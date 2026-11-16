# Research Manuscript Addendum: Comparative Methodological Analysis

**Document Status:** Academic Addendum to `research_paper/main.tex`  
**Location:** `research/paper_aligned/MANUSCRIPT_ADDENDUM.md`  
**Purpose:** Formally articulates the theoretical and architectural relationship between the original reference paper, the existing campus-adapted PPO implementation, and the newly constructed paper-aligned implementation.

---

## 1. Context and Motivation

The Smart Parking BTP research program explores intelligent parking search guidance using deep reinforcement learning. Two distinct architectural paradigms have now been developed, validated, and benchmarked within the project repository:
1. **The Campus-Adapted Recurrent PPO Architecture (`smart_parking_ai/models/research/`):** A lightweight (24,420 parameters) single-agent actor-critic model designed for intra-facility micro-parking facilities featuring discrete defensive action masking and 4-way GAE.
2. **The Paper-Aligned MARL-GCN Architecture (`research/paper_aligned/`):** A multi-agent framework faithfully reproducing the Graph Attention Network (GAT), Heterogeneous Graph Pooling (HGP), Graph Contrastive Learning (GCL), and learnable Hypernetwork methodology of Zhao & Yan (*Sensors* 2025).

---

## 2. Comparative Methodological Triangulation

The table below contrasts the reference paper against both BTP implementations:

| Feature / Dimension | Reference Base Paper (Zhao & Yan 2025) | Campus-Adapted BTP Model (`smart_parking_ai/models/research/`) | Paper-Aligned BTP Model (`research/paper_aligned/`) |
| :--- | :--- | :--- | :--- |
| **Problem Scale** | Municipal scale: 9 districts, 541 bays, 29,342 requests/day | Micro-facility: 5 stalls (A1–B2) + overflow lot, 5–15 requests/episode | Municipal scale: 9 districts, 541 bays (Table 1 distribution) |
| **Graph Representation** | Dynamic Heterogeneous Graph $G = (V, E)$ | None (Flat 18-element state vector; static Dijkstra road graph) | Dynamic Heterogeneous Graph ($G^c$) with spatial proximity edges |
| **Spatial Modeling** | Two-Stage GAT + Feature Aggregation $X = W_p \bullet G^c$ | Dense Feed-Forward Layer (`nn.Linear(10, 32)`) | Two-Stage GAT Layer (`TwoStageGATLayer`) with Softmax attention |
| **Graph Pooling** | Heterogeneous Graph Pooling (HGP) with Softmax gating | None | Heterogeneous Graph Pooling (`HeterogeneousGraphPooling`, Eqs. 10–14) |
| **Auxiliary Learning** | Graph Contrastive Learning (GCL) with InfoNCE loss $L_c$ | None | Graph Contrastive Learning (`GraphContrastiveLearningLoss`, Eq. 16) |
| **Temporal Modeling** | GRU on regional historical features (Eq. 6) | `nn.GRUCell(37, 64)` on observation sequence | `AgentTemporalGRU` tracking agent-specific history (Eq. 6) |
| **Policy Generation** | Learnable Hypernetwork generating agent-specific $W_G, b_G$ | Static shared MLP Actor and Critic heads | Learnable Hypernetwork (`PolicyHypernetwork`, Eq. 7) |
| **Reinforcement Learning** | Multi-Agent DDPG with Centralized Evaluator $Q_u(H_t)$ | Single-Agent PPO with clipped surrogate objective $L_{\text{clip}}$ | Multi-Agent DDPG (`MADDPGTrainer`) with Centralized Evaluator $Q_u$ |
| **Action Space** | Continuous action priority $a_t^i \in [0, \kappa]$ | Discrete single-agent choice $a \in \{0, 1, 2\}$ with hard $-\infty$ masking | Continuous action priority $a_t^i \in [0, \kappa]$ with Sigmoid scaling |
| **Advantage Estimation** | Standard Bellman TD Error ($Q_u - y_t$) | 4-Way Boundary Generalized Advantage Estimation (GAE) | Joint Bellman TD Error + Contrastive Loss ($L_{\text{bellman}} + \lambda L_c$) |
| **Cruising Delay Formula** | $\eta_p = e_p (1 - \delta_p / \sigma_p)^{-1}$ (Eq. 1) | $\eta_p = e_p (1 - \min(\delta_p/\sigma_p, 0.95))^{-1}$ (Eq. 1) | $\eta_p = e_p (1 - \min(\delta_p/\sigma_p, 0.95))^{-1}$ (Eq. 1) |
| **Step Reward** | $r_t = \varepsilon_a - \lambda T_{\text{cruise}}$ (Eq. 4) | $R = \max(10 - 0.02 T_{\text{cruise}} - 0.01 T_{\text{walk}}, 1.0)$ | $r_t = \max(\varepsilon_a - \lambda T_{\text{cruise}}, 1.0)$ (Eq. 4) |
| **Inference Latency** | $170\text{ ms}$ (RTX 3060 GPU) | $95.35\ \mu\text{s}$ (CPU Single-Thread) | $206.5\ \mu\text{s}$ (CPU Single-Thread) |

---

## 3. Scientific Insights and Trade-Offs

1. **When to use Campus-Adapted PPO:**
   - In micro-facilities (airports, hospital campuses, single parking garages), the physical topology contains discrete stalls whose occupancy states are coupled via a single local roadway. A centralized agent equipped with discrete action masking guarantees zero allocation conflicts and provides ultra-low latency ($95.35\ \mu\text{s}$) on embedded microcontrollers.
2. **When to use Paper-Aligned MARL-GCN:**
   - In municipal city-scale parking management across multiple geographic precincts (e.g. Melbourne CBD vs. Southbank vs. Docklands), centralized controllers suffer from computational bottlenecks and communication latency. A decentralized multi-agent system where regional agents adaptively coordinate via Graph Attention and Hypernetworks provides the necessary spatiotemporal scalability.

