# Test Execution and Verification Report: Paper-Aligned Implementation

**Date:** November 16, 2026  
**Test Suite:** `research/paper_aligned/test_paper_aligned.py`  
**Python Environment:** `/opt/anaconda3/envs/smart-parking-ml/bin/python` (Python 3.11.18, PyTorch 2.15.0)  
**Execution Status:** **ALL 15 TESTS PASSED (100% SUCCESS RATE)**  
**Total Test Runtime:** 0.855s

---

## 1. Test Execution Command

```bash
/opt/anaconda3/envs/smart-parking-ml/bin/python -m unittest research/paper_aligned/test_paper_aligned.py -v
```

---

## 2. Test Execution Log and Results

| # | Test Method Name | Category | Component Tested | Execution Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | `test_dynamic_graph_construction` | Architecture | Heterogeneous graph construction, 9 districts, 541 bays (Table 1), feature tensor shapes $(1, 9, 8)$ and $(1, 9, 9)$. | **PASSED** |
| **2** | `test_two_stage_gat_attention` | Architecture | Two-Stage GAT linear projection, pairwise concatenation, LeakyReLU attention logits, Softmax normalization ($\sum_j \alpha_{ij} = 1.0$). | **PASSED** |
| **3** | `test_hgp_pooling_and_permutation_invariance` | Architecture | Heterogeneous Graph Pooling (HGP) importance scoring, top-$k_h$ filtering, gating, and readout $H = [s_O \parallel s_F]$ (Eqs. 10–14). | **PASSED** |
| **4** | `test_gcl_infonce_loss` | Learning | InfoNCE auxiliary loss $L_c$ (Eq. 16), positive alignment, negative repulsion, and gradient backpropagation to $W_c$. | **PASSED** |
| **5** | `test_temporal_gru_and_hypernetwork` | Architecture | Agent temporal GRU ($H_t^i$, Eq. 6), learnable hypernetwork weight generation ($W_G, b_G$, Eq. 7), and personalized continuous policy (Eq. 8). | **PASSED** |
| **6** | `test_reciprocal_cruising_delay_equation` | Mathematical | Exact verification of Equation (1) across vacant lot ($3.0 \to 3.0$), 50% capacity ($3.0 \to 6.0$), and 80% capacity ($3.0 \to 15.0$). | **PASSED** |
| **7** | `test_reciprocal_delay_saturation_cap` | Mathematical | Numerical boundary safeguard at 100% capacity ($\delta_p = \sigma_p$), verifying finite $20\times$ penalty without floating-point overflow. | **PASSED** |
| **8** | `test_total_travel_time_equation` | Mathematical | Exact verification of Equation (2): $\text{Total travel time} = \eta_p^t + W_{pi}$ ($6.5 + 2.5 = 9.0$). | **PASSED** |
| **9** | `test_paper_reward_function` | Mathematical | Exact verification of Equation (4): success case ($10.0 - 0.5 \cdot 6.0 = 7.0$) and failure case ($0.0$). | **PASSED** |
| **10** | `test_municipal_environment_lifecycle` | Environment | Full environment reset, dynamic request generation, vehicle dwell departures, FIFO baseline stepping, and metric accumulation (SV, OR, AR). | **PASSED** |
| **11** | `test_siro_baseline_execution` | Environment | Service In Random Order (SIRO) baseline priority generation across 9 districts. | **PASSED** |
| **12** | `test_decentralized_actor_execution` | Architecture | CTDE decentralized actor: verifies agent $c_i$ evaluates action $a_t^i \in [0, 1]$ using only its local features and dynamic hypernetwork weights. | **PASSED** |
| **13** | `test_target_network_soft_updates` | Learning | Polyak soft target network update $\theta' \leftarrow \tau \theta + (1-\tau) \theta'$ verifying parameter displacement. | **PASSED** |
| **14** | `test_replay_buffer_sampling_shapes` | Learning | Multi-agent experience replay buffer transition storage and uniform batch tensor sampling. | **PASSED** |
| **15** | `test_maddpg_training_step` | Integration | End-to-end CTDE training step: Two-Stage GAT + HGP + GCL + GRU + Hypernetwork + Centralized Evaluator $Q_u$ joint loss optimization (Eqs. 17–18). | **PASSED** |

---

## 3. Raw Test Output

```text
test_decentralized_actor_execution (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_decentralized_actor_execution)
Verifies CTDE decentralized actor: agent c_i acts given only its own feature and weights. ... ok
test_dynamic_graph_construction (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_dynamic_graph_construction)
Verifies heterogeneous graph construction across 9 Melbourne districts. ... ok
test_gcl_infonce_loss (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_gcl_infonce_loss)
Verifies Graph Contrastive Learning InfoNCE loss computation and gradients (Eqs. 15-16). ... ok
test_hgp_pooling_and_permutation_invariance (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_hgp_pooling_and_permutation_invariance)
Verifies HGP importance scoring, top-k selection, and permutation-invariant readout (Eqs. 10-14). ... ok
test_maddpg_training_step (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_maddpg_training_step)
Verifies joint actor-critic CTDE update with GCL auxiliary objective (Eqs. 17-18). ... ok
test_municipal_environment_lifecycle (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_municipal_environment_lifecycle)
Verifies MelbourneMunicipalParkingEnv reset, step, and metric tracking. ... ok
test_paper_reward_function (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_paper_reward_function)
Verifies Equation (4): r_t = epsilon_a - lambda * cruising_time. ... ok
test_reciprocal_cruising_delay_equation (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_reciprocal_cruising_delay_equation)
Verifies Equation (1): eta_p = e_p * (1 - delta_p / sigma_p)^(-1). ... ok
test_reciprocal_delay_saturation_cap (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_reciprocal_delay_saturation_cap)
Verifies numerical safety capping when parking lot reaches 100% capacity. ... ok
test_replay_buffer_sampling_shapes (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_replay_buffer_sampling_shapes)
Verifies replay buffer storage and batch tensor shapes. ... ok
test_siro_baseline_execution (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_siro_baseline_execution)
Verifies SIRO municipal baseline priority generation. ... ok
test_target_network_soft_updates (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_target_network_soft_updates)
Verifies Polyak target network update theta' <- tau * theta + (1-tau) * theta'. ... ok
test_temporal_gru_and_hypernetwork (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_temporal_gru_and_hypernetwork)
Verifies GRU meta-features and hypernetwork dynamic policy parameter generation (Eqs. 6-8). ... ok
test_total_travel_time_equation (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_total_travel_time_equation)
Verifies Equation (2): Total travel time = eta_p + W_pi. ... ok
test_two_stage_gat_attention (research.paper_aligned.test_paper_aligned.TestPaperAlignedArchitecture.test_two_stage_gat_attention)
Verifies Two-Stage GAT attention normalization and feature aggregation (Eq. 9). ... ok

----------------------------------------------------------------------
Ran 15 tests in 0.855s

OK
```

