# MULTI-SEED STATISTICAL REPORT — SMART PARKING BTP

**Reference Framework:** MARL-GCN vs. FIFO vs. SIRO Municipal Baselines  
**Evaluation Design:** Paired Multi-Seed Randomized Trials ($N = 10$ Seeds per Scenario, 8 Scenarios = 240 Total Simulations)  
**Statistical Reviewer:** Senior Research Scientist & Statistical Auditor  
**Date:** 2026-11-16  

---

## 1. Experimental Design and Statistical Methodology

To satisfy high-impact academic standards (Henderson et al., 2018; Agarwal et al., 2021) and overcome the limitations of the preliminary $N=5$ pilot test:
1. **Paired Common Random Streams:**  
   Across every evaluation seed $s \in \{100, 147, 194, 241, 288, 335, 382, 429, 476, 523\}$, all three policies (MARL-GCN, FIFO, SIRO) were evaluated on **strictly identical vehicle arrival sequences, identical arrival timestamps, identical spatial origins, and identical dwell times**.
2. **Reported Estimators:**  
   - Mean ($\mu$) and Sample Standard Deviation ($s$, $N-1$ degrees of freedom)
   - Median and Interquartile Range (IQR $= Q_{75} - Q_{25}$)
   - Parametric 95% Confidence Intervals based on Student's $t$-distribution:
     $$\text{CI}_{95\%} = \bar{x} \pm t_{0.025, N-1} \cdot \frac{s}{\sqrt{N}}$$
3. **Hypothesis Testing:**  
   Paired two-tailed Student's $t$-test ($t$-statistic and $p$-value) comparing cruising delay between MARL-GCN and FIFO / SIRO under identical environmental conditions.

---

## 2. Statistical Metrics and Confidence Intervals (Key Scenarios)

### Scenario 2: Moderate Municipal Workload (250 Requests)
| Policy | Cruising Mean $\pm$ Std | Median (IQR) | 95% Confidence Interval |
| :--- | :---: | :---: | :---: |
| **MARL-GCN** | $6.48 \pm 0.63$ min | $6.33$ ($0.91$) min | $[6.03, 6.93]$ min |
| **FIFO** | $3.38 \pm 0.10$ min | $3.37$ ($0.16$) min | $[3.31, 3.45]$ min |
| **SIRO** | $4.45 \pm 0.48$ min | $4.44$ ($0.66$) min | $[4.11, 4.79]$ min |

- **Hypothesis Test (MARL vs. FIFO):** $t = 15.65, \, p = 1.18 \times 10^{-7}$ (Statistically Significant)
- **Hypothesis Test (MARL vs. SIRO):** $t = 8.12, \, p = 1.95 \times 10^{-5}$ (Statistically Significant)

### Scenario 3: Saturated Municipal Workload (600 Requests)
| Policy | Cruising Mean $\pm$ Std | Median (IQR) | 95% Confidence Interval |
| :--- | :---: | :---: | :---: |
| **MARL-GCN** | $20.45 \pm 1.44$ min | $20.31$ ($2.12$) min | $[19.42, 21.48]$ min |
| **FIFO** | $5.11 \pm 0.24$ min | $5.08$ ($0.38$) min | $[4.94, 5.28]$ min |
| **SIRO** | $9.10 \pm 1.14$ min | $8.95$ ($1.62$) min | $[8.28, 9.92]$ min |

- **Hypothesis Test (MARL vs. FIFO):** $t = 33.18, \, p = 2.45 \times 10^{-10}$ (Statistically Significant)
- **Hypothesis Test (MARL vs. SIRO):** $t = 20.89, \, p = 8.76 \times 10^{-9}$ (Statistically Significant)

### Scenario 4: Localized CBD Overload (65% Concentrated Demand)
| Policy | Cruising Mean $\pm$ Std | Median (IQR) | 95% Confidence Interval |
| :--- | :---: | :---: | :---: |
| **MARL-GCN** | $11.48 \pm 1.98$ min | $11.22$ ($2.84$) min | $[10.06, 12.90]$ min |
| **FIFO** | $3.64 \pm 0.10$ min | $3.63$ ($0.15$) min | $[3.57, 3.71]$ min |
| **SIRO** | $5.31 \pm 0.42$ min | $5.28$ ($0.58$) min | $[5.01, 5.61]$ min |

- **Hypothesis Test (MARL vs. FIFO):** $t = 12.44, \, p = 6.42 \times 10^{-7}$ (Statistically Significant)

---

## 3. Data Integrity & Verification
- All raw per-seed records, per-step latencies, and summary statistics are serialized in machine-readable JSON format at:  
  `research/paper_aligned/results/comprehensive_benchmark_results.json`.
- Zero manual rounding or fabricated entries.

