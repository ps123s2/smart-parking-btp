# Comparative Experiment Protocol: Municipal Parking Allocation

This document outlines the evaluation protocol comparing the paper-aligned MARL-GCN architecture with baseline algorithms on the Melbourne municipal network.

---

## 1. Experimental Setup

- **Simulation Network:** Melbourne 9-District Network (Carlton, Docklands, East Melbourne, Kensington, CBD, North Melbourne, Parkville, Southbank, West Melbourne).
- **Physical Capacity:** 541 on-street parking bays (Table 1 distribution).
- **Time Horizon:** $T = 120$ discrete simulation minutes.
- **Request Generation:** Empirical categorical sampling proportional to daily request shares from Table 1 (50.05% CBD, 14.28% Docklands, etc.). Dwell times drawn from empirical Gamma distribution $\Gamma(\alpha=2.33, \theta=18.58)$.
- **Evaluated Policies:**
  1. **MARL-GCN (MADDPG Paper-Aligned):** Two-Stage GAT + HGP + GCL + Agent Temporal GRU + Learnable Policy Hypernetwork trained via CTDE for 30 episodes.
  2. **FIFO (First-In-First-Out, Sandholm & Lai [9]):** Prioritizes requested district; if saturated, falls back to nearest adjacent vacant bay.
  3. **SIRO (Service In Random Order, Larson & Sasanuma [10]):** Allocates spaces uniformly at random across vacant facilities.

---

## 2. Evaluation Metrics

1. **Service Volume (SV, Definition 3):** Total fulfilled parking requests per episode.
2. **Occupancy Rate (OR, Equation 19):** Average percentage of physical parking bays occupied over the simulation horizon:
   $$OR = \frac{1}{T} \sum_{t=1}^T \frac{\text{Occupied Slots}_t}{541} \times 100\%$$
3. **Allocation Rate (AR, Equation 20):** Proportion of submitted requests successfully assigned to a parking bay:
   $$AR = \frac{\text{Successful Requests}}{\text{Submitted Requests}} \times 100\%$$
4. **Mean Cruising Time (Equation 1):** Average time spent cruising for parking (minutes) calculated via the reciprocal delay model:
   $$\eta_p = e_p \left(1 - \frac{\delta_p}{\sigma_p}\right)^{-1}$$
5. **Cumulative Return (Equation 4):** Total discounted reward accumulated under the base paper reward function ($r_t = \varepsilon_a - \lambda T_{\text{cruise}}$).
6. **Inference Latency:** Wall-clock CPU time per decision step (milliseconds).

---

## 3. Scientific Reproducibility Safeguards

- **Paired Seeds:** All policies are evaluated on identical request arrival sequences using common random seeds (`seed_base = 2026`).
- **Raw Data Preservation:** Full episode-by-episode records are logged to `research/paper_aligned/results/benchmark_comparison_results.json`.
- **Zero Fabrication:** All reported numbers correspond directly to actual code execution.

