# RESEARCH REPRODUCIBILITY GUIDE — SMART PARKING BTP

**Reference Paper:** Xiaohang Zhao and Yangzhi Yan, *"A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation"*, **Sensors** 2025, 25(8), 2389.  
**Research Package:** `research/paper_aligned/`  
**Date:** 2026-11-16  

---

## 1. Environment & Hardware Prerequisites

### Software Dependencies
- **Python Version:** 3.11.x (Tested on Python 3.11.18)
- **PyTorch:** 2.15.0 (CPU / MPS deterministic execution)
- **Scientific Stack:**
  - `numpy >= 1.26.0`
  - `scipy >= 1.13.0`
  - `matplotlib >= 3.8.0`

### Installation
```bash
conda create -n smart-parking-research python=3.11 -y
conda activate smart-parking-research
pip install torch numpy scipy matplotlib
```

---

## 2. Directory Structure

```text
research/paper_aligned/
├── graph_network.py          # Dynamic Heterogeneous Graph, Two-Stage GAT, HGP, GCL
├── hypernetwork.py           # Temporal GRU, Policy Hypernetwork, Personalized Policy
├── maddpg.py                 # Centralized Evaluators, Twin Critics, Sequence Replay
├── melbourne_env.py          # 9-District Melbourne Municipal Simulation (541 bays)
├── baselines_paper.py        # FIFO and SIRO Municipal Baselines
├── train_maddpg.py           # Stabilized Multi-Agent CTDE Training Runner
├── test_paper_aligned.py     # 17 Unit and Integration Test Assertions
├── benchmarks/
│   ├── run_comprehensive_benchmarks.py  # 8 Scenarios x 10 Paired Seeds
│   └── run_ablations.py                 # 6 Ablation Variants x 5 Seeds
├── checkpoints/              # Checkpoints (.pt) and Training Summaries (.json)
├── logs/                     # Training Logs (.csv)
├── results/                  # Machine-Readable Benchmark Outputs (.json)
├── figures/                  # Publication Figures (.png) and Generator Script
├── manuscript/               # Overleaf-Ready LaTeX Manuscript, BibTeX & Figures
└── reports/                  # Comprehensive Research Audit Reports (.md)
```

---

## 3. Step-by-Step Reproduction Workflow

### Step 1: Run the Automated Unit Test Suite
Execute the 17 unit and integration tests covering all graph, hypernetwork, twin critic, sequence replay, and environment modules:
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python research/paper_aligned/test_paper_aligned.py
```
*Expected Output:* `Ran 17 tests in ~0.8s ... OK`.

### Step 2: Execute Stabilized CTDE MADDPG Training
Train the stabilized Twin-Critic multi-agent architecture across 30 municipal episodes:
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python research/paper_aligned/train_maddpg.py
```
*Artifacts Generated:*
- `checkpoints/best_maddpg_stabilized_seed_42.pt`
- `logs/training_log_maddpg_stabilized_seed_42.csv`
- `checkpoints/training_summary_maddpg_stabilized_seed_42.json`

### Step 3: Run the Multi-Scenario Comparative Benchmarks
Evaluate MARL-GCN, FIFO, and SIRO across 8 municipal workload scenarios under $N=10$ paired common random seeds (240 total simulation episodes):
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python research/paper_aligned/benchmarks/run_comprehensive_benchmarks.py
```
*Artifacts Generated:*
- `results/comprehensive_benchmark_results.json`

### Step 4: Execute the Ablation Studies
Run all 6 controlled ablation variants isolating the contribution of GAT, GCL, GRU, Hypernetwork, and CTDE:
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python research/paper_aligned/benchmarks/run_ablations.py
```
*Artifacts Generated:*
- `results/ablation_study_results.json`

### Step 5: Regenerate Publication Figures
Generate the high-resolution publication figures from verified empirical results:
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python research/paper_aligned/figures/generate_research_figures.py
```
*Figures Generated in `figures/` and `manuscript/figures/`:*
- `fig1_maddpg_stabilization_curves.png`
- `fig2_multi_scenario_benchmarks.png`
- `fig3_ablation_effect_sizes.png`
- `fig4_inference_latency_distribution.png`

---

## 4. Academic Data Provenance & Calibration
- **Data Source:** City of Melbourne Open Data Portal (On-Street Parking Bay Sensors).
- **Network Dimensions:** 9 geographic districts, 541 physical bays, 29,342 weighted daily records (Table 1).
- **Dwell Time Sampling:** $\text{Gamma}(\alpha = 2.33, \theta = 18.58\text{ min})$, mean $= 43.29\text{ min}$.
- **Characterization:** Trace-calibrated discrete municipal simulation with empirical arrival distributions.
