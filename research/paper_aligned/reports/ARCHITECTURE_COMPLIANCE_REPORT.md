# ARCHITECTURE COMPLIANCE REPORT — PAPER-ALIGNED RESEARCH CODEBASE

**Reference Paper:** Xiaohang Zhao and Yangzhi Yan, *"A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation"*, **Sensors** 2025, 25(8), 2389.  
**Audited Target Directory:** `research/paper_aligned/`  
**Date:** 2026-11-16  
**Auditor:** Senior Research Scientist & GNN/MADDPG Specialist

---

## 1. Executive Summary
An exhaustive source-level audit was conducted across all 10 architectural components in `research/paper_aligned/` against the formal definitions in Zhao & Yan (2025). The architecture contains mathematically grounded PyTorch implementations of the two-stage GAT, heterogeneous graph pooling, InfoNCE contrastive learning, temporal GRU, and meta-policy hypernetwork. 

However, two critical methodological nuances were identified:
1. **Recurrent Replay Truncation:** In off-policy batch sampling (`train_step`), dummy zero hidden states were passed to the GRU, turning off multi-step recurrence during off-policy replay updates.
2. **Cruising Delay Truncation:** Eq. (1) was capped at $0.95$ occupancy ($20 \cdot e_p$) to avoid numerical division-by-zero, creating an engineering adaptation of the unbounded queueing curve.

---

## 2. Comprehensive Component Compliance Matrix

| Paper Component | Expected Method (Zhao & Yan 2025) | Actual Implementation | Source Evidence | Status |
| :--- | :--- | :--- | :--- | :---: |
| **A1. Heterogeneous Graph Construction** | Nodes: Parking facilities $I = [I_o, I_n]$; Edges: Spatial distance and adjacency matrix $G^c$. | `DynamicHeterogeneousParkingGraph` builds 8-dim node tensors with capacity, occupancy ratio, dynamic ETA, cruising count, and demand. | [graph_network.py#L25-L134](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py#L25-L134) | **PASS** |
| **A1. Two-Stage GAT** | Intra-partition self-attention + inter-partition projection $X = W_p * G^c$ (Eq. 9). | `TwoStageGATLayer` with LeakyReLU attention logits, adjacency masking, dropout, ELU activation, and linear inter-projection. | [graph_network.py#L140-L225](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py#L140-L225) | **PASS** |
| **A2. Heterogeneous Graph Pooling** | Learnable projection vectors $p_O, p_F$, top-$k$ filtering, softmax gating, and permutation-invariant readout $H = [s_O \| s_F]$ (Eqs. 10–14). | `HeterogeneousGraphPooling` with projection vectors, top-$k$ index gathering, softmax gating weights, and sum/max aggregation. | [graph_network.py#L231-L330](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py#L231-L330) | **PASS** |
| **A3. Graph Contrastive Learning** | Bilinear InfoNCE loss $L_c$ maximizing mutual information between query $H_q$ and positive $H_+$ vs negative $H_-$ (Eqs. 15–16). | `GraphContrastiveLearningLoss` with learnable bilinear projection matrix $W_c$, temperature scaling $\tau = 0.1$, and cross-entropy against label 0. | [graph_network.py#L336-L394](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py#L336-L394) | **PASS** |
| **A4. Temporal Modeling (GRU)** | Recurrent memory tracking regional historical trends $H_t^i = \text{GRU}(H_{t-1}^i, [x_t^i \| a_{t-1}^i])$ (Eq. 6). | `AgentTemporalGRU` with orthogonal initialization, GRUCell processing concatenated spatial feature and action vectors. | [hypernetwork.py#L23-L82](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/hypernetwork.py#L23-L82) | **PARTIAL**<br>*(Live rollout preserves state; replay buffer zeroes it)* |
| **A5. Learnable Hypernetwork** | Dynamic meta-network $G$ generating agent weights $W_{G,t}^i, b_{G,t}^i$ conditioned on temporal features (Eq. 7). | `PolicyHypernetwork` with shared MLP trunk, linear generators for weights and biases, scaled orthogonal initialization. | [hypernetwork.py#L88-L157](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/hypernetwork.py#L88-L157) | **PASS** |
| **A6. Personalized Agent Policy** | Dynamic policy execution $a_t^i = \text{Sigmoid}(W_G \phi(x) + b_G) \cdot \kappa$ (Eq. 8). | `PersonalizedAgentPolicy` with latent projection $\phi$, batched dynamic matrix multiplication, sigmoid activation, and $\kappa$-scaling. | [hypernetwork.py#L163-L229](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/hypernetwork.py#L163-L229) | **PASS** |
| **A7. Centralized Evaluator** | Centralized critic $Q_u(H_t, A_t)$ evaluating global utility under joint action vectors (Eq. 17). | `CentralizedEvaluator` with global graph embedding input (64-dim) concatenated with joint actions (9-dim), 3-layer MLP. | [maddpg.py#L37-L95](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/maddpg.py#L37-L95) | **PASS** |
| **A8. MADDPG CTDE Training** | Joint optimization of Bellman error and InfoNCE contrastive loss (Eq. 18), Polyak target updates. | `MADDPGTrainer` with actor-critic separation, Polyak soft updates ($\tau = 0.01$). Critic explosion observed due to lack of clipping and overestimation. | [maddpg.py#L159-L386](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/maddpg.py#L159-L386) | **PARTIAL**<br>*(Needs gradient clipping & twin critic stabilization)* |
| **A9. Melbourne Environment** | 9 districts, 541 slots (Table 1), Gamma dwell distribution, Eq. (1) cruising delay, Eq. (4) reward. | `MelbourneMunicipalParkingEnv` accurately reflects Table 1 capacities and arrival distributions; caps $\rho \le 0.95$. | [melbourne_env.py#L26-L382](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/melbourne_env.py#L26-L382) | **PASS**<br>*(With engineering cap)* |

---

## 3. Deep Component Analysis

### A1. Heterogeneous Graph and Two-Stage GAT
- **Graph Partitioning:** Correctly divides the 9 districts into dynamic optimized facilities ($I_o$, first 6 facilities) and fixed baseline facilities ($I_n$, last 3 facilities).
- **Two-Stage Message Passing:** Intra-partition attention computes pairwise dynamic coefficients $\alpha_{ij} \in [0, 1]$ satisfying $\sum_j \alpha_{ij} = 1.0$ through softmax masking. Inter-partition projection linearly maps transformed features via $W_p$ to model inter-district competition.

### A2. Heterogeneous Graph Pooling (HGP)
- Evaluates importance scores $Y_O = X_O p_O$ and $Y_F = X_F p_F$.
- Performs top-$k$ filtering selecting the most informative facilities. Softmax gating produces attention-weighted representations, followed by a permutation-invariant readout $\sum x / (\max |x| + \epsilon)$.
- Produces fixed 64-dimensional global embedding $H = [s_O \| s_F]$.

### A3. Graph Contrastive Learning (GCL)
- Implements Eq. (16) via `GraphContrastiveLearningLoss`. A learnable bilinear projection matrix $W_c \in \mathbb{R}^{64 \times 64}$ computes normalized dot-product similarities against positive and negative graph views.
- Contrastive loss is backpropagated jointly with the Bellman error using weight $\lambda_{\text{cl}} = 0.1$.

### A4. Temporal Modeling & Recurrent Limitations
- During environment interaction (`select_actions`), the recurrent hidden state $h_t$ is correctly maintained across the 120-minute episode.
- During off-policy replay updates (`train_step`), single-step transition tuples $(s, a, r, s')$ are sampled randomly, forcing the use of `dummy_h = torch.zeros(...)`.
- **Remediation Plan (Phase C):** Build a sequential trajectory replay buffer or burn-in buffer to preserve temporal dependencies during training updates.

### A5-A6. Hypernetwork & Personalized Policy
- The hypernetwork trunk maps the 64-dim agent temporal state to 32 weights and 1 bias per agent.
- `PersonalizedAgentPolicy` performs dynamic batch matrix multiplication: $a_t^i = \text{Sigmoid}(W_{G,t}^i \phi(x_t^i) + b_{G,t}^i) \cdot \kappa$. Continuous actions in $[0, 1]$ represent district allocation priority scores.

### A7-A8. MADDPG Stability Deficiencies
- The critic objective suffers from exponential Q-value explosion ($31.0 \to 5.91 \times 10^{11}$).
- **Causes:** Unbounded positive reward summation (~900/ep), high discount factor ($\gamma = 0.99$), absence of gradient norm clipping, and classic DDPG single-critic overestimation bias.
- **Remediation Plan (Phase B):** Introduce Twin Critic networks (Clipped Double Q / TD3 style), gradient norm clipping, reward scaling, and target action smoothing.

