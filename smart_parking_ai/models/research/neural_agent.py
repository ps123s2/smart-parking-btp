"""Neural Agent implementation for Smart Parking Research.

Defines the frozen 24,420-parameter Spatial-GRU Actor-Critic model,
Recurrent Rollout Buffer with 4-way GAE boundary handling,
PPO Trainer with decoupled arrival-conditioned objectives,
and NeuralParkingPolicy adhering strictly to the BasePolicy interface.

Reference:
    Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution
    Approach to On-Street Parking Search Navigation," Sensors, 2025, 25(8), 2389.
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

from smart_parking_ai.models.research.baselines import BasePolicy


# ============================================================================
# 1. RECURRENT ACTOR-CRITIC ARCHITECTURE (24,420 Trainable Parameters)
# ============================================================================

class RecurrentActorCritic(nn.Module):
    """Frozen Spatial-GRU Actor-Critic network for Campus Parking Allocation.

    Architecture:
        - Input: 18-element state vector
            obs[0:10]:   Physical stall features (occupancy flags + normalized dwell)
            obs[10:15]:  Global features (zone occupancy ratios + progress + arrival flag + pending dwell)
            obs[15:18]:  Dynamic action mask [M_0, M_1, M_2]
        - Spatial Encoder: Linear(10, 32) + ReLU  (352 params)
        - Concatenation:   32 (spatial) + 5 (global) = 37 features
        - Recurrent Core:  GRUCell(37, 64)        (19,776 params)
        - Actor Head:      Linear(64, 32) + ReLU + Linear(32, 3) (2,179 params)
        - Critic Head:     Linear(64, 32) + ReLU + Linear(32, 1) (2,113 params)
        - Total Parameters: 352 + 19,776 + 2,179 + 2,113 = 24,420.
    """

    def __init__(
        self,
        obs_dim: int = 18,
        action_dim: int = 3,
        hidden_dim: int = 64,
        spatial_in_dim: int = 10,
        spatial_out_dim: int = 32,
    ):
        super().__init__()
        self.obs_dim = obs_dim
        self.action_dim = action_dim
        self.hidden_dim = hidden_dim
        self.spatial_in_dim = spatial_in_dim
        self.spatial_out_dim = spatial_out_dim

        # 1. Spatial Encoder: 10 -> 32
        # Params: 10 * 32 + 32 = 352
        self.spatial_encoder = nn.Linear(spatial_in_dim, spatial_out_dim)

        # 2. Recurrent Core: GRUCell(37, 64)
        # Input: 32 (spatial) + 5 (global: obs[10:15]) = 37
        # Params: 3 * (37 * 64 + 64 * 64 + 64 + 64) = 19,776
        gru_input_dim = spatial_out_dim + 5
        self.gru = nn.GRUCell(gru_input_dim, hidden_dim)

        # 3. Actor Head: 64 -> 32 -> 3
        # Layer 1: 64 * 32 + 32 = 2,080
        # Layer 2: 32 * 3 + 3 = 99
        # Total Actor: 2,179
        self.actor_fc1 = nn.Linear(hidden_dim, 32)
        self.actor_fc2 = nn.Linear(32, action_dim)

        # 4. Critic Head: 64 -> 32 -> 1
        # Layer 1: 64 * 32 + 32 = 2,080
        # Layer 2: 32 * 1 + 1 = 33
        # Total Critic: 2,113
        self.critic_fc1 = nn.Linear(hidden_dim, 32)
        self.critic_fc2 = nn.Linear(32, 1)

        self._init_weights()

    def _init_weights(self) -> None:
        """Applies orthogonal initialization for stable recurrent policy optimization."""
        for m in [self.spatial_encoder, self.actor_fc1, self.critic_fc1]:
            nn.init.orthogonal_(m.weight, gain=math.sqrt(2))
            nn.init.constant_(m.bias, 0.0)

        # Actor output layer initialized with smaller gain for uniform initial exploration
        nn.init.orthogonal_(self.actor_fc2.weight, gain=0.01)
        nn.init.constant_(self.actor_fc2.bias, 0.0)

        # Critic output layer
        nn.init.orthogonal_(self.critic_fc2.weight, gain=1.0)
        nn.init.constant_(self.critic_fc2.bias, 0.0)

        # GRU orthogonal initialization
        for name, param in self.gru.named_parameters():
            if "weight_ih" in name:
                nn.init.orthogonal_(param)
            elif "weight_hh" in name:
                nn.init.orthogonal_(param)
            elif "bias" in name:
                nn.init.constant_(param, 0.0)

    def forward_step(
        self,
        obs: torch.Tensor,
        h_prev: torch.Tensor,
        action_mask: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Executes a single causal forward step through the recurrent architecture.

        Args:
            obs: (B, 18) observation tensor.
            h_prev: (B, 64) recurrent hidden state from previous step.
            action_mask: Optional (B, 3) binary mask. If None, sliced from obs[..., 15:18].

        Returns:
            masked_logits: (B, 3) action logits with invalid actions masked to -inf.
            value: (B, 1) estimated state value.
            h_new: (B, 64) updated recurrent hidden state.
        """
        # Slicing: stall features [0:10], global features [10:15], mask [15:18]
        stall_feats = obs[..., :10]
        global_feats = obs[..., 10:15]

        if action_mask is None:
            mask = obs[..., 15:18]
        else:
            mask = action_mask

        # Defensive action-mask assertion: every transition MUST have >= 1 valid action
        assert mask.bool().any(dim=-1).all(), (
            "Defensive check failed: action_mask contains an all-zero vector! "
            f"Received mask:\n{mask}"
        )

        # 1. Spatial Encoding: Linear(10, 32) + ReLU
        z_spatial = F.relu(self.spatial_encoder(stall_feats))

        # 2. Concatenation: (B, 37)
        gru_in = torch.cat([z_spatial, global_feats], dim=-1)

        # 3. Recurrent Update: GRUCell(37, 64)
        h_new = self.gru(gru_in, h_prev)

        # 4. Actor Head: 64 -> 32 -> 3
        a_hid = F.relu(self.actor_fc1(h_new))
        raw_logits = self.actor_fc2(a_hid)

        # Hard -inf masking for invalid actions
        masked_logits = raw_logits.masked_fill(~mask.bool(), float("-inf"))

        # 5. Critic Head: 64 -> 32 -> 1
        c_hid = F.relu(self.critic_fc1(h_new))
        value = self.critic_fc2(c_hid)

        return masked_logits, value, h_new


# ============================================================================
# 2. RECURRENT ROLLOUT BUFFER WITH 4-WAY GAE BOUNDARY HANDLING
# ============================================================================

class RecurrentRolloutBuffer:
    """Stores sequential transitions for recurrent PPO training with decoupled GAE.

    Maintains 4-way boundary classification:
        1. Natural Horizon Termination:  terminated=True,  truncated=False -> b_t=0, c_t=0, V_next=0.0
        2. Genuine Artificial Truncation: terminated=False, truncated=True  -> b_t=1, c_t=0, V_next=V(s_final)
        3. Rollout Buffer Edge Cutoff:    buffer full, ongoing episode      -> b_t=1, c_t=0, V_next=V(s_next)
        4. Ordinary Transition:           terminated=False, truncated=False -> b_t=1, c_t=1, V_next=V(s_next)

    Arrival Detection:
        Always uses obs[13] == 1.0 (never obs[14]).
    """

    def __init__(
        self,
        capacity: int,
        obs_dim: int = 18,
        action_dim: int = 3,
        hidden_dim: int = 64,
        gamma: float = 0.99,
        gae_lambda: float = 0.95,
        device: torch.device = torch.device("cpu"),
    ):
        self.capacity = capacity
        self.obs_dim = obs_dim
        self.action_dim = action_dim
        self.hidden_dim = hidden_dim
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.device = device

        self.reset()

    def reset(self) -> None:
        """Clears buffer and resets storage pointers."""
        self.observations = torch.zeros((self.capacity, self.obs_dim), dtype=torch.float32, device=self.device)
        self.next_observations = torch.zeros((self.capacity, self.obs_dim), dtype=torch.float32, device=self.device)
        self.actions = torch.zeros(self.capacity, dtype=torch.long, device=self.device)
        self.rewards = torch.zeros(self.capacity, dtype=torch.float32, device=self.device)
        self.log_probs = torch.zeros(self.capacity, dtype=torch.float32, device=self.device)
        self.action_masks = torch.zeros((self.capacity, self.action_dim), dtype=torch.int32, device=self.device)
        self.values = torch.zeros(self.capacity, dtype=torch.float32, device=self.device)
        self.next_values = torch.zeros(self.capacity, dtype=torch.float32, device=self.device)
        self.hidden_states = torch.zeros((self.capacity, self.hidden_dim), dtype=torch.float32, device=self.device)

        self.terminated = torch.zeros(self.capacity, dtype=torch.bool, device=self.device)
        self.truncated = torch.zeros(self.capacity, dtype=torch.bool, device=self.device)
        self.is_arrival = torch.zeros(self.capacity, dtype=torch.bool, device=self.device)
        self.buffer_edge = torch.zeros(self.capacity, dtype=torch.bool, device=self.device)

        self.advantages = torch.zeros(self.capacity, dtype=torch.float32, device=self.device)
        self.returns = torch.zeros(self.capacity, dtype=torch.float32, device=self.device)
        self.normalized_advantages = torch.zeros(self.capacity, dtype=torch.float32, device=self.device)

        self.ptr = 0
        self.is_full = False

    def store(
        self,
        obs: Union[np.ndarray, torch.Tensor],
        action: int,
        reward: float,
        next_obs: Union[np.ndarray, torch.Tensor],
        log_prob: float,
        action_mask: Union[np.ndarray, torch.Tensor],
        value: float,
        next_value: float,
        h_prev: torch.Tensor,
        terminated: bool,
        truncated: bool,
        buffer_edge: bool = False,
    ) -> None:
        """Stores a transition. Arrival detection strictly uses obs[13] > 0.5."""
        if self.ptr >= self.capacity:
            raise IndexError("RecurrentRolloutBuffer overflow: capacity exceeded!")

        if isinstance(obs, np.ndarray):
            obs_t = torch.as_tensor(obs, dtype=torch.float32, device=self.device)
        else:
            obs_t = obs.to(device=self.device, dtype=torch.float32)

        if isinstance(next_obs, np.ndarray):
            next_obs_t = torch.as_tensor(next_obs, dtype=torch.float32, device=self.device)
        else:
            next_obs_t = next_obs.to(device=self.device, dtype=torch.float32)

        if isinstance(action_mask, np.ndarray):
            mask_t = torch.as_tensor(action_mask, dtype=torch.int32, device=self.device)
        else:
            mask_t = action_mask.to(device=self.device, dtype=torch.int32)

        # Arrival detection strictly uses obs[13]
        arrival_flag = bool(obs_t[13].item() > 0.5)

        self.observations[self.ptr] = obs_t
        self.next_observations[self.ptr] = next_obs_t
        self.actions[self.ptr] = int(action)
        self.rewards[self.ptr] = float(reward)
        self.log_probs[self.ptr] = float(log_prob)
        self.action_masks[self.ptr] = mask_t
        self.values[self.ptr] = float(value)
        self.next_values[self.ptr] = float(next_value)
        self.hidden_states[self.ptr] = h_prev.squeeze(0).to(device=self.device, dtype=torch.float32)

        self.terminated[self.ptr] = bool(terminated)
        self.truncated[self.ptr] = bool(truncated)
        self.is_arrival[self.ptr] = arrival_flag
        self.buffer_edge[self.ptr] = bool(buffer_edge)

        self.ptr += 1
        if self.ptr == self.capacity:
            self.is_full = True

    def compute_gae(self) -> None:
        """Computes Generalized Advantage Estimation with decoupled bootstrap and trace masks."""
        n = self.ptr
        last_gae = 0.0

        for t in reversed(range(n)):
            is_term = self.terminated[t].item()
            is_trunc = self.truncated[t].item()
            is_edge = self.buffer_edge[t].item()

            # 4-Way Boundary Masking
            if is_term:
                # Natural termination: no bootstrap, no trace continuation
                bootstrap_mask = 0.0
                trace_mask = 0.0
            elif is_trunc:
                # Artificial truncation: bootstrap from V(s_final), trace stops
                bootstrap_mask = 1.0
                trace_mask = 0.0
            elif is_edge:
                # Rollout buffer capacity limit: bootstrap from V(s_next), trace stops
                bootstrap_mask = 1.0
                trace_mask = 0.0
            else:
                # Ordinary step within episode
                bootstrap_mask = 1.0
                trace_mask = 1.0

            r_t = self.rewards[t].item()
            v_t = self.values[t].item()
            v_next = self.next_values[t].item()

            delta_t = r_t + self.gamma * bootstrap_mask * v_next - v_t
            last_gae = delta_t + self.gamma * self.gae_lambda * trace_mask * last_gae

            self.advantages[t] = last_gae
            self.returns[t] = last_gae + v_t

        # Arrival-Only Advantage Normalization with Edge-Case Guards
        arrival_mask = self.is_arrival[:n]
        n_arrivals = int(arrival_mask.sum().item())

        if n_arrivals > 1:
            arr_advs = self.advantages[:n][arrival_mask]
            mean_adv = arr_advs.mean()
            std_adv = arr_advs.std() + 1e-8
            self.normalized_advantages[:n] = 0.0
            self.normalized_advantages[:n][arrival_mask] = (arr_advs - mean_adv) / std_adv
        elif n_arrivals == 1:
            # Single-arrival safeguard: avoid division by zero std
            arr_advs = self.advantages[:n][arrival_mask]
            self.normalized_advantages[:n] = 0.0
            self.normalized_advantages[:n][arrival_mask] = arr_advs - arr_advs.mean()
        else:
            # Zero-arrival safeguard
            self.normalized_advantages[:n] = 0.0


# ============================================================================
# 3. PPO TRAINER (Decoupled Arrival Losses, Whole-Episode Recurrent BPTT)
# ============================================================================

class PPOTrainer:
    """Proximal Policy Optimization trainer for RecurrentActorCritic.

    Core Principles:
        - Whole-Episode Unrolling: trajectories start with h_{-1} = 0.
        - Decoupled Arrival Actor Loss: L_clip evaluates only on is_arrival=True.
        - Decoupled Arrival Entropy: L_ent evaluates only on is_arrival=True.
        - All-Transition Critic Loss: L_V evaluates across all valid steps t.
        - Recurrent BPTT: Gradients from arrival actor loss propagate through
          preceding idle GRU hidden states.
        - Zero-Arrival Guard: Bypasses actor/entropy optimization if a batch
          contains 0 arrival decisions.
    """

    def __init__(
        self,
        model: RecurrentActorCritic,
        lr: float = 3e-4,
        clip_eps: float = 0.2,
        vf_coef: float = 0.5,
        ent_coef: float = 0.01,
        max_grad_norm: float = 0.5,
        device: torch.device = torch.device("cpu"),
    ):
        self.model = model.to(device)
        self.lr = lr
        self.clip_eps = clip_eps
        self.vf_coef = vf_coef
        self.ent_coef = ent_coef
        self.max_grad_norm = max_grad_norm
        self.device = device

        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=lr, eps=1e-5)

    def train_trajectory(
        self,
        obs_seq: torch.Tensor,
        action_seq: torch.Tensor,
        old_log_probs: torch.Tensor,
        norm_adv_seq: torch.Tensor,
        returns_seq: torch.Tensor,
        masks_seq: torch.Tensor,
        is_arrival_seq: torch.Tensor,
    ) -> Dict[str, float]:
        """Performs a single recurrent PPO gradient update on an unbroken trajectory.

        Args:
            obs_seq: (T, 18) sequence of observations.
            action_seq: (T,) chosen actions.
            old_log_probs: (T,) rollout log-probabilities.
            norm_adv_seq: (T,) normalized advantages.
            returns_seq: (T,) target return values.
            masks_seq: (T, 3) action masks.
            is_arrival_seq: (T,) boolean arrival indicators.

        Returns:
            metrics: Dict containing loss values and gradient telemetry.
        """
        self.model.train()
        t_len = obs_seq.size(0)

        # Whole-episode recurrent unrolling starting with h_{-1} = 0
        h = torch.zeros(1, self.model.hidden_dim, dtype=torch.float32, device=self.device)
        logits_list: List[torch.Tensor] = []
        values_list: List[torch.Tensor] = []

        for t in range(t_len):
            step_obs = obs_seq[t:t+1]
            step_mask = masks_seq[t:t+1]
            m_logits, val, h = self.model.forward_step(step_obs, h, step_mask)
            logits_list.append(m_logits)
            values_list.append(val)

        all_logits = torch.cat(logits_list, dim=0)   # (T, 3)
        all_values = torch.cat(values_list, dim=0).squeeze(-1) # (T,)

        # 1. Critic Loss: covers ALL valid transitions
        critic_loss = F.mse_loss(all_values, returns_seq)

        # 2. Actor and Entropy Losses: ARRIVAL-ONLY
        n_arrivals = int(is_arrival_seq.sum().item())

        if n_arrivals == 0:
            # Zero-arrival batch safeguard
            actor_loss = torch.tensor(0.0, device=self.device)
            entropy_loss = torch.tensor(0.0, device=self.device)
            total_loss = self.vf_coef * critic_loss
            approx_kl = 0.0
            clip_frac = 0.0
        else:
            arr_indices = is_arrival_seq.nonzero(as_tuple=True)[0]
            arr_logits = all_logits[arr_indices]
            arr_actions = action_seq[arr_indices]
            arr_old_log_probs = old_log_probs[arr_indices]
            arr_advantages = norm_adv_seq[arr_indices]

            dist = Categorical(logits=arr_logits)
            new_log_probs = dist.log_prob(arr_actions)
            entropy = dist.entropy().mean()

            log_ratio = new_log_probs - arr_old_log_probs
            ratio = torch.exp(log_ratio)

            surr1 = ratio * arr_advantages
            surr2 = torch.clamp(ratio, 1.0 - self.clip_eps, 1.0 + self.clip_eps) * arr_advantages
            actor_loss = -torch.min(surr1, surr2).mean()

            entropy_loss = -entropy
            total_loss = actor_loss + self.vf_coef * critic_loss + self.ent_coef * entropy_loss

            with torch.no_grad():
                approx_kl = ((ratio - 1.0) - log_ratio).mean().item()
                clip_frac = (torch.abs(ratio - 1.0) > self.clip_eps).float().mean().item()

        # Optimization Step
        self.optimizer.zero_grad()
        total_loss.backward()
        grad_norm = nn.utils.clip_grad_norm_(self.model.parameters(), self.max_grad_norm).item()
        self.optimizer.step()

        return {
            "total_loss": total_loss.item(),
            "actor_loss": actor_loss.item(),
            "critic_loss": critic_loss.item(),
            "entropy_loss": entropy_loss.item(),
            "approx_kl": float(approx_kl),
            "clip_frac": float(clip_frac),
            "grad_norm": float(grad_norm),
            "n_arrivals": n_arrivals,
        }


# ============================================================================
# 4. NEURAL PARKING POLICY (Strict BasePolicy Adapter Compatibility)
# ============================================================================

class NeuralParkingPolicy(BasePolicy):
    """Deep Recurrent Neural Policy adapter adhering strictly to BasePolicy.

    Interface:
        select_action(observation: np.ndarray, action_mask: np.ndarray) -> int
        reset() -> None

    Guarantees:
        - Processes EVERY simulator step through the GRU, including idle transitions.
        - Updates recurrent hidden state unconditionally on every step.
        - Evaluates dynamic action mask on every step with hard -inf logit masking.
        - Zero modifications required to sim_env.py or baselines.py.
    """

    def __init__(
        self,
        model: RecurrentActorCritic,
        deterministic: bool = True,
        device: str = "cpu",
    ):
        self.model = model
        self.deterministic = deterministic
        self.device = torch.device(device)
        self.model.to(self.device)
        self.hidden_state: Optional[torch.Tensor] = None
        self.reset()

    @property
    def name(self) -> str:
        mode = "Deterministic" if self.deterministic else "Stochastic"
        return f"Neural-PPO-GRU ({mode})"

    def reset(self) -> None:
        """Lifecycle hook called at episode onset. Initializes GRU hidden state to zeros."""
        self.hidden_state = torch.zeros(1, self.model.hidden_dim, dtype=torch.float32, device=self.device)

    def select_action(self, observation: np.ndarray, action_mask: np.ndarray) -> int:
        """Selects an action for the current simulator step.

        Args:
            observation: Standardized 18-element float32 observation vector.
            action_mask: 3-element int array [M_0, M_1, M_2].

        Returns:
            action: 0 (Zone A), 1 (Zone B), or 2 (Abstract Overflow Fallback).
        """
        obs_t = torch.as_tensor(observation, dtype=torch.float32, device=self.device).unsqueeze(0)
        mask_t = torch.as_tensor(action_mask, dtype=torch.int32, device=self.device).unsqueeze(0)

        self.model.eval()
        with torch.no_grad():
            masked_logits, value, h_new = self.model.forward_step(obs_t, self.hidden_state, mask_t)

            # Recurrent state MUST update on every simulator step
            self.hidden_state = h_new

            if self.deterministic:
                action = int(torch.argmax(masked_logits, dim=-1).item())
            else:
                dist = Categorical(logits=masked_logits)
                action = int(dist.sample().item())

        return action

