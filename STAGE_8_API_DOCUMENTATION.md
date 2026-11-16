# STAGE 8 — API DOCUMENTATION

## Endpoint: `POST /api/ai/allocate-slot`

### Overview
Executes AI-driven parking stall allocation using the paper-aligned MARL-GCN neural policy with defensive action masking and automatic fallback to the verified campus heuristic.

- **Base URL:** `http://localhost:5000` (or `https://smart-parking-btp.onrender.com`)
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Authentication:** Optional Bearer JWT (compatible with `/api/auth/login`)
- **Feature Flag Gate:** `ENABLE_AI_ALLOCATION` (defaults to `false`)

---

### Request Payload (Optional)

```json
{
  "user_id": "usr_78942",
  "preferred_slot": "slot1",
  "vehicle_type": "standard_car"
}
```

#### Field Specifications:
- `user_id` *(string, optional)*: Unique identifier of the requesting user.
- `preferred_slot` *(string, optional)*: Preferred campus stall identifier (`slot1` to `slot5`).
- `vehicle_type` *(string, optional)*: Vehicle type classification (e.g., `"standard_car"`, `"suv"`, `"ev"`).

---

### Response Payloads

#### 1. Success — Neural Policy Allocation (`ENABLE_AI_ALLOCATION=true`)
**HTTP Status:** `200 OK`
```json
{
  "success": true,
  "status": "success",
  "allocated_stall": "slot4",
  "allocated_label": "B1",
  "allocation_source": "marl_gcn_neural_policy",
  "model_confidence": 0.5342,
  "latency_ms": 0.83,
  "top3_slots": ["slot4", "slot3", "slot1"],
  "ranked_slots": [
    {"slot_id": "slot4", "label": "B1", "score": 0.5342},
    {"slot_id": "slot3", "label": "A3", "score": 0.5338},
    {"slot_id": "slot1", "label": "A1", "score": 0.5335}
  ],
  "is_fallback": false,
  "fallback_reason": null,
  "model_version": "maddpg-stabilized-twin-critic-v1"
}
```

#### 2. Success — Heuristic Fallback (`ENABLE_AI_ALLOCATION=false` or Hardware Fallback)
**HTTP Status:** `200 OK`
```json
{
  "success": true,
  "status": "success",
  "allocated_stall": "slot5",
  "allocated_label": "B2",
  "allocation_source": "heuristic_fallback",
  "model_confidence": null,
  "latency_ms": 0.45,
  "top3_slots": ["slot5", "slot4", "slot1"],
  "is_fallback": true,
  "fallback_reason": "AI allocation disabled by feature flag (ENABLE_AI_ALLOCATION=false)",
  "model_version": "heuristic-campus-baseline"
}
```

#### 3. Capacity Exhausted — No Available Stalls
**HTTP Status:** `200 OK`
```json
{
  "success": true,
  "status": "no_available_stalls",
  "allocated_stall": null,
  "allocated_label": null,
  "allocation_source": "marl_gcn_neural_policy",
  "model_confidence": 0.0,
  "latency_ms": 0.38,
  "top3_slots": [],
  "ranked_slots": [],
  "is_fallback": false,
  "fallback_reason": null,
  "model_version": "maddpg-stabilized-twin-critic-v1"
}
```

---

## Endpoint: `POST /api/parking/book` (Enhanced with Atomic Pre-Check)

### Overview
Reserves a specific parking stall for a driver, with mandatory atomic verification that the stall is physically vacant and unbooked.

- **Method:** `POST`
- **Request Payload:**
  ```json
  {
    "slot_id": "slot4",
    "user_email": "driver@example.com",
    "duration_hours": 2.0
  }
  ```
- **Success Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Slot booked successfully",
    "booking_id": "bk_1763312400_slot4",
    "slot_id": "slot4",
    "duration_hours": 2.0
  }
  ```
- **Conflict Response (HTTP 409 Conflict):**
  ```json
  {
    "success": false,
    "message": "Stall slot4 is currently occupied."
  }
  ```
  *(or `"Stall slot4 is already reserved by another driver."`)*

