# Dataset Provenance, Calibration, and Preprocessing Specification

This document details the data acquisition, empirical calibration, and preprocessing pipeline for the paper-aligned research implementation in `research/paper_aligned/`.

---

## 1. Dataset Provenance and Licensing

- **Source:** City of Melbourne Open Data Portal (*On-street Parking Bay Sensors*).
- **Public URL:** `https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/`
- **Publisher:** City of Melbourne Open Data Platform, Australia.
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Observation Period in Base Paper:** 46 days (27 March 2019 to 11 May 2019).
- **Hardware Telemetry:** In-ground geomagnetic and infrared vehicle presence sensors providing timestamped occupancy transitions.

---

## 2. Municipal Experimental Scope (Zhao & Yan 2025, Table 1)

The reference publication models 9 metropolitan districts covering 541 parking slots with 29,342 average daily parking requests:

| District Name | Number of Parking Slots | Daily Parking Requests | Capacity Share (%) | Daily Request Share (%) |
| :--- | :---: | :---: | :---: | :---: |
| **Carlton** | 71 | 805 | 13.12% | 2.74% |
| **Docklands** | 17 | 4,191 | 3.14% | 14.28% |
| **East Melbourne** | 37 | 2,283 | 6.84% | 7.78% |
| **Kensington** | 117 | 1 | 21.63% | 0.003% |
| **Melbourne (CBD)** | 83 | 14,687 | 15.34% | 50.05% |
| **North Melbourne** | 94 | 2,452 | 17.38% | 8.36% |
| **Parkville** | 34 | 411 | 6.28% | 1.40% |
| **Southbank** | 40 | 2,129 | 7.39% | 7.26% |
| **West Melbourne** | 48 | 2,384 | 8.87% | 8.12% |
| **Total** | **541** | **29,342** | **100.00%** | **100.00%** |

*Key Regional Characteristics:*
- **Melbourne CBD** represents the extreme demand bottleneck: while accounting for only 15.34% of parking capacity (83 bays), it receives 50.05% of all daily parking requests (14,687 requests/day).
- **Kensington** represents a low-density residential district: 117 bays with virtually zero on-street commercial demand (1 request/day).
- **Docklands** suffers severe spatial undersupply: only 17 bays to satisfy 4,191 daily requests (246.5 requests per bay per day).

---

## 3. Data Classification: Observed vs. Reconstructed vs. Simulated

In strict accordance with academic integrity guidelines, we explicitly distinguish the empirical and synthetic components:

1. **Observed Data:**
   - Raw parking bay sensor records, geographic coordinates, and historical transaction timestamps retrieved from the City of Melbourne portal.
   - District-level slot capacities and daily request counts extracted directly from Table 1 of Zhao & Yan (2025).
2. **Parametric Dwell Distribution Fitting (Scipy MLE):**
   - Empirical dwell durations ($N=1,000$ samples) fitted across candidate probability distributions:
     - **Gamma Distribution (Best Fit by AIC/BIC):** Shape $\alpha = 2.33$, Scale $\theta = 18.58$ ($\text{AIC} = 9213.52$, $\text{BIC} = 9223.34$, KS $D = 0.0191, p = 0.8511$).
     - **Log-Normal Distribution:** $\mu = 3.54, \sigma = 0.71$ ($\text{AIC} = 9246.50$, $\text{BIC} = 9256.32$).
     - **Weibull Distribution:** $k = 1.57, \lambda = 48.44$ ($\text{AIC} = 9250.28$, $\text{BIC} = 9260.09$).
   - *Lilliefors Limitation Disclosed:* Standard Kolmogorov-Smirnov $p$-values are non-conservative because distribution parameters were estimated from the sample without parametric bootstrapping.
3. **Simulated Municipal Network:**
   - Because the full 46-day second-by-second historical GPS trajectories of all individual private vehicles searching in Melbourne are proprietary and not released in the open data dump, the arrival sequences in `MelbourneMunicipalParkingEnv` are generated via **trace-calibrated discrete simulation**:
     - Arrival destinations are sampled from the empirical categorical distribution $\mathcal{P}(\text{district}) = \text{DailyRequests}_d / 29342$.
     - Dwell durations are sampled from the empirical Gamma distribution $\Gamma(\alpha=2.33, \theta=18.58)$.
     - Asynchronous vehicle turnovers, occupancy updates, and reciprocal queuing delays follow exact mathematical physics.

---

## 4. Normalization and Feature Preprocessing

All state observations are normalized to $[0, 1]$ before feeding into the Graph Attention Network (Section 5.1 of base paper):
- Capacity: $\text{cap} / 120.0$
- Occupancy ratio: $\text{occ} / \text{cap} \in [0.0, 1.0]$
- Distance and ETA: normalized by 20 km search radius and 60-minute time cap
- Cruising vehicles: normalized by saturation factor of 50
- Action priority scores: constrained to $[0.0, \kappa]$ with $\kappa = 1.0$ via Sigmoid activation

