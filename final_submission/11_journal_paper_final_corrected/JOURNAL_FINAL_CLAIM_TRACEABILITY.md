# Final Journal Claim Traceability Matrix

**Manuscript Title:** *A Heterogeneous Graph Attention and Hypernetwork Multi-Agent Reinforcement Learning Framework for Urban Parking Search Navigation: Architectural Adaptation, Empirical Stabilization, and Scaled Benchmarking*  
**Date of Audit:** November 16, 2026  
**Auditor:** Senior Journal Editor & Software Architecture Auditor  
**Audit Standard:** 100% Traceability to Codebase Files, Line Numbers, JSON Records, and Verified Literature.

---

## 1. Traceability Matrix

| Claim ID | Paper Section | Scientific / Empirical Claim | Authoritative Repository Artifact / Source File | Specific Line Numbers / Keys | Verification Status |
|:---:|:---|:---|:---|:---:|:---:|
| **CLM-01** | Sec. 1, 3.1 | Municipal network contains 9 districts, 541 parking bays, and 29,343 daily request weights. | `research/paper_aligned/melbourne_env.py` | Lines 26--61 (`DISTRICT_CAPACITIES`, `DISTRICT_DAILY_REQUESTS`) | **CODE-VERIFIED** |
| **CLM-02** | Sec. 3.1 | Kensington has 117 bays and 1 daily request in open telemetry ($0.003\%$ demand share). | `research/paper_aligned/DATASET_AND_PREPROCESSING.md`, `melbourne_env.py` | Line 56 (`DISTRICT_DAILY_REQUESTS[3] = 1`) | **CODE-VERIFIED** |
| **CLM-03** | Sec. 3.2 | Cruising delay follows reciprocal non-linear queueing formula: $\eta_p^t = e_p (1 - \delta_p^t / \sigma_p)^{-1}$. | `research/paper_aligned/melbourne_env.py` | Lines 130--150 (`calculate_cruising_delay_paper`) | **CODE-VERIFIED** |
| **CLM-04** | Sec. 3.3 | Saturation truncation safeguard caps occupancy ratio at $\rho \le 0.95$ and delay at $\le 20 \cdot e_p$ (CBD capped at 80.0 min). | `research/paper_aligned/melbourne_env.py` | Lines 142--148 (`effective_occ_ratio = min(..., 0.95)`) | **CODE-VERIFIED** |
| **CLM-05** | Sec. 3.5 | Step reward is $r_t = \max(10 - 0.5\eta, 1.0)$ for success, $0.0$ for failure, ensuring strict dominance. | `research/paper_aligned/melbourne_env.py` | Lines 100--125 (`compute_paper_reward`) | **CODE-VERIFIED** |
| **CLM-06** | Sec. 4.1 | Two-Stage GAT implements Stage 1 intra-partition attention and Stage 2 inter-partition projection with structural masking. | `research/paper_aligned/graph_network.py` | Lines 45--140 (`TwoStageGATLayer`) | **CODE-VERIFIED** |
| **CLM-07** | Sec. 4.2 | Heterogeneous Graph Pooling uses learnable vectors $p_O, p_F$, top-$k$ gating, and permutation-invariant sum-to-max readout. | `research/paper_aligned/graph_network.py` | Lines 150--210 (`HeterogeneousGraphPooling`) | **CODE-VERIFIED** |
| **CLM-08** | Sec. 4.3 | Graph Contrastive Learning optimizes InfoNCE loss with Gaussian jitter ($\sigma=0.02$) positive samples and circular roll negatives. | `research/paper_aligned/maddpg.py` | Lines 590--597 (`self.gcl(H_t, H_pos, H_neg)`) | **CODE-VERIFIED** |
| **CLM-09** | Sec. 4.4 | Temporal modeling tracks state-action history via agent GRU: $H_t^i = \text{GRU}(H_{t-1}^i, [x_t^i \| a_{t-1}^i]) \in \mathbb{R}^{64}$. | `research/paper_aligned/hypernetwork.py` | Lines 15--60 (`AgentTemporalGRU`) | **CODE-VERIFIED** |
| **CLM-10** | Sec. 4.5 | Policy Hypernetwork dynamically generates personalized actor weights $W_{G,t}^i \in \mathbb{R}^{1 \times 32}$ and bias $b_{G,t}^i \in \mathbb{R}^1$. | `research/paper_aligned/hypernetwork.py` | Lines 65--120 (`PolicyHypernetwork`) | **CODE-VERIFIED** |
| **CLM-11** | Sec. 4.6 | Trajectory replay buffer uses sequence length $L=16$ with TBPTT initialized from stored hidden state $H_{\tau}$. | `research/paper_aligned/maddpg.py` | Lines 550--607 (`seq_len = 16`, `h_state.detach()`) | **CODE-VERIFIED** |
| **CLM-12** | Sec. 5.1 | Unconstrained single-critic MADDPG suffers catastrophic loss explosion ($31.0 \to 5.91 \times 10^{11}$). | `research/paper_aligned/training_diagnostics.json`, `fig1_maddpg_stabilization_curves.png` | `loss_history` array in diagnostic log | **ARTIFACT-VERIFIED** |
| **CLM-13** | Sec. 5.2 | Twin Critics with Clipped Double-Q, reward scaling ($0.1$), and gradient clipping ($5.0$) achieve bounded loss $\le 4.04$ and Q-mean $11.98$. | `research/paper_aligned/maddpg.py` | Lines 576--580, Line 558, Line 617 | **CODE-VERIFIED** |
| **CLM-14** | Sec. 5.2 | Spatial GAT features are detached prior to critic pooling (`X.detach()`), isolating spatial features from Bellman shocks. | `research/paper_aligned/maddpg.py` | Line 569 (`H_t, _, _ = self.hgp(X.detach())`) | **CODE-VERIFIED** |
| **CLM-15** | Sec. 5.3 | Explicit distinction: numerical loss stabilization ($\le 4.04$) does NOT prove asymptotic policy convergence under 30-episode budget. | Manuscript Section 5.3; Stage 3C1 Audit Report | Explicit methodological disclosure | **METHOD-VERIFIED** |
| **CLM-16** | Sec. 6.2 | 8 benchmark scenarios evaluated across 10 paired seeds under standardized 120-minute horizon. | `research/paper_aligned/benchmarks/run_comprehensive_benchmarks.py` | Line 290 (`episode_minutes=120`, `num_seeds=10`) | **CODE-VERIFIED** |
| **CLM-17** | Sec. 6.3 | Exact 10 seeds evaluated in benchmarks: `[100, 147, 194, 241, 288, 335, 382, 429, 476, 523]`. | `research/paper_aligned/results/comprehensive_benchmark_results.json` | `metadata['seeds']` | **ARTIFACT-VERIFIED** |
| **CLM-18** | Sec. 7.1 | Allocation acceptance rate is $100.0\% \pm 0.0\%$ across all 8 scenarios (requests assigned without immediate rejection). | `research/paper_aligned/results/comprehensive_benchmark_results.json` | `scenarios[*]['summary'][*]['allocation_rate']` | **ARTIFACT-VERIFIED** |
| **CLM-19** | Sec. 7.2 | Little's Law analysis: Scenario 3 concurrent load $L = 2.50 \times 43.29 \approx 108.2$ veh exceeds CBD capacity (83) by $1.30\times$. | Mathematical derivation; `melbourne_env.py` | Little's Law ($L = \lambda W$) | **MATH-VERIFIED** |
| **CLM-20** | Sec. 7.2 | Scenario 4 concurrent load $L = 1.896 \times 43.29 \approx 82.1$ veh ($0.989\times$ bays) + 37 initial bays occupied triggers saturation. Cumulative demand = $2.74\times$ bays. | Mathematical derivation; `melbourne_env.py` | Lines 240--254 (`init_ratio = 0.45`, `cbd_idx = 4`) | **MATH-VERIFIED** |
| **CLM-21** | Sec. 7.3 | FIFO ($2.89 \pm 0.13$ min) and SIRO ($3.35 \pm 0.12$ min) outperform MARL-GCN ($4.59 \pm 0.34$ min) in 100-request pilot benchmark ($p < 0.001$). | `research/paper_aligned/results/benchmark_comparison_results.json` | `summary[*]['mean_cruising_time_min']` | **ARTIFACT-VERIFIED** |
| **CLM-22** | Sec. 7.3 | FIFO maintains lower delay across all 8 scenarios (e.g., Scen 2: $3.38$ vs $6.48$ min, $t=15.69, p=7.61 \times 10^{-8}$). | `research/paper_aligned/results/comprehensive_benchmark_results.json` | `scenarios['Scenario 2']['hypothesis_tests']` | **ARTIFACT-VERIFIED** |
| **CLM-23** | Sec. 7.4 | Ablating GRU (No-GRU) surges delay by $+545.5\%$ ($4.64 \to 29.93$ min, $t = 37.46, p = 3.03 \times 10^{-6}$), isolating temporal recurrence. | `research/paper_aligned/results/ablation_study_results.json` | `effect_sizes['No-GRU']`, `raw_runs` | **ARTIFACT-VERIFIED** |
| **CLM-24** | Sec. 7.4 | Disabling GAT (No-GAT) descriptively reduces delay by 23.0\% ($4.64 \to 3.57$ min, raw $p = 0.0210$, Holm-adjusted $p = 0.0840 > 0.05$). | `research/paper_aligned/results/ablation_study_results.json` | `effect_sizes['No-GAT']`, paired $t$-test ($df=4$) | **ARTIFACT-VERIFIED** |
| **CLM-25** | Sec. 7.5 | CPU latency: Amortized single-agent decision $= 17.61~\mu$s, Joint 9-agent policy forward pass $= 158.52 \pm 5.76~\mu$s. | `research/paper_aligned/results/comprehensive_benchmark_results.json` | `metadata['neural_latency']`, `generate_research_figures.py` | **ARTIFACT-VERIFIED** |
| **CLM-26** | Sec. 8.2 | Campus adapter models 5 physical stalls (A1, A2, A3, B1, B2) directly with tensor shape `(1, 5, 8)` without 9-node padding. | `smart_parking_ai/campus_adapter.py`, `smart_parking_ai/neural_inference_service.py` | Lines 12--20 (`CAMPUS_SLOT_LABELS`), Lines 157--162 | **CODE-VERIFIED** |
| **CLM-27** | Sec. 8.4 | Database concurrency uses Firebase Realtime Database REST API with HTTP conditional PUT (`If-Match` ETag headers, HTTP 412 handling). | `api.py` | Lines 656--675 (`headers = {"if-match": etag_val}`) | **CODE-VERIFIED** |
| **CLM-28** | Sec. 8.4 | Production AI allocation is strictly disabled via environment configuration (`ENABLE_AI_ALLOCATION=false`). | `api.py`, `.env` | Verified active feature flag configuration | **CODE-VERIFIED** |

---

## 2. Unresolved Items & Author Decisions

1. **Author Names and Affiliations:** Left as explicit blind-review placeholders (`[Author Names Omitted for Blind Peer Review]`) pending supervisor review.
2. **Grant / Funding Acknowledgements:** Stated as placeholders in manuscript title footnotes.
3. **Target Journal Selection:** Manuscript is prepared in universal `IEEEtran` format, immediately ready for submission to *IEEE T-ITS*, *Sensors*, or *IEEE OJ-ITS*.

---

## 3. Traceability Certification

Every claim in `SMART_PARKING_JOURNAL_PAPER_FINAL.tex` maps directly to verified source lines and data records. No claims of unverified real-world deployment or unproven convergence exist.
