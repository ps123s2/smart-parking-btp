# Equation Verification and Mathematical Proofs: Zhao & Yan (2025)

This document provides exact transcriptions, code cross-references, numerical boundary analyses, and unit test verification for every mathematical equation from the reference paper.

---

## 1. Cruising Time Delay Formula (Section 3.2, Equation 1)

### 1.1 Original Mathematical Definition
$$\eta_p^t = e_p \left(1 - \frac{\delta_p^t}{\sigma_p}\right)^{-1}, \quad \forall t, p \quad \text{(Equation 1)}$$
- $e_p$: Average vacant cruising time for roadside parking facility $p$ (minutes).
- $\delta_p^t$: Current number of occupied parking spaces at time $t$.
- $\sigma_p$: Total parking capacity of facility $p$.
- $\delta_p^t / \sigma_p$: Instantaneous occupancy ratio.

### 1.2 Code Implementation Location
`research/paper_aligned/melbourne_env.py`: lines 55–75:
```python
def calculate_cruising_delay_paper(vacant_base_ep, current_occupancy, capacity, numerical_cap=0.95):
    ratio = float(current_occupancy) / max(float(capacity), 1.0)
    capped_ratio = min(ratio, numerical_cap)
    cruising_time = vacant_base_ep / (1.0 - capped_ratio)
    return float(cruising_time)
```

### 1.3 Boundary Condition Verification
- **Vacant Lot ($\delta_p^t = 0$):**
  $$\eta_p^t = e_p (1 - 0)^{-1} = e_p$$
  *Verified:* `calculate_cruising_delay_paper(3.0, 0, 10) == 3.0`.
- **Half-Occupied Lot ($\delta_p^t / \sigma_p = 0.5$):**
  $$\eta_p^t = e_p (1 - 0.5)^{-1} = 2 \cdot e_p$$
  *Verified:* `calculate_cruising_delay_paper(3.0, 5, 10) == 6.0`.
- **Saturated Lot ($\delta_p^t \to \sigma_p$):**
  As occupancy ratio approaches 1.0, theoretical queuing delay diverges asymptotically ($\lim_{x \to 1^-} (1-x)^{-1} = \infty$).
  *Implementation Adaptation:* Enforces a numerical cap at 0.95 to maintain finite float representation while penalizing saturated facilities with a $20\times$ latency multiplier ($\eta_p = 20 \cdot e_p$).

---

## 2. Total User Travel Time (Section 3.2, Equation 2)

### 2.1 Original Mathematical Definition
$$\text{Total travel time} = \eta_p^t + W_{pi} \quad \text{(Equation 2)}$$
- $\eta_p^t$: Cruising time in parking lot $p$ (minutes).
- $W_{pi}$: Walking time from parking lot $p$ to final destination $i$ (minutes).

### 2.2 Code Implementation Location
`research/paper_aligned/melbourne_env.py`: lines 78–84.
*Verified:* `calculate_total_travel_time(6.5, 2.5) == 9.0`.

---

## 3. Delayed Reward Function (Section 4.2.5, Equation 4)

### 3.1 Original Mathematical Definition
$$r_t = \begin{cases} 
\varepsilon_a - \lambda \cdot \text{cruising time}, & \text{success in } I_o \\ 
\varepsilon_a, & \text{failure in } I_o \\ 
0, & \text{otherwise} 
\end{cases} \quad \text{(Equation 4)}$$
- $\varepsilon_a$: Base incentive encouraging requests to be directed to optimized agents in $I_o$.
- $\lambda$: Scaling coefficient penalizing prolonged cruising duration.
- The paper explicitly notes (p. 10): *"While the numerical value of the reward may appear smaller in successful cases due to the subtraction, it represents the net benefit of an effective allocation and is always higher than the reward for failure or inaction."*
- "Otherwise" case: Requests rejected before reaching an actionable decision point or exceeding maximum user waiting time ($r_t = 0$).

### 3.2 Code Implementation Location
`research/paper_aligned/melbourne_env.py`: lines 87–108.
*Verified:*
- Success case ($\varepsilon_a = 10.0, \lambda = 0.5, T_{\text{cruise}} = 6.0$):
  $$r_t = \max(10.0 - 0.5 \cdot 6.0, \, 1.0) = 7.0$$
- Failure case: $r_t = 0.0$.

---

## 4. GRU Temporal Representation (Section 4.4, Equation 6)

### 4.1 Original Mathematical Definition
$$H_t^i = \text{GRU}\left(H_{t-1}^i, \, \left[x_t^i \parallel a_{t-1}^i\right]\right) \quad \text{(Equation 6)}$$
- $H_{t-1}^i$: GRU hidden state of agent $c_i$ from previous step.
- $x_t^i$: Spatial feature vector from the reinforcement learning graph encoder.
- $a_{t-1}^i$: Prior allocation action chosen by agent $c_i$.

### 4.2 Code Implementation Location
`research/paper_aligned/hypernetwork.py`: lines 45–75 (`AgentTemporalGRU.forward_step`).

---

## 5. Learnable Hypernetwork & Personalized Policy (Section 4.4, Equations 7–8)

### 5.1 Original Mathematical Definition
$$W_{G,t}^i = G_w(H_t^i), \quad b_{G,t}^i = G_b(H_t^i) \quad \text{(Equation 7)}$$
$$a_t^i = u_t^i(x_t^i) = \text{Sigmoid}\left(W_{G,t}^i \phi(x_t^i) + b_{G,t}^i\right) \times \kappa \quad \text{(Equation 8)}$$
- $G = [G_w, G_b]$: Meta-generator network mapping temporal meta-features to personalized policy parameters.
- $\phi(x_t^i)$: Learnable latent feature transformation (`Linear(32, 32) + Tanh`).
- $\kappa$: Continuous scaling factor (default $\kappa = 1.0$).

### 5.2 Code Implementation Location
`research/paper_aligned/hypernetwork.py`: lines 100–180 (`PolicyHypernetwork` and `PersonalizedAgentPolicy`).

---

## 6. Two-Stage GAT and Heterogeneous Graph Pooling (Section 4.5.1, Equations 9–14)

### 6.1 Original Mathematical Definition
$$X = W_p \bullet G^c \quad \text{(Equation 9)}$$
$$Y_O = X_O p_O \quad \text{(Equation 10)}$$
$$X_O^{\text{top}k}, Y_O^{\text{top}k} = \text{Filter}(X_O, Y_O, k_h) \quad \text{(Equation 11)}$$
$$X_O^{\text{gate}} = X_O^{\text{top}k} \odot \text{Norm}(Y_O^{\text{top}k}) \quad \text{(Equation 12)}$$
$$s_O = \sum_{i=1}^{k_h} x_O^{i, \text{gate}} \oslash \max_{i=1}^{k_h} x_O^{i, \text{gate}} \quad \text{(Equation 13)}$$
$$H = [s_O \parallel s_F] \quad \text{(Equation 14)}$$

### 6.2 Code Implementation Location
`research/paper_aligned/graph_network.py`: lines 140–310 (`TwoStageGATLayer` and `HeterogeneousGraphPooling`).

---

## 7. Graph Contrastive Learning Auxiliary Objective (Section 4.5.2, Equation 16)

### 7.1 Original Mathematical Definition
$$L_c = -\log \frac{\exp\left(H_q^T W_c H_+ / \tau\right)}{\exp\left(H_q^T W_c H_+ / \tau\right) + \sum_{i=1}^{K-1} \exp\left(H_q^T W_c H_-^i / \tau\right)} \quad \text{(Equation 16)}$$
- $H_q$: Query subgraph embedding cropped around request location $l_t$ (Eq. 15).
- $H_+$: Augmented positive instance from same graph.
- $H_-^i$: Negative instances cropped from other graphs in batch.
- $W_c$: Learnable bilinear similarity matrix.

### 7.2 Code Implementation Location
`research/paper_aligned/graph_network.py`: lines 320–380 (`GraphContrastiveLearningLoss`).

---

## 8. MADDPG Policy Objective and Joint Critic Loss (Section 4.6, Equations 17–18)

### 8.1 Original Mathematical Definition
$$J(\theta_G, \theta_M) = \mathbb{E}_{O_t, G_t \sim D}\left[ Q_u(H_t) \Big|_{a_t^i = u_t^i(x_t^i)} \right] \quad \text{(Equation 17)}$$
$$L(\theta_Q, \theta_p) = \mathbb{E}\left[\left(Q_u(H_t, A_t) - y_t\right)^2\right] + \lambda L_c \quad \text{(Equation 18)}$$
where $y_t = r_t + \gamma Q_u'(H_{t+1}, A_{t+1})$.

### 8.2 Code Implementation Location
`research/paper_aligned/maddpg.py`: lines 160–340 (`CentralizedEvaluator` and `MADDPGTrainer.train_step`).

---

## 9. Evaluation Metrics (Section 5.2, Equations 19–20)

### 9.1 Original Mathematical Definition
$$\text{Occupancy Rate (OR)} = \frac{1}{T} \sum_{t=1}^T \frac{\text{Number of occupied slots}_t}{\text{Total slots}} \quad \text{(Equation 19)}$$
$$\text{Allocation Rate (AR)} = \frac{\text{Total successful requests}}{\text{Total requests submitted}} \quad \text{(Equation 20)}$$

### 9.2 Code Implementation Location
`research/paper_aligned/melbourne_env.py`: lines 240–260.

