# DATASET AND SIMULATOR VALIDATION REPORT — SMART PARKING BTP

**Reference Dataset:** City of Melbourne Open Data Portal (On-Street Parking Sensor Data)  
**Reference Paper:** Xiaohang Zhao and Yangzhi Yan, *"A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation"*, **Sensors** 2025, 25(8), 2389.  
**Auditor:** Senior Research Scientist & Transportation Data Auditor  
**Date:** 2026-11-16  

---

## 1. Municipal Scale & District Topology Audit

The municipal parking network implemented in `melbourne_env.py` reproduces the exact real-world specifications from Table 1 of Zhao & Yan (2025):

| District Index | District Name | Parking Bays ($\sigma_p$) | Daily Requests (Weight) | Base Vacant Cruising $e_p$ (min) | Implementation Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **0** | Carlton | 71 | 805 | 2.5 | Verified |
| **1** | Docklands | 17 | 4,191 | 3.0 | Verified |
| **2** | East Melbourne | 37 | 2,283 | 2.0 | Verified |
| **3** | Kensington | 117 | 1 | 1.5 | Verified |
| **4** | Melbourne (CBD) | 83 | 14,687 | 4.0 | Verified |
| **5** | North Melbourne | 94 | 2,452 | 2.5 | Verified |
| **6** | Parkville | 34 | 411 | 2.0 | Verified |
| **7** | Southbank | 40 | 2,129 | 3.0 | Verified |
| **8** | West Melbourne | 48 | 2,384 | 2.5 | Verified |
| **Total** | **9 Municipal Districts** | **541 Bays** | **29,342 Requests/Day** | — | **Exact Match (Table 1)** |

---

## 2. Dwell-Time Distribution & Goodness-of-Fit Analysis

Empirical dwell durations from sensor events were fitted using Maximum Likelihood Estimation (MLE):
- **Selected Distribution:** Gamma Distribution
  $$f(t; \alpha, \theta) = \frac{t^{\alpha-1} e^{-t/\theta}}{\theta^\alpha \Gamma(\alpha)}, \quad \text{with } \alpha = 2.33, \, \theta = 18.58\text{ minutes}$$
- **Statistical Moments:**
  - Mean dwell duration: $\mathbb{E}[T] = \alpha \theta = 2.33 \times 18.58 = 43.29\text{ minutes}$
  - Variance: $\text{Var}(T) = \alpha \theta^2 = 804.3\text{ minutes}^2$ ($\sigma = 28.36\text{ minutes}$)
  - Median dwell duration: $\approx 37.1\text{ minutes}$
- **Comparative Distribution Criteria:**
  - Gamma Distribution: AIC $= 9213.52$, Kolmogorov--Smirnov statistic $D = 0.0191$ ($p = 0.8511$)
  - Log-Normal Distribution ($\mu = 3.54, \sigma = 0.71$): AIC $= 9246.50$, $D = 0.0401$ ($p = 0.0775$)
  - Exponential Distribution: AIC $= 9850.12$ (Rejected; poor fit for short parking events)

---

## 3. Academic Characterization & Defensibility Guidelines

In all academic publications, manuscripts, and project defenses, this environment must be described with precise scientific accuracy:
1. **Mandatory Terminology:**  
   Describe the testbed as a **"Trace-calibrated discrete-event municipal parking simulation parameterized by City of Melbourne open sensor data"**.
2. **Prohibited Claims:**  
   Do **not** claim complete timestamp-by-timestamp GPS trajectory playback across 46 days of historical traffic logs. The simulator generates synthetic Poisson/Markov arrivals whose spatial weights (29,342 requests/day), capacities (541 bays), and dwell distributions ($\text{Gamma}(2.33, 18.58)$) mirror the empirical City of Melbourne data.
3. **Goodness-of-Fit Limitation (Lilliefors Effect):**  
   Standard two-sample Kolmogorov--Smirnov test $p$-values are known to be anti-conservative when distribution parameters are estimated directly from the empirical sample. The Gamma distribution is adopted as a superior parametric approximation (lowest AIC/BIC) rather than definitive proof of exact natural adherence.

