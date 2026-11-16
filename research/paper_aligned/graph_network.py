"""Dynamic Heterogeneous Graph, Two-Stage GAT, HGP, and GCL Modules.

Faithfully implements the graph architecture described in:
Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution
Approach to On-Street Parking Search Navigation," Sensors 2025, 25(8), 2389.
- Dynamic Heterogeneous Graph Construction (Section 4.3, 4.5.1)
- Two-Stage Graph Attention Network (GAT) (Section 4.3, Eq. 9)
- Heterogeneous Graph Pooling (HGP) (Section 4.5.1, Eqs. 10-14)
- Graph Contrastive Learning (GCL) with InfoNCE Loss (Section 4.5.2, Eqs. 15-16)
"""

import math
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


# ----------------------------------------------------------------------------
# 1. Dynamic Heterogeneous Parking Graph Representation
# ----------------------------------------------------------------------------

class DynamicHeterogeneousParkingGraph:
    """Represents the dynamic heterogeneous urban parking network G = (V, E).

    Nodes V: Parking facilities c_i in I = [I_o, I_n].
        - Node Features (per facility):
          [unique_id_norm, capacity, current_occupancy_ratio, eta_minutes,
           cruising_vehicles_count, predicted_future_demand, distance_to_request]
    Edges E: Adjacency and spatial proximity between facilities across regional partitions.
    Multi-view Graph G^c: Aggregates agent observations and dynamic actions (Section 4.5.1).
    """

    def __init__(
        self,
        num_facilities: int = 9,
        node_feat_dim: int = 8,
        districts: Optional[List[str]] = None,
        capacities: Optional[List[int]] = None,
        distance_matrix: Optional[np.ndarray] = None,
        device: torch.device = torch.device("cpu"),
    ):
        self.num_facilities = num_facilities
        self.node_feat_dim = node_feat_dim
        self.device = device

        if districts is None:
            self.districts = [
                "Carlton", "Docklands", "East Melbourne", "Kensington",
                "CBD", "North Melbourne", "Parkville", "Southbank", "West Melbourne"
            ][:num_facilities]
        else:
            self.districts = districts

        if capacities is None:
            # Table 1: Carlton=71, Docklands=17, East Melb=37, Kensington=117, CBD=83,
            # North Melb=94, Parkville=34, Southbank=40, West Melb=48 (Total=541)
            default_caps = [71, 17, 37, 117, 83, 94, 34, 40, 48]
            self.capacities = default_caps[:num_facilities]
        else:
            self.capacities = capacities

        # Normalized Distance Matrix between District Parking Centers (Section 5.1, Figure 4)
        if distance_matrix is None:
            # Normalized synthetic distance matrix reflecting Figure 4 heatmap (scaled [0, 1])
            np.random.seed(42)
            raw_dist = np.random.uniform(0.01, 0.05, size=(num_facilities, num_facilities))
            np.fill_diagonal(raw_dist, 0.0)
            raw_dist = (raw_dist + raw_dist.T) / 2.0
            self.distance_matrix = raw_dist
        else:
            self.distance_matrix = distance_matrix

        # Adjacency threshold for regional partitions (Section 4.3)
        self.adjacency_threshold = 0.045
        self.adjacency_matrix = (self.distance_matrix <= self.adjacency_threshold).astype(np.float32)

    def build_feature_tensor(
        self,
        occupancies: List[int],
        request_location: np.ndarray,
        cruising_counts: List[int],
        predicted_demands: List[float],
        actions: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Constructs node feature matrix and multi-view graph G^c tensor.

        Args:
            occupancies: Real-time occupied bay count per facility.
            request_location: [x, y] coordinates of active parking request q_t.
            cruising_counts: Number of vehicles currently cruising toward facility c_i.
            predicted_demands: Forecasted demand in vicinity of c_i.
            actions: Optional previous action tensor (B, num_facilities) for multi-view graph.

        Returns:
            node_features: (B=1, num_facilities, node_feat_dim)
            adj_tensor: (B=1, num_facilities, num_facilities)
        """
        feats = []
        for i in range(self.num_facilities):
            cap = float(self.capacities[i])
            occ = float(occupancies[i])
            occ_ratio = occ / max(cap, 1.0)
            cruising = float(cruising_counts[i]) / 50.0  # Normalized
            pred_demand = float(predicted_demands[i]) / 100.0  # Normalized
            # Distance from facility center to request location
            fac_pos = np.array([float(i) / self.num_facilities, 0.5])
            dist_to_req = float(np.linalg.norm(fac_pos - request_location))
            eta = dist_to_req * 10.0  # Minutes

            # Node feature vector (length 7 base + 1 optional action = 8)
            feat_vec = [
                float(i) / max(self.num_facilities - 1, 1),
                cap / 120.0,
                occ_ratio,
                eta / 60.0,
                cruising,
                pred_demand,
                dist_to_req,
            ]
            if actions is not None:
                act_val = float(actions[0, i].item()) if actions.dim() == 2 else float(actions[i].item())
                feat_vec.append(act_val)
            else:
                feat_vec.append(0.0)

            feats.append(feat_vec)

        node_tensor = torch.tensor(feats, dtype=torch.float32, device=self.device).unsqueeze(0)
        adj_tensor = torch.tensor(self.adjacency_matrix, dtype=torch.float32, device=self.device).unsqueeze(0)
        return node_tensor, adj_tensor


# ----------------------------------------------------------------------------
# 2. Two-Stage Graph Attention Network (GAT) (Section 4.3, Eq. 9)
# ----------------------------------------------------------------------------

class TwoStageGATLayer(nn.Module):
    """Two-Stage Graph Attention Network layer.

    Stage 1: Computes dynamic attention weights across neighboring parking facilities
             within regional spatial partitions using Softmax normalization.
    Stage 2: Inter-regional aggregation capturing competition and cooperation (Eq. 9).
    Mathematical Formulation:
        e_ij = LeakyReLU(a^T [W h_i || W h_j])
        alpha_ij = Softmax_j(e_ij)
        h_i' = ELU( sum_{j in N(i)} alpha_ij W h_j )
        X = W_p * G^c  (Eq. 9)
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        dropout: float = 0.1,
        alpha: float = 0.2,
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.dropout = dropout
        self.alpha = alpha

        # Stage 1: Intra-partition transformation and self-attention
        self.W_intra = nn.Linear(in_features, out_features, bias=False)
        self.a_intra = nn.Linear(2 * out_features, 1, bias=False)

        # Stage 2: Inter-partition projection W_p (Eq. 9)
        self.W_inter = nn.Linear(out_features, out_features, bias=True)
        self.leaky_relu = nn.LeakyReLU(self.alpha)

        self._init_weights()

    def _init_weights(self) -> None:
        nn.init.xavier_uniform_(self.W_intra.weight)
        nn.init.xavier_uniform_(self.a_intra.weight)
        nn.init.xavier_uniform_(self.W_inter.weight)
        nn.init.constant_(self.W_inter.bias, 0.0)

    def forward(
        self,
        h: torch.Tensor,
        adj: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Forward pass of Two-Stage GAT.

        Args:
            h: Node feature tensor (B, N, in_features).
            adj: Adjacency matrix (B, N, N), 1.0 for connected neighbors, 0.0 otherwise.

        Returns:
            X: Enhanced node representations (B, N, out_features).
            attention_weights: Normalized attention coefficients (B, N, N).
        """
        B, N, _ = h.shape

        # Stage 1: Linear projection
        Wh = self.W_intra(h)  # (B, N, out_features)

        # Pairwise concatenation for attention: [Wh_i || Wh_j] for all pairs (i, j)
        Wh_i = Wh.unsqueeze(2).repeat(1, 1, N, 1)  # (B, N, N, out_features)
        Wh_j = Wh.unsqueeze(1).repeat(1, N, 1, 1)  # (B, N, N, out_features)
        pair_concat = torch.cat([Wh_i, Wh_j], dim=-1)  # (B, N, N, 2 * out_features)

        # Unnormalized attention coefficients e_ij
        e = self.leaky_relu(self.a_intra(pair_concat)).squeeze(-1)  # (B, N, N)

        # Mask non-adjacent nodes with large negative value (-1e9)
        zero_vec = -9e15 * torch.ones_like(e)
        attention_logits = torch.where(adj > 0, e, zero_vec)

        # Softmax normalization over neighbors (Section 4.3)
        attention_weights = F.softmax(attention_logits, dim=-1)
        dropped_weights = F.dropout(attention_weights, p=self.dropout, training=self.training)

        # Intra-regional neighborhood aggregation
        h_intra = torch.matmul(dropped_weights, Wh)  # (B, N, out_features)
        h_intra = F.elu(h_intra)

        # Stage 2: Inter-regional projection (X = W_p * G^c, Eq. 9)
        X = self.W_inter(h_intra)  # (B, N, out_features)
        return X, attention_weights


# ----------------------------------------------------------------------------
# 3. Heterogeneous Graph Pooling (HGP) (Section 4.5.1, Eqs. 10-14)
# ----------------------------------------------------------------------------

class HeterogeneousGraphPooling(nn.Module):
    """Heterogeneous Graph Pooling (HGP) layer.

    Extracts compact global latent state-action representation H = [s_O || s_F]
    by scoring, gating, and pooling dynamic (I_o) and fixed (I_n) parking agents.
    Mathematical Formulation:
        Y_O = X_O * p_O                     (Eq. 10)
        X_O^{topk}, Y_O^{topk} = Filter(X_O, Y_O, k_h) (Eq. 11)
        X_O^{gate} = X_O^{topk} \odot Norm(Y_O^{topk})  (Eq. 12)
        s_O = sum(x_O^{i, gate}) \oslash max(x_O^{i, gate}) (Eq. 13)
        H = [s_O || s_F]                     (Eq. 14)
    """

    def __init__(
        self,
        in_dim: int = 32,
        k_h: int = 5,
        num_dynamic_agents: int = 6,
        num_fixed_agents: int = 3,
    ):
        super().__init__()
        self.in_dim = in_dim
        self.k_h = k_h
        self.num_dynamic = num_dynamic_agents
        self.num_fixed = num_fixed_agents

        # Projection vectors p_O and p_F for importance scoring (Eq. 10)
        self.p_O = nn.Parameter(torch.empty(in_dim, 1))
        self.p_F = nn.Parameter(torch.empty(in_dim, 1))

        self._init_weights()

    def _init_weights(self) -> None:
        nn.init.xavier_uniform_(self.p_O)
        nn.init.xavier_uniform_(self.p_F)

    def _pool_partition(
        self,
        X_part: torch.Tensor,
        p_proj: torch.Tensor,
        k_val: int,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Pools a single agent partition (dynamic or fixed)."""
        B, N_part, D = X_part.shape
        actual_k = min(k_val, N_part)

        # 1. Importance scores Y = X * p (Eq. 10)
        # (B, N_part, D) @ (D, 1) -> (B, N_part)
        Y = torch.matmul(X_part, p_proj).squeeze(-1)

        # 2. Top-k filtering (Eq. 11)
        topk_scores, topk_indices = torch.topk(Y, k=actual_k, dim=-1)  # (B, actual_k)

        # Gather top-k node features
        # Expand indices to (B, actual_k, D)
        gather_idx = topk_indices.unsqueeze(-1).expand(-1, -1, D)
        X_topk = torch.gather(X_part, dim=1, index=gather_idx)  # (B, actual_k, D)

        # 3. Softmax gating (Eq. 12)
        gating_weights = F.softmax(topk_scores, dim=-1).unsqueeze(-1)  # (B, actual_k, 1)
        X_gate = X_topk * gating_weights  # (B, actual_k, D)

        # 4. Permutation-invariant readout s = sum(x) / (max(x) + eps) (Eq. 13)
        sum_feat = torch.sum(X_gate, dim=1)  # (B, D)
        max_feat = torch.max(X_gate, dim=1).values  # (B, D)
        s = sum_feat / (torch.clamp(max_feat.abs(), min=1e-5))  # (B, D)
        return s, topk_indices

    def forward(
        self,
        X: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Executes Heterogeneous Graph Pooling.

        Args:
            X: Enhanced node feature tensor from GAT (B, N_total, in_dim).

        Returns:
            H: Global pooled state-action representation [s_O || s_F] of shape (B, 2 * in_dim) (Eq. 14).
            s_O: Dynamic partition pooled representation (B, in_dim).
            s_F: Fixed partition pooled representation (B, in_dim).
        """
        B, N_total, _ = X.shape

        # Partition into dynamic optimized agents I_o and fixed agents I_n
        n_dyn = min(self.num_dynamic, N_total)
        X_O = X[:, :n_dyn, :]  # Dynamic agents
        X_F = X[:, n_dyn:, :] if n_dyn < N_total else X[:, :1, :]  # Fixed agents

        # Pool dynamic partition
        s_O, _ = self._pool_partition(X_O, self.p_O, self.k_h)

        # Pool fixed partition
        k_fixed = max(1, self.num_fixed)
        s_F, _ = self._pool_partition(X_F, self.p_F, k_fixed)

        # 5. Global concatenation H = [s_O || s_F] (Eq. 14)
        H = torch.cat([s_O, s_F], dim=-1)  # (B, 2 * in_dim)
        return H, s_O, s_F


# ----------------------------------------------------------------------------
# 4. Graph Contrastive Learning (GCL) Auxiliary Task (Section 4.5.2, Eqs. 15-16)
# ----------------------------------------------------------------------------

class GraphContrastiveLearningLoss(nn.Module):
    """Graph Contrastive Learning (GCL) InfoNCE objective.

    Aligns query subgraph H_q with augmented positive subgraph H_+ while
    maximizing divergence from K-1 negative subgraphs H_- (Eqs. 15-16).
    Mathematical Formulation:
        L_c = -log( exp(H_q^T W_c H_+ / tau) / (exp(H_q^T W_c H_+ / tau) + sum_i exp(H_q^T W_c H_-^i / tau)) )
    """

    def __init__(
        self,
        embed_dim: int = 64,
        temperature: float = 0.1,
    ):
        super().__init__()
        self.embed_dim = embed_dim
        self.temperature = temperature
        # Bilinear projection matrix W_c (Eq. 16)
        self.W_c = nn.Parameter(torch.empty(embed_dim, embed_dim))
        self._init_weights()

    def _init_weights(self) -> None:
        nn.init.xavier_uniform_(self.W_c)

    def forward(
        self,
        H_q: torch.Tensor,
        H_pos: torch.Tensor,
        H_neg: torch.Tensor,
    ) -> torch.Tensor:
        """Computes the InfoNCE Graph Contrastive Loss L_c.

        Args:
            H_q: Query graph embedding (B, embed_dim).
            H_pos: Positive graph embedding (B, embed_dim).
            H_neg: Negative graph embeddings (B, K-1, embed_dim).

        Returns:
            L_c: Scalar contrastive loss tensor.
        """
        B, D = H_q.shape
        _, K_neg, _ = H_neg.shape

        # 1. Positive similarity: H_q^T W_c H_+
        # H_q @ W_c -> (B, D)
        q_proj = torch.matmul(H_q, self.W_c)  # (B, D)
        # Dot product with H_pos: sum(q_proj * H_pos, dim=-1) -> (B, 1)
        pos_sim = torch.sum(q_proj * H_pos, dim=-1, keepdim=True) / self.temperature  # (B, 1)

        # 2. Negative similarities: H_q^T W_c H_-^i for i in 1..K-1
        # q_proj.unsqueeze(1) is (B, 1, D); H_neg is (B, K_neg, D)
        neg_sim = torch.sum(q_proj.unsqueeze(1) * H_neg, dim=-1) / self.temperature  # (B, K_neg)

        # 3. InfoNCE loss (Eq. 16) via Cross-Entropy against target class 0 (positive)
        logits = torch.cat([pos_sim, neg_sim], dim=-1)  # (B, 1 + K_neg)
        labels = torch.zeros(B, dtype=torch.long, device=H_q.device)

        loss = F.cross_entropy(logits, labels)
        return loss
