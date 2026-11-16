"""Multi-Agent Deep Deterministic Policy Gradient (MADDPG) and CTDE Framework.

Faithfully implements the multi-agent actor-critic training pipeline described in:
Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution
Approach to On-Street Parking Search Navigation," Sensors 2025, 25(8), 2389.
- Centralized Training with Decentralized Execution (CTDE) (Section 4.1, 4.6)
- Centralized Action-Value Evaluator Q_u(H_t) (Section 4.6, Eq. 17)
- Joint Reinforcement Learning and Graph Contrastive Learning Objective (Section 4.6, Eq. 18)
- Experience Replay Buffer with Sequence Replay and Recurrent Temporal State Support
- Twin Critics (TD3-style Clipped Double-Q) and Gradient Norm Regularization for Stabilization
"""

from collections import deque
import random
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from research.paper_aligned.graph_network import (
    TwoStageGATLayer,
    HeterogeneousGraphPooling,
    GraphContrastiveLearningLoss,
)
from research.paper_aligned.hypernetwork import (
    AgentTemporalGRU,
    PolicyHypernetwork,
    PersonalizedAgentPolicy,
)


# ----------------------------------------------------------------------------
# 1. Centralized Action-Value Evaluator Q_u(H_t) (Section 4.6, Eqs. 17-18)
# ----------------------------------------------------------------------------

class CentralizedEvaluator(nn.Module):
    """Centralized action-value function Q_u(H_t, A_t) shared across all agents.

    Evaluates joint action utility conditioned on global pooled heterogeneous graph
    representation H_t = [s_O || s_F] (Section 4.6).
    Mathematical Formulation:
        Q_u(H_t, A_t) -> R  (Eqs. 17-18)
    """

    def __init__(
        self,
        global_state_dim: int = 64,  # H = [s_O || s_F], each 32 -> 64
        num_agents: int = 9,
        action_dim: int = 1,
        hidden_dim: int = 128,
    ):
        super().__init__()
        self.global_state_dim = global_state_dim
        self.num_agents = num_agents
        self.action_dim = action_dim
        self.total_action_dim = num_agents * action_dim

        in_dim = global_state_dim + self.total_action_dim

        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )
        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.net:
            if isinstance(m, nn.Linear):
                nn.init.orthogonal_(m.weight, gain=1.0)
                nn.init.constant_(m.bias, 0.0)

    def forward(
        self,
        H_t: torch.Tensor,
        joint_actions: torch.Tensor,
    ) -> torch.Tensor:
        """Evaluates centralized Q-value.

        Args:
            H_t: Global pooled state representation (B, global_state_dim).
            joint_actions: Actions of all agents (B, num_agents, action_dim) or (B, total_action_dim).

        Returns:
            Q_val: Estimated joint return (B, 1).
        """
        B = H_t.shape[0]
        flat_actions = joint_actions.view(B, -1)
        q_in = torch.cat([H_t, flat_actions], dim=-1)
        q_val = self.net(q_in)
        return q_val


# ----------------------------------------------------------------------------
# 2. Multi-Agent Replay Buffer with Sequence Replay Support
# ----------------------------------------------------------------------------

class MultiAgentReplayBuffer:
    """Experience replay buffer D storing graph state-transition tuples and episode sequences.

    Supports:
        - Flat uniform transition sampling (s, a, r, s', done)
        - Sequential trajectory sampling (preserving recurrent GRU hidden states)
    """

    def __init__(self, capacity: int = 10000, device: torch.device = torch.device("cpu")):
        self.capacity = capacity
        self.device = device
        self.buffer: deque = deque(maxlen=capacity)
        # Sequence storage: list of completed episode trajectories
        self.episodes: List[List[Dict[str, Any]]] = []
        self.current_episode: List[Dict[str, Any]] = []

    def store(
        self,
        node_feats: np.ndarray,
        adj: np.ndarray,
        actions: np.ndarray,
        reward: float,
        next_node_feats: np.ndarray,
        next_adj: np.ndarray,
        done: bool,
        h_state: Optional[np.ndarray] = None,
    ) -> None:
        """Appends a transition to the flat buffer and tracking episode trajectory."""
        transition = {
            "node_feats": node_feats,
            "adj": adj,
            "actions": actions,
            "reward": reward,
            "next_node_feats": next_node_feats,
            "next_adj": next_adj,
            "done": done,
            "h_state": h_state,
        }
        self.buffer.append((
            node_feats,
            adj,
            actions,
            reward,
            next_node_feats,
            next_adj,
            done,
        ))

        self.current_episode.append(transition)
        if done:
            if len(self.current_episode) >= 4:
                self.episodes.append(self.current_episode)
                if len(self.episodes) > 100:
                    self.episodes.pop(0)
            self.current_episode = []

    def sample(
        self,
        batch_size: int,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        """Uniformly samples a batch of transitions."""
        batch = random.sample(self.buffer, batch_size)
        node_feats_b, adj_b, actions_b, reward_b, next_node_feats_b, next_adj_b, done_b = zip(*batch)

        t_node_feats = torch.tensor(np.array(node_feats_b), dtype=torch.float32, device=self.device)
        t_adj = torch.tensor(np.array(adj_b), dtype=torch.float32, device=self.device)
        t_actions = torch.tensor(np.array(actions_b), dtype=torch.float32, device=self.device)
        t_reward = torch.tensor(np.array(reward_b), dtype=torch.float32, device=self.device).unsqueeze(-1)
        t_next_node_feats = torch.tensor(np.array(next_node_feats_b), dtype=torch.float32, device=self.device)
        t_next_adj = torch.tensor(np.array(next_adj_b), dtype=torch.float32, device=self.device)
        t_done = torch.tensor(np.array(done_b), dtype=torch.float32, device=self.device).unsqueeze(-1)

        return t_node_feats, t_adj, t_actions, t_reward, t_next_node_feats, t_next_adj, t_done

    def sample_sequences(
        self,
        batch_size: int,
        seq_len: int = 8,
    ) -> Optional[List[Dict[str, torch.Tensor]]]:
        """Samples contiguous sub-sequences of length seq_len from recorded episodes.

        Returns:
            List of transition dictionaries containing tensors of shape (B, ...),
            or None if insufficient episodes are recorded.
        """
        valid_episodes = [ep for ep in self.episodes if len(ep) >= seq_len]
        if len(valid_episodes) < 2:
            return None

        sampled_subseqs = []
        for _ in range(batch_size):
            ep = random.choice(valid_episodes)
            start_idx = random.randint(0, len(ep) - seq_len)
            subseq = ep[start_idx : start_idx + seq_len]
            sampled_subseqs.append(subseq)

        # Transpose to list of time-step batches
        time_step_batches = []
        for t in range(seq_len):
            step_transitions = [subseq[t] for subseq in sampled_subseqs]
            node_feats_b = np.array([tr["node_feats"] for tr in step_transitions])
            adj_b = np.array([tr["adj"] for tr in step_transitions])
            actions_b = np.array([tr["actions"] for tr in step_transitions])
            reward_b = np.array([tr["reward"] for tr in step_transitions])
            next_node_feats_b = np.array([tr["next_node_feats"] for tr in step_transitions])
            next_adj_b = np.array([tr["next_adj"] for tr in step_transitions])
            done_b = np.array([tr["done"] for tr in step_transitions])

            # Initial hidden state at start of subsequence if available
            init_h_b = None
            if t == 0 and step_transitions[0]["h_state"] is not None:
                init_h_b = torch.tensor(
                    np.array([tr["h_state"] for tr in step_transitions]),
                    dtype=torch.float32,
                    device=self.device,
                )

            step_dict = {
                "node_feats": torch.tensor(node_feats_b, dtype=torch.float32, device=self.device),
                "adj": torch.tensor(adj_b, dtype=torch.float32, device=self.device),
                "actions": torch.tensor(actions_b, dtype=torch.float32, device=self.device),
                "reward": torch.tensor(reward_b, dtype=torch.float32, device=self.device).unsqueeze(-1),
                "next_node_feats": torch.tensor(next_node_feats_b, dtype=torch.float32, device=self.device),
                "next_adj": torch.tensor(next_adj_b, dtype=torch.float32, device=self.device),
                "done": torch.tensor(done_b, dtype=torch.float32, device=self.device).unsqueeze(-1),
                "init_h": init_h_b,
            }
            time_step_batches.append(step_dict)

        return time_step_batches

    def __len__(self) -> int:
        return len(self.buffer)


# ----------------------------------------------------------------------------
# 3. Complete Paper-Aligned MADDPG Trainer (CTDE)
# ----------------------------------------------------------------------------

class MADDPGTrainer:
    """Orchestrates Centralized Training with Decentralized Execution.

    Integrates:
        - Two-Stage GAT for spatial feature enhancement (X = W_p * G^c, Eq. 9).
        - HGP for global representation pooling (H = [s_O || s_F], Eq. 14).
        - GCL InfoNCE auxiliary loss (L_c, Eq. 16).
        - GRU + Hypernetwork for personalized agent policy weights (Eqs. 6-8).
        - Twin Critics with Clipped Double-Q (TD3 style) for training stabilization.
        - Gradient Norm Regularization preventing Q-value explosion.
    """

    def __init__(
        self,
        num_facilities: int = 9,
        node_feat_dim: int = 8,
        spatial_dim: int = 32,
        gru_hidden_dim: int = 64,
        action_dim: int = 1,
        gamma: float = 0.99,
        tau: float = 0.01,
        lr_actor: float = 1e-4,
        lr_critic: float = 3e-4,
        lambda_cl: float = 0.1,  # Weight for contrastive loss (Eq. 18)
        kappa: float = 1.0,      # Action priority scale (Eq. 8)
        device: torch.device = torch.device("cpu"),
        # Stabilization Parameters
        use_twin_critic: bool = True,
        clip_grad_norm: float = 5.0,
        reward_scale: float = 0.1,
        policy_noise: float = 0.1,
        noise_clip: float = 0.2,
    ):
        self.num_facilities = num_facilities
        self.node_feat_dim = node_feat_dim
        self.spatial_dim = spatial_dim
        self.gru_hidden_dim = gru_hidden_dim
        self.action_dim = action_dim
        self.gamma = gamma
        self.tau = tau
        self.lambda_cl = lambda_cl
        self.kappa = kappa
        self.device = device

        self.use_twin_critic = use_twin_critic
        self.clip_grad_norm = clip_grad_norm
        self.reward_scale = reward_scale
        self.policy_noise = policy_noise
        self.noise_clip = noise_clip

        # 1. Spatial & Representation Modules
        self.gat = TwoStageGATLayer(node_feat_dim, spatial_dim).to(device)
        self.hgp = HeterogeneousGraphPooling(spatial_dim, k_h=5, num_dynamic_agents=6, num_fixed_agents=3).to(device)
        self.gcl = GraphContrastiveLearningLoss(embed_dim=2 * spatial_dim).to(device)

        # 2. Temporal Core & Meta-Policy Hypernetwork
        self.temporal_gru = AgentTemporalGRU(spatial_dim, action_dim, gru_hidden_dim).to(device)
        self.hypernetwork = PolicyHypernetwork(gru_hidden_dim, spatial_dim, action_dim).to(device)
        self.actor = PersonalizedAgentPolicy(spatial_dim, spatial_dim, action_dim, kappa=kappa).to(device)

        # Target Actor Components
        self.target_gat = TwoStageGATLayer(node_feat_dim, spatial_dim).to(device)
        self.target_temporal_gru = AgentTemporalGRU(spatial_dim, action_dim, gru_hidden_dim).to(device)
        self.target_hypernetwork = PolicyHypernetwork(gru_hidden_dim, spatial_dim, action_dim).to(device)
        self.target_actor = PersonalizedAgentPolicy(spatial_dim, spatial_dim, action_dim, kappa=kappa).to(device)
        self._hard_update_actor_targets()

        # 3. Centralized Action-Value Evaluators (Critic 1 and Twin Critic 2)
        self.critic1 = CentralizedEvaluator(
            global_state_dim=2 * spatial_dim,
            num_agents=num_facilities,
            action_dim=action_dim,
        ).to(device)
        self.critic2 = CentralizedEvaluator(
            global_state_dim=2 * spatial_dim,
            num_agents=num_facilities,
            action_dim=action_dim,
        ).to(device)
        # Backward compatibility alias
        self.critic = self.critic1

        self.target_critic1 = CentralizedEvaluator(
            global_state_dim=2 * spatial_dim,
            num_agents=num_facilities,
            action_dim=action_dim,
        ).to(device)
        self.target_critic2 = CentralizedEvaluator(
            global_state_dim=2 * spatial_dim,
            num_agents=num_facilities,
            action_dim=action_dim,
        ).to(device)
        self.target_critic = self.target_critic1

        self.target_critic1.load_state_dict(self.critic1.state_dict())
        self.target_critic2.load_state_dict(self.critic2.state_dict())

        # 4. Optimizers
        self.actor_params = (
            list(self.gat.parameters()) +
            list(self.temporal_gru.parameters()) +
            list(self.hypernetwork.parameters()) +
            list(self.actor.parameters())
        )
        self.critic_params = (
            list(self.critic1.parameters()) +
            list(self.critic2.parameters()) +
            list(self.hgp.parameters()) +
            list(self.gcl.parameters())
        )
        self.actor_optimizer = torch.optim.Adam(self.actor_params, lr=lr_actor)
        self.critic_optimizer = torch.optim.Adam(self.critic_params, lr=lr_critic)

    def _hard_update_actor_targets(self) -> None:
        """Copies primary actor network weights into target networks."""
        self.target_gat.load_state_dict(self.gat.state_dict())
        self.target_temporal_gru.load_state_dict(self.temporal_gru.state_dict())
        self.target_hypernetwork.load_state_dict(self.hypernetwork.state_dict())
        self.target_actor.load_state_dict(self.actor.state_dict())

    def _soft_update(self, net: nn.Module, target_net: nn.Module) -> None:
        """Polyak soft parameter update: theta' <- tau * theta + (1 - tau) * theta'."""
        for param, target_param in zip(net.parameters(), target_net.parameters()):
            target_param.data.copy_(self.tau * param.data + (1.0 - self.tau) * target_param.data)

    def select_actions(
        self,
        node_feats: torch.Tensor,
        adj: torch.Tensor,
        h_prev: torch.Tensor,
        a_prev: torch.Tensor,
        explore_noise: float = 0.0,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Decentralized execution of allocation policy for each agent c_i."""
        self.gat.eval()
        self.temporal_gru.eval()
        self.hypernetwork.eval()
        self.actor.eval()

        with torch.no_grad():
            X, _ = self.gat(node_feats, adj)
            h_new = self.temporal_gru.forward_step(X, a_prev, h_prev)
            W_G, b_G = self.hypernetwork(h_new)
            actions = self.actor(X, W_G, b_G)

            if explore_noise > 0.0:
                noise = torch.randn_like(actions) * explore_noise
                actions = torch.clamp(actions + noise, min=0.0, max=self.kappa)

        return actions, h_new

    def train_step(
        self,
        replay_buffer: MultiAgentReplayBuffer,
        batch_size: int = 32,
    ) -> Dict[str, float]:
        """Performs a stabilized joint MADDPG + GCL optimization step."""
        if len(replay_buffer) < batch_size:
            return {
                "critic_loss": 0.0,
                "bellman_loss": 0.0,
                "contrastive_loss": 0.0,
                "actor_loss": 0.0,
                "q_mean": 0.0,
                "q_std": 0.0,
                "target_q_mean": 0.0,
                "critic_grad_norm": 0.0,
                "actor_grad_norm": 0.0,
            }

        # 1. Sample batch
        node_feats, adj, actions, reward, next_node_feats, next_adj, done = replay_buffer.sample(batch_size)

        # Scale reward
        scaled_reward = reward * self.reward_scale

        # --------------------------------------------------------------------
        # Critic Training (Eq. 18 with Twin Critics)
        # --------------------------------------------------------------------
        self.critic_optimizer.zero_grad()

        # Compute next target actions A_{t+1} via target actors
        with torch.no_grad():
            next_X, _ = self.target_gat(next_node_feats, next_adj)
            dummy_h = torch.zeros(batch_size, self.num_facilities, self.gru_hidden_dim, device=self.device)
            next_h = self.target_temporal_gru.forward_step(next_X, actions, dummy_h)
            next_W_G, next_b_G = self.target_hypernetwork(next_h)
            next_actions = self.target_actor(next_X, next_W_G, next_b_G)

            # Target action smoothing (TD3 principle)
            if self.policy_noise > 0.0:
                noise = (torch.randn_like(next_actions) * self.policy_noise).clamp(-self.noise_clip, self.noise_clip)
                next_actions = torch.clamp(next_actions + noise, 0.0, self.kappa)

            next_H, _, _ = self.hgp(next_X)
            if self.use_twin_critic:
                target_Q1 = self.target_critic1(next_H, next_actions)
                target_Q2 = self.target_critic2(next_H, next_actions)
                target_Q = torch.min(target_Q1, target_Q2)
            else:
                target_Q = self.target_critic1(next_H, next_actions)

            y_t = scaled_reward + (1.0 - done) * self.gamma * target_Q

        # Current Q evaluation
        with torch.no_grad():
            X_curr, _ = self.gat(node_feats, adj)
        H_t, _, _ = self.hgp(X_curr)

        if self.use_twin_critic:
            current_Q1 = self.critic1(H_t, actions)
            current_Q2 = self.critic2(H_t, actions)
            loss_c1 = F.mse_loss(current_Q1, y_t)
            loss_c2 = F.mse_loss(current_Q2, y_t)
            bellman_loss = loss_c1 + loss_c2
            q_eval = current_Q1
        else:
            current_Q1 = self.critic1(H_t, actions)
            bellman_loss = F.mse_loss(current_Q1, y_t)
            q_eval = current_Q1

        # Auxiliary Graph Contrastive Learning loss L_c (Eq. 16)
        H_pos = H_t + 0.02 * torch.randn_like(H_t)
        K_neg = min(4, batch_size - 1)
        neg_list = [torch.roll(H_t, shifts=i + 1, dims=0) for i in range(K_neg)]
        H_neg = torch.stack(neg_list, dim=1)
        contrastive_loss = self.gcl(H_t, H_pos, H_neg)

        # Joint loss (Eq. 18)
        total_critic_loss = bellman_loss + self.lambda_cl * contrastive_loss
        total_critic_loss.backward()

        # Gradient clipping for critic
        if self.clip_grad_norm > 0.0:
            critic_norm = float(torch.nn.utils.clip_grad_norm_(self.critic_params, self.clip_grad_norm))
        else:
            critic_norm = 0.0
        self.critic_optimizer.step()

        # --------------------------------------------------------------------
        # Actor Training (Eq. 17)
        # --------------------------------------------------------------------
        self.actor_optimizer.zero_grad()

        X_actor, _ = self.gat(node_feats, adj)
        h_dummy = torch.zeros(batch_size, self.num_facilities, self.gru_hidden_dim, device=self.device)
        h_actor = self.temporal_gru.forward_step(X_actor, actions, h_dummy)
        W_G_act, b_G_act = self.hypernetwork(h_actor)
        pred_actions = self.actor(X_actor, W_G_act, b_G_act)

        H_actor, _, _ = self.hgp(X_actor)
        actor_q = self.critic1(H_actor, pred_actions)
        actor_loss = -torch.mean(actor_q)

        actor_loss.backward()
        if self.clip_grad_norm > 0.0:
            actor_norm = float(torch.nn.utils.clip_grad_norm_(self.actor_params, self.clip_grad_norm))
        else:
            actor_norm = 0.0
        self.actor_optimizer.step()

        # --------------------------------------------------------------------
        # Target Network Soft Updates
        # --------------------------------------------------------------------
        self._soft_update(self.gat, self.target_gat)
        self._soft_update(self.temporal_gru, self.target_temporal_gru)
        self._soft_update(self.hypernetwork, self.target_hypernetwork)
        self._soft_update(self.actor, self.target_actor)
        self._soft_update(self.critic1, self.target_critic1)
        if self.use_twin_critic:
            self._soft_update(self.critic2, self.target_critic2)

        return {
            "critic_loss": float(total_critic_loss.item()),
            "bellman_loss": float(bellman_loss.item()),
            "contrastive_loss": float(contrastive_loss.item()),
            "actor_loss": float(actor_loss.item()),
            "q_mean": float(q_eval.mean().item()),
            "q_std": float(q_eval.std().item()),
            "target_q_mean": float(target_Q.mean().item()),
            "critic_grad_norm": float(critic_norm),
            "actor_grad_norm": float(actor_norm),
        }

    def train_step_sequence(
        self,
        replay_buffer: MultiAgentReplayBuffer,
        batch_size: int = 8,
        seq_len: int = 8,
    ) -> Dict[str, float]:
        """Performs a multi-step recurrent sequential MADDPG update unrolling GRU hidden states."""
        seq_batch = replay_buffer.sample_sequences(batch_size=batch_size, seq_len=seq_len)
        if seq_batch is None:
            # Fall back to single-step transition
            return self.train_step(replay_buffer, batch_size=batch_size)

        total_bellman = 0.0
        total_actor_loss = 0.0
        total_contrastive = 0.0

        # Initialize hidden state
        first_step = seq_batch[0]
        if first_step["init_h"] is not None:
            h_state = first_step["init_h"]
        else:
            h_state = torch.zeros(batch_size, self.num_facilities, self.gru_hidden_dim, device=self.device)

        prev_actions = torch.zeros(batch_size, self.num_facilities, self.action_dim, device=self.device)

        self.critic_optimizer.zero_grad()
        self.actor_optimizer.zero_grad()

        for t in range(seq_len):
            step_data = seq_batch[t]
            node_feats = step_data["node_feats"]
            adj = step_data["adj"]
            actions = step_data["actions"]
            reward = step_data["reward"] * self.reward_scale
            next_node_feats = step_data["next_node_feats"]
            next_adj = step_data["next_adj"]
            done = step_data["done"]

            # Spatial GAT
            X, _ = self.gat(node_feats, adj)
            h_state = self.temporal_gru.forward_step(X, prev_actions, h_state)
            prev_actions = actions

            # Critic step
            H_t, _, _ = self.hgp(X.detach())
            with torch.no_grad():
                next_X, _ = self.target_gat(next_node_feats, next_adj)
                next_h = self.target_temporal_gru.forward_step(next_X, actions, h_state.detach())
                next_W, next_b = self.target_hypernetwork(next_h)
                next_act = self.target_actor(next_X, next_W, next_b)
                next_H, _, _ = self.hgp(next_X)
                if self.use_twin_critic:
                    tq = torch.min(self.target_critic1(next_H, next_act), self.target_critic2(next_H, next_act))
                else:
                    tq = self.target_critic1(next_H, next_act)
                y_t = reward + (1.0 - done) * self.gamma * tq

            q1 = self.critic1(H_t, actions)
            step_bellman = F.mse_loss(q1, y_t)
            if self.use_twin_critic:
                q2 = self.critic2(H_t, actions)
                step_bellman = step_bellman + F.mse_loss(q2, y_t)

            total_bellman = total_bellman + step_bellman

            # Contrastive
            H_pos = H_t + 0.02 * torch.randn_like(H_t)
            K_neg = min(4, batch_size - 1)
            neg_list = [torch.roll(H_t, shifts=i + 1, dims=0) for i in range(K_neg)]
            H_neg = torch.stack(neg_list, dim=1)
            step_cl = self.gcl(H_t, H_pos, H_neg)
            total_contrastive = total_contrastive + step_cl

            # Actor step
            W_G, b_G = self.hypernetwork(h_state)
            pred_act = self.actor(X, W_G, b_G)
            H_act, _, _ = self.hgp(X)
            act_q = self.critic1(H_act, pred_act)
            step_actor = -torch.mean(act_q)
            total_actor_loss = total_actor_loss + step_actor

            # Detach h_state for next step truncation (TBPTT)
            h_state = h_state.detach()

        avg_critic_loss = (total_bellman + self.lambda_cl * total_contrastive) / seq_len
        avg_actor_loss = total_actor_loss / seq_len

        # Backward passes before optimizer step
        avg_critic_loss.backward(retain_graph=True)
        avg_actor_loss.backward()

        if self.clip_grad_norm > 0.0:
            c_norm = float(torch.nn.utils.clip_grad_norm_(self.critic_params, self.clip_grad_norm))
            a_norm = float(torch.nn.utils.clip_grad_norm_(self.actor_params, self.clip_grad_norm))
        else:
            c_norm = 0.0
            a_norm = 0.0

        self.critic_optimizer.step()
        self.actor_optimizer.step()

        # Target updates
        self._soft_update(self.gat, self.target_gat)
        self._soft_update(self.temporal_gru, self.target_temporal_gru)
        self._soft_update(self.hypernetwork, self.target_hypernetwork)
        self._soft_update(self.actor, self.target_actor)
        self._soft_update(self.critic1, self.target_critic1)
        if self.use_twin_critic:
            self._soft_update(self.critic2, self.target_critic2)

        return {
            "critic_loss": float(avg_critic_loss.item()),
            "bellman_loss": float((total_bellman / seq_len).item()),
            "contrastive_loss": float((total_contrastive / seq_len).item()),
            "actor_loss": float(avg_actor_loss.item()),
            "q_mean": float(q1.mean().item()),
            "q_std": float(q1.std().item()),
            "target_q_mean": float(y_t.mean().item()),
            "critic_grad_norm": float(c_norm),
            "actor_grad_norm": float(a_norm),
        }
