# FINAL SCIENTIFIC ACCEPTANCE AUDIT — SMART PARKING BTP

**Role:** Independent Senior Research Auditor, Reinforcement Learning Reviewer, Statistical Reviewer and Academic Publication Referee  
**Scope:** `research/paper_aligned/` only  
**Reference Paper:** Xiaohang Zhao and Yangzhi Yan, *"A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation"*, **Sensors** 2025, 25(8), 2389  
**Audit Date:** 2026-11-16  
**Final Verdict:** **`CONDITIONALLY READY FOR RESEARCH REVIEW`**

---

## 1. Files Inspected and Evidence Inventory

The following source code, empirical logs, serialized results, checkpoints, tests, and manuscript files were audited directly in read-only mode:

1. **Source Code:**
   - [graph_network.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py): TwoStageGATLayer, HeterogeneousGraphPooling, GraphContrastiveLearningLoss.
   - [hypernetwork.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/hypernetwork.py): AgentTemporalGRU, PolicyHypernetwork, PersonalizedAgentPolicy.
   - [maddpg.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/maddpg.py): CentralizedEvaluator, Twin Critics, MultiAgentReplayBuffer, Sequence Replay, TBPTT.
   - [melbourne_env.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/melbourne_env.py): MelbourneMunicipalParkingEnv (Table 1 541 bays, 9 districts, multi-arrival queuing).
   - [baselines_paper.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/baselines_paper.py): FIFOMunicipalPolicy, SIROMunicipalPolicy.
2. **Experimental Scripts & Unit Tests:**
   - [train_maddpg.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/train_maddpg.py): CTDE training runner with diagnostic logging and held-out evaluation.
   - [run_comprehensive_benchmarks.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/benchmarks/run_comprehensive_benchmarks.py): 8-scenario benchmark runner.
   - [run_ablations.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/benchmarks/run_ablations.py): 6-variant ablation runner.
   - [test_paper_aligned.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/test_paper_aligned.py): 17 automated unit and integration tests.
3. **Empirical Logs & Results:**
   - [training_log_maddpg_seed_42.csv](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/logs/training_log_maddpg_seed_42.csv): Original unstabilized training log ($31.0 \to 5.91 \times 10^{11}$).
   - [training_log_maddpg_stabilized_seed_42.csv](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/logs/training_log_maddpg_stabilized_seed_42.csv): Stabilized Twin-Critic log ($\le 4.04$ MSE, Q-mean 11.98).
   - [comprehensive_benchmark_results.json](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/results/comprehensive_benchmark_results.json): 8 scenarios $\times$ 3 policies $\times$ 10 paired seeds = 240 simulation episodes.
   - [ablation_study_results.json](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/results/ablation_study_results.json): 6 ablation variants $\times$ 5 seeds = 30 simulation episodes.
4. **Checkpoints:**
   - [best_maddpg_seed_42.pt](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/checkpoints/best_maddpg_seed_42.pt): Preserved pilot checkpoint.
   - [best_maddpg_stabilized_seed_42.pt](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/checkpoints/best_maddpg_stabilized_seed_42.pt): Stabilized Twin-Critic checkpoint.
5. **Manuscript & Figures:**
   - [manuscript/main.tex](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/main.tex) & [manuscript/references.bib](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/references.bib).
   - 4 publication figures in [figures/](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/figures/) and [manuscript/figures/](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/figures/).

---

## 2. AUDIT 1 — Training Stability: Loss Stabilization vs. Policy Convergence

### Empirical Verification
- **Unstabilized Baseline (`logs/training_log_maddpg_seed_42.csv`):**  
  Critic loss exploded from $31.00$ (Ep 1) to $5,655.77$ (Ep 10), $738,254.25$ (Ep 15), and **$5.91 \times 10^{11}$** (Ep 30). Unbounded positive returns with $\gamma=0.99$ and single DDPG critic overestimation caused exponential weight divergence.
- **Stabilized Twin-Critic (`logs/training_log_maddpg_stabilized_seed_42.csv`):**  
  Critic loss remained bounded: Ep 1 = $0.81$, Ep 10 = $2.43$, Ep 15 = $2.70$, Ep 20 = $3.40$, Ep 30 = **$4.04$**. Q-mean calibrated smoothly to $11.98$ (matching scaled theoretical returns $\sim 12.0$). Gradient norms were clipped at $\|\mathbf{g}\|_2 \le 5.0$.

### Critical Auditor Determination: Stability $\neq$ Convergence
- **What was achieved:** **Numerical Training Stabilization.** Divergence, `NaN`/`Inf` parameters, and explosive Bellman gradients were completely eliminated.
- **What was NOT achieved:** **Asymptotic Policy Convergence.** 30 training episodes $\times 120$ steps = $3,600$ total transitions. In continuous multi-agent reinforcement learning with 9 decentralized actors and high-dimensional graph embeddings, 3,600 transitions is an early exploratory phase. As verified in Audit 3, the policy's cruising delay has not converged to the theoretical lower bound.
- **Academic Mandate:** The manuscript must describe this run as *stabilized exploratory training*, not as full asymptotic policy convergence.

---

## 3. AUDIT 2 — Benchmark Correctness & Saturation Dynamics

### Recalculation across all 8 Scenarios ($N=10$ Paired Seeds):
All metrics in [comprehensive_benchmark_results.json](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/results/comprehensive_benchmark_results.json) were independently recalculated via Python / SciPy:

1. **Scenario 1 (Low Demand, 100 req):** $\text{SV}=100.0, \, \text{AR}=100.00\%, \, \text{OR}=10.80\%$.
2. **Scenario 2 (Moderate Demand, 250 req):** $\text{SV}=250.0, \, \text{AR}=100.00\%, \, \text{OR}=25.98\%$.
3. **Scenario 3 (Saturated Demand, 600 req):** $\text{SV}=600.0, \, \text{AR}=100.00\%, \, \text{OR}=48.46\%$.
4. **Scenario 4 (CBD Overload, 350 req, 65% in CBD):** $\text{SV}=350.0, \, \text{AR}=100.00\%, \, \text{OR}=31.13\%$.
5. **Scenario 5 (Stochastic Variance, 300 req):** $\text{SV}=300.0, \, \text{AR}=100.00\%, \, \text{OR}=25.69\%$.
6. **Scenario 6 (Demand Surge +50%, 900 req):** $\text{SV}=900.0, \, \text{AR}=100.00\%, \, \text{OR}=64.73\%$.
7. **Scenario 7 (Dwell +30%, 400 req):** $\text{SV}=400.0, \, \text{AR}=100.00\%, \, \text{OR}=37.20\%$.
8. **Scenario 8 (Capacity -25%, 350 req):** $\text{SV}=350.0, \, \text{AR}=100.00\%, \, \text{OR}=27.68\%$.

### Rigorous Saturation Analysis
Is Scenario 3 (600 requests) genuinely saturated?
- **City-Wide Network Level:** **NO.**  
  Total network capacity = 541 bays. Mean dwell time = $43.29\text{ minutes}$. Over a 120-minute simulation, natural turnovers provide $\approx 541 \times (120 / 43.29) \approx 1,500$ vehicle service opportunities. Under 600 requests, Little's Law gives concurrent occupancy $L = \lambda W = (600/120) \times 43.29 = 216.5$ vehicles ($40.0\%$ concurrent load; measured OR $= 48.46\%$ including initial baseline). Thus, network-wide capacity is not exhausted, which explains why $\text{AR} = 100\%$ and $\text{Rejections} = 0$.
- **District Level (CBD):** **YES.**  
  Melbourne CBD has only 83 bays, but receives 50% of requests ($\lambda_{\text{CBD}} = 2.5\text{ req/min} \implies L_{\text{CBD}} = 2.5 \times 43.3 = 108.2$ cars), exceeding its 83-bay capacity by $1.3\times$ (and $2.5\times$ in Scenario 4). This triggers localized queue saturation, driving CBD cruising delay to the $20\times$ cap ($80\text{ minutes}$).

---

## 4. AUDIT 3 — Policy Comparison: MARL-GCN vs. FIFO vs. SIRO

Direct empirical comparison of cruising search delay ($\mu \pm \sigma$ in minutes) from verified data:

| Scenario | MARL-GCN | FIFO Baseline | SIRO Baseline | Performance Relationship |
| :--- | :---: | :---: | :---: | :---: |
| **Scenario 1 (Low Demand)** | $3.27 \pm 0.17$ | $2.78 \pm 0.06$ | $3.03 \pm 0.16$ | $\text{FIFO} \prec \text{SIRO} \prec \text{MARL-GCN}$ |
| **Scenario 2 (Moderate Demand)** | $6.48 \pm 0.63$ | $3.38 \pm 0.10$ | $4.45 \pm 0.48$ | $\text{FIFO} \prec \text{SIRO} \prec \text{MARL-GCN}$ |
| **Scenario 3 (Saturated Demand)** | $20.45 \pm 1.44$ | $5.11 \pm 0.24$ | $9.10 \pm 1.14$ | $\text{FIFO} \prec \text{SIRO} \prec \text{MARL-GCN}$ |
| **Scenario 4 (CBD Overload)** | $11.48 \pm 1.98$ | $3.64 \pm 0.10$ | $5.31 \pm 0.42$ | $\text{FIFO} \prec \text{SIRO} \prec \text{MARL-GCN}$ |
| **Scenario 6 (Demand Surge +50%)** | $21.69 \pm 1.72$ | $7.55 \pm 0.35$ | $12.85 \pm 1.33$ | $\text{FIFO} \prec \text{SIRO} \prec \text{MARL-GCN}$ |

### Independent Auditor Finding:
**MARL-GCN has statistically significantly HIGHER (worse) cruising search delay than both FIFO and SIRO in all scenarios.**
- In Scenario 3, FIFO achieves $5.11\text{ min}$, SIRO achieves $9.10\text{ min}$, while MARL-GCN incurs $20.45\text{ min}$ ($4.0\times$ longer search time).
- In Scenario 4, FIFO achieves $3.64\text{ min}$, while MARL-GCN incurs $11.48\text{ min}$ ($3.2\times$ longer).

### Scientific Explanation of the Gap:
1. **FIFO's Optimal Reactive Queue Balancing:** In a municipal network where vehicles can be directed to any available district, FIFO evaluates the exact current ratio $\delta_p / \sigma_p$ and assigns each vehicle to the district with the lowest instantaneous queue. This greedy queue-level balancing is mathematically near-optimal for minimizing the reciprocal formula $\eta = \frac{e_p}{1 - \rho}$.
2. **Short Training Budget:** MARL-GCN's 9 continuous actor policies had only 30 episodes of training. The agents learned to distribute allocations to prevent overflow (achieving 100% allocation), but have not yet converged to the fine-grained load-balancing precision of the deterministic FIFO rule.
3. **Disclosure in Manuscript:** The manuscript in Section V-A and Table II truthfully reports these exact numbers without fabrication, which is scientifically defensible.

---

## 5. AUDIT 4 — Statistical Validation & Recalculation

Recalculated paired two-tailed Student's $t$-tests ($N=10$ paired seeds, $df = 9$):

| Scenario | MARL vs. FIFO ($t$-stat) | Exact $p$-value | MARL vs. SIRO ($t$-stat) | Exact $p$-value | Statistical Significance |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Scenario 1** | $t = 10.2484$ | $p = 2.92 \times 10^{-6}$ | $t = 3.1696$ | $p = 0.0114$ | Significant ($p < 0.05$) |
| **Scenario 2** | $t = 15.6935$ | $p = 7.61 \times 10^{-8}$ | $t = 7.9979$ | $p = 2.22 \times 10^{-5}$ | Significant ($p < 0.001$) |
| **Scenario 3** | $t = 33.8438$ | $p = 8.47 \times 10^{-11}$ | $t = 17.1434$ | $p = 3.52 \times 10^{-8}$ | Significant ($p < 0.001$) |
| **Scenario 4** | $t = 12.4606$ | $p = 5.58 \times 10^{-7}$ | $t = 10.7692$ | $p = 1.92 \times 10^{-6}$ | Significant ($p < 0.001$) |
| **Scenario 5** | $t = 5.7627$ | $p = 2.72 \times 10^{-4}$ | $t = 3.9893$ | $p = 3.16 \times 10^{-3}$ | Significant ($p < 0.01$) |
| **Scenario 6** | $t = 27.6471$ | $p = 5.14 \times 10^{-10}$ | $t = 14.3679$ | $p = 1.64 \times 10^{-7}$ | Significant ($p < 0.001$) |
| **Scenario 7** | $t = 14.7055$ | $p = 1.34 \times 10^{-7}$ | $t = 12.8966$ | $p = 4.16 \times 10^{-7}$ | Significant ($p < 0.001$) |
| **Scenario 8** | $t = 21.3882$ | $p = 5.02 \times 10^{-9}$ | $t = 18.0089$ | $p = 2.28 \times 10^{-8}$ | Significant ($p < 0.001$) |

**Auditor Verification:**  
- The seed pairing is valid: random arrival streams, timestamps, and dwells were identically generated per seed index across all three policies.
- Degrees of freedom ($df = 9$) and $t$-statistics are mathematically verified.
- The differences are statistically significant, confirming that policy actions genuinely differed.

---

## 6. AUDIT 5 — Ablation Studies Verification

Audited results from [ablation_study_results.json](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/results/ablation_study_results.json) ($N=5$ seeds, 250 requests):

| Ablation Model | Cruising Delay ($\mu \pm \sigma$) | $\Delta$ Delay vs. Full Model | Return ($\mu \pm \sigma$) | $\Delta$ Return | Impact Interpretation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Full MARL-GCN** | $4.64 \pm 0.76$ min | Reference Baseline | $1952.4 \pm 71.2$ | Reference Baseline | Baseline multi-component model |
| **No-GAT** | $3.57 \pm 0.26$ min | **$-1.07$ min ($-23.0\%$)** | $2053.6 \pm 32.0$ | **$+101.2$** | **Performance IMPROVED without GAT** |
| **No-GCL** | $4.38 \pm 0.36$ min | **$-0.25$ min ($-5.5\%$)** | $1964.1 \pm 36.3$ | **$+11.7$** | **Performance IMPROVED without GCL** |
| **No-GRU** | **$29.93 \pm 1.89$ min** | **$+25.30$ min ($\mathbf{+545.5\%}$)** | **$730.5 \pm 68.5$** | **$-1221.9$ ($\mathbf{-62.6\%}$)** | **Catastrophic Failure without GRU** |
| **No-Hypernetwork** | $4.97 \pm 1.03$ min | $+0.34$ min ($+7.3\%$) | $1938.3 \pm 52.0$ | $-14.1$ | Slight degradation without hypernet |
| **No-CTDE** | $4.29 \pm 0.46$ min | **$-0.35$ min ($-7.6\%$)** | $1979.1 \pm 42.3$ | **$+26.7$** | **Performance IMPROVED without CTDE** |

### Critical Auditor Finding on Ablations:
1. **The GRU is the Single Indispensable Module:** Without temporal memory, the system collapses ($+545.5\%$ delay explosion, $-62.6\%$ return drop).
2. **GAT and CTDE Imposed an Overhead under 30 Episodes:** Removing GAT reduced delay from $4.64\text{ min}$ to $3.57\text{ min}$ ($-23.0\%$), and removing CTDE reduced delay to $4.29\text{ min}$. In a 9-node macro graph with a 30-episode budget, complex attention matrices and 9-agent centralized critics add sample complexity that hurts exploratory performance relative to simpler MLP baselines.
3. **Deficiency in Manuscript Text:** Section V-B of [manuscript/main.tex](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/main.tex) discussed `No-GRU` and `No-Hypernetwork`, but **did not explicitly disclose that `No-GAT` achieved lower cruising delay**. This omission must be corrected before submission.

---

## 7. AUDIT 6 — Mathematical Compliance & Engineering Adaptations

| Item | Zhao & Yan (2025) Definition | Implementation in Source Code | Scientific Classification |
| :--- | :--- | :--- | :--- |
| **Eq. 1 Cruising Delay** | $\eta = e_p (1 - \delta_p / \sigma_p)^{-1}$ | Capped at $\rho \le 0.95 \implies \eta \le 20 \cdot e_p$ | **Engineering Truncation Safeguard** |
| **Eq. 4 Reward Function** | $r = \varepsilon_a$ on failure in $I_o$ | $r = 0.0$ on failure; $\max(10 - 0.5\eta, 1.0)$ on success | **MDP Incentive Alignment Adaptation** |
| **MADDPG Critic** | Single centralized critic $Q_u(H_t, A_t)$ | Twin Critics with Clipped Double-Q (TD3) | **Stabilization Extension (This Work)** |
| **Reward Scaling** | Undiscounted step rewards $r \in [1, 10]$ | Scaled by $\alpha = 0.1$ | **Numerical Gradient Scaling (This Work)** |
| **Temporal GRU** | Sequential update Eq. (6) | Sequential Trajectory Replay with TBPTT | **Recurrent Replay Formulation (This Work)**|

All adaptations are sound and mathematically justified, but must be explicitly labeled as *stabilization extensions* rather than exact literal reproductions.

---

## 8. AUDIT 7 — Research Manuscript & Overleaf Readiness

1. **LaTeX Source Check:** [manuscript/main.tex](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/main.tex) contains all 22 required academic sections in IEEEtran format.
2. **BibTeX Verification:** [references.bib](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/references.bib) has 12 complete, verified citations.
3. **Figure Embeddings:** All 4 publication figures are properly referenced and stored in [manuscript/figures/](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/figures/).
4. **Unsupported Claims Check:** The unsupported 820x GPU-vs-CPU claim was completely removed and replaced with genuine Apple Silicon CPU latency profiling ($158.5~\mu\text{s}$).
5. **Compilation Limitation:** Local host lacks `pdflatex` / `bibtex`. The package must be compiled externally via Overleaf.
6. **Double-Blind Placeholders:** Author names, departments, and email addresses correctly use peer-review placeholders.

---

## 9. Required Academic Corrections Before Submission

To bring the manuscript from *Conditionally Ready* to *Fully Ready for Submission*, the following 4 corrections must be made to [research/paper_aligned/manuscript/main.tex](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript/main.tex):

1. **Explicitly Disclose the No-GAT and No-CTDE Ablation Results:**  
   Update Section V-B to explicitly state:  
   *"Interestingly, disabling the Two-Stage GAT (No-GAT) and Centralized Evaluator (No-CTDE) yielded slight reductions in cruising search delay ($-23.0\%$ and $-7.6\%$). In a compact 9-district macro-partition topology evaluated under a 30-episode pilot horizon, complex multi-head attention weights and centralized action evaluations add optimization overhead; the system's predictive performance is primarily driven by the recurrent temporal GRU core ($+545.5\%$ delay explosion when ablated)."*
2. **Clarify Training Stability vs. Asymptotic Policy Convergence:**  
   In the Abstract, Introduction, and Section IV, replace any phrasing implying full "policy convergence" with *"numerical training stabilization of the actor-critic Bellman error"*. Disclose that multi-agent continuous action policies require extended curriculum training ($\ge 500$ episodes) to learn optimal load-balancing that matches reactive heuristics like FIFO.
3. **Disclose City-Wide vs. District Saturation in Scenario 3:**  
   In Section V-A, explicitly explain that Scenario 3 (600 requests) saturated localized district queues (CBD), but did not cause city-wide capacity exhaustion due to vehicle turnover dynamics ($1,500$ turnover opportunities across 120 minutes), which mathematically accounts for the 100% Allocation Rate across all policies.
4. **Compile Manuscript on Overleaf:**  
   Import the self-contained [research/paper_aligned/manuscript/](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/manuscript) directory into Overleaf to compile the final publication PDF.

---

## 10. Final Acceptance Decision

### **`CONDITIONALLY READY FOR RESEARCH REVIEW`**

### Scientific Justification:
The engineering implementation, mathematical formulation, training stabilization, experimental benchmarks (240 episodes), and statistical hypothesis testing are complete, rigorous, and verified against source data. However, before the research manuscript can be submitted to an IEEE Transactions or Sensors journal, the 4 academic corrections specified in Section 9 must be updated in the manuscript text to ensure total transparency regarding the ablation results (No-GAT outperforming Full Model on 9 nodes) and the distinction between training stabilization and asymptotic policy convergence.

