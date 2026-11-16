"""Campus Graph and Observation Adapter for Stage 8 Integration.

Bridges the real-world campus parking facility (IIIT Sri City layout)
with the paper-aligned MARL-GCN neural architecture.
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import torch

# Verified Campus Parking Layout Constants (from smart_parking_ai/models/gnn.py and types/parking.ts)
CAMPUS_SLOT_IDS = ["slot1", "slot2", "slot3", "slot4", "slot5"]
CAMPUS_SLOT_LABELS = {
    "slot1": "A1",
    "slot2": "A2",
    "slot3": "A3",
    "slot4": "B1",
    "slot5": "B2",
}
# Measured walking/driving distances from parking entrance (meters)
CAMPUS_SLOT_DISTANCES_METERS = {
    "slot1": 85.0,
    "slot2": 70.0,
    "slot3": 85.0,
    "slot4": 55.0,
    "slot5": 35.0,
}
# Nominal capacity per physical stall (1 stall = 1 parking space)
CAMPUS_STALL_CAPACITIES = [1, 1, 1, 1, 1]


class TopologyMismatchError(ValueError):
    """Raised when an input topology does not conform to the authoritative 5-stall layout."""
    pass


class CampusGraph:
    """Graph topology representing the physical campus parking facility."""

    def __init__(self, slot_ids: Optional[List[str]] = None):
        ids = slot_ids or CAMPUS_SLOT_IDS
        self.validate_slot_ids(ids)
        self.slot_ids = ids
        self.num_nodes = len(self.slot_ids)
        self.slot_to_idx = {slot_id: i for i, slot_id in enumerate(self.slot_ids)}
        self.distances = CAMPUS_SLOT_DISTANCES_METERS
        self.adjacency_matrix = self._construct_adjacency()

    @staticmethod
    def validate_slot_ids(slot_ids: List[str]) -> None:
        """Validates that stall identifiers conform strictly to authoritative topology."""
        if len(slot_ids) != 5:
            raise TopologyMismatchError(
                f"Campus topology error: expected exactly 5 stalls ({CAMPUS_SLOT_IDS}), "
                f"but received {len(slot_ids)} stalls: {slot_ids}"
            )
        # Check duplicate identifiers
        if len(set(slot_ids)) != len(slot_ids):
            raise TopologyMismatchError(
                f"Campus topology error: duplicate stall identifiers detected: {slot_ids}"
            )
        # Check unknown identifiers
        unknown = [s for s in slot_ids if s not in CAMPUS_SLOT_IDS]
        if unknown:
            raise TopologyMismatchError(
                f"Campus topology error: unknown stall identifier(s) {unknown}. "
                f"Authoritative layout only supports {CAMPUS_SLOT_IDS}."
            )

    def _construct_adjacency(self) -> np.ndarray:
        """Constructs adjacency matrix based on campus aisle connectivity.

        Aisle A: slot1 (A1) <-> slot2 (A2) <-> slot3 (A3)
        Aisle B: slot4 (B1) <-> slot5 (B2)
        Cross-aisle connection: slot2 (A2) <-> slot5 (B2) via central aisle
        Self-loops: Added for GAT self-attention.
        """
        N = self.num_nodes
        adj = np.eye(N, dtype=np.float32)  # Self-loops

        edges = [
            ("slot1", "slot2"),  # A1 <-> A2
            ("slot2", "slot3"),  # A2 <-> A3
            ("slot4", "slot5"),  # B1 <-> B2
            ("slot2", "slot5"),  # A2 <-> B2 (Cross-aisle connection)
        ]

        for u, v in edges:
            if u in self.slot_to_idx and v in self.slot_to_idx:
                i, j = self.slot_to_idx[u], self.slot_to_idx[v]
                adj[i, j] = 1.0
                adj[j, i] = 1.0

        return adj


class CampusObservationAdapter:
    """Translates raw Firebase states & requests into normalized model observations."""

    def __init__(self, graph: Optional[CampusGraph] = None, device: str = "cpu"):
        self.graph = graph or CampusGraph()
        self.device = device
        self.num_nodes = self.graph.num_nodes
        self.last_anomalies: List[str] = []

    def validate_topology(
        self,
        slot_ids: Optional[List[str]] = None,
        states: Optional[List[int]] = None,
        booked_slots: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Explicitly validates campus topology, failing closed on any discrepancy (TOP-01)."""
        if slot_ids is not None:
            CampusGraph.validate_slot_ids(slot_ids)

        if states is not None:
            if len(states) > self.num_nodes:
                raise TopologyMismatchError(
                    f"⚠️ [TOPOLOGY REJECTED] Received {len(states)} stall states, exceeding authoritative "
                    f"campus layout of {self.num_nodes} stalls ({self.graph.slot_ids}). "
                    f"Silently truncating excess stalls is prohibited; failing closed."
                )
            elif 0 < len(states) < self.num_nodes:
                raise TopologyMismatchError(
                    f"⚠️ [TOPOLOGY REJECTED] Received {len(states)} stall states; expected exactly {self.num_nodes} "
                    f"stalls ({self.graph.slot_ids}). Incomplete stall telemetry cannot be safely reconciled."
                )

        if booked_slots:
            for s_id in booked_slots:
                if s_id not in self.graph.slot_to_idx:
                    raise TopologyMismatchError(
                        f"⚠️ [TOPOLOGY REJECTED] Unrecognized slot ID '{s_id}' in booked_slots; "
                        f"authoritative layout only supports {self.graph.slot_ids}. Failing closed."
                    )

    def build_node_features(
        self,
        states: Optional[List[int]] = None,
        booked_slots: Optional[Dict[str, Any]] = None,
        request_location: Optional[Tuple[float, float]] = None,
        cruising_counts: Optional[List[int]] = None,
        predicted_demands: Optional[List[float]] = None,
        previous_actions: Optional[List[float]] = None,
        strict_topology: bool = False,
    ) -> Tuple[torch.Tensor, torch.Tensor, List[bool]]:
        """Constructs standardized 8-dimensional node feature tensor for GAT.

        Feature Vector Format (8 dimensions):
            0: Normalized stall index i / (N - 1)
            1: Normalized stall capacity (1.0 / 120.0, matching municipal normalization)
            2: Occupancy ratio (1.0 if occupied/booked, 0.0 if vacant)
            3: Normalized travel time ETA (distance / walking speed / 60.0)
            4: Normalized cruising count (target count / 50.0)
            5: Normalized demand forecast (0.0 to 1.0)
            6: Normalized distance to request
            7: Previous action priority value in [0, 1]

        Returns:
            node_tensor: Shape (1, N, 8) float32 tensor
            adj_tensor: Shape (1, N, N) float32 tensor
            availability_mask: List of booleans (True = available, False = unavailable)
        """
        booked_dict = booked_slots or {}
        self.last_anomalies = []

        if strict_topology:
            self.validate_topology(states=states, booked_slots=booked_dict)

        # Explicit Topology Reconciliation (TOP-01 Remediation)
        # Check for slot count anomalies
        if states is not None and len(states) > self.num_nodes:
            anomaly = (
                f"⚠️ [TOPOLOGY ANOMALY] Received {len(states)} stall states, but authoritative campus "
                f"topology defines {self.num_nodes} stalls ({self.graph.slot_ids}). Extra states beyond "
                f"index {self.num_nodes-1} will be safely dropped."
            )
            self.last_anomalies.append(anomaly)
            print(anomaly)
        elif states is not None and 0 < len(states) < self.num_nodes:
            anomaly = (
                f"⚠️ [TOPOLOGY ANOMALY] Received {len(states)} stall states; expected {self.num_nodes}. "
                f"Missing stalls will default to occupied/unavailable (fail-safe)."
            )
            self.last_anomalies.append(anomaly)
            print(anomaly)

        # Check for unrecognized slot keys in booked_slots
        for s_id in booked_dict:
            if s_id not in self.graph.slot_to_idx:
                anomaly = (
                    f"⚠️ [TOPOLOGY ANOMALY] Unrecognized slot ID '{s_id}' in booked_slots; "
                    f"authoritative layout only supports {self.graph.slot_ids}."
                )
                self.last_anomalies.append(anomaly)
                print(anomaly)

        # Handle missing, short, or invalid states safely
        clean_states: List[int] = []
        if states is None or len(states) == 0:
            clean_states = [0] * self.num_nodes
        else:
            for i in range(self.num_nodes):
                if i < len(states):
                    val = 1 if states[i] == 1 else 0
                else:
                    # Missing stall sensor data fails closed (occupied) for safety
                    val = 1
                clean_states.append(val)

        availability_mask: List[bool] = []
        feats: List[List[float]] = []

        walking_speed_mps = 1.4  # ~5 km/h

        for i, slot_id in enumerate(self.graph.slot_ids):
            # Check physical sensor occupancy
            is_physically_occupied = (clean_states[i] == 1)
            # Check active booking in Firebase
            booking_info = booked_dict.get(slot_id, {})
            is_booked = isinstance(booking_info, dict) and booking_info.get("status") == "active"

            is_unavailable = is_physically_occupied or is_booked
            availability_mask.append(not is_unavailable)

            occ_ratio = 1.0 if is_unavailable else 0.0
            dist_m = self.graph.distances.get(slot_id, 50.0)
            eta_min = (dist_m / walking_speed_mps) / 60.0
            norm_eta = min(eta_min / 60.0, 1.0)

            cruising = (float(cruising_counts[i]) / 50.0) if (cruising_counts and i < len(cruising_counts)) else 0.0
            demand = (float(predicted_demands[i]) / 100.0) if (predicted_demands and i < len(predicted_demands)) else 0.1
            norm_dist = min(dist_m / 200.0, 1.0)
            prev_act = float(previous_actions[i]) if (previous_actions and i < len(previous_actions)) else 0.0

            feat_vec = [
                float(i) / max(self.num_nodes - 1, 1),
                1.0 / 120.0,   # 1 stall normalized by municipal scale 120
                occ_ratio,
                norm_eta,
                cruising,
                demand,
                norm_dist,
                prev_act,
            ]
            feats.append(feat_vec)

        node_tensor = torch.tensor(feats, dtype=torch.float32, device=self.device).unsqueeze(0)
        adj_tensor = torch.tensor(self.graph.adjacency_matrix, dtype=torch.float32, device=self.device).unsqueeze(0)

        return node_tensor, adj_tensor, availability_mask


def decode_actions(
    action_tensor: torch.Tensor,
    availability_mask: List[bool],
    slot_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Decodes continuous policy priority scores into discrete stall allocations.

    Applies defensive action masking: unavailable stalls receive priority -inf.

    Args:
        action_tensor: Continuous priority tensor of shape (1, N, 1) or (N,).
        availability_mask: Boolean mask (True = vacant, False = occupied/booked).
        slot_ids: Optional list of slot IDs (default CAMPUS_SLOT_IDS).

    Returns:
        Dict containing best_slot, best_label, top3_slots, ranked_slots, and status.
    """
    slots = slot_ids or CAMPUS_SLOT_IDS
    scores = action_tensor.squeeze().detach().cpu().numpy().tolist()
    if isinstance(scores, float):
        scores = [scores]

    ranked_available = []
    masked_scores = {}

    for i, slot_id in enumerate(slots):
        raw_score = float(scores[i]) if i < len(scores) else 0.0
        is_avail = availability_mask[i] if i < len(availability_mask) else False
        if is_avail:
            masked_score = raw_score
            ranked_available.append((slot_id, CAMPUS_SLOT_LABELS.get(slot_id, slot_id), masked_score))
        else:
            masked_score = -float("inf")
        masked_scores[slot_id] = masked_score

    # Sort available stalls descending by neural priority score
    ranked_available.sort(key=lambda x: x[2], reverse=True)

    if not ranked_available:
        return {
            "status": "no_available_stalls",
            "allocated_stall": None,
            "allocated_label": None,
            "model_confidence": 0.0,
            "top3_slots": [],
            "ranked_slots": [],
            "masked_scores": masked_scores,
        }

    best_slot, best_label, best_score = ranked_available[0]
    top3 = [s[0] for s in ranked_available[:3]]

    return {
        "status": "success",
        "allocated_stall": best_slot,
        "allocated_label": best_label,
        "model_confidence": round(float(best_score), 4),
        "top3_slots": top3,
        "ranked_slots": [{"slot_id": s[0], "label": s[1], "score": round(s[2], 4)} for s in ranked_available],
        "masked_scores": masked_scores,
    }

