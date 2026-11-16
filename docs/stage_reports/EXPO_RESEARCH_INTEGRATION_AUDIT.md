# SMART PARKING BTP — EXPO MOBILE APPLICATION INTEGRATION STATUS AUDIT

**Audit Date:** 2026-11-16  
**Auditor Role:** Senior React Native Architect, Expo Engineer, Backend Integration Auditor  
**Execution Mode:** STRICTLY READ-ONLY AUDIT  
**Target Application:** Smart Parking BTP Expo Mobile App (`smart-parking-app/`) & Flask Backend (`api.py`)  
**Target Research:** Paper-Aligned MARL-GCN Implementation (`research/paper_aligned/`)  
**Reference Paper:** Xiaohang Zhao & Yangzhi Yan, *"A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation"*, **Sensors** 2025, 25(8), 2389  

---

## 1. Overall Integration Verdict

### **VERDICT: `NOT INTEGRATED`**

The paper-aligned MARL-GCN deep reinforcement learning research implementation located in `research/paper_aligned/` is **completely unintegrated** into the live Expo mobile application, Flask backend, and Firebase database. 

The existing mobile application is a production-grade campus parking application operating independently on a simulated 6-slot campus lot layout (Slots A1, A2, B1, B2, etc.) using client-side heuristics and a Flask/Firebase rule-based scoring engine. Zero neural network weights, zero PyTorch inference pipelines, and zero graph attention models from the base paper are loaded, imported, or executed by the production application.

---

## 2. Mobile Screens & Components Inspected

| Screen / Component | File Path | Function in UI | AI / Allocation Behavior |
| :--- | :--- | :--- | :--- |
| **Dashboard Screen** | [DashboardScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/DashboardScreen.tsx) | Hero Mapbox view, campus landmark selector (IIIT Sri City), live occupancy ring, recommendation capsule | Consumes `data?.recommendation?.best_slot` from Firebase or falls back to client-side `computeDynamicMARLScores()` in `types/parking.ts`. |
| **Map Screen** | [MapScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/MapScreen.tsx) | Full-screen interactive map, walking route polyline, distance banner, target slot selection | Visualizes route to `bestSlot` (derived from Firebase or local heuristic). Does not call any MARL-GCN inference API. |
| **Bookings Screen** | [BookingsScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/BookingsScreen.tsx) | Active reservations, countdown timer, booking pass generator, cancel/extend actions | Reads and writes directly to Firebase `/data/booked_slots/` via `useFirebaseParking.ts`. |
| **Login / Profile** | [LoginScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/LoginScreen.tsx), [ProfileScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/ProfileScreen.tsx) | Driver profile, vehicle license plate, lifetime $\text{CO}_2$ emissions saved tracker | Authenticates with Flask backend via `/api/auth/login`. |
| **Overhead Slots Viewer** | [OverheadSlotsViewer.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/components/slots/OverheadSlotsViewer.tsx) | 2D bay layout with animated top-down car graphics ([TopDownCar.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/components/slots/TopDownCar.tsx)) | Renders visual status (green = available, red = occupied) based on live Firebase occupancy array. |
| **Firebase Hook** | [useFirebaseParking.ts](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/hooks/useFirebaseParking.ts) | Core state synchronization hook | Listens to Firebase Realtime DB at `FB_REST_BASE`. Executes local fallback scoring via `computeDynamicMARLScores()`. |
| **API Client Service** | [api.ts](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/services/api.ts) | HTTP client service connecting to `API_BASE` (`localhost:5000` or hosted Render URL) | Contains only 5 functions: `loginUser`, `registerUser`, `verifyToken`, `bookSlot`, and `healthCheck`. Contains **no** call to any RL/GCN model. |

---

## 3. Backend Endpoints Inspected ([api.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py))

A forensic audit of all 12 registered Flask routes in [api.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py) reveals:

| Endpoint | HTTP Method | Target Function | Current Implementation | Paper MARL-GCN Invoked? |
| :--- | :---: | :--- | :--- | :---: |
| `/api/auth/register` | `POST` | `register()` | User registration in SQLite/Firebase auth | **NO** |
| `/api/auth/login` | `POST` | `login()` | User authentication & JWT generation | **NO** |
| `/api/auth/verify` | `POST` | `verify()` | JWT token verification | **NO** |
| `/api/auth/user/<email>` | `GET` | `get_user()` | Retrieves driver profile details | **NO** |
| `/api/parking/slots` | `GET` | `get_slots()` | Fetches binary states from Firebase and formats distance/pricing | **NO** |
| `/api/parking/recommendations` | `GET` | `get_parking_recommendations()` | Computes composite heuristic score | **NO** |
| `/api/parking/co2` | `POST` | `calculate_co2_savings()` | Heuristic $\text{CO}_2$ emission calculation | **NO** |
| `/api/parking/update` | `POST` | `update_slot_status()` | Updates slot state in Firebase | **NO** |
| `/api/parking/sensor/<slot_id>` | `GET` | `get_sensor_data()` | Returns mocked/live sensor readings | **NO** |
| `/api/parking/book` | `POST` | `book_slot()` | Writes booking reservation record | **NO** |
| `/api/health` | `GET` | `health_check()` | Basic server liveness ping | **NO** |
| `/api/init/test-data` | `POST` | `init_test_data()` | Initializes default slot entries | **NO** |

### Inspection Findings for `/api/parking/recommendations`:
While named "recommendations", this endpoint executes purely deterministic heuristics from `smart_parking_ai/models/`:
1. `smart_parking_ai/models/marl.py`: Applies a simple rule-based reward formula: $+10.0$ if slot is free, $-20.0$ if occupied.
2. `smart_parking_ai/models/gru.py`: Implements an exponential weighted moving average of the last 10 binary observations in a sliding window (`HISTORY_WINDOW = 10`), described as "GRU-inspired". It does not use PyTorch `nn.GRU` or load any neural checkpoint.
3. `smart_parking_ai/models/gnn.py`: Implements a Breadth-First Search (BFS) / Dijkstra shortest path on a hardcoded 5-node adjacency list (`PARKING_GRAPH`), not a Graph Neural Network or Graph Attention Layer.

**PyTorch is not imported anywhere in `api.py`. No trained `.pt` checkpoint is loaded.**

---

## 4. Firebase Integration Findings

- **Realtime Database Node Structure:**
  - `/data/states`: Binary array of slot states `[0, 1, 0, 0, 1, 0]` representing 6 physical campus stalls.
  - `/data/booked_slots`: Dictionary of active reservations keyed by slot ID (`slot1`, `slot2`, etc.).
  - `/data/recommendation`: Object containing `{"best_slot": "slot1", "top3": ["slot1", "slot2", "slot4"]}` updated by `firebase_dashboard.py`.
- **Publisher Component:**
  - [firebase_dashboard.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/firebase_dashboard.py) runs an infinite loop reading `/data/states` and computing recommendations via `smart_parking_ai.models.marl.select_best_slots()`.
- **Research Data Flow Gap:**
  - None of the paper-aligned Melbourne entities (9 municipal districts, 541 bays, Little's Law queues, macro continuous allocation actions) exist in or flow through Firebase.
  - The existing Firebase listeners and database structure are strictly wired for the 6-slot campus lot.

---

## 5. Research Modules vs. Production Matrix

| Base-Paper Component (Zhao & Yan 2025) | Research Implementation (`research/paper_aligned/`) | Present in Production (`api.py` / `smart-parking-app`) | Status |
| :--- | :--- | :--- | :--- |
| **Two-Stage Graph Attention (GAT)** | [graph_network.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py): `TwoStageGATLayer` with intra/inter partition self-attention | None. Production uses hardcoded adjacency BFS in `gnn.py`. | **DISCONNECTED** |
| **Heterogeneous Graph Pooling (HGP)** | [graph_network.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py): `HeterogeneousGraphPooling` with top-k gating & sum-to-max ratios | None. | **DISCONNECTED** |
| **Graph Contrastive Learning (GCL)** | [graph_network.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/graph_network.py): `GraphContrastiveLearningLoss` with bilinear InfoNCE | None. | **DISCONNECTED** |
| **Temporal GRU Memory** | [hypernetwork.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/hypernetwork.py): `AgentTemporalGRU` tracking hidden trajectory representations | Production uses moving-average array math in `gru.py`. | **DISCONNECTED** |
| **Policy Hypernetwork** | [hypernetwork.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/hypernetwork.py): `PolicyHypernetwork` generating per-agent dynamic policy weights | None. Production uses static hardcoded coefficients. | **DISCONNECTED** |
| **MADDPG Centralized Evaluation** | [maddpg.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/maddpg.py): `CentralizedEvaluator` with Twin-Critic Double-Q stabilization | None. | **DISCONNECTED** |
| **Municipal Simulation Environment** | [melbourne_env.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/melbourne_env.py): 9 districts, 541 bays, Little's Law queues | Production models a single 6-stall campus parking lot. | **DISCONNECTED** |
| **Trained Checkpoint** | [best_maddpg_stabilized_seed_42.pt](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/research/paper_aligned/checkpoints/best_maddpg_stabilized_seed_42.pt) (859 KB PyTorch weights) | Checkpoint is never loaded by Flask or mobile app. | **DISCONNECTED** |

**Summary: 0 out of 8 core base-paper components are connected to production.**

---

## 6. Status of Feature Flag `ENABLE_AI_ALLOCATION`

- **Design Specification:**
  In [STAGE_8_INTEGRATION_PLAN.md](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/models/research/STAGE_8_INTEGRATION_PLAN.md#L92-L98), the feature flag was formulated as:
  ```python
  ENABLE_AI_ALLOCATION = os.getenv("ENABLE_AI_ALLOCATION", "false").lower() == "true"
  ```
- **Current Audit Finding:**
  - `ENABLE_AI_ALLOCATION` was **intentionally never injected into `api.py`**.
  - All past master prompts and audit gates mandated zero regressions and strict isolation of research files. Consequently, Stage 8 integration was kept in a pre-integration design freeze.
  - The live production backend operates exclusively in fallback heuristic mode.

---

## 7. Fundamental Domain Discrepancies (Research vs. Production)

Connecting the research model to the mobile app requires bridging three fundamental architectural discrepancies:

1. **Spatial Representation:**
   - *Research:* 9 macro municipal districts across the City of Melbourne (Carlton, Docklands, CBD, etc.) modeling inter-district traffic competition and macro queue lengths.
   - *Production Mobile App:* A micro parking facility representing 6 specific parking bays (A1, A2, B1, etc.) on the IIIT Sri City campus.
2. **Action Space:**
   - *Research:* Continuous 9-dimensional priority vector $\mathbf{a}_t \in [0, 1]^9$ representing allocation weighting across municipal zones.
   - *Production Mobile App:* Discrete selection of a single stall ID (`slot1` to `slot6`) for a specific arriving driver.
3. **Execution Model:**
   - *Research:* Episodic step-by-step simulation over a 120-minute horizon driven by Poisson arrival streams.
   - *Production Mobile App:* On-demand asynchronous HTTP/WebSocket requests triggered whenever a real mobile app user opens the screen or taps "Book".

---

## 8. Missing Implementation Work for Production Deployment

To achieve genuine production integration (Stage 8), the following tasks remain to be implemented:

1. **Neural Inference Service (`smart_parking_ai/neural_inference_service.py`):**
   - Create a thread-safe PyTorch inference wrapper loading `best_maddpg_stabilized_seed_42.pt` (or the campus neural agent `best_model_seed_42.pt`).
   - Implement input vector adapter converting 6-stall binary occupancy states into the model's expected observation tensor.
   - Implement action-to-stall mapping converting continuous policy outputs into discrete stall ranks.
   - Enforce a strict sub-50ms execution timeout with automatic fallback to the heuristic.
2. **Backend Route (`POST /api/ai/allocate-slot`):**
   - Add the endpoint to [api.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py) wrapped by `ENABLE_AI_ALLOCATION`.
   - Guarantee that if `ENABLE_AI_ALLOCATION=false` or if PyTorch raises an exception, the response seamlessly falls back to the existing `select_best_slots()` logic.
3. **Mobile App API Service (`smart-parking-app/src/services/api.ts`):**
   - Add `allocateAISlot()` calling `/api/ai/allocate-slot`.
   - Update [useFirebaseParking.ts](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/hooks/useFirebaseParking.ts) to query this endpoint upon user check-in.
4. **UI Attribution:**
   - Display a verified "AI-Allocated via Neural Policy" badge in [DashboardScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/DashboardScreen.tsx) with model confidence and inference latency ($\sim 158.5~\mu\text{s}$).

---

## 9. Recommended Integration Roadmap (Stage 8)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STAGE 8 INTEGRATION ROADMAP                     │
└────────────────────────────────────────────────────────────────────────┘

 [Phase 1: Inference Service] 
    Create isolated `smart_parking_ai/neural_inference_service.py`
    Load model weights with torch.no_grad()
    Add 50ms latency guard & defensive exception handling
             │
             ▼
 [Phase 2: Flask Endpoint Integration]
    Add `POST /api/ai/allocate-slot` to `api.py`
    Enforce `ENABLE_AI_ALLOCATION = os.getenv("ENABLE_AI_ALLOCATION", "false")`
    Default to `"false"` (heuristic fallback)
             │
             ▼
 [Phase 3: Integration Verification & Shadow Testing]
    Run 50 automated synthetic requests against `/api/ai/allocate-slot`
    Verify latency < 5ms and zero server crashes
             │
             ▼
 [Phase 4: Mobile App Wire-Up]
    Wire `allocateAISlot` into `useFirebaseParking.ts`
    Display model latency & confidence in UI
             │
             ▼
 [Phase 5: Production Enablement]
    Set `ENABLE_AI_ALLOCATION=true` in environment
    Verify live Expo application on tunnel port 8081
```

---

## 10. Confirmation of Strict Non-Interference

The auditor explicitly confirms:
- **Zero files modified:** This audit was conducted in 100% read-only mode (with only this report created).
- **Zero services interrupted:** Expo daemon (PID 42190), Expo tunnel (PID 44535), and ngrok daemon (PID 44619) were monitored and remain continuously running.
- **Zero configurations altered:** Feature flags, database configurations, package dependencies, model checkpoints, and results files remain 100% intact.

