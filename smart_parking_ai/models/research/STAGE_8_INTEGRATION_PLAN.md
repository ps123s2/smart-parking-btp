# Smart Parking BTP — Stage 8 Production Application Integration Plan

**Status:** Mandatory Approval Gate (Pre-Integration Design Freeze)  
**Execution Rule:** No production files will be modified until explicit authorization is granted by the project owner.

---

## 1. Integration Architecture & System Dataflow

```
[React Native / Expo Client]
       │
       │ HTTP POST /api/ai/allocate-slot (Vehicle Search Request)
       ▼
[Flask Backend: api.py]
       │
       ├──> Reads live stall occupancy from [Firebase Realtime DB]
       │    (Constructs standardized 18-element state vector obs & 3-element mask)
       │
       ├──> Calls [NeuralInferenceService]
       │    ├── Validates input dimensions & action mask
       │    ├── Executes RecurrentActorCritic (24,420 params) with torch.no_grad()
       │    ├── Updates recurrent context h_t
       │    └── Applies defensive -inf action masking
       │
       ├──> Safety Fallback Guard:
       │    └── If latency > 50ms, or exception occurs, or NaN detected:
       │        AUTOMATICALLY FALLBACK to Congestion-Aware Nearest Zone Heuristic
       │
       ├──> Writes allocated stall state to [Firebase Realtime DB]
       │
       ▼
[Expo Mobile App] displays AI Recommendation Banner, Overhead Slot Visualizer, & Route.
```

---

## 2. Formal API Contract

### Endpoint: `POST /api/ai/allocate-slot`
**Headers:** `Content-Type: application/json`

#### Request Payload:
```json
{
  "user_id": "usr_78942",
  "vehicle_type": "standard_car",
  "estimated_dwell_minutes": 45,
  "preferred_zone": 0
}
```

#### Response Payload (Success):
```json
{
  "status": "success",
  "allocated_stall": "A1",
  "zone_id": 0,
  "zone_name": "Zone A (Core Campus)",
  "is_fallback": false,
  "model_confidence": 0.942,
  "latency_ms": 1.42,
  "timestamp": "2026-11-16T14:50:00Z"
}
```

#### Response Payload (Graceful Fallback on Timeout/Error):
```json
{
  "status": "success",
  "allocated_stall": "B1",
  "zone_id": 1,
  "zone_name": "Zone B (Peripheral)",
  "is_fallback": true,
  "fallback_reason": "Neural inference timeout (>50ms); heuristic applied",
  "model_confidence": null,
  "latency_ms": 51.2,
  "timestamp": "2026-11-16T14:50:00Z"
}
```

---

## 3. Inference-Service Design (`NeuralInferenceService`)
- **Implementation File:** `smart_parking_ai/neural_inference_service.py` (New isolated file).
- **Model Checkpoint:** Loads `smart_parking_ai/models/research/checkpoints/best_model_seed_42.pt`.
- **Thread Safety:** Implements `threading.Lock()` across hidden-state updates to prevent race conditions during concurrent vehicle booking requests.
- **Fail-Safe Mechanism:** Enclosed in strict `try...except` and timer wrappers. Any failure instantly invokes `CongestionAwareNearestZonePolicy` without raising 500 errors to the mobile app.

---

## 4. Rollback & Decoupling Strategy
- **Feature Flag in `api.py`:**
  ```python
  ENABLE_AI_ALLOCATION = os.getenv("ENABLE_AI_ALLOCATION", "false").lower() == "true"
  ```
- **Strict Default Status:** Production integration remains completely disabled by default (`ENABLE_AI_ALLOCATION = "false"`) until separate explicit production approval is granted. Under default settings, Flask instantly bypasses PyTorch neural inference and routes 100% of allocation requests to the pre-existing, verified heuristic backend.
- Zero database migrations or schema alterations required in Firebase.

---

## 5. Existing-Flow Regression Test Plan
Prior to deployment, the following 5 end-to-end regression tests will be executed:
1. `test_user_auth_and_login`: Verify mobile JWT token issuance remains unaffected.
2. `test_manual_slot_booking`: Verify users can manually reserve stalls A1–B2 via mobile UI.
3. `test_sensor_http_update`: Verify simulated ultrasonic distance updates (`/api/parking/update`) update Firebase occupancy correctly.
4. `test_mobile_live_map`: Verify Expo map view on port 8081 displays real-time slot colors.
5. `test_simulated_ai_failure`: Inject artificial exception into model weights and verify seamless fallback to nearest available zone.

---

## 6. Latency & Concurrency Validation Protocol
- Benchmark 100 sequential and 20 concurrent allocation requests.
- **Acceptance SLA:** Mean latency $< 15\text{ ms}$; 99th percentile $< 40\text{ ms}$; error rate $= 0.0\%$.

---

## 7. Exact List of Files Requiring Modification (Upon Authorization)
1. **To Create:**
   - `smart_parking_ai/neural_inference_service.py` (Production inference engine)
   - `test_production_integration.py` (Integration & concurrency test suite)
2. **To Modify:**
   - `api.py` (Add route `/api/ai/allocate-slot` with feature flag)
   - `smart-parking-app/src/services/api.ts` (Add client method `allocateSlotAI()`)

