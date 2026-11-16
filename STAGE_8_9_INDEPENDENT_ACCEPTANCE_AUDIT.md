# STAGE 8.9 — INDEPENDENT PRODUCTION READINESS ACCEPTANCE AUDIT

**Audit Date:** 2026-11-16  
**Auditor Role:** Independent Senior Software Auditor, MARL-GCN Research Reviewer, Flask Backend Security Reviewer, Firebase Consistency Auditor, and React Native / Expo QA Engineer  
**Execution Mode:** STRICTLY READ-ONLY AUDIT  
**Audit Target:** Stage 8 Integration Artifacts, Source Code, Test Suites, and Runtime Architecture  
**Reference Report:** `STAGE_8_FINAL_INTEGRATION_REPORT.md`  
**Reference Checkpoint:** `research/paper_aligned/checkpoints/best_maddpg_stabilized_seed_42.pt`  

---

## 1. Executive Verdict

### **VERDICT: `CONDITIONALLY READY — SPECIFIC BLOCKERS REMAIN`**

### Summary Determination:
While the mathematical formulation, GAT/Hypernetwork tensor compatibility, CPU inference latency ($0.33\text{ ms}$ warmed), and fallback scaffolding were successfully implemented, an independent read-only audit identified **two production blockers** and **three architectural inconsistencies** that preclude immediate production activation:

1. **CRITICAL PRODUCTION BLOCKER — Firebase Non-Atomic TOCTOU Race Condition:**  
   The pre-booking validation in [api.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py#L508-L552) executes a sequential read (`GET` `/data/states` and `GET` `/data/booked_slots`) followed by an unconditioned write (`PUT` `/data/booked_slots/{slot_id}.json`). It does not use Firebase Admin SDK transactions or HTTP `ETag` conditional headers. Under concurrent booking requests for the same stall, multiple drivers can simultaneously pass validation and overwrite each other's reservations. Furthermore, if the Firebase write fails, the error is caught and printed, but the API still returns `HTTP 200 OK: "Slot booked successfully"`.
2. **HIGH DEFECT — Cross-User Recurrent Hidden-State Leakage:**  
   In [smart_parking_ai/neural_inference_service.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/neural_inference_service.py#L64-L65), `self.h_prev` is stored as an instance variable on the singleton service. In a multi-user environment, Driver Alice's inference updates `self.h_prev`, which is then reused as the initial temporal state for Driver Bob's subsequent request. Recurrent memory is thus polluted across unrelated user sessions rather than tracking a clean facility or per-session trajectory.
3. **HIGH DEFECT — Cold-Start Inference Exceeds Latency Budget:**  
   The initial un-warmed inference call takes **55.58 ms** (exceeding the 50.0 ms target) due to disk I/O and PyTorch graph initialization. Only subsequent warmed calls achieve the claimed $0.33\text{ ms}$ latency.
4. **INTEGRATION INCONSISTENCY — MapScreen Bypasses Neural Allocation:**  
   Although [STAGE_8_FINAL_INTEGRATION_REPORT.md](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/STAGE_8_FINAL_INTEGRATION_REPORT.md) claimed `MapScreen.tsx` was integrated, line 68 of [smart-parking-app/src/screens/MapScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/MapScreen.tsx#L68) directly binds to `data?.recommendation?.best_slot` (legacy heuristic from Firebase), completely ignoring the neural allocation output from `useFirebaseParking.ts`.
5. **TOPOLOGY AMBIGUITY — Five vs. Six Stall Discrepancy:**  
   The campus adapter and GNN graph model exactly 5 stalls (`slot1` to `slot5`), whereas legacy mockups and test routes in `api.py` describe 6 stalls (`slot1` to `slot6`). The adapter silently truncates any 6th stall.

Production activation must remain **BLOCKED** (`ENABLE_AI_ALLOCATION=false`) until these specific items are remediated.

---

## 2. Source-Code Verification Matrix

| File Path | Claimed Status | Verified Status | Actual Implementation Details & Evidence | Defects / Discrepancies |
| :--- | :---: | :---: | :--- | :--- |
| [smart_parking_ai/campus_adapter.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/campus_adapter.py) | Created | **VERIFIED** | Implements `CampusGraph`, `CampusObservationAdapter`, and `decode_actions`. Builds $(1, 5, 8)$ node tensor and $(1, 5, 5)$ adjacency with self-loops. Enforces $-\infty$ availability mask. | Hardcodes $N=5$. Any 6th stall in `states` is silently ignored. |
| [smart_parking_ai/neural_inference_service.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/neural_inference_service.py) | Created | **VERIFIED** | Loads GAT, GRU, Hypernetwork, and Actor from `best_maddpg_stabilized_seed_42.pt`. Thread-safe singleton with `threading.Lock()`. | Stores `self.h_prev` globally on singleton, causing cross-user state pollution. Cold start is $55.58\text{ ms}$. |
| [api.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py) | Modified | **VERIFIED** | Added `POST /api/ai/allocate-slot` (lines 249–378) gated by `ENABLE_AI_ALLOCATION`. Enhanced `/api/parking/book` with availability checks. | Non-atomic check-then-write race condition in booking (lines 508–552). Flag read once at import time. |
| [smart-parking-app/src/types/parking.ts](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/types/parking.ts) | Modified | **VERIFIED** | Added `AIAllocationResponse` interface (lines 78–92) with `allocated_stall`, `allocation_source`, and `model_confidence`. | None. Clean TypeScript schema. |
| [smart-parking-app/src/services/api.ts](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/services/api.ts) | Modified | **VERIFIED** | Added `allocateAISlot()` client service (lines 103–115) pointing to `/api/ai/allocate-slot`. | None. Includes timeout and error handling. |
| [smart-parking-app/src/hooks/useFirebaseParking.ts](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/hooks/useFirebaseParking.ts) | Modified | **VERIFIED** | Added `aiAllocation` state and `refreshAIAllocation()`. Maps neural allocation into `slots[].isBest`. | Auto-fetch triggered on `data.states` update. |
| [smart-parking-app/src/screens/DashboardScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/DashboardScreen.tsx) | Modified | **VERIFIED** | Displays neural attribution badge: `Neural MARL-GCN (53%) • Slot B1 Selected`. | None. UI compiles cleanly. |
| [smart-parking-app/src/screens/MapScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/MapScreen.tsx) | Claimed Modified | **NOT MODIFIED** | File was **NOT modified** in Stage 8. Line 68 still reads `data?.recommendation?.best_slot` (legacy Firebase heuristic). | **Bypasses Stage 8 neural allocation entirely.** |
| [smart-parking-app/src/screens/BookingsScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/BookingsScreen.tsx) | Claimed Modified | **NOT MODIFIED** | File was **NOT modified** in Stage 8. Consumes `bookings` array from `useFirebaseParking.ts`. | Indirectly functional, but claimed as directly integrated. |

---

## 3. Model and Checkpoint Compatibility Analysis

### A. Dimensional Invariance vs. Functional Transfer
The auditor independently verified the mathematical behavior of the trained checkpoint:
- **Tensor Compatibility:** **CONFIRMED.** The decentralized actor pipeline ($W_{\text{intra}} \in \mathbb{R}^{32 \times 8}$, $\text{GRUCell}(33, 64)$, Hypernetwork trunk $64 \to 64 \to (32, 1)$, $\phi \in \mathbb{R}^{32 \times 32}$) executes matrix projections purely along feature axes. The tensor operations accept arbitrary node count $N$ without shape mismatches.
- **Checkpoint Compatibility:** **CONFIRMED.** Checkpoint `best_maddpg_stabilized_seed_42.pt` loads cleanly via `torch.load()`.
- **Functional Inference Compatibility:** **CONFIRMED.** Given standardized 8-dimensional campus observations, the model outputs finite continuous priority scores $a_t^i \in [0.533, 0.535]$.
- **Valid Campus Allocation Behavior:** **CONFIRMED (VIA DEFENSIVE MASKING).** The model itself outputs near-uniform scores across all stalls ($\sim 0.534$). The reason it successfully avoids occupied stalls in tests is **not** because the neural network recognized the occupancy, but because the **defensive action mask in `decode_actions()` forcibly sets occupied stall priorities to $-\infty$**.
- **Demonstrated Allocation Quality:** **UNPROVEN.** The model was trained on the City of Melbourne municipal network (macro travel times of 2.0–4.0 minutes, 541 bays across 9 districts). Transferring these weights to a 5-stall parking lot without fine-tuning produces near-identical raw scores ($0.5341$ vs $0.5335$). While defensive masking guarantees safety, the neural network's preference over vacant stalls is essentially arbitrary rather than learned optimal campus routing.

---

## 4. Five-Versus-Six-Stall Discrepancy Investigation

### The Conflict:
- In `api.py` line 437 (`init_test_data`): 6 slots are declared (`slot1` to `slot6`, labels A1, A2, B1, B2, C1, C2).
- In `smart_parking_ai/models/gnn.py` (line 21): 5 slots are declared (`slot1` to `slot5`, labels A1, A2, A3, B1, B2).
- In `smart-parking-app/src/types/parking.ts` (line 79): 5 slots are declared in `SLOT_LABELS` (`slot1` to `slot5`).
- In `smart_parking_ai/campus_adapter.py`: $N=5$ nodes are instantiated (`slot1` to `slot5`).

### Auditor Finding:
The operational codebase is architected for **5 stalls** (3 in Row A, 2 in Row B). The reference to "six stalls" in prior handover prompts and reports stemmed from an old mock JSON schema. 
However, in [smart_parking_ai/campus_adapter.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/campus_adapter.py#L96-L103), if Firebase transmits a 6-element array `states = [0, 1, 0, 0, 1, 0]`, the loop iterates only over `self.graph.slot_ids` ($N=5$). The 6th stall is silently dropped from observation tensors and cannot be allocated by the neural policy.

---

## 5. Firebase Atomicity & Double-Booking Audit

### Forensic Inspection of `POST /api/parking/book` ([api.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py#L508-L552)):

```python
# 1. READ phase
states = get_parking_states(FIREBASE_URL)     # HTTP GET /data.json
booked = get_booked_slots(FIREBASE_URL)       # HTTP GET /data.json

# 2. CHECK phase (In-memory)
if booked.get(slot_id, {}).get("status") == "active":
    return jsonify({"success": False, "message": "Stall is already reserved"}), 409

# 3. WRITE phase
http_requests.put(fb_booking_url, json=fb_payload, timeout=3) # HTTP PUT
```

### Critical Flaws Identified:
1. **Time-of-Check to Time-of-Use (TOCTOU) Vulnerability:**  
   The validation phase and write phase are separated by network latency ($\sim 100\text{--}300\text{ ms}$). If Driver 1 and Driver 2 attempt to book `slot4` concurrently:
   - Driver 1 reads Firebase $\implies$ `slot4` is unbooked.
   - Driver 2 reads Firebase $\implies$ `slot4` is unbooked.
   - Driver 1 executes `PUT` $\implies$ `slot4` booked for Driver 1.
   - Driver 2 executes `PUT` $\implies$ `slot4` overwritten for Driver 2.
   - Both drivers receive `HTTP 200 OK: "Slot booked successfully"`.
2. **No Database Transaction / Conditional Header:**  
   Firebase Realtime Database supports atomic conditional updates via Firebase Admin SDK transactions (`runTransaction()`) or REST `if-match` ETag headers. Neither is used here.
3. **Swallowed Write Failures:**  
   Lines 551–553 catch `http_requests.put` exceptions with a print statement (`⚠️ Firebase booking sync failed: {fb_err}`), but execution proceeds to line 556, returning `HTTP 200 OK: "Booking confirmed"` to the mobile app even when the database write completely failed!

**Classification: CRITICAL PRODUCTION BLOCKER.**

---

## 6. Inference Performance & Latency Audit

1. **Warmed vs. Cold-Start Latency:**
   - Warmed CPU Forward Pass: Measured at **0.33 ms** (consistent with report).
   - Cold-Start Pass: Measured at **55.58 ms** (disk read of 859 KB checkpoint + PyTorch graph allocation).
   - Impact: In serverless or containerized environments (Render, Cloud Run) where instances sleep, initial requests will experience cold starts $> 50\text{ ms}$.
2. **Hidden State Isolation Defect:**
   - [smart_parking_ai/neural_inference_service.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/neural_inference_service.py#L64-L65) maintains:
     ```python
     self.h_prev: Optional[torch.Tensor] = None
     ```
   - In `allocate_slot()`:
     ```python
     self.h_prev = h_new.detach()
     ```
   - This state persists on the singleton across requests from different users. Request $K$ from User A alters the initial hidden state for Request $K+1$ from User B.

---

## 7. Automated Test Independence Assessment

| Test Suite | Test Count | Evaluation Type | Mocking Extent | Independent Auditor Assessment |
| :--- | :---: | :---: | :---: | :--- |
| `test_campus_adapter.py` | 5 | Unit Tests | None | **GENUINE.** Tests real graph matrices, normalization math, and masking. |
| `test_neural_inference_service.py` | 5 | Unit Tests | None | **GENUINE.** Loads actual `.pt` file; runs real PyTorch inference on CPU. |
| `test_api_integration.py` | 5 | Integration Tests | Heavy (Firebase) | **PARTIAL.** Mocks `get_parking_states` and `get_booked_slots`. Does not test live Firebase latency or network timeouts. |
| `test_shadow_evaluation.py` | 10 | Benchmark Tests | None (Input Fixtures) | **GENUINE.** Exercises real model and heuristic against 10 synthetic occupancy fixtures. |
| `test_end_to_end_regression.py` | 10 | Regression Tests | Heavy (Firebase) | **PARTIAL.** Mocks network calls. The concurrent test (Flow 5) tests concurrent reads to the Flask API, not concurrent competing writes to Firebase. |

---

## 8. Expo Mobile Application Integration Findings

1. **DashboardScreen:** **INTEGRATED.** Successfully consumes `aiAllocation` and renders the neural attribution badge.
2. **MapScreen:** **NOT INTEGRATED.**  
   Line 68 of [smart-parking-app/src/screens/MapScreen.tsx](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/screens/MapScreen.tsx#L68):
   ```typescript
   const bestSlot = data?.recommendation?.best_slot;
   const targetSlotId = activeBookingForUser ? activeBookingForUser.slotId : (bestSlot || 'slot1');
   ```
   `bestSlot` is pulled strictly from `data?.recommendation?.best_slot` (Firebase legacy heuristic). It does not use `slots.find(s => s.isBest)?.id` or `parking.aiAllocation?.allocated_stall`. Consequently, the map route navigation ignores neural allocation decisions.
3. **BookingsScreen:** **INDIRECTLY INTEGRATED.** Uses `bookings` from `useFirebaseParking.ts`, which syncs with Firebase.

---

## 9. Feature Flag and Rollback Verification

1. **Feature Flag Declaration:**
   In [api.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py#L25):
   ```python
   ENABLE_AI_ALLOCATION = os.getenv("ENABLE_AI_ALLOCATION", "false").lower() == "true"
   ```
2. **Evaluation Timing:**  
   Evaluated **once at module load time**. A running Flask server will **not** pick up changes to `ENABLE_AI_ALLOCATION` without a process restart.
3. **Safety Posture:**  
   Defaults to `False`. When `False`, `/api/ai/allocate-slot` cleanly routes 100% of traffic to the verified heuristic allocator `select_best_slots()`.

---

## 10. Critical and High-Severity Defects

| Severity | Defect ID | Description | Location |
| :---: | :---: | :--- | :--- |
| **CRITICAL** | **SEC-01** | **TOCTOU Race Condition on Booking:** Sequential read then write allows concurrent drivers to overwrite each other's reservations. | `api.py:508-552` |
| **CRITICAL** | **SEC-02** | **Swallowed Write Failures:** Failed Firebase `PUT` writes return `HTTP 200 OK: "Booking confirmed"` instead of `HTTP 500/503`. | `api.py:551-556` |
| **HIGH** | **AI-01** | **Global Hidden State Leakage:** `self.h_prev` shared across distinct users on singleton service, leaking recurrent memory. | `neural_inference_service.py:64, 185` |
| **HIGH** | **UI-01** | **MapScreen Neural Bypass:** Navigation polyline on `MapScreen` binds to legacy Firebase recommendation, ignoring AI allocation. | `MapScreen.tsx:68` |
| **MEDIUM** | **PERF-01** | **Cold Start Budget Exceeded:** Initial un-warmed inference latency is $55.58\text{ ms}$ (budget: $50\text{ ms}$). | `test_api_integration.py` |
| **MEDIUM** | **TOP-01** | **Stall Truncation:** Adapter strictly assumes $N=5$. Any 6th stall in Firebase `states` is silently dropped. | `campus_adapter.py:96` |
| **LOW** | **OPS-01** | **Static Flag Evaluation:** `ENABLE_AI_ALLOCATION` evaluated at import time; dynamic reload requires server restart. | `api.py:25` |

---

## 11. Exact Remediation Steps (Prior to Production Activation)

1. **Remediate Firebase Atomicity (SEC-01 & SEC-02):**
   - Update `/api/parking/book` in `api.py` to check response status of `http_requests.put()`. If the write fails or status $\ne 200$, return `HTTP 502/503 Bad Gateway`.
   - Implement Firebase REST `ETag` conditional header (`if-match`) or Firebase Admin SDK transaction to guarantee atomic stall reservation.
2. **Isolate Recurrent Hidden State (AI-01):**
   - In `smart_parking_ai/neural_inference_service.py`, do not update global `self.h_prev` during user allocation requests. Initialize `h_prev = torch.zeros(1, N, 64)` per inference call, or key recurrent state by `user_id` / facility ID with a TTL cache.
3. **Wire MapScreen to Neural Allocation (UI-01):**
   - Update line 68 of `smart-parking-app/src/screens/MapScreen.tsx` to:
     ```typescript
     const bestSlot = parking.aiAllocation?.allocated_stall || slots.find(s => s.isBest)?.id || data?.recommendation?.best_slot;
     ```
4. **Pre-Warm Model on Startup (PERF-01):**
   - In `api.py`, call `NeuralInferenceService.get_instance()` during server initialization to absorb the 55ms disk read before servicing HTTP requests.
5. **Dynamic Feature Flag Evaluation (OPS-01):**
   - In `/api/ai/allocate-slot`, evaluate `os.getenv("ENABLE_AI_ALLOCATION", "false").lower() == "true"` dynamically on each request rather than relying on a static module-level constant.

---

## 12. Final Production Activation Recommendation

### **DO NOT ACTIVATE IN PRODUCTION YET.**
Maintain `ENABLE_AI_ALLOCATION=false`.

The system is well-engineered and demonstrates genuine neural inference capability, but the **TOCTOU race condition in `/api/parking/book`** and the **MapScreen disconnection** must be addressed before real drivers can safely rely on the application for campus parking reservations.

