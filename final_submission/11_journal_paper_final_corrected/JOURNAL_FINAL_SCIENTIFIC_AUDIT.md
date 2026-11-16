# Final Scientific Consistency & Architecture Audit Report

**Manuscript Title:** *A Heterogeneous Graph Attention and Hypernetwork Multi-Agent Reinforcement Learning Framework for Urban Parking Search Navigation: Architectural Adaptation, Empirical Stabilization, and Scaled Benchmarking*  
**Date of Audit:** November 16, 2026  
**Auditor:** Senior Journal Editor, MARL/GCN Research Scientist & Independent Auditor  
**Scope:** Independent Read-Only Inspection of Repository Artifacts, Model Code, Simulation Telemetry, and Mathematical Derivations.

---

## 1. Executive Summary of Scientific Discrepancies & Corrections

During this comprehensive audit, every mathematical derivation, simulation parameter, architectural component, and experimental result in the original manuscript (`10_journal_paper/`) was audited against the authoritative codebase and data artifacts. All discovered discrepancies have been resolved in the final corrected manuscript (`11_journal_paper_final_corrected/`).

| Audit Item | Original Manuscript State | Code / Data Ground Truth | Resolution / Correction in Final Package |
|:---|:---|:---|:---|
| **3.1 Benchmark Numbers in Abstract** | Abstract reported delay values of 2.89 (FIFO), 3.35 (SIRO), 4.59 (MARL-GCN), while Scenario 2 reported 3.38, 4.45, 6.48 min. | 2.89, 3.35, and 4.59 min come from the initial 100-request standalone pilot benchmark (`benchmark_comparison_results.json`). Scenario 2 represents the 250-request benchmark (`comprehensive_benchmark_results.json`). | Explicitly contextualized both figures: identified 2.89/3.35/4.59 min as the 100-request pilot benchmark and 3.38/4.45/6.48 min as Scenario 2 (250 requests). Stated that FIFO/SIRO outperform MARL-GCN across all evaluated scenarios. |
| **3.2 District Request Sum & Kensington** | Total requests reported as 29,342. Kensington had 1 request. | Summing Table 1 values: $805 + 4191 + 2283 + 1 + 14687 + 2452 + 411 + 2129 + 2384 = \mathbf{29,343}$. | Corrected total to 29,343 daily request weights. Disclosed the 1-count difference as a typographical artifact in Zhao \& Yan (2025) Table 1. Explained that Kensington is a residential district with 117 bays and 1 request recorded in the open trace. |
| **3.3 Little's Law Congestion Math** | Stated that CBD concurrent demand exceeds capacity by 2.5× in Scenario 4. | 350 requests $\times$ 65% CBD = 227.5 requests / 120 min $\implies \lambda = 1.896$ veh/min. $L = 1.896 \times 43.29 \approx 82.1$ concurrent vehicles from newly arriving traffic ($0.989\times$ capacity of 83 bays). Adding 45% initial occupancy pushes it into saturation. Cumulative demand (227.5) is $2.74\times$ bays. | Corrected the mathematical explanation: distinguishing Little's Law concurrent load ($L = 82.1$ veh, $0.989\times$ capacity) from cumulative arrivals ($227.5$ requests, $2.74\times$ capacity), and showing how initial occupancy plus arrivals triggers queue saturation. |
| **3.4 Allocation Rate Semantics** | Claimed "100% Allocation Rate" without qualifying completion semantics. | The simulator increments `total_successful_requests` when a candidate lot has available capacity upon arrival (`occupancies[d] < capacities[d]`). | Revised terminology to "100% allocation acceptance under the evaluated simulation protocol." Explicitly noted that vehicles arriving late in the episode or assigned to lots with high queuing delays remain active/cruising at simulation termination. |
| **3.5 Demand Surge & Gridlock** | Claimed "absorbs surges up to 900 vehicles without gridlock" and "prevents gridlock." | In Scenario 6 (900 requests), MARL-GCN cruising delay averages 21.69 min, with saturated districts reaching the maximum 80.0-minute queuing cap ($\rho = 0.95$). | Removed all unsupported claims regarding "guaranteed gridlock prevention." Accurately reported that all 900 requests were accepted across the 120-min horizon without rejection, but resulted in severe localized cruising queues up to the 80.0-min cap. |
| **4.1 TD3 Terminology** | Manuscript implied full TD3 implementation (target policy smoothing, delayed actor updates). | `maddpg.py` implements dual critics and Clipped Double-Q target evaluation ($\min(Q_1', Q_2')$), but updates actors every step and does not add target perturbation noise. | Corrected terminology to "Twin Critics with Clipped Double-Q evaluation inspired by TD3 principles, without delayed policy updates or target action perturbation." |
| **4.2 Critic Feature Detachment** | Critic feature detachment was briefly mentioned. | Line 569 of `maddpg.py`: `H_t, _, _ = self.hgp(X.detach())` isolates GAT from critic TD-error shocks, while actor updates backpropagate through the connected GAT graph. | Detailed the exact gradient flow: critic gradients are isolated via detachment, preventing Bellman divergence, while actor policy gradients train GAT and hypernetworks end-to-end. |
| **5.1 Campus Adapter Tensor Shape** | Manuscript claimed 5 physical stalls are padded into a 9-node tensor `(1, 9, 8)` with action masking. | `campus_adapter.py` and `neural_inference_service.py` construct an exact 5-node graph `(1, 5, 8)` and `(1, 5, 5)` conforming to physical stalls A1, A2, A3, B1, B2. GAT and GRU evaluate dynamically without 9-node padding. | Corrected to describe direct 5-node graph evaluation `(1, 5, 8)` matching physical stalls A1, A2, A3, B1, B2, with availability masking over the 5 candidate bays. |
| **5.2 Firebase Concurrency Mechanism** | Manuscript claimed "atomic Firestore transactions." | `api.py` lines 656--675 use **Firebase Realtime Database REST API** with HTTP conditional PUT using the `If-Match` header and ETag tokens (`HTTP 412 Precondition Failed`). | Corrected to "Firebase Realtime Database ETag concurrency control via conditional PUT (`If-Match`)," eliminating confusion with Cloud Firestore. |
| **7.1 Latency Amortization** | Single-agent decision latency ($17.61~\mu$s) was presented as an isolated forward pass. | `generate_research_figures.py` line 199 calculates single-agent latency as $158.52~\mu\text{s} / 9 = 17.61~\mu\text{s}$ per agent from the joint 9-agent policy forward pass. | Explicitly designated $17.61~\mu$s as the **amortized per-agent decision latency** derived from the joint 9-agent policy forward pass ($158.52 \pm 5.76~\mu$s). |
| **8.1 Scenario Horizons** | Earlier project documents mentioned 40-min or 240-min horizons. | `run_comprehensive_benchmarks.py` line 290 and `run_ablations.py` line 136 standardise all 8 benchmark scenarios and all 6 ablation variants to $T = 120$ discrete simulation minutes. | Confirmed and documented that all authoritative benchmark and ablation evaluations were conducted under a standardized $T=120$ minute horizon (2-hour operational peak). |

---

## 2. In-Depth Architectural Verification

### 2.1 Spatial Processing: Two-Stage GAT Layer
- **Implementation File:** `research/paper_aligned/graph_network.py` (Lines 40--145).
- **Stage 1 (Intra-Partition Self-Attention):** Implements parameterized self-attention across adjacent nodes $\mathcal{N}_i$. Masking disconnected edges with $-9 \times 10^{15}$ guarantees structural topological integrity.
- **Stage 2 (Inter-Partition Projection):** Linear projection ($W_{\text{inter}} \in \mathbb{R}^{32 \times 32}$) with ELU activation aggregates inter-regional facility competition.
- **Operational Status:** Fully implemented, verified in training, inference, and benchmarks.

### 2.2 Global Readout: Heterogeneous Graph Pooling (HGP)
- **Implementation File:** `research/paper_aligned/graph_network.py` (Lines 150--210).
- **Gated Selection:** Learnable projection vectors $p_O, p_F \in \mathbb{R}^{32 \times 1}$ generate attention scores for top-$k$ selection, followed by Softmax gating.
- **Permutation-Invariant Readout:** Evaluates sum-to-max ratio aggregations ($s = \sum x / (\max |x| + \epsilon)$), yielding $H_t \in \mathbb{R}^{64}$.
- **Operational Status:** Fully implemented and active during training.

### 2.3 Temporal Dynamics: Agent Temporal GRU
- **Implementation File:** `research/paper_aligned/hypernetwork.py` (Lines 15--60).
- **Recurrent State:** Tracks state-action transitions: $H_t^i = \text{GRU}(H_{t-1}^i, [x_t^i \| a_{t-1}^i]) \in \mathbb{R}^{64}$.
- **Operational Status:** Crucial driver of performance. Ablating this module causes a $+545.5\%$ surge in cruising delay ($p = 3.03 \times 10^{-6}$).

### 2.4 Dynamic Actor Parameters: Policy Hypernetwork
- **Implementation File:** `research/paper_aligned/hypernetwork.py` (Lines 65--120).
- **Weight Generation:** Two-layer MLP maps $H_t^i \in \mathbb{R}^{64}$ to dynamic actor weights $W_{G,t}^i \in \mathbb{R}^{1 \times 32}$ and bias $b_{G,t}^i \in \mathbb{R}^1$.
- **Actor Execution:** Evaluates continuous priority actions $a_t^i = \text{Sigmoid}(W_{G,t}^i \phi(x_t^i) + b_{G,t}^i) \in [0, 1]$.
- **Operational Status:** Fully implemented. Ablation reveals a $+7.3\%$ delay increase when replaced with static weights ($p = 0.6391$, non-significant).

### 2.5 Centralized Evaluator & Twin-Critic Stabilization
- **Implementation File:** `research/paper_aligned/maddpg.py` (Lines 550--640).
- **Catastrophic Divergence in Unstabilized Baseline:** Critic MSE loss exploded from $31.0 \to 5.91 \times 10^{11}$ due to unbounded step rewards ($r > 80$), maximization overestimation, and spatial gradient feedback loops.
- **Twin Critics (Clipped Double-Q):** Dual evaluators $Q_{\theta_1}, Q_{\theta_2}$ compute target $y_t = r_{\text{scaled}} + \gamma \min(Q_1', Q_2')$, eliminating overestimation cascades.
- **Reward Scaling & Gradient Clipping:** Scaling step rewards ($r \times 0.1$) bounds discounted returns ($R \le 100.0$), and parameter gradient clipping ($\|\mathbf{g}\|_2 \le 5.0$) suppresses gradient shocks.
- **Critic Feature Detachment:** Detaching GAT features ($X.\text{detach}()$) prior to HGP pooling isolates spatial features from TD-error shocks.
- **Operational Status:** Enforces critic loss $\le 4.04$ and Q-mean $11.98$. Strictly distinguished from asymptotic policy convergence.

---

## 3. Audit of Campus IoT Application Integration

- **Layout Conformity:** Stalls are verified as **A1, A2, A3, B1, B2** (slot1 through slot5) with walking distances $[85, 70, 85, 55, 35]$ meters.
- **Graph Dimension:** Evaluates an exact 5-node graph `(1, 5, 8)` directly on CPU in sub-millisecond time ($< 1$ ms), comfortably exceeding the 50 ms edge latency deadline.
- **Database Concurrency:** Uses HTTP conditional PUT requests with `If-Match: "<ETag>"` to the Firebase Realtime Database REST API. Conflicts trigger HTTP 412 Precondition Failed, ensuring transactional booking safety.
- **Safety Feature Flag:** Verified that `ENABLE_AI_ALLOCATION=false` is enforced in production configuration. Production traffic uses verified deterministic campus logic.

---

## 4. Conclusion & Certification

All identified scientific and architectural inconsistencies have been corrected. The updated manuscript [`SMART_PARKING_JOURNAL_PAPER_FINAL.tex`](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/final_submission/11_journal_paper_final_corrected/SMART_PARKING_JOURNAL_PAPER_FINAL.tex) is strictly aligned with the underlying codebase, experimental telemetry, and mathematical theory.
