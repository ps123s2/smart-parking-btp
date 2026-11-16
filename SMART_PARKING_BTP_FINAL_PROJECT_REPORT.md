# SMART PARKING SYSTEM USING MULTI-AGENT DEEP REINFORCEMENT LEARNING AND GRAPH CONVOLUTION NETWORKS
## Bachelor of Technology (BTP) Final Project Report

**Project Title:** Multi-Agent Deep Reinforcement Learning and Graph Attention Networks for Dynamic Urban and Campus Parking Allocation  
**Academic Degree:** Bachelor of Technology in Computer Science & Engineering  
**Academic Session:** 2025 – 2026  
**Candidate Information:** [Candidate Names / Student IDs Placeholder]  
**Project Supervisor:** [Project Supervisor Name, Title, and Department Placeholder]  
**Academic Institution:** [Department of Computer Science & Engineering, University / Institute Placeholder]  
**Submission Date:** November 2026  
**Reference Benchmark:** Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation", *Sensors* 2025, 25(8), 2389.

---

# CANDIDATE DECLARATION & APPROVAL PLACEHOLDERS

### Candidate Declaration
We hereby declare that the work presented in this Bachelor Thesis Project report entitled **"Smart Parking System Using Multi-Agent Deep Reinforcement Learning and Graph Convolution Networks"** is an authentic record of our own work carried out under the supervision of our project guide. The material presented has not been submitted elsewhere for the award of any other degree or diploma. All contributions from literature, open-source repositories, and external datasets have been duly acknowledged.

*Signatures of Candidates:*  
1. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ ([Candidate 1 Name / ID])  
2. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ ([Candidate 2 Name / ID])  
3. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ ([Candidate 3 Name / ID])  

### Certificate of Approval
This is to certify that the project report entitled **"Smart Parking System Using Multi-Agent Deep Reinforcement Learning and Graph Convolution Networks"** submitted by the above students in partial fulfillment of the requirements for the degree of Bachelor of Technology in Computer Science & Engineering is approved for academic evaluation.

*Project Supervisor:* \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
*Head of Department:* \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
*External Examiner:* \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  

---

# ABSTRACT

Vehicular cruising for on-street parking generates up to 30% of localized urban traffic congestion, resulting in significant economic waste and unnecessary greenhouse gas emissions. While static heuristics such as First-In-First-Out (FIFO) and Service-in-Random-Order (SIRO) are widely deployed due to computational simplicity, they fail to coordinate across competing facilities during regional demand surges. Recently, Zhao and Yan (*Sensors* 2025) proposed MARL-GCN, combining Graph Convolutional Networks (GCN) with a multi-agent actor--critic framework for parking search navigation.

This Bachelor Thesis Project presents the complete engineering implementation, numerical training stabilization, empirical benchmark evaluation, and mobile edge deployment of a paper-aligned heterogeneous graph attention and hypernetwork multi-agent reinforcement learning system. The contributions of this work span three interconnected domains:
1. **Machine Learning & Stabilization:** We implement the 10 core modules of the Zhao & Yan (2025) architecture in PyTorch, comprising Two-Stage Graph Attention Networks (GAT), Heterogeneous Graph Pooling (HGP), Graph Contrastive Learning (GCL), temporal GRU, and learnable policy hypernetworks. Crucially, we uncover catastrophic Bellman error explosion ($31.0 \to 5.91 \times 10^{11}$) in unconstrained multi-agent centralized critics and resolve it through Twin-Critic Clipped Double-Q updates, reward scaling ($0.1\times$), and gradient norm regularization, achieving bounded numerical stabilization (critic loss $\le 4.04$, Q-mean $11.98$).
2. **Empirical Benchmarking & Statistical Evaluation:** Benchmarking across 8 municipal workload scenarios calibrated against City of Melbourne open sensor data (9 districts, 541 bays, 240 simulation episodes, $N=10$ paired seeds) confirms a 100% Allocation Rate and zero gridlock up to 900 vehicles, while transparently reporting that deterministic FIFO achieves lower physical cruising delays under static macro-queuing. Systematic ablations ($N=5$ seeds) demonstrate that temporal GRU memory is indispensable ($+545.5\%$ delay explosion when ablated, $p = 3.03 \times 10^{-6}$), while spatial attention introduces descriptive optimization overhead under short horizons.
3. **Full-Stack Production Integration:** We bridge the research model to a real-time React Native / Expo mobile application and IoT-driven Firebase Realtime Database via a Flask REST microservice. The production layer incorporates a mathematical 5-stall Campus Adapter, sub-millisecond edge neural inference ($0.194\text{ ms}$ CPU latency), fail-closed optimistic concurrency control (Firebase `ETag` and conditional `If-Match` PUTs), and a multi-tiered fail-safe heuristic fallback engine.

The complete system has been verified through 66 automated tests (100% pass rate) and clean TypeScript compilation, providing a robust, scientifically honest, and publication-ready foundation for next-generation intelligent transportation systems.

---

# TABLE OF CONTENTS

- **Chapter 1 — Introduction**
  - 1.1 Background & The Urban Parking Problem
  - 1.2 Motivation
  - 1.3 Problem Statement
  - 1.4 Research & Project Objectives
  - 1.5 Scope of Work
  - 1.6 Key Technical & Scientific Contributions
- **Chapter 2 — Literature Review**
  - 2.1 Smart Parking Guidance Systems
  - 2.2 Traditional Allocation Heuristics (FIFO, SIRO)
  - 2.3 Graph Neural Networks & Graph Attention in ITS
  - 2.4 Deep Reinforcement Learning for Resource Allocation
  - 2.5 Multi-Agent Reinforcement Learning & CTDE
  - 2.6 The Zhao & Yan (2025) MARL-GCN Paradigm
  - 2.7 Identified Research Gaps
- **Chapter 3 — System Requirements and Analysis**
  - 3.1 Functional Requirements
  - 3.2 Non-Functional Requirements & Performance SLAs
  - 3.3 User Roles & Use Cases
  - 3.4 Hardware, Software & Environmental Constraints
- **Chapter 4 — System Architecture and Design**
  - 4.1 Global End-to-End System Architecture
  - 4.2 Frontend Architecture (React Native / Expo)
  - 4.3 Backend Architecture (Flask REST API)
  - 4.4 Distributed Database Architecture (Firebase RTDB)
  - 4.5 Campus Adapter & Graph Normalization Layer
  - 4.6 Stage 8 Neural Inference Microservice
  - 4.7 Fail-Safe Gating & Routing Engine
- **Chapter 5 — Methodology and Mathematical Formulation**
  - 5.1 Urban Network Graph Representation
  - 5.2 Reciprocal Non-Linear Cruising Delay Model
  - 5.3 Two-Stage Graph Attention Network (GAT)
  - 5.4 Heterogeneous Graph Pooling (HGP)
  - 5.5 Self-Supervised Graph Contrastive Learning (GCL)
  - 5.6 Temporal Recurrence & Policy Hypernetwork
  - 5.7 Continuous Actor Policy Execution
  - 5.8 Multi-Agent Actor-Critic & Centralized Critic Stabilization
  - 5.9 Reward Engineering & Optimization Objectives
- **Chapter 6 — Implementation Details**
  - 6.1 Complete Technology Stack
  - 6.2 PyTorch Deep Learning Pipeline
  - 6.3 Flask REST Microservice (`api.py`)
  - 6.4 Concurrency-Hardened Booking Implementation
  - 6.5 React Native Mobile Client (`smart-parking-app`)
  - 6.6 Campus Adapter Implementation (`campus_adapter.py`)
  - 6.7 Startup Pre-Warming & In-Memory Execution
- **Chapter 7 — Experimental Setup and Simulation Calibration**
  - 7.1 Dataset & Environmental Parameterization (City of Melbourne)
  - 7.2 Municipal Simulation Network (9 Districts, 541 Bays)
  - 7.3 Campus Integration Testbed (5 Stalls)
  - 7.4 Workload Scenario Configurations
  - 7.5 Baseline Algorithms
  - 7.6 Evaluation Metrics
- **Chapter 8 — Results and Discussion**
  - 8.1 Training Loss Stabilization & Q-Value Calibrations
  - 8.2 Comprehensive Multi-Scenario Benchmark Results
  - 8.3 Analysis of Saturation & Little's Law Queuing Dynamics
  - 8.4 Architectural Ablation Findings
  - 8.5 Empirical Shadow Evaluation Results
  - 8.6 Computational Latency & Edge Feasibility Profiling
- **Chapter 9 — Testing, Verification and Quality Assurance**
  - 9.1 Testing Strategy & Test Suites Overview
  - 9.2 Unit & Mathematical Invariant Testing
  - 9.3 Concurrency & Atomic Booking Testing
  - 9.4 Mobile TypeScript Type-Safety Verification
  - 9.5 Regression Testing & Test Automation
  - 9.6 Limitations of Test Coverage
- **Chapter 10 — Limitations, Threats to Validity and Future Work**
  - 10.1 Limitations of Training Budget & Convergence Evidence
  - 10.2 Simulation-to-Real-World Transfer Boundaries
  - 10.3 Continuous Policy Over-Smoothing vs. Discrete Selection
  - 10.4 Threats to Validity (Internal, Construct, External)
  - 10.5 Proposed Future Investigations
- **Chapter 11 — Conclusion**
  - 11.1 Summary of Completed Work
  - 11.2 Key Research & Engineering Findings
  - 11.3 Concluding Remarks
- **Appendices**
  - Appendix A: API Reference Documentation
  - Appendix B: Automated Test Suite Execution Summary
  - Appendix C: Installation & Reproducibility Guide
  - Appendix D: System Architecture Diagram (Mermaid Source)

---

# CHAPTER 1 — INTRODUCTION

## 1.1 Background & The Urban Parking Problem
In metropolitan centers worldwide, traffic congestion is severely exacerbated by drivers searching for curbside parking. Transportation economics studies, most notably by Donald Shoup (2005), establish that cruising for parking accounts for 30% to 50% of localized urban traffic in commercial corridors. Drivers repeatedly circle city blocks seeking available bays, precipitating intersection blockages, elevated fuel waste, and increased tailpipe emissions of carbon dioxide ($CO_2$), nitrogen oxides ($NO_x$), and fine particulate matter ($PM_{2.5}$).

Traditional smart parking systems rely on passive information dissemination—such as variable-message signs (VMS) or static smartphone maps displaying slot occupancy. However, passive information often induces a "herding effect": multiple approaching drivers simultaneously head toward the same recently vacated stall, creating secondary traffic jams and leaving distant parking facilities underutilized.

## 1.2 Motivation
Mitigating urban parking congestion requires shifting from passive monitoring to active, coordinated allocation. Graph-based spatial modeling combined with Multi-Agent Reinforcement Learning (MARL) provides an ideal paradigm: each parking facility can be represented as an autonomous agent or graph node that coordinates with neighboring facilities to balance driver arrivals across the network.

In 2025, Xiaohang Zhao and Yangzhi Yan published a foundational paper in *Sensors* entitled *"A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation"*, introducing the MARL-GCN architecture. While conceptually compelling, practical adoption of this framework requires resolving fundamental reinforcement learning optimization instabilities, verifying real-world simulation dynamics, and building production-grade integration bridges to real mobile applications.

## 1.3 Problem Statement
The objective of this project is to develop, stabilize, validate, and deploy an end-to-end intelligent parking allocation system that minimizes physical cruising search delays, prevents localized gridlock, ensures atomic distributed booking safety, and provides a seamless mobile driver experience.

Mathematically, given an urban graph $\mathcal{G} = (\mathcal{V}, \mathcal{E})$ with dynamically changing stall occupancy ratios $\delta_p^t / \sigma_p$ and a sequence of stochastic vehicle arrival requests, the system must learn continuous allocation priorities $a_t \in [0, 1]^{|\mathcal{V}|}$ that maximize long-term network-wide search efficiency while satisfying sub-50ms latency constraints.

## 1.4 Research & Project Objectives
1. **Mathematical & Deep Learning Implementation:** Faithfully implement all 10 architectural components of the Zhao & Yan (2025) MARL-GCN model in PyTorch.
2. **Resolution of Critic Explosion:** Uncover the root causes of Bellman error divergence in continuous multi-agent parking critics and implement bounded numerical stabilization.
3. **Trace-Calibrated Simulation Benchmarking:** Calibrate a 9-district, 541-bay municipal simulation environment using open sensor data from the City of Melbourne and evaluate against standard baselines across diverse traffic scenarios.
4. **Statistical & Ablation Rigor:** Execute controlled ablation studies and formal hypothesis tests with multiple-comparison corrections to identify essential components.
5. **Production Microservice & Mobile Deployment:** Develop a hardened Flask REST backend and integrate the neural engine with a React Native / Expo mobile application and IoT Firebase Realtime Database.
6. **Distributed Concurrency Hardening:** Enforce fail-closed optimistic concurrency control (`ETag` and conditional `If-Match`) to eliminate double-booking vulnerabilities.

## 1.5 Scope of Work
The project encompasses:
- The theoretical and empirical investigation of the MARL-GCN architecture.
- Numerical stabilization of the Multi-Agent Deep Deterministic Policy Gradient (MADDPG) algorithm.
- Simulation across 8 distinct demand workloads (from 100 to 900 vehicles).
- Full-stack mobile software engineering (React Native, TypeScript, Flask, Firebase).
- Edge inference latency profiling on Apple Silicon CPU.
- Safe pre-activation gating with a dedicated heuristic fallback engine.

*Exclusions:* Production activation (`ENABLE_AI_ALLOCATION=true`) in a live commercial parking facility with real drivers remains gated, pending municipal administrative approval.

## 1.6 Key Technical & Scientific Contributions
1. **Uncovering & Eliminating Bellman Error Explosion:** Identified that single-critic unconstrained MADDPG suffers exponential loss explosion ($31.0 \to 5.91 \times 10^{11}$). Resolved this via Twin Critics (TD3 principle), reward scaling ($0.1\times$), and gradient norm regularization ($\|\mathbf{g}\|_2 \le 5.0$), establishing bounded loss ($\le 4.04$).
2. **Trajectory Replay with TBPTT:** Formulated a sequential trajectory replay buffer with Truncated Backpropagation Through Time, overcoming the single-step Markov assumption that degrades recurrent GRU hidden states.
3. **Transparent Scientific Reporting:** Demonstrated that deterministic FIFO maintains lower search delays under stationary queuing, providing an honest, rigorous analysis of multi-agent continuous policy exploration under short training horizons.
4. **Ablation Isolation of Temporal Memory:** Statistically proved that recurrent GRU modeling is the single indispensable component ($p = 3.03 \times 10^{-6}$), with cruising delay exploding by $+545.5\%$ when ablated.
5. **Fail-Closed Distributed Atomicity:** Designed and verified a concurrency-hardened booking protocol using per-stall mutex serialization and conditional HTTP `If-Match` headers against Firebase RTDB.
6. **Sub-Millisecond Edge Feasibility:** Verified an isolated neural forward latency of $0.194\text{ ms}$ on CPU, satisfying urban ITS real-time deadlines by over 200x.

---

# CHAPTER 2 — LITERATURE REVIEW

## 2.1 Smart Parking Guidance Systems
Smart Parking Systems (SPS) have transitioned through three generations:
- **First Generation (Sensor Only):** Focused on in-ground ultrasonic or geomagnetic sensor deployment to detect stall occupancy, displaying binary vacant/occupied status on localized LED displays.
- **Second Generation (Centralized Heuristic Apps):** Mobile applications aggregating sensor feeds via cloud databases (e.g., Firebase, AWS IoT) and guiding drivers via greedy routing heuristics such as nearest-bay distance.
- **Third Generation (Predictive & Multi-Agent ITS):** Proactive systems utilizing deep spatio-temporal neural networks to forecast localized availability and coordinate arrival flows across multiple competing parking facilities.

## 2.2 Traditional Allocation Heuristics (FIFO, SIRO)
Classical queueing theory establishes two standard service disciplines for uncoordinated resources:
- **First-In-First-Out (FIFO):** Arriving vehicles are processed in strict chronological order and allocated to the currently available stall with the lowest localized queue ratio. FIFO represents a greedy reactive baseline that directly minimizes instantaneous search delay under stationary arrivals.
- **Service-in-Random-Order (SIRO):** Vehicles are selected from the arrival buffer with equal probability. SIRO models uncoordinated curbside cruising where competing drivers arrive simultaneously at an intersection and compete stochastically for a spotted vacancy.

While FIFO performs exceptionally well under uniform demand, it lacks forward-looking predictive awareness, precipitating severe localized gridlock when sudden demand surges concentrate in a single commercial district.

## 2.3 Graph Neural Networks & Graph Attention in ITS
Because municipal transportation systems operate over non-Euclidean road networks, conventional Convolutional Neural Networks (CNNs) operating on grid matrices are structurally ill-suited. Graph Neural Networks (GNNs) capture spatial correlations by propagating feature representations along road network edges.

Veličković et al. (2018) introduced Graph Attention Networks (GAT), introducing self-attention mechanisms into graph convolution. In urban parking systems, GAT enables dynamic weighting of neighboring facilities based on real-time traffic volume and occupancy, allowing the network to prioritize spatial relationships that matter most during peak hours.

## 2.4 Deep Reinforcement Learning for Resource Allocation
Deep Reinforcement Learning (DRL) enables autonomous agents to learn optimal control policies through trial-and-error interaction with a dynamic environment. Algorithms such as Deep Q-Networks (DQN) and Deep Deterministic Policy Gradients (DDPG) have been widely applied to traffic signal control, ride-hailing dispatch, and parking guidance. However, single-agent DRL fails to scale when applied to municipal networks with dozens of geographically dispersed parking facilities.

## 2.5 Multi-Agent Reinforcement Learning & CTDE
Multi-Agent Reinforcement Learning (MARL) models the parking ecosystem as a decentralized multi-agent system. To address non-stationarity (where each agent's environment changes as other agents learn), Lowe et al. (2017) formulated Centralized Training with Decentralized Execution (CTDE) under Multi-Agent DDPG (MADDPG). During offline training, centralized critics evaluate the joint state and joint action vector of all agents. During online inference, decentralized actors execute policies based strictly on localized observations.

## 2.6 The Zhao & Yan (2025) MARL-GCN Paradigm
Zhao and Yan (Sensors 2025) synthesized these domains into MARL-GCN:
1. Spatial graph modeling via Two-Stage GAT.
2. Feature compression via Heterogeneous Graph Pooling.
3. Feature alignment via Graph Contrastive Learning.
4. Temporal tracking via GRU.
5. Dynamic actor weight generation via Policy Hypernetworks.
6. Multi-agent continuous policy coordination via MADDPG.

## 2.7 Identified Research Gaps
Despite its theoretical elegance, critical gaps remained unaddressed in the original publication:
- **Critic Optimization Divergence:** The unconstrained DDPG critic architecture exhibits catastrophic gradient explosion and Q-value divergence in multi-agent queuing environments.
- **Replay Disconnect with Recurrence:** Standard single-step experience replay violates the Markov assumption when pairing recurrent GRU policies with dynamic environments.
- **Empirical Baseline Comparison Transparency:** The original paper did not report rigorous hypothesis testing or Holm--Bonferroni corrections against deterministic FIFO.
- **Absence of Production Deployment:** No bridge existed between the theoretical Python simulation and real-world mobile applications with distributed database concurrency.

---

# CHAPTER 3 — SYSTEM REQUIREMENTS AND ANALYSIS

## 3.1 Functional Requirements
- **FR-01 (Sensor State Acquisition):** Continuously monitor physical IR/ultrasonic sensor state arrays from Firebase Realtime Database.
- **FR-02 (Topology Mapping):** Normalize raw sensor data into standardized node feature tensors and adjacency matrices representing the parking graph.
- **FR-03 (Neural Slot Allocation):** Execute MARL-GCN neural inference to compute continuous allocation priorities and select the optimal vacant stall.
- **FR-04 (Defensive Action Masking):** Mathematically mask occupied or actively reserved stalls with $-\infty$ to eliminate collision recommendations.
- **FR-05 (Heuristic Fail-Safe Fallback):** Automatically revert to the deterministic campus heuristic allocator if the feature flag is disabled, the model is un-warmed, or an exception occurs.
- **FR-06 (Atomic Slot Reservation):** Provide atomic booking with mutex serialization and conditional HTTP `If-Match` headers against Firebase RTDB.
- **FR-07 (Driver Real-Time Sync):** Stream real-time stall occupancy and reservation status to mobile driver devices via SSE/WebSockets.
- **FR-08 (System Health Telemetry):** Expose `/api/health` reporting model readiness, pre-warming status, latency, and feature-flag configuration.

## 3.2 Non-Functional Requirements & Performance SLAs
- **NFR-01 (Neural Latency Budget):** Neural policy forward inference must execute in $< 50.0\text{ ms}$ on edge CPU (achieved: $0.194\text{ ms}$).
- **NFR-02 (API Round-Trip SLA):** End-to-end Flask allocation response time must remain $< 100.0\text{ ms}$ (achieved: $0.369\text{ ms}$).
- **NFR-03 (Zero Double-Booking):** Optimistic concurrency control must achieve a 100% rejection rate for concurrent race-condition booking requests.
- **NFR-04 (Zero Downtime Rollback):** Rollback from neural to heuristic mode must execute instantaneously ($< 30\text{ seconds}$) without service restart.
- **NFR-05 (Type Safety & Code Quality):** Zero TypeScript compilation diagnostics in mobile frontend; 100% pass rate across automated regression suites.

## 3.3 User Roles & Use Cases
- **Role 1 (Campus Driver):** Launches Expo app, views live stall availability, receives AI-recommended stall, reserves stall, and navigates via campus map.
- **Role 2 (IoT Microcontroller / ESP32):** Reads hardware ultrasonic/IR sensors and publishes state updates (`0=free, 1=occupied`) to Firebase RTDB.
- **Role 3 (System Administrator / DevOps):** Monitors system health telemetry, reviews shadow validation metrics, and manages the controlled rollout feature flag.

## 3.4 Hardware, Software & Environmental Constraints
- **Client Platform:** Cross-platform React Native / Expo running on Android, iOS, and Web.
- **Server Environment:** macOS / Linux executing Python 3.13, PyTorch 2.15, Flask 3.1.
- **Database:** Firebase Realtime Database with REST ETag concurrency support.
- **Network Boundaries:** Mobile client communicates with backend via secure HTTPS / ngrok tunnel; backend communicates with Firebase via REST HTTPS.

---

# CHAPTER 4 — SYSTEM ARCHITECTURE AND DESIGN

## 4.1 Global End-to-End System Architecture

```mermaid
flowchart TD
    subgraph Client["React Native / Expo Client (smart-parking-app)"]
        Dashboard["DashboardScreen.tsx\n(Neural Recommendation Card & Allocation Badge)"]
        Map["MapScreen.tsx\n(Interactive Map, Route Line, Slot Selection)"]
        Hook["useFirebaseParking.ts\n(Realtime RTDB Listener & Reservation Sync)"]
        APIClient["api.ts Service\n(allocateAISlot, bookSlot, getHealth)"]
    end

    subgraph Backend["Flask API Server (api.py)"]
        AuthRoute["POST /api/auth/register & /login"]
        SlotsRoute["GET /api/parking/slots"]
        RecRoute["GET /api/parking/recommendations"]
        HealthRoute["GET /api/health\n(Reports model readiness, latency, memory)"]
        AIRoute["POST /api/ai/allocate-slot\n(AI Parking Allocation Endpoint)"]
        BookRoute["POST /api/parking/book\n(Hardened Atomic Reservation Endpoint)"]

        subgraph Gates["Backend Safety & Routing Gates"]
            PrewarmCheck{"Model Loaded & Pre-warmed?"}
            FlagCheck{"ENABLE_AI_ALLOCATION == true?"}
            TopologyGuard{"Topology Valid?\n(Exactly 5 Stalls: slot1..slot5)"}
            SafetyMaskGuard{"Allocated Stall Free & Unbooked?"}
        end

        subgraph Fallback["Fail-Safe Engine"]
            HeuristicAllocator["Heuristic Engine (marl.py: select_best_slots)\n(Deterministic Distance/Availability Greedy)"]
        end

        subgraph ConcurrencyLock["Per-Stall Mutex & ETag Gate"]
            StallLock["threading.Lock(slot_id)\n(Serialization of concurrent requests)"]
            ETagFetch["Fail-Closed GET ETag\n(/data/booked_slots/{slot_id}.json)"]
            IfMatchPUT["Conditional PUT with If-Match\n(Atomic Firebase Write)"]
        end
    end

    subgraph Neural["Stage 8 MARL-GCN Neural Inference Engine (smart_parking_ai/)"]
        CampusAdapter["CampusObservationAdapter\n(campus_adapter.py)\nNode tensor: (1, 5, 8)\nAdj matrix: (1, 5, 5)"]
        GAT["TwoStageGATLayer (graph_network.py)\nSpatial Multi-Head Graph Attention"]
        GRU["AgentTemporalGRU (hypernetwork.py)\nIsolated Stateless Context (h_0=0, a_0=0)"]
        Hyper["PolicyHypernetwork (hypernetwork.py)\nGenerates Dynamic Policy Weights W_G, b_G"]
        Actor["PersonalizedAgentPolicy (hypernetwork.py)\nComputes continuous allocation priorities"]
        Masker["Defensive Masking Layer\n(-inf on occupied/booked stalls)"]
        Softmax["Softmax Selection & Greedy Argmax\nConfidence scoring & fallback trigger"]
        Weights[("Frozen Checkpoint\n(best_maddpg_stabilized_seed_42.pt)\nMD5: 5a7c2b...")]
    end

    subgraph Firebase["Firebase Realtime Database (smartparking-87cee-default-rtdb)"]
        FB_Sensors["/data/states\n(Physical IR sensor states: 0=free, 1=occupied)"]
        FB_Bookings["/data/booked_slots/{slot_id}\n(User reservations & timestamp locks)"]
        FB_Recommendations["/data/recommendation\n(Legacy heuristic recommendations)"]
    end

    %% Client Interactions
    Dashboard -->|1. Request Optimal Slot| APIClient
    Map -->|1. Request Optimal Slot| APIClient
    Dashboard -->|Reserve Slot| APIClient
    Map -->|Reserve Slot| APIClient
    APIClient -->|HTTP POST| AIRoute
    APIClient -->|HTTP POST| BookRoute
    APIClient -->|HTTP GET| HealthRoute

    %% Health & Monitoring
    HealthRoute -.->|Inspect Telemetry| PrewarmCheck

    %% State Acquisition
    AIRoute -->|2. Fetch Live Stall States| FB_Sensors
    AIRoute -->|2. Fetch Live Active Bookings| FB_Bookings

    %% Decision Gates
    AIRoute --> PrewarmCheck
    PrewarmCheck -->|No: Service Unavailable| HeuristicAllocator
    PrewarmCheck -->|Yes| FlagCheck
    FlagCheck -->|Disabled (Default: false)| HeuristicAllocator
    FlagCheck -->|Enabled (true)| TopologyGuard
    TopologyGuard -->|Mismatch: <5, >5, Dupes| HeuristicAllocator
    TopologyGuard -->|Valid: Exactly 5 slots| CampusAdapter

    %% Neural Execution Pipeline
    Weights -.->|Pre-warmed on Startup| GAT
    Weights -.->|Pre-warmed on Startup| GRU
    Weights -.->|Pre-warmed on Startup| Hyper
    Weights -.->|Pre-warmed on Startup| Actor

    CampusAdapter -->|Normalized Graph Features| GAT
    GAT -->|Spatial Feature Representations| GRU
    GRU -->|Temporal Meta-State| Hyper
    Hyper -->|Dynamic Layer Weights| Actor
    GAT -->|Node Embeddings| Actor
    Actor -->|Raw Priority Logits| Masker
    Masker -->|Mask Occupied/Booked Slots| Softmax
    Softmax --> SafetyMaskGuard
    SafetyMaskGuard -->|Collision Detected| HeuristicAllocator
    SafetyMaskGuard -->|Optimal Vacant Stall Validated| AIRoute

    HeuristicAllocator -->|Heuristic Fallback Response| AIRoute
    AIRoute -->|JSON: slot_id, confidence, latency, attribution| APIClient

    %% Booking Flow with Atomic Concurrency
    BookRoute --> StallLock
    StallLock --> ETagFetch
    ETagFetch -->|Resource ETag Valid| IfMatchPUT
    ETagFetch -->|GET Error or Missing ETag| FailClosedAbort["502 Bad Gateway / Abort"]
    IfMatchPUT -->|ETag Match: 200 OK| FB_Bookings
    IfMatchPUT -->|ETag Mismatch: 412 Precondition Failed| Conflict["409 Conflict: Already Booked"]

    %% Real-time Sync Back to App
    FB_Sensors -.->|WebSocket / SSE Stream| Hook
    FB_Bookings -.->|WebSocket / SSE Stream| Hook
    Hook -.->|State Updates| Dashboard
    Hook -.->|State Updates| Map
```

## 4.2 Frontend Architecture (React Native / Expo)
The mobile frontend is structured in modern TypeScript under Expo 51:
- `DashboardScreen.tsx`: Renders the high-level facility status, live availability stats, CO2 savings counters, and the primary AI Recommendation Banner.
- `MapScreen.tsx`: Renders an interactive top-down vector canvas showing parking aisles, individual stalls with real-time status colors (green=available, red=occupied, blue=reserved), vehicle routing paths, and booking confirmation modals.
- `useFirebaseParking.ts`: Custom React hook establishing real-time synchronization with Firebase RTDB, automatically updating component state upon sensor state changes.
- `api.ts`: Centralized strongly-typed API service managing token-authenticated communication with the Flask backend.

## 4.3 Backend Architecture (Flask REST API)
The Flask server (`api.py`) acts as the authoritative decision gate. It encapsulates authentication, sensor data ingestion, AI inference orchestration, concurrency-hardened booking, and health monitoring. It guarantees that an unavailable model or bad network request never crashes the driver's client application.

## 4.4 Distributed Database Architecture (Firebase RTDB)
Firebase Realtime Database maintains three primary JSON branches:
- `/data/states`: Integer array `[s1, s2, s3, s4, s5]` where $0 = \text{available}, 1 = \text{occupied}$, updated by IoT sensors.
- `/data/booked_slots/{slot_id}`: Objects containing active reservation metadata, driver email, booking ID, duration, and expiration timestamps.
- `/data/recommendation`: Historical logging branch storing allocation scores and telemetry.

## 4.5 Campus Adapter & Graph Normalization Layer
The Campus Adapter (`smart_parking_ai/campus_adapter.py`) bridges physical reality and research tensors:
- Reconciles historical 6-slot mockup discrepancies with the 5 physical sensor bays:
  - `slot1` $\implies$ A1 (North Aisle, 80m walking distance)
  - `slot2` $\implies$ A2 (North Aisle, 65m walking distance)
  - `slot3` $\implies$ A3 (North Aisle, 50m walking distance)
  - `slot4` $\implies$ B1 (South Aisle, 50m walking distance)
  - `slot5` $\implies$ B2 (South Aisle, 35m walking distance)
- Validates topology invariants ($|\mathcal{V}|=5$, no duplicates, valid IDs).
- Normalizes distance and capacity features into $[0, 1]$ bounds.

## 4.6 Stage 8 Neural Inference Microservice
Implemented as a thread-safe singleton (`NeuralInferenceService.get_instance()`) in `smart_parking_ai/neural_inference_service.py`. It holds the PyTorch model weights in CPU memory, applies `torch.no_grad()` evaluation semantics, executes defensive masking, and logs telemetry metrics.

## 4.7 Fail-Safe Gating & Routing Engine
The routing engine evaluates four sequential security gates before executing neural allocation:
1. `is_loaded`: Confirms checkpoint weights are present in memory.
2. `is_prewarmed`: Confirms warmup dummy forward pass executed on startup.
3. `is_ai_enabled`: Evaluates dynamic feature flag (`ENABLE_AI_ALLOCATION`).
4. `validate_topology()`: Confirms exact 5-stall input state.

If any check fails, requests seamlessly route to `marl.py: select_best_slots()`.

---

# CHAPTER 5 — METHODOLOGY AND MATHEMATICAL FORMULATION

## 5.1 Urban Network Graph Representation
We model an urban parking network as a dynamic heterogeneous graph:
$$\mathcal{G} = (\mathcal{V}, \mathcal{E}, \mathcal{W})$$
where $\mathcal{V} = \{v_1, \dots, v_N\}$ represents parking facilities, $\mathcal{E}$ represents spatial connectivity, and $\mathcal{W}$ represents adjacency weights inversely proportional to physical travel distances.

Each node $v_i$ is described by an 8-dimensional feature vector $x_i \in \mathbb{R}^8$:
$$x_i = \left[ \frac{\delta_i}{\sigma_i}, \, \frac{\sigma_i}{\sigma_{\max}}, \, \frac{e_i}{e_{\max}}, \, \frac{\text{cruising}_i}{\text{cruising}_{\max}}, \, \frac{\text{arrival}_i}{\text{arrival}_{\max}}, \, \frac{\text{walking}_i}{\text{walking}_{\max}}, \, \text{coord}_x, \, \text{coord}_y \right]$$

## 5.2 Reciprocal Non-Linear Cruising Delay Model
Following traffic flow theory, search delay $\eta_p^t$ in district $p$ at minute $t$ follows the reciprocal congestion formula:
$$\eta_p^t = e_p \cdot \left(1 - \frac{\delta_p^t}{\sigma_p}\right)^{-1}$$
where $e_p$ is base vacant cruising time, $\delta_p^t$ is active occupied bays, and $\sigma_p$ is capacity.

*Engineering Truncation Safeguard:* To prevent numerical divergence as $\delta_p \to \sigma_p$, we enforce:
$$\rho_p^t = \min\left(\frac{\delta_p^t}{\sigma_p}, \, 0.95\right), \quad \eta_p^t = \frac{e_p}{1.0 - \rho_p^t} \le 20 \cdot e_p$$

## 5.3 Two-Stage Graph Attention Network (GAT)
Spatial feature extraction is executed in two stages:
1. **Intra-Partition Attention:** Computes pairwise self-attention coefficients between connected facilities:
   $$\alpha_{ij} = \frac{\exp\left(\text{LeakyReLU}\left(\mathbf{a}^T [W_{\text{intra}} h_i \,\|\, W_{\text{intra}} h_j]\right)\right)}{\sum_{k \in \mathcal{N}_i} \exp\left(\text{LeakyReLU}\left(\mathbf{a}^T [W_{\text{intra}} h_i \,\|\, W_{\text{intra}} h_k]\right)\right)}$$
   Disconnected pairs are masked with $-9 \times 10^{15}$ before softmax.
2. **Inter-Partition Projection:** Features pass through ELU activation and linear projection $W_{\text{inter}}$ to capture regional macro-competition:
   $$X = W_{\text{inter}} * G^c \in \mathbb{R}^{B \times N \times 32}$$

## 5.4 Heterogeneous Graph Pooling (HGP)
To compress the variable-sized node representations into a fixed 64-dimensional global graph embedding $H_t$, learnable scoring vectors $p_O, p_F \in \mathbb{R}^{32 \times 1}$ evaluate node importance:
$$Y = X p, \quad X^{\text{gate}} = X^{\text{topk}} \odot \text{Softmax}(Y^{\text{topk}})$$
The readout layer aggregates sum-to-max ratios:
$$s_O = \sum_{i} x_O^{i, \text{gate}} \oslash \left(\max_{i} |x_O^{i, \text{gate}}| + \epsilon\right), \quad H_t = [s_O \,\|\, s_F] \in \mathbb{R}^{64}$$

## 5.5 Self-Supervised Graph Contrastive Learning (GCL)
An auxiliary InfoNCE contrastive objective aligns query graph representation $H_q$ with positive augmented graph $H_+$ while repelling $K-1$ negative samples $H_-$:
$$\mathcal{L}_c = -\log \frac{\exp(H_q^T W_c H_+ / \tau)}{\exp(H_q^T W_c H_+ / \tau) + \sum_{k=1}^{K-1} \exp(H_q^T W_c H_-^k / \tau)}$$
where $W_c \in \mathbb{R}^{64 \times 64}$ is a learnable bilinear projection matrix and temperature $\tau = 0.1$.

## 5.6 Temporal Recurrence & Policy Hypernetwork
Each facility agent maintains a historical temporal hidden state via a Gated Recurrent Unit (GRU):
$$H_t^i = \text{GRU}\left(H_{t-1}^i, \, [x_t^i \,\|\, a_{t-1}^i]\right) \in \mathbb{R}^{64}$$
A learnable policy hypernetwork $G$ maps temporal hidden features $H_t^i$ to dynamic policy weights:
$$W_{G,t}^i = G_w(H_t^i) \in \mathbb{R}^{1 \times 32}, \quad b_{G,t}^i = G_b(H_t^i) \in \mathbb{R}^1$$

## 5.7 Continuous Actor Policy Execution
Decentralized continuous allocation priorities in $[0, 1]$ are executed by individual agents:
$$a_t^i = \text{Sigmoid}\left(W_{G,t}^i \phi(x_t^i) + b_{G,t}^i\right) \cdot \kappa$$
where $\phi(x_t^i)$ is the localized GAT feature embedding and $\kappa = 1.0$.

## 5.8 Multi-Agent Actor-Critic & Centralized Critic Stabilization
Under Centralized Training with Decentralized Execution (CTDE), a centralized action-value evaluator $Q(H_t, A_t)$ guides decentralized policy updates. To eliminate exponential loss explosion, we implement:
1. **Twin Critics with Clipped Double-Q (TD3 Principle):** Dual centralized evaluators $Q_{\theta_1}$ and $Q_{\theta_2}$ bound overestimation:
   $$y_t = r_t^{\text{scaled}} + (1 - d_t) \gamma \min_{j=1,2} Q_{\theta_j}'(H_{t+1}, \tilde{A}_{t+1})$$
2. **Reward Scaling:** Step reward scaled by $0.1\times$, bounding discounted returns at $\le 100.0$.
3. **Gradient Norm Clipping:** Explicit parameter gradient clipping: $\|\mathbf{g}\|_2 \le 5.0$.
4. **Feature Detachment:** GAT spatial features are detached when passed to the critic ($H_t = \text{HGP}(X_{\text{GAT}}.\text{detach}())$), preventing critic gradients from destabilizing graph attention.

## 5.9 Reward Engineering & Optimization Objectives
Step reward evaluates allocation utility and search speed:
$$r_t = \sum_{a \in A_t} \left[ \mathbb{I}_{a \in \text{success}} \max(10.0 - 0.5 \eta_{p_a}, 1.0) + \mathbb{I}_{a \in \text{fail}} \cdot 0.0 \right]$$
Assigning $0.0$ to unallocated requests guarantees that successful parking strictly dominates rejection.

---

# CHAPTER 6 — IMPLEMENTATION DETAILS

## 6.1 Complete Technology Stack
- **Deep Learning Framework:** PyTorch 2.15.0 with CPU edge optimization.
- **Backend API Framework:** Flask 3.1.0 with Flask-CORS.
- **Frontend Framework:** React Native 0.74, Expo SDK 51, TypeScript 5.3.
- **Distributed Database:** Firebase Realtime Database with REST ETag concurrency.
- **Programming Languages:** Python 3.13, TypeScript / JavaScript, KaTeX / LaTeX.

## 6.2 PyTorch Deep Learning Pipeline
The neural network implementation spans three core modules in `research/paper_aligned/`:
- `graph_network.py`: Implements `TwoStageGATLayer`, `HeteroGraphPooling`, and `GraphContrastiveLearning`.
- `hypernetwork.py`: Implements `AgentTemporalGRU`, `PolicyHypernetwork`, and `PersonalizedAgentPolicy`.
- `maddpg.py`: Implements `MADDPGAgent`, `CentralizedCritic`, and `TrajectoryReplayBuffer`.

## 6.3 Flask REST Microservice (`api.py`)
`api.py` exposes seven REST endpoints:
1. `POST /api/auth/register`: Driver registration.
2. `POST /api/auth/login`: Driver authentication and token issuance.
3. `GET /api/parking/slots`: Live stall occupancy and distance retrieval.
4. `GET /api/parking/recommendations`: Legacy heuristic recommendation.
5. `POST /api/ai/allocate-slot`: MARL-GCN neural allocation with fail-safe fallback.
6. `POST /api/parking/book`: Concurrency-hardened atomic stall booking.
7. `GET /api/health`: Real-time backend and AI telemetry.

## 6.4 Concurrency-Hardened Booking Implementation
Implemented in `api.py:512-650`:
1. **Module Mutex (`_booking_lock`):** Serializes concurrent booking threads within the backend instance.
2. **Fail-Closed ETag Query:** Queries `GET /data/booked_slots/{slot_id}.json`. If the GET fails or ETag is missing, immediately returns `HTTP 502 Bad Gateway`. Unconditioned PUT is strictly unreachable.
3. **Conditional PUT (`If-Match`):** Sends `PUT` with `headers = {"if-match": etag}`. If modified concurrently, Firebase returns `HTTP 412`, which is mapped to `HTTP 409 Conflict`.
4. **Idempotency:** Duplicate booking requests for the same driver email return existing reservation metadata with `HTTP 200 OK` and `"is_duplicate": true`.

## 6.5 React Native Mobile Client (`smart-parking-app`)
Key user interfaces:
- **DashboardScreen:** Renders dynamic facility occupancy, AI allocation cards with real-time confidence scores and latency metrics, and quick reservation triggers.
- **MapScreen:** Displays custom SVG vector map of campus stalls (A1–A3, B1–B2), real-time occupancy colors, walking route paths, and modal booking dialogs. Prioritizes active user bookings over AI recommendations to prevent UI thrashing.

## 6.6 Campus Adapter Implementation (`campus_adapter.py`)
Enforces rigid mathematical invariants:
- Translates campus states `[s1, s2, s3, s4, s5]` into $(1, 5, 8)$ tensors.
- Raises `TopologyMismatchError` if stall count $<5$ or $>5$, or if duplicate IDs are passed.

## 6.7 Startup Pre-Warming & In-Memory Execution
On backend startup, `_neural_service.prewarm()` executes a dummy forward pass through PyTorch:
- Cold disk checkpoint loading: $113.85\text{ ms}$ (one-time).
- Warmup dummy pass: $0.480\text{ ms}$.
- First HTTP request inference: $0.278\text{ ms}$ (eliminates first-user cold-start delay).
- Subsequent warm inferences: $0.194\text{ ms}$ mean.

---

# CHAPTER 7 — EXPERIMENTAL SETUP AND SIMULATION CALIBRATION

## 7.1 Dataset & Environmental Parameterization (City of Melbourne)
The research environment is calibrated against open sensor data from the City of Melbourne Open Data Portal (2024), comprising 29,342 real-world daily parking events. Parking dwell durations follow a fitted Gamma distribution:
$$\text{Dwell Duration} \sim \text{Gamma}(\alpha = 2.33, \, \beta = 18.58), \quad \text{Mean} = 43.29\text{ minutes}$$

## 7.2 Municipal Simulation Network (9 Districts, 541 Bays)
Following Table 1 of Zhao & Yan (2025), the municipal simulation network is partitioned into 9 geographic districts:

| District ID | District Name | Parking Bays ($\sigma_p$) | Daily Requests | Base Cruising $e_p$ (min) |
| :---: | :--- | :---: | :---: | :---: |
| 0 | Carlton | 71 | 805 | 2.5 |
| 1 | Docklands | 17 | 4,191 | 3.0 |
| 2 | East Melbourne | 37 | 2,283 | 2.0 |
| 3 | Kensington | 117 | 1 | 1.5 |
| 4 | Melbourne (CBD) | 83 | 14,687 | 4.0 |
| 5 | North Melbourne | 94 | 2,452 | 2.5 |
| 6 | Parkville | 34 | 411 | 2.0 |
| 7 | Southbank | 40 | 2,129 | 3.0 |
| 8 | West Melbourne | 48 | 2,384 | 2.5 |
| **Total** | **9 Districts** | **541 Bays** | **29,342** | --- |

## 7.3 Campus Integration Testbed (5 Stalls)
To validate physical deployment, an on-campus testbed was instrumented:
- 5 physical parking bays: A1, A2, A3, B1, B2.
- 5 HC-SR04 ultrasonic / infrared sensors wired to ESP32 microcontrollers.
- Live telemetry streamed to Firebase RTDB `/data/states`.

*Distinction:* The Melbourne 541-bay environment is a trace-calibrated research simulation; the 5-stall campus environment is a physical edge deployment testbed.

## 7.4 Workload Scenario Configurations
Eight distinct operational scenarios were designed to evaluate robustness:
- **Scenario 1 (Low Demand):** 100 vehicle requests, nominal arrival rate.
- **Scenario 2 (Moderate Demand):** 250 vehicle requests, standard daytime traffic.
- **Scenario 3 (Saturated Demand):** 600 vehicle requests, peak rush-hour queuing.
- **Scenario 4 (CBD Overload):** 350 vehicle requests with 65% concentrated in District 4.
- **Scenario 5 (Stochastic Variance):** 300 vehicle requests with high arrival/dwell variance.
- **Scenario 6 (Demand Surge):** 900 vehicle requests (+50% volume surge).
- **Scenario 7 (East Asymmetry):** 350 vehicle requests concentrated in East districts.
- **Scenario 8 (Turnover Stress):** 350 vehicle requests with 50% shorter dwell times.

## 7.5 Baseline Algorithms
- **FIFO (First-In-First-Out):** Centralized queue balancing allocating arriving vehicles to the vacant bay with lowest localized queue ratio.
- **SIRO (Service-in-Random-Order):** Stochastic selection baseline modeling uncoordinated cruising.

## 7.6 Evaluation Metrics
- **Allocation Rate (%):** Percentage of vehicle requests successfully assigned to a parking stall upon arrival.
- **Cruising Delay (minutes):** Search time spent cruising between initial request and bay occupancy.
- **Cumulative Episode Return:** Total discounted reward accumulated across the episode.
- **Inference Latency (ms):** Pure neural forward execution duration.

---

# CHAPTER 8 — RESULTS AND DISCUSSION

## 8.1 Training Loss Stabilization & Q-Value Calibrations
In initial experiments using unconstrained single-critic MADDPG, the centralized critic experienced catastrophic Bellman loss explosion: critic MSE exploded from $31.0$ at episode 1 to $5.91 \times 10^{11}$ at episode 15, precipitating `NaN` gradients and policy collapse.

Under our stabilized Twin-Critic Clipped Double-Q architecture with reward scaling ($0.1\times$) and gradient clipping ($\|\mathbf{g}\|_2 \le 5.0$):
- Critic MSE loss remained bounded at $\le 4.04$ across all 30 episodes.
- Centralized Q-mean calibrated stably at $11.98 \pm 0.45$.
- Held-out evaluation return reached $998.0$, confirming that numerical stability was completely established.

*Loss Stabilization vs Policy Convergence:* We emphasize that achieving bounded critic loss confirms numerical training stability, but does not imply asymptotic policy convergence. Full convergence on high-dimensional multi-agent graph topologies requires curriculum training across $\ge 500$ episodes.

## 8.2 Comprehensive Multi-Scenario Benchmark Results
Table 8.1 summarizes the benchmark evaluation across all 8 scenarios ($N=10$ paired seeds, 240 simulation episodes):

### Table 8.1: Multi-Scenario Benchmark Results ($N=10$ Paired Seeds, 240 Episodes)

| Scenario | Policy Method | Allocation Rate (%) | Cruising Delay (min) | 95% CI Delay | Cumulative Return |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Scenario 1: Low** | MARL-GCN | $100.00 \pm 0.00$ | $3.27 \pm 0.17$ | $[3.15, 3.39]$ | $836.5 \pm 8.5$ |
| (100 req) | FIFO | $100.00 \pm 0.00$ | $2.78 \pm 0.06$ | $[2.74, 2.82]$ | $861.2 \pm 2.9$ |
| | SIRO | $100.00 \pm 0.00$ | $3.03 \pm 0.16$ | $[2.91, 3.14]$ | $848.7 \pm 7.8$ |
| **Scenario 2: Moderate**| MARL-GCN | $100.00 \pm 0.00$ | $6.48 \pm 0.63$ | $[6.03, 6.93]$ | $1747.6 \pm 93.4$ |
| (250 req) | FIFO | $100.00 \pm 0.00$ | $3.38 \pm 0.10$ | $[3.31, 3.45]$ | $2077.1 \pm 12.3$ |
| | SIRO | $100.00 \pm 0.00$ | $4.45 \pm 0.48$ | $[4.10, 4.79]$ | $1975.2 \pm 31.0$ |
| **Scenario 3: Saturated**| MARL-GCN | $100.00 \pm 0.00$ | $20.45 \pm 1.44$ | $[19.42, 21.48]$ | $2531.9 \pm 167.4$ |
| (600 req) | FIFO | $100.00 \pm 0.00$ | $5.11 \pm 0.24$ | $[4.94, 5.28]$ | $4481.1 \pm 63.8$ |
| | SIRO | $100.00 \pm 0.00$ | $9.10 \pm 1.14$ | $[8.28, 9.92]$ | $3764.3 \pm 205.7$ |
| **Scenario 4: CBD Overload**| MARL-GCN | $100.00 \pm 0.00$ | $11.48 \pm 1.98$ | $[10.06, 12.89]$ | $1991.5 \pm 150.5$ |
| (65% in CBD) | FIFO | $100.00 \pm 0.00$ | $3.64 \pm 0.10$ | $[3.57, 3.71]$ | $2863.4 \pm 17.0$ |
| | SIRO | $100.00 \pm 0.00$ | $5.31 \pm 0.42$ | $[5.01, 5.61]$ | $2655.4 \pm 52.2$ |
| **Scenario 5: Variance** | MARL-GCN | $100.00 \pm 0.00$ | $6.37 \pm 1.64$ | $[5.20, 7.54]$ | $2114.8 \pm 134.9$ |
| (High arrival var) | FIFO | $100.00 \pm 0.00$ | $3.38 \pm 0.09$ | $[3.32, 3.45]$ | $2492.6 \pm 13.8$ |
| | SIRO | $100.00 \pm 0.00$ | $4.51 \pm 0.62$ | $[4.07, 4.95]$ | $2361.5 \pm 55.0$ |
| **Scenario 6: Surge** | MARL-GCN | $100.00 \pm 0.00$ | $21.69 \pm 1.72$ | $[20.46, 22.92]$ | $3354.1 \pm 365.8$ |
| (900 req) | FIFO | $100.00 \pm 0.00$ | $7.55 \pm 0.35$ | $[7.30, 7.80]$ | $5726.3 \pm 139.3$ |
| | SIRO | $100.00 \pm 0.00$ | $12.85 \pm 1.39$ | $[11.85, 13.84]$ | $4869.6 \pm 208.7$ |
| **Scenario 7: Asymmetry**| MARL-GCN | $100.00 \pm 0.00$ | $4.64 \pm 0.50$ | $[4.28, 4.99]$ | $2286.0 \pm 49.3$ |
| (East focus) | FIFO | $100.00 \pm 0.00$ | $3.16 \pm 0.08$ | $[3.10, 3.22]$ | $2465.7 \pm 10.3$ |
| | SIRO | $100.00 \pm 0.00$ | $4.18 \pm 0.44$ | $[3.87, 4.50]$ | $2371.3 \pm 36.3$ |
| **Scenario 8: Turnover** | MARL-GCN | $100.00 \pm 0.00$ | $10.05 \pm 2.06$ | $[8.58, 11.53]$ | $2006.1 \pm 221.7$ |
| (Short dwell) | FIFO | $100.00 \pm 0.00$ | $3.97 \pm 0.09$ | $[3.91, 4.04]$ | $2805.4 \pm 16.9$ |
| | SIRO | $100.00 \pm 0.00$ | $6.07 \pm 0.61$ | $[5.64, 6.50]$ | $2531.6 \pm 71.6$ |

*Empirical Finding:* Across all 8 scenarios, deterministic FIFO achieved the lowest physical cruising search delay (e.g., $3.38\text{ min}$ vs $6.48\text{ min}$ in Scenario 2). Paired two-tailed Student's $t$-tests ($df=9$) confirm statistical significance ($p < 0.001$, remaining significant at $p_{\text{Holm}} \le 2.72 \times 10^{-4}$ under Holm--Bonferroni correction). FIFO operates as an instantaneous greedy queue balancer that directly minimizes $\eta = e_p / (1 - \rho)$. MARL-GCN learned to distribute vehicles to prevent overflow, but under 30 training episodes, has not converged to the fine-grained precision of deterministic FIFO.

## 8.3 Analysis of Saturation & Little's Law Queuing Dynamics
A critical distinction must be drawn between city-wide network capacity and localized district saturation:
- **Theoretical Network Capacity:** Across the 9 districts, total capacity is 541 bays. Under a mean dwell duration of $W = 43.29\text{ min}$, each bay turns over approximately $120 / 43.29 \approx 2.77$ times during a 120-minute simulation. Under idealized 100% continuous utilization, the network could theoretically offer up to $541 \times 2.77 \approx 1,500$ vehicle service opportunities.
- **Little's Law Analysis of Localized CBD Saturation:** Under Scenario 3 (600 requests), approximately 50% of traffic seeks parking in District 4 (Melbourne CBD), yielding an arrival rate $\lambda_{\text{CBD}} = 300 / 120 = 2.5\text{ vehicles/min}$. By Little's Law, the expected concurrent parked load in CBD is $L_{\text{CBD}} = \lambda_{\text{CBD}} \times W = 2.5 \times 43.29 \approx 108.2\text{ vehicles}$. Because CBD capacity is only 83 bays, concurrent demand exceeds local capacity by $1.3\times$ (and by $2.5\times$ in Scenario 4). This triggers severe localized queue congestion, pushing CBD occupancy to the 0.95 cap and driving cruising delay to 80.0 min.

## 8.4 Architectural Ablation Findings
To evaluate the contribution of each module, 6 controlled variants were evaluated under identical conditions (250 requests, 120 minutes, $N=5$ seeds):

### Table 8.2: Architectural Ablation Results ($N=5$ Seeds)

| Model Variant | Cruising Delay (min) | Delay $\Delta$ (min) | % Change in Delay | Cumulative Return | Return $\Delta$ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Full MARL-GCN (Baseline)**| $4.64 \pm 0.76$ | $0.00$ | $0.0\%$ | $1952.4 \pm 71.2$ | $0.0$ |
| **No-GAT (Spatial Attention)** | $3.57 \pm 0.26$ | $-1.07$ | $-23.0\%$ | $2053.6 \pm 32.0$ | $+101.2$ |
| **No-GCL (Contrastive Loss)** | $4.38 \pm 0.36$ | $-0.25$ | $-5.5\%$ | $1964.1 \pm 36.3$ | $+11.7$ |
| **No-GRU (Temporal Memory)** | **$29.93 \pm 1.89$** | **$+25.30$** | **$+545.5\%$** | **$730.5 \pm 68.5$** | **$-1221.9$** |
| **No-Hypernetwork (Static)** | $4.97 \pm 1.03$ | $+0.34$ | $+7.3\%$ | $1938.3 \pm 52.0$ | $-14.1$ |
| **No-CTDE (Decentralized)** | $4.29 \pm 0.46$ | $-0.35$ | $-7.6\%$ | $1979.1 \pm 42.3$ | $+26.7$ |

*Key Ablation Insights:*
1. **GRU is Indispensable:** Removing temporal recurrence (No-GRU) precipitates a catastrophic $+545.5\%$ surge in cruising delay ($4.64 \to 29.93\text{ min}$) and a $62.6\%$ collapse in episode return ($t = -37.46, p = 3.03 \times 10^{-6}$). Temporal memory of previous facility occupancy is essential for intelligent allocation.
2. **Attention Overhead on Compact Topologies:** Disabling spatial attention (No-GAT) descriptively reduced cruising delay by 23.0% ($4.64 \to 3.57\text{ min}$). On a compact 9-district macro-partition, multi-head attention introduces parameter overhead during early training, whereas a flat MLP learns effective representations faster under a 30-episode budget.

## 8.5 Empirical Shadow Evaluation Results
Shadow evaluation ran 20 non-destructive scenario evaluations in memory:
- **Allocation Validity Rate:** $100.0\%$ (0 occupied or reserved stalls were ever allocated).
- **Agreement with Heuristic:** $20.0\%$. The heuristic strictly targets the closest bay (`slot5`, 35m), whereas the neural policy distributes traffic between Aisle A (`slot2`, `slot3`) and Aisle B (`slot4`, `slot5`) based on localized capacity and graph connectivity.
- **Fail-Safe Fallback Rate:** $10.0\%$ (triggered strictly during simulated model outage and invalid 6-stall topology rejection, verifying fail-closed safety).

## 8.6 Computational Latency & Edge Feasibility Profiling
Prior informal claims asserted an "820$\times$ speedup" over Zhao & Yan's GPU baseline of 170~ms. We refuted this as an invalid comparison between pure neural forward execution and an entire microscopic SUMO simulation cycle.

Rigorous latency profiling on Apple Silicon CPU (PyTorch 2.15) established:
- **Single-Agent Decision Latency:** $17.61~\mu\text{s}$.
- **Joint 9-Agent Policy Forward Pass:** $158.52 \pm 5.76~\mu\text{s}$ (Median: $156.35~\mu\text{s}$, P95: $172.54~\mu\text{s}$).
- **Flask End-to-End API Latency:** $0.369\text{ ms}$ mean, $0.444\text{ ms}$ P95.
- **SUMO Microscopic Simulation Step (Zhao & Yan GPU):** $170.0\text{ ms}$.

The neural policy executes in under $160~\mu\text{s}$, satisfying urban ITS deadlines ($< 50\text{ ms}$) by over 200x.

---

# CHAPTER 9 — TESTING, VERIFICATION AND QUALITY ASSURANCE

## 9.1 Testing Strategy & Test Suites Overview
The quality assurance strategy encompasses 8 dedicated automated test suites verifying every layer of the stack:

| Test Suite | Tests | Scope | Result |
| :--- | :---: | :--- | :---: |
| `test_stage_8_12_hardening.py` | 15 | Fail-closed ETag retrieval, topology invariants, startup gates | **15 / 15 PASS** |
| `test_stage_8_10_remediation.py` | 15 | Booking mutex, race condition 412 mapping, state isolation | **15 / 15 PASS** |
| `test_campus_adapter.py` | 5 | Feature tensor dimensions, adjacency weights, slot labels | **5 / 5 PASS** |
| `test_neural_inference_service.py` | 5 | Checkpoint loading, GAT message passing, defensive masking | **5 / 5 PASS** |
| `test_api_integration.py` | 5 | Endpoint schemas, feature flag toggling, heuristic fallbacks | **5 / 5 PASS** |
| `test_shadow_evaluation.py` | 10 | Paired decision comparisons across 10 nominal states | **10 / 10 PASS** |
| `test_end_to_end_regression.py` | 10 | Full-system regression from UI payload to Firebase response | **10 / 10 PASS** |
| `test_comprehensive_shadow_evaluation.py` | 1 (20 runs)| Comprehensive 11-scenario non-destructive shadow evaluation | **1 / 1 PASS** |
| **Total Test Execution** | **66** | **End-to-End System Quality Assurance** | **100% PASS** |

## 9.2 Unit & Mathematical Invariant Testing
- Verified that observation tensors match $(1, 5, 8)$ and action logits match $(1, 5, 1)$.
- Verified that defensive masking sets $-\infty$ for occupied stalls, resulting in exact 0 probability after softmax.
- Verified that `TopologyMismatchError` is raised on input arrays with $<5$ or $>5$ stalls.

## 9.3 Concurrency & Atomic Booking Testing
- Serialized execution verified via `_booking_lock`.
- Verified that missing or whitespace ETag headers abort with `HTTP 502 Bad Gateway`.
- Verified that concurrent double-booking receives `HTTP 412 Precondition Failed` from Firebase RTDB and is mapped to `HTTP 409 Conflict`.
- Verified that duplicate booking by the same driver email returns `HTTP 200 OK` with `"is_duplicate": true`.

## 9.4 Mobile TypeScript Type-Safety Verification
Executed `npx tsc --noEmit` across `smart-parking-app`:
- **Result:** Exit Code 0; zero syntax, import, or type diagnostics.
- Verified strong typing for `AIAllocationResponse`, `BookSlotResponse`, and `SlotCard` props.

## 9.5 Regression Testing & Test Automation
Executed the complete test suite:
```
Ran 66 tests in 0.104s
OK (0 failures, 0 errors)
```

## 9.6 Limitations of Test Coverage
- Concurrency and Firebase tests utilize mock HTTP injection rather than live production Firebase writes to protect production database integrity.
- Physical sensor telemetry relies on simulated state streams in unit testing.

---

# CHAPTER 10 — LIMITATIONS, THREATS TO VALIDITY AND FUTURE WORK

## 10.1 Limitations of Training Budget & Convergence Evidence
Training was conducted under a 30-episode exploratory budget (3,600 environment transitions). While numerical stability (critic loss $\le 4.04$) was formally achieved, full asymptotic policy convergence on high-dimensional multi-agent graph topologies typically requires extended curriculum learning ($\ge 500$ episodes).

## 10.2 Simulation-to-Real-World Transfer Boundaries
The research simulator represents a trace-calibrated discrete simulation parameterized by City of Melbourne open sensor distributions ($\text{Gamma}(2.33, 18.58)$, 541 bays across 9 districts), rather than a live hardware-in-the-loop vehicle GPS replay.

## 10.3 Continuous Policy Over-Smoothing vs. Discrete Selection
The continuous actor outputs priority logits $a_t \in [0, 1]$, which are decoded via argmax. In uniform demand scenarios, continuous gradients can induce policy over-smoothing across adjacent nodes.

## 10.4 Threats to Validity
- **Internal Validity:** Small seed samples ($N=10$ for benchmarks, $N=5$ for ablations); 30-episode training horizon.
- **Construct Validity:** Cruising delay is modeled via the reciprocal non-linear queuing equation $\eta = e_p / (1 - \delta / \sigma)$. Real-world cruising duration also depends on traffic signals, turn delays, and visual scanning.
- **External Validity:** Generalizability to continuous micro-street networks requires empirical re-calibration of adjacency matrices and arrival priors.

## 10.5 Proposed Future Investigations
1. **Scaled Curriculum Training:** Training across 500+ episodes with prioritized experience replay to evaluate whether MARL-GCN can surpass deterministic FIFO under dynamic non-stationary surges.
2. **Action Space Discretization:** Investigating discrete multi-agent parameterizations (e.g., QMIX or MAPPO) to evaluate discrete bay selection.
3. **Simulation-to-Real Domain Adaptation:** Bridging the municipal 541-bay research simulation and the 5-stall campus IoT testbed via transfer learning.

---

# CHAPTER 11 — CONCLUSION

## 11.1 Summary of Completed Work
This Bachelor Thesis Project successfully designed, implemented, stabilized, validated, and deployed a paper-aligned Multi-Agent Reinforcement Learning and Graph Attention Network (MARL-GCN) intelligent parking allocation system. The implementation encompasses the complete stack: PyTorch deep learning models, trace-calibrated municipal simulation, hardened Flask microservices, distributed Firebase concurrency control, and a modern React Native / Expo mobile application.

## 11.2 Key Research & Engineering Findings
1. **Numerical Stabilization:** Unconstrained continuous actor--critic parking models suffer exponential critic loss explosion. Twin-Critic Clipped Double-Q updates, reward scaling, and gradient clipping resolve this divergence, establishing bounded numerical loss ($\le 4.04$).
2. **Ablation Role of GRU:** Temporal memory is the single indispensable component ($+545.5\%$ delay explosion when ablated, $p = 3.03 \times 10^{-6}$).
3. **Attention Overhead:** On compact macro-topologies, spatial attention matrices introduce optimization overhead under short training horizons, allowing flat MLP baselines to learn faster.
4. **Transparent Benchmark Evaluation:** Deterministic FIFO achieves lower search delays under stationary macro-queuing, refuting unqualified claims of early reinforcement learning superiority.
5. **Production Edge Feasibility:** Pure neural forward execution requires $158.5~\mu\text{s}$ on CPU, demonstrating complete feasibility for sub-50ms edge deployment.

## 11.3 Concluding Remarks
The developed system demonstrates that modern deep reinforcement learning and graph attention networks can be successfully combined with robust distributed systems engineering to create next-generation intelligent transportation solutions. By openly reporting experimental realities, identifying convergence boundaries, and enforcing fail-closed production safety, this project establishes a credible, rigorous, and publication-ready contribution to smart mobility research.

---

# APPENDICES

## Appendix A: API Reference Documentation
Summary of endpoints exposed by `api.py`:
- `POST /api/ai/allocate-slot`: Accepts `{"user_id": string}`. Gated by `ENABLE_AI_ALLOCATION`. Returns allocated stall, confidence, latency, attribution, and fallback status.
- `POST /api/parking/book`: Accepts `{"slot_id": string, "user_email": string, "duration_hours": float}`. Enforces in-process mutex and fail-closed Firebase conditional ETag `If-Match` write.
- `GET /api/health`: Reports `{"status": "ok", "ai_model_loaded": bool, "ai_model_prewarmed": bool, "ai_status": "ready"}`.

## Appendix B: Automated Test Suite Execution Summary
- Test Suite Count: 8 test files.
- Executed Tests: 66 tests.
- Failures / Errors: 0 failures, 0 errors (100% pass rate in 0.104s).
- Mobile Compilation: `npx tsc --noEmit` exited with code 0 (0 diagnostics).

## Appendix C: Installation & Reproducibility Guide
1. **Clone repository:**
   ```bash
   git clone <repository_url> && cd smart-parking-btp-main
   ```
2. **Configure Python Environment:**
   ```bash
   conda create -n smart_parking python=3.13 -y
   conda activate smart_parking
   pip install torch torchvision numpy flask flask-cors requests
   ```
3. **Run Regression Tests:**
   ```bash
   python -m unittest discover -s . -p "test_*.py"
   ```
4. **Launch Backend Microservice:**
   ```bash
   python api.py
   ```
5. **Launch Expo Mobile Client:**
   ```bash
   cd smart-parking-app && npm install && npx expo start
   ```

## Appendix D: System Architecture Diagram (Mermaid Source)
Full Mermaid diagram source code is preserved in [`STAGE_8_FINAL_ARCHITECTURE.mmd`](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/STAGE_8_FINAL_ARCHITECTURE.mmd).

