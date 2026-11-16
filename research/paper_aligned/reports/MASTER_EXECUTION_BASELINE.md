# MASTER EXECUTION BASELINE — SMART PARKING BTP

**Date:** 2026-11-16  
**Auditor / Engineer:** Senior Research Scientist, Reinforcement Learning Engineer, MADDPG Specialist  
**Project:** Smart Parking — BTP  
**Primary Working Directory:** `/Users/psimonpeter/Downloads/smart-parking-btp-main`  
**Research Target Directory:** `research/paper_aligned/`  
**Execution Mode:** STRICTLY PRODUCTION-ISOLATED, READ-WRITE WITHIN PERMITTED RESEARCH SCOPE ONLY.

---

## 1. System and Hardware Environment
- **Operating System:** macOS 26.3.1 (Darwin 24.3.0, arm64, Apple Silicon)
- **Python Binary:** `/opt/anaconda3/envs/smart-parking-ml/bin/python`
- **Python Version:** 3.11.18 (main, Oct 26 2026, 18:15:19) [Clang 20.1.8]
- **PyTorch Version:** 2.15.0
- **Accelerator Backend:** Apple Metal Performance Shaders (MPS) Available: `True` (Device `mps` supported; CPU used for deterministic reproducibility)
- **Key Installed Packages:** `torch==2.15.0`, `numpy==1.26.4`, `scipy==1.13.0`, `matplotlib==3.8.4`

---

## 2. Protected Production Services Status
- **Expo Daemon:** PID 44535 (`node .../expo start --tunnel -p 8081`) — **Active & Running**
- **Ngrok Tunnel:** PID 44619 (`.../ngrok start --none ...`) — **Active & Running**
- **Expo Secondary Daemon:** PID 42190 (`node .../expo start -c`) — **Active & Running**
- **Protection Mandate:** Zero modification to production endpoints, React Native frontend, Firebase services, Flask backend (`api.py`), or pre-existing campus baseline models. `ENABLE_AI_ALLOCATION` remains strictly `false`.

---

## 3. Cryptographic Baseline Hashes (Protected Pre-Existing Files)

| File Path | SHA-256 Digest | Status |
| :--- | :--- | :---: |
| `api.py` | `6a13530563b48d9a76e21d4dca0246191a94016c205a1dc420d32e6499e6d34a` | Protected Baseline |
| `smart_parking_ai/services/firebase_service.py` | `9bfa18e3edcaa3d5c43d8b6fff4942819f4ef61a131d9371a637cd133bfcdf7c` | Protected Baseline |
| `smart_parking_ai/firebase_config.py` | `e1244492daea519a56e21ffb1878421f4815cbf5d325ec1353e21444b087c15d` | Protected Baseline |
| `smart_parking_ai/models/research/scenario_data.py` | `4e905f224e766b20e365b29e744400b605afc66282e89fa07af5e3f990716222` | Protected Baseline |
| `smart_parking_ai/models/research/sim_env.py` | `a2140cae042bf4138cee89930c2e630ba3e0a0faab700a811653fca7b89c7783` | Protected Baseline |
| `smart_parking_ai/models/research/baselines.py` | `34d6739684d103c4fa31c04a875f8b0b2914535f36950fd1c4cb5d6fca15353b` | Protected Baseline |
| `smart_parking_ai/models/research/neural_agent.py` | `0af7dc6dec4d1909b7d7a8ef6ecd4a68ee16a72289bf081990515055ccaaaf14` | Protected Baseline |
| `smart_parking_ai/models/research/train_ppo.py` | `a7e496b515aa7b351f81482f5548cf47794a275d29337d0bb874c2604e21e6df` | Protected Baseline |
| `smart_parking_ai/models/research/benchmark_runner.py` | `fa16a1fdcfeaf0759cbd2fb35c6abd95841ec7b09a4709d3df3d402ac5f99758` | Protected Baseline |
| `smart_parking_ai/models/research/run_ablations.py` | `8dcabb92bc5946b6ecf50034d06e8e5cf787df598b29521524a81b3e78b0a257` | Protected Baseline |
| `smart_parking_ai/models/research/generalization_test.py` | `28c54a16473435249de0c31b5aede8905881f159c719ee9e60e9fb4b66858f52` | Protected Baseline |
| `smart_parking_ai/models/research/dataset_curator.py` | `cea404fd4f92c94c44d79fdd68bced912693235d2da8c8eddb0e388950ccf5a0` | Protected Baseline |
| `smart_parking_ai/models/research/checkpoints/best_model_seed_42.pt` | `8e6360d7f2844a3e6a983af4a426e631b097327b1841732fc833501775bfeaf5` | Protected Baseline |

---

## 4. Starting Inventory of `research/paper_aligned/`
- **Source Files:**
  - `graph_network.py`: TwoStageGATLayer, HeterogeneousGraphPooling, GraphContrastiveLearningLoss.
  - `hypernetwork.py`: AgentTemporalGRU, PolicyHypernetwork, PersonalizedAgentPolicy.
  - `maddpg.py`: CentralizedEvaluator, MultiAgentReplayBuffer, MADDPGTrainer.
  - `melbourne_env.py`: MelbourneMunicipalParkingEnv (Table 1 541 bays, 9 districts, Eq 1-4).
  - `baselines_paper.py`: FIFOPolicy, SIROPolicy.
  - `train_maddpg.py`: Pilot training runner.
  - `run_experiments.py`: Pilot benchmark comparison runner.
  - `test_paper_aligned.py`: Unit test suite (15 tests passing under `PYTHONPATH=.`).
- **Existing Artifacts:**
  - `checkpoints/best_maddpg_seed_42.pt` (Pilot checkpoint)
  - `checkpoints/final_maddpg_seed_42.pt` (Pilot checkpoint)
  - `logs/training_log_maddpg_seed_42.csv` (Demonstrating critic explosion $31.0 \to 5.91 \times 10^{11}$)
  - `results/benchmark_comparison_results.json` (Undersaturated $N=100$ pilot results)

---

## 5. Identified Baseline Deficiencies to Resolve in this Execution
1. **MADDPG Critic Explosion:** Unbounded Bellman errors, single DDPG critic overestimation, no gradient clipping, unnormalized rewards.
2. **Replay Buffer Recurrent History:** Off-policy replay currently passes dummy zeros into GRU hidden state during batch updates. Must implement sequential trajectory replay buffer or burn-in with hidden state tracking.
3. **Undersaturated Benchmark Scenarios:** Pilot tested only 100 requests (18.5% capacity), leading to identical AR/OR/SV. Must implement multi-tier workloads including high-demand saturation (600+ requests) and localized district overload.
4. **Statistical Rigor:** Must scale from $N=5$ to multi-seed rigorous experimental trials with confidence intervals, p-values, and effect sizes.
5. **Ablation Studies & Robustness:** Must systematically isolate and evaluate GAT, GCL, GRU, Hypernetwork, and CTDE components.
6. **Inference Latency Audit:** Must measure isolated neural forward latency rigorously on CPU and GPU/MPS with warmup and 1,000 iterations, discarding the invalid 820x claim.
7. **Academic Documentation & Manuscript:** Must produce comprehensive reports and update manuscript with verified equations, figures, and honest disclosures.

