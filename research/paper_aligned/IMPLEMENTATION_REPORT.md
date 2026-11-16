# Paper-Aligned Implementation Report: MARL-GCN with CTDE

**Date:** November 16, 2026  
**Auditor/Engineer:** Senior Deep Reinforcement Learning Researcher & Software Architect  
**Workspace:** `research/paper_aligned/`  
**Execution Status:** Fully Implemented, Unit Tested, Trained, and Benchmarked

---

## 1. Executive Summary

This report documents the implementation of the paper-aligned architecture faithfully reproducing:
**Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation," *Sensors*, 2025, 25(8), 2389.**

All core components that were previously missing from the Smart Parking BTP project have now been developed as independent, modular components inside the isolated namespace `research/paper_aligned/`. The existing campus-adapted PPO implementation (`smart_parking_ai/models/research/`) and production Expo application (`smart-parking-app/`) remain 100% intact and preserved.

---

## 2. Component Inventory and File Mapping

| Module Name | File Path | Lines | Core Classes & Functions | Functional Purpose |
| :--- | :--- | :---: | :--- | :--- |
| **Graph Network** | `research/paper_aligned/graph_network.py` | 396 | `DynamicHeterogeneousParkingGraph`<br>`TwoStageGATLayer`<br>`HeterogeneousGraphPooling`<br>`GraphContrastiveLearningLoss` | Implements heterogeneous graph construction, Two-Stage GAT feature projection ($X = W_p \bullet G^c$, Eq. 9), HGP pooling (Eqs. 10–14), and InfoNCE contrastive loss $L_c$ (Eqs. 15–16). |
| **Hypernetwork** | `research/paper_aligned/hypernetwork.py` | 185 | `AgentTemporalGRU`<br>`PolicyHypernetwork`<br>`PersonalizedAgentPolicy` | Implements agent temporal GRU ($H_t^i$, Eq. 6), learnable hypernetwork generating agent-specific policy weights ($W_G, b_G$, Eq. 7), and continuous action evaluation ($a_t^i$, Eq. 8). |
| **MADDPG / CTDE** | `research/paper_aligned/maddpg.py` | 345 | `CentralizedEvaluator`<br>`MultiAgentReplayBuffer`<br>`MADDPGTrainer` | Implements Centralized Training with Decentralized Execution (CTDE), centralized action-value evaluator $Q_u(H_t, A_t)$ (Eq. 17), joint Bellman + contrastive loss (Eq. 18), and Polyak soft target updates. |
| **Melbourne Environment** | `research/paper_aligned/melbourne_env.py` | 275 | `MelbourneMunicipalParkingEnv`<br>`calculate_cruising_delay_paper`<br>`calculate_total_travel_time`<br>`compute_paper_reward` | Implements 9-district, 541-bay municipal network (Table 1), reciprocal cruising delay $\eta_p$ (Eq. 1), total travel time (Eq. 2), delayed reward $r_t$ (Eq. 4), and OR/AR metric tracking (Eqs. 19–20). |
| **Baselines** | `research/paper_aligned/baselines_paper.py` | 75 | `FIFOMunicipalPolicy`<br>`SIROMunicipalPolicy` | Implements paper-defined First-In-First-Out (FIFO, Sandholm & Lai [9]) and Service In Random Order (SIRO, Larson & Sasanuma [10]) on the 9-district municipal network. |
| **Test Suite** | `research/paper_aligned/test_paper_aligned.py` | 325 | `TestPaperAlignedArchitecture` (15 test cases) | Unit and integration test suite verifying graph construction, GAT, HGP, GCL, GRU, hypernetwork, equations, environment lifecycle, and end-to-end training. |
| **Training Pipeline** | `research/paper_aligned/train_maddpg.py` | 170 | `run_maddpg_training` | Orchestrates multi-episode MADDPG training with checkpointing, logging, and evaluation on the Melbourne network. |
| **Benchmark Runner** | `research/paper_aligned/run_experiments.py` | 175 | `run_comparative_benchmark` | Runs paired comparative evaluations across MADDPG, FIFO, and SIRO across 9 districts, recording raw episode JSON logs. |

---

## 3. Integration Architecture

The interaction flow between the newly implemented components is structured as follows:

```
                  [ MelbourneMunicipalParkingEnv (9 Districts, 541 Bays) ]
                                      |
                      State: Node Features (N=9, d=8), Adjacency (9x9)
                                      |
                                      v
                        [ TwoStageGATLayer (W_intra, W_inter) ]
                                      |
                            Enhanced Features X (N=9, d=32)
                                      |
            +-------------------------+-------------------------+
            |                                                   |
            v                                                   v
[ HeterogeneousGraphPooling (HGP) ]             [ AgentTemporalGRU (GRUCell) ]
            |                                                   |
Global Latent State H = [s_O || s_F]                     Meta-Features H_t^i (N=9, d=64)
            |                                                   |
            |                                                   v
            |                                      [ PolicyHypernetwork (G_w, G_b) ]
            |                                                   |
            |                                      Dynamic Weights W_{G,t}^i, b_{G,t}^i
            |                                                   |
            |                                                   v
            |                                    [ PersonalizedAgentPolicy (phi) ]
            |                                                   |
            |                                      Decentralized Actions A_t in [0, kappa]
            |                                                   |
            +-------------------------+-------------------------+
                                      |
                                      v
                    [ CentralizedEvaluator Q_u(H_t, A_t) ]
                                      |
                    Joint Objective: L_bellman + lambda * L_c
```

---

## 4. Verification of Preservation

- **Existing PPO Files:** `neural_agent.py`, `sim_env.py`, `baselines.py`, `train_ppo.py`, and `test_neural_agent.py` in `smart_parking_ai/models/research/` remain unaltered.
- **Production Files:** `api.py` and `smart-parking-app/` remain untouched.
- **Expo Process:** The Expo daemon on port 8081 remains running.

