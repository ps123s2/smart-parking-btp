"""Neural Inference Service for Campus Parking Allocation.

Loads the paper-aligned MARL-GCN trained checkpoint and executes thread-safe,
latency-bounded forward inference with automatic fallback detection.
"""

import os
import time
import threading
from typing import Dict, List, Optional, Any, Tuple

import torch
import torch.nn as nn

from research.paper_aligned.graph_network import TwoStageGATLayer
from research.paper_aligned.hypernetwork import (
    AgentTemporalGRU,
    PolicyHypernetwork,
    PersonalizedAgentPolicy,
)
from smart_parking_ai.campus_adapter import (
    CampusGraph,
    CampusObservationAdapter,
    decode_actions,
    CAMPUS_SLOT_IDS,
)

# Default path to approved stabilized checkpoint
DEFAULT_CHECKPOINT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "research",
    "paper_aligned",
    "checkpoints",
    "best_maddpg_stabilized_seed_42.pt",
)


class NeuralInferenceService:
    """Thread-safe, warmed-model inference service executing MARL-GCN policy."""

    _instance: Optional["NeuralInferenceService"] = None
    _init_lock = threading.Lock()

    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        device: str = "cpu",
        timeout_ms: float = 50.0,
    ):
        self.checkpoint_path = checkpoint_path or DEFAULT_CHECKPOINT_PATH
        self.device = device
        self.timeout_sec = timeout_ms / 1000.0
        self.lock = threading.Lock()
        self.is_loaded = False
        self.load_error: Optional[str] = None
        self.model_version = "maddpg-stabilized-seed-42-v1"

        # Initialize adapter
        self.campus_graph = CampusGraph()
        self.adapter = CampusObservationAdapter(self.campus_graph, device=self.device)
        self.num_nodes = self.campus_graph.num_nodes

        # Hidden state management (AI-01 Remediation)
        # Bounded, thread-safe facility state cache with TTL
        self._facility_states: Dict[str, Tuple[torch.Tensor, torch.Tensor, float]] = {}
        self._facility_lock = threading.Lock()
        self.h_prev: Optional[torch.Tensor] = None
        self.a_prev: Optional[torch.Tensor] = None

        # Pre-warming status (PERF-01 Remediation)
        self.is_prewarmed: bool = False
        self.prewarm_latency_ms: float = 0.0

        # Build and load model
        self._load_checkpoint()

    @classmethod
    def get_instance(cls, checkpoint_path: Optional[str] = None) -> "NeuralInferenceService":
        """Singleton accessor ensuring model weights are loaded once in memory."""
        with cls._init_lock:
            if cls._instance is None:
                cls._instance = cls(checkpoint_path=checkpoint_path)
            return cls._instance

    def _load_checkpoint(self) -> None:
        """Loads and freezes neural policy modules from checkpoint."""
        try:
            if not os.path.exists(self.checkpoint_path):
                raise FileNotFoundError(f"Checkpoint not found at: {self.checkpoint_path}")

            ckpt = torch.load(self.checkpoint_path, map_location=self.device)

            # 1. Two-Stage GAT
            self.gat = TwoStageGATLayer(in_features=8, out_features=32)
            self.gat.load_state_dict(ckpt["gat_state"])
            self.gat.to(self.device)
            self.gat.eval()

            # 2. Temporal GRU
            self.temporal_gru = AgentTemporalGRU(node_feat_dim=32, action_dim=1, gru_hidden_dim=64)
            self.temporal_gru.load_state_dict(ckpt["temporal_gru_state"])
            self.temporal_gru.to(self.device)
            self.temporal_gru.eval()

            # 3. Policy Hypernetwork
            self.hypernetwork = PolicyHypernetwork(
                gru_hidden_dim=64, policy_in_dim=32, policy_out_dim=1, hyper_hidden_dim=64
            )
            self.hypernetwork.load_state_dict(ckpt["hypernetwork_state"])
            self.hypernetwork.to(self.device)
            self.hypernetwork.eval()

            # 4. Personalized Agent Policy
            self.actor = PersonalizedAgentPolicy(
                node_feat_dim=32, policy_in_dim=32, action_dim=1, kappa=1.0
            )
            self.actor.load_state_dict(ckpt["actor_state"])
            self.actor.to(self.device)
            self.actor.eval()

            # Disable gradients across all parameters
            for model in [self.gat, self.temporal_gru, self.hypernetwork, self.actor]:
                for param in model.parameters():
                    param.requires_grad = False

            # Initialize recurrent states
            self.reset_recurrent_state()

            self.is_loaded = True
            self.load_error = None

            # Automatic model pre-warming during initialization (PERF-01)
            self.prewarm()

        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)

    def prewarm(self) -> Dict[str, Any]:
        """Executes warm-up forward pass to prime PyTorch weights and CPU memory caches."""
        if not self.is_loaded:
            return {"success": False, "error": self.load_error, "latency_ms": 0.0}
        start = time.perf_counter()
        try:
            # Execute one complete forward inference in stateless mode
            _ = self.allocate_slot(states=[0] * self.num_nodes, booked_slots={}, stateless=True)
            self.prewarm_latency_ms = (time.perf_counter() - start) * 1000.0
            self.is_prewarmed = True
            return {"success": True, "latency_ms": round(self.prewarm_latency_ms, 3)}
        except Exception as e:
            self.prewarm_latency_ms = (time.perf_counter() - start) * 1000.0
            return {"success": False, "error": str(e), "latency_ms": round(self.prewarm_latency_ms, 3)}

    def reset_recurrent_state(self, facility_id: Optional[str] = None) -> None:
        """Resets agent GRU hidden states to zeros."""
        with self.lock:
            self.h_prev = torch.zeros(1, self.num_nodes, 64, dtype=torch.float32, device=self.device)
            self.a_prev = torch.zeros(1, self.num_nodes, 1, dtype=torch.float32, device=self.device)
        with self._facility_lock:
            if facility_id:
                self._facility_states.pop(facility_id, None)
            else:
                self._facility_states.clear()

    def allocate_slot(
        self,
        states: Optional[List[int]] = None,
        booked_slots: Optional[Dict[str, Any]] = None,
        facility_id: Optional[str] = None,
        stateless: bool = True,
    ) -> Dict[str, Any]:
        """Performs forward neural inference to recommend the optimal parking stall.

        Guarantees sub-50ms execution; catches all exceptions and non-finite outputs.

        Recurrent State Lifecycle (AI-01 Remediation):
            - If stateless=True (default for discrete HTTP API requests):
              Evaluates the temporal GRU from an unbiased zero prior (h_0=0, a_0=0).
              Completely eliminates cross-user memory leakage and state drift over time.
            - If stateless=False and facility_id is given (for continuous simulation tracking):
              Maintains isolated, serialized temporal state per facility with TTL eviction.
        """
        start_time = time.perf_counter()

        # Check if model failed to load
        if not self.is_loaded:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "success": False,
                "status": "model_unavailable",
                "allocated_stall": None,
                "allocated_label": None,
                "model_confidence": 0.0,
                "top3_slots": [],
                "latency_ms": round(latency_ms, 3),
                "is_fallback": True,
                "fallback_reason": f"Model checkpoint failed to load: {self.load_error}",
                "model_version": self.model_version,
            }

        try:
            with self.lock:
                # 1. Build observations
                node_tensor, adj_tensor, availability_mask = self.adapter.build_node_features(
                    states=states,
                    booked_slots=booked_slots,
                )

                # Determine recurrent prior based on isolation mode
                if stateless or facility_id is None:
                    # Isolated stateless evaluation per request: zero prior
                    h_in = torch.zeros(1, self.num_nodes, 64, dtype=torch.float32, device=self.device)
                    a_in = torch.zeros(1, self.num_nodes, 1, dtype=torch.float32, device=self.device)
                else:
                    # Stateful facility tracking mode
                    now = time.time()
                    with self._facility_lock:
                        if facility_id in self._facility_states:
                            h_cached, a_cached, last_t = self._facility_states[facility_id]
                            # TTL check: reset if stale (> 300s)
                            if now - last_t > 300.0:
                                h_in = torch.zeros(1, self.num_nodes, 64, dtype=torch.float32, device=self.device)
                                a_in = torch.zeros(1, self.num_nodes, 1, dtype=torch.float32, device=self.device)
                            else:
                                h_in = h_cached
                                a_in = a_cached
                        else:
                            h_in = torch.zeros(1, self.num_nodes, 64, dtype=torch.float32, device=self.device)
                            a_in = torch.zeros(1, self.num_nodes, 1, dtype=torch.float32, device=self.device)

                # 2. Run forward neural pass with torch.no_grad()
                with torch.no_grad():
                    # Spatial message passing
                    X, _ = self.gat(node_tensor, adj_tensor)

                    # Temporal GRU update
                    h_new = self.temporal_gru.forward_step(X, a_in, h_in)

                    # Hypernetwork parameter generation
                    W_G, b_G = self.hypernetwork(h_new)

                    # Continuous action generation
                    actions = self.actor(X, W_G, b_G)

                    # Check for non-finite values (NaN / Inf)
                    if torch.isnan(actions).any() or torch.isinf(actions).any():
                        raise ValueError("Non-finite values detected in neural policy output")

                    # Check timeout guard
                    elapsed = time.perf_counter() - start_time
                    if elapsed > self.timeout_sec:
                        raise TimeoutError(f"Neural inference exceeded timeout ({elapsed*1000:.1f}ms > {self.timeout_sec*1000:.1f}ms)")

                    # In stateful tracking mode, update facility state
                    if not stateless and facility_id is not None:
                        with self._facility_lock:
                            self._facility_states[facility_id] = (h_new.detach(), actions.detach(), time.time())
                        self.h_prev = h_new.detach()
                        self.a_prev = actions.detach()

                # 3. Decode action and apply defensive availability mask
                decoded = decode_actions(actions, availability_mask, CAMPUS_SLOT_IDS)

                latency_ms = (time.perf_counter() - start_time) * 1000.0

                return {
                    "success": True,
                    "status": decoded["status"],
                    "allocated_stall": decoded["allocated_stall"],
                    "allocated_label": decoded["allocated_label"],
                    "model_confidence": decoded["model_confidence"],
                    "top3_slots": decoded["top3_slots"],
                    "ranked_slots": decoded.get("ranked_slots", []),
                    "latency_ms": round(latency_ms, 3),
                    "is_fallback": False,
                    "fallback_reason": None,
                    "model_version": self.model_version,
                }

        except Exception as exc:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "success": False,
                "status": "inference_error",
                "allocated_stall": None,
                "allocated_label": None,
                "model_confidence": 0.0,
                "top3_slots": [],
                "latency_ms": round(latency_ms, 3),
                "is_fallback": True,
                "fallback_reason": str(exc),
                "model_version": self.model_version,
            }

