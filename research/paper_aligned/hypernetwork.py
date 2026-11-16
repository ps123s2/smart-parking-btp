"""Temporal Modeling with GRU and Learnable Hypernetwork for Policy Generation.

Faithfully implements the adaptive meta-learning strategy described in:
Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution
Approach to On-Street Parking Search Navigation," Sensors 2025, 25(8), 2389.
- GRU Temporal Meta-Representation (Section 4.4, Eq. 6)
- Learnable Hypernetwork for Agent-Specific Parameters (Section 4.4, Eq. 7)
- Personalized Policy Network with Continuous Action Scaling (Section 4.4, Eq. 8)
"""

import math
from typing import Dict, List, Optional, Tuple, Union

import torch
import torch.nn as nn
import torch.nn.functional as F


# ----------------------------------------------------------------------------
# 1. Agent Temporal GRU (Section 4.4, Eq. 6)
# ----------------------------------------------------------------------------

class AgentTemporalGRU(nn.Module):
    """Gated Recurrent Unit (GRU) capturing regional historical temporal dynamics.

    Tracks temporal demand variations, day-of-week trends, and historical failure rates
    for each individual parking facility agent c_i.
    Mathematical Formulation:
        H_t^i = GRU( H_{t-1}^i, [x_t^i || a_{t-1}^i] )  (Eq. 6)
    """

    def __init__(
        self,
        node_feat_dim: int = 32,
        action_dim: int = 1,
        gru_hidden_dim: int = 64,
    ):
        super().__init__()
        self.node_feat_dim = node_feat_dim
        self.action_dim = action_dim
        self.gru_hidden_dim = gru_hidden_dim

        # Input dimension: node feature x_t^i concatenated with prior action a_{t-1}^i
        in_dim = node_feat_dim + action_dim
        self.gru_cell = nn.GRUCell(in_dim, gru_hidden_dim)
        self._init_weights()

    def _init_weights(self) -> None:
        for name, param in self.gru_cell.named_parameters():
            if "weight_ih" in name:
                nn.init.orthogonal_(param)
            elif "weight_hh" in name:
                nn.init.orthogonal_(param)
            elif "bias" in name:
                nn.init.constant_(param, 0.0)

    def forward_step(
        self,
        x_t: torch.Tensor,
        a_prev: torch.Tensor,
        h_prev: torch.Tensor,
    ) -> torch.Tensor:
        """Single step forward for all agents.

        Args:
            x_t: Current spatial features per agent (B, num_agents, node_feat_dim).
            a_prev: Previous action per agent (B, num_agents, action_dim).
            h_prev: Previous GRU hidden states (B, num_agents, gru_hidden_dim).

        Returns:
            h_new: Updated meta-features H_t^i (B, num_agents, gru_hidden_dim).
        """
        B, N, D = x_t.shape
        # Flatten batch and agent dimensions to process through GRUCell
        gru_in = torch.cat([x_t, a_prev], dim=-1)  # (B, N, D + action_dim)
        flat_in = gru_in.view(B * N, -1)
        flat_h = h_prev.view(B * N, -1)

        flat_h_new = self.gru_cell(flat_in, flat_h)
        h_new = flat_h_new.view(B, N, self.gru_hidden_dim)
        return h_new


# ----------------------------------------------------------------------------
# 2. Learnable Hypernetwork (Section 4.4, Eq. 7)
# ----------------------------------------------------------------------------

class PolicyHypernetwork(nn.Module):
    """Learnable Hypernetwork G generating agent-specific policy parameters.

    Maps extracted temporal meta-features H_t^i to personalized policy weights
    W_{G,t}^i and biases b_{G,t}^i for each agent c_i (Section 4.4).
    Mathematical Formulation:
        W_{G,t}^i = G_w(H_t^i),  b_{G,t}^i = G_b(H_t^i)  (Eq. 7)
    """

    def __init__(
        self,
        gru_hidden_dim: int = 64,
        policy_in_dim: int = 32,
        policy_out_dim: int = 1,
        hyper_hidden_dim: int = 64,
    ):
        super().__init__()
        self.gru_hidden_dim = gru_hidden_dim
        self.policy_in_dim = policy_in_dim
        self.policy_out_dim = policy_out_dim
        self.total_weights_needed = policy_in_dim * policy_out_dim

        # Shared trunk
        self.trunk = nn.Sequential(
            nn.Linear(gru_hidden_dim, hyper_hidden_dim),
            nn.ReLU(),
        )

        # Weight generator G_w
        self.g_w = nn.Linear(hyper_hidden_dim, self.total_weights_needed)
        # Bias generator G_b
        self.g_b = nn.Linear(hyper_hidden_dim, policy_out_dim)

        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.trunk:
            if isinstance(m, nn.Linear):
                nn.init.orthogonal_(m.weight, gain=math.sqrt(2))
                nn.init.constant_(m.bias, 0.0)
        # Small weights for initial stability
        nn.init.orthogonal_(self.g_w.weight, gain=0.01)
        nn.init.constant_(self.g_w.bias, 0.0)
        nn.init.orthogonal_(self.g_b.weight, gain=0.01)
        nn.init.constant_(self.g_b.bias, 0.0)

    def forward(
        self,
        H_t: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Generates agent-specific policy weights and biases.

        Args:
            H_t: Temporal meta-features (B, num_agents, gru_hidden_dim).

        Returns:
            W_G: Generated weights (B, num_agents, policy_out_dim, policy_in_dim).
            b_G: Generated biases (B, num_agents, policy_out_dim).
        """
        B, N, _ = H_t.shape
        flat_H = H_t.view(B * N, self.gru_hidden_dim)
        hid = self.trunk(flat_H)

        flat_w = self.g_w(hid)  # (B * N, policy_in_dim * policy_out_dim)
        flat_b = self.g_b(hid)  # (B * N, policy_out_dim)

        W_G = flat_w.view(B, N, self.policy_out_dim, self.policy_in_dim)
        b_G = flat_b.view(B, N, self.policy_out_dim)
        return W_G, b_G


# ----------------------------------------------------------------------------
# 3. Personalized Agent Policy (Section 4.4, Eq. 8)
# ----------------------------------------------------------------------------

class PersonalizedAgentPolicy(nn.Module):
    """Executes the individualized decision-making strategy for each agent c_i.

    Mathematical Formulation:
        a_t^i = u_t^i(x_t^i) = Sigmoid( W_{G,t}^i * phi(x_t^i) + b_{G,t}^i ) * kappa  (Eq. 8)
    where:
        phi(x_t^i) is a learnable latent projection,
        kappa is a continuous scaling factor adjusting the allocation priority.
    """

    def __init__(
        self,
        node_feat_dim: int = 32,
        policy_in_dim: int = 32,
        action_dim: int = 1,
        kappa: float = 1.0,
    ):
        super().__init__()
        self.node_feat_dim = node_feat_dim
        self.policy_in_dim = policy_in_dim
        self.action_dim = action_dim
        self.kappa = kappa

        # Learnable transformation phi(x_t^i) (Section 4.4)
        self.phi = nn.Sequential(
            nn.Linear(node_feat_dim, policy_in_dim),
            nn.Tanh(),
        )
        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.phi:
            if isinstance(m, nn.Linear):
                nn.init.orthogonal_(m.weight, gain=1.0)
                nn.init.constant_(m.bias, 0.0)

    def forward(
        self,
        x_t: torch.Tensor,
        W_G: torch.Tensor,
        b_G: torch.Tensor,
    ) -> torch.Tensor:
        """Forward evaluation of personalized allocation action.

        Args:
            x_t: Node features per agent (B, num_agents, node_feat_dim).
            W_G: Hypernetwork-generated weights (B, num_agents, action_dim, policy_in_dim).
            b_G: Hypernetwork-generated biases (B, num_agents, action_dim).

        Returns:
            a_t: Continuous action values in [0, kappa] of shape (B, num_agents, action_dim).
        """
        B, N, _ = x_t.shape

        # 1. Transform features via phi: (B, N, policy_in_dim)
        phi_x = self.phi(x_t)

        # 2. Dynamic batch matrix multiplication: W_G @ phi_x + b_G
        # phi_x is (B, N, policy_in_dim, 1)
        phi_x_unsqueezed = phi_x.unsqueeze(-1)
        # W_G is (B, N, action_dim, policy_in_dim)
        # Matmul result: (B, N, action_dim, 1) -> squeeze to (B, N, action_dim)
        act_logits = torch.matmul(W_G, phi_x_unsqueezed).squeeze(-1) + b_G

        # 3. Sigmoid activation scaled by kappa (Eq. 8)
        a_t = torch.sigmoid(act_logits) * self.kappa
        return a_t
