# Paper-Aligned Architecture Specification: MARL-GCN with CTDE

This document details the neural architecture and learning pipeline implemented in `research/paper_aligned/`, faithfully reproducing the methodology of:
**Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation," *Sensors*, 2025, 25(8), 2389.**

---

## 1. Architectural Pipeline Overview

The paper-aligned architecture consists of five coordinated modules:
1. **Dynamic Heterogeneous Graph ($G^c$):** Multi-view graph representing the 9 Melbourne parking districts ($V = \{c_1, \dots, c_9\}$) with 541 total bays, spatial adjacency, and action concatenation.
2. **Two-Stage Graph Attention Network (GAT):** Computes normalized attention coefficients $\alpha_{ij}$ over neighboring facilities within regional clusters, aggregating features via $X = W_p \bullet G^c$ (Equation 9).
3. **Heterogeneous Graph Pooling (HGP):** Importance projection $p_O$, top-$k_h$ filtering, Softmax gating, and permutation-invariant readout extracting global latent state $H = [s_O \parallel s_F]$ (Equations 10–14).
4. **Graph Contrastive Learning (GCL):** Self-supervised InfoNCE auxiliary loss $L_c$ aligning query subgraphs $H_q$ with positive instances $H_+$ while repelling $K-1$ negative instances $H_-$ (Equations 15–16).
5. **Agent Temporal GRU & Policy Hypernetwork:** GRU cell updating temporal meta-features $H_t^i$ from previous actions and spatial features (Equation 6), which feed a learnable Hypernetwork $G = [G_w, G_b]$ that generates agent-specific policy weights $W_{G,t}^i, b_{G,t}^i$ for continuous action generation $a_t^i = \text{Sigmoid}(W_{G,t}^i \phi(x_t^i) + b_{G,t}^i) \times \kappa$ (Equations 7–8).
6. **Centralized Training with Decentralized Execution (CTDE / MADDPG):** Decentralized actors execute personalized policies, while a centralized evaluator $Q_u(H_t, A_t)$ guides off-policy Bellman updates with contrastive regularization (Equations 17–18).

---

## 2. Mathematical Formulations & Tensor Dimensions

### 2.1 Two-Stage Graph Attention Network (GAT) (Section 4.3, Eq. 9)
- **Input:** Node feature tensor $h \in \mathbb{R}^{B \times N \times d_{\text{in}}}$, where $N = 9, d_{\text{in}} = 8$.
- **Adjacency:** Adjacency matrix $A \in \{0, 1\}^{B \times N \times N}$.
- **Attention Computation:**
  $$e_{ij} = \text{LeakyReLU}\left(a^T [W_{\text{intra}} h_i \parallel W_{\text{intra}} h_j]\right)$$
  $$\alpha_{ij} = \frac{\exp(e_{ij})}{\sum_{k \in \mathcal{N}(i)} \exp(e_{ik})}$$
- **Aggregation & Inter-Regional Projection:**
  $$h_i^{\text{intra}} = \text{ELU}\left(\sum_{j \in \mathcal{N}(i)} \alpha_{ij} W_{\text{intra}} h_j\right), \quad X = W_{\text{inter}} h^{\text{intra}} \quad \text{(Eq. 9)}$$
- **Output:** Enhanced spatial feature tensor $X \in \mathbb{R}^{B \times N \times d_{\text{spatial}}}$, with $d_{\text{spatial}} = 32$.

### 2.2 Heterogeneous Graph Pooling (HGP) (Section 4.5.1, Eqs. 10–14)
- **Importance Scoring:**
  $$Y_O = X_O p_O \in \mathbb{R}^{B \times N_O} \quad \text{(Eq. 10)}$$
- **Top-$k$ Selection & Softmax Gating:**
  $$X_O^{\text{top}k}, Y_O^{\text{top}k} = \text{Filter}(X_O, Y_O, k_h) \quad \text{(Eq. 11)}$$
  $$X_O^{\text{gate}} = X_O^{\text{top}k} \odot \text{Softmax}(Y_O^{\text{top}k}) \quad \text{(Eq. 12)}$$
- **Permutation-Invariant Readout:**
  $$s_O = \sum_{i=1}^{k_h} x_O^{i, \text{gate}} \oslash \max_{i=1}^{k_h} x_O^{i, \text{gate}} \in \mathbb{R}^{B \times d_{\text{spatial}}} \quad \text{(Eq. 13)}$$
  $$H = [s_O \parallel s_F] \in \mathbb{R}^{B \times (2 \cdot d_{\text{spatial}})} = \mathbb{R}^{B \times 64} \quad \text{(Eq. 14)}$$

### 2.3 Graph Contrastive Learning Loss (Section 4.5.2, Eqs. 15–16)
- **InfoNCE Loss:**
  $$L_c = -\log \frac{\exp\left(H_q^T W_c H_+ / \tau\right)}{\exp\left(H_q^T W_c H_+ / \tau\right) + \sum_{i=1}^{K-1} \exp\left(H_q^T W_c H_-^i / \tau\right)} \quad \text{(Eq. 16)}$$
  where $W_c \in \mathbb{R}^{64 \times 64}$ is a learnable bilinear similarity matrix and $\tau = 0.1$.

### 2.4 Policy Hypernetwork (Section 4.4, Eqs. 7–8)
- **Temporal GRU:**
  $$H_t^i = \text{GRU}\left(H_{t-1}^i, \, [x_t^i \parallel a_{t-1}^i]\right) \in \mathbb{R}^{64} \quad \text{(Eq. 6)}$$
- **Hypernetwork Trunk & Parameter Heads:**
  $$W_{G,t}^i = G_w(H_t^i) \in \mathbb{R}^{1 \times 32}, \quad b_{G,t}^i = G_b(H_t^i) \in \mathbb{R}^{1} \quad \text{(Eq. 7)}$$
- **Continuous Priority Policy:**
  $$a_t^i = u_t^i(x_t^i) = \text{Sigmoid}\left(W_{G,t}^i \phi(x_t^i) + b_{G,t}^i\right) \times \kappa \quad \text{(Eq. 8)}$$
  with $\kappa = 1.0$.

### 2.5 Centralized Evaluator & Joint Optimization (Section 4.6, Eqs. 17–18)
- **Critic Network:**
  $$Q_u(H_t, A_t) = \text{MLP}\left([H_t \parallel A_t]\right) \in \mathbb{R}^1 \quad \text{(Eq. 17)}$$
- **Target Value:**
  $$y_t = r_t + \gamma Q_u'(H_{t+1}, A_{t+1})$$
- **Joint Loss Function:**
  $$L(\theta_Q, \theta_p) = \mathbb{E}\left[\left(Q_u(H_t, A_t) - y_t\right)^2\right] + \lambda L_c \quad \text{(Eq. 18)}$$
  with discount $\gamma = 0.99$ and contrastive weight $\lambda = 0.1$.

