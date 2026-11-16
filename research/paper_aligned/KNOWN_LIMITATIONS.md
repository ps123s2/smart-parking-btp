# Known Methodological and Experimental Limitations

This document transparently discloses all known methodological, data, and computational limitations associated with the paper-aligned implementation in `research/paper_aligned/`.

---

## 1. Data Availability & Historical Trajectory Limitations

1. **Proprietary Vehicle Trajectories:** While the City of Melbourne openly provides on-street parking bay sensor records, geographic coordinates, and historical transaction timestamps, the base paper's exact continuous GPS search trajectories of all individual searching drivers are not published in the open data portal.
2. **Trace-Calibrated Discrete Simulation:** To bridge this gap without manufacturing unverified data, our implementation uses a trace-calibrated discrete simulation: arrival district distributions match the empirical proportions from Table 1 (50.05% CBD, 14.28% Docklands, etc.), and vehicle dwell times follow the empirical Gamma distribution ($\alpha = 2.33, \theta = 18.58$) fitted directly to Melbourne sensor records.

---

## 2. Computational & Training Scale Limitations

1. **Episode Scale:** Zhao & Yan (2025) report training over 46 full daily cycles with 29,342 requests per day using a dedicated workstation with an NVIDIA RTX 3060 GPU.
2. **CPU-Isolated Execution:** In strict compliance with the safety constraints of this audit (preserving host resources and background Expo processes), our isolated MADDPG training pipeline was executed on a single CPU thread for 30 episodes (120 requests/episode). While this completely verifies gradient backpropagation, InfoNCE contrastive alignment, and Polyak target updates, reaching asymptotic convergence comparable to 46 full days will require extended GPU training runs.

---

## 3. Behavioral and Economic Modeling Constraints

1. **Absence of Dynamic Pricing:** In common with Zhao & Yan (2025, Section 1, p. 2), the current framework does not model dynamic curbside pricing or parking fees, which can significantly influence driver parking zone choices in real-world metropolitan cores.
2. **Full Driver Compliance Assumption:** The system assumes drivers follow the platform's recommended allocation without illegal parking or non-compliance behavior.

