# STAGE 8 — FINAL API SPECIFICATION AND REFERENCE DOCUMENTATION

**System:** Smart Parking BTP — Paper-Aligned MARL-GCN Real-Time Backend  
**Document Version:** 1.0.0 (Post-Stage 8.12 Hardening)  
**Base Server:** Flask REST API (`api.py`)  
**Default Base URL:** `http://localhost:5000` / `https://<ngrok-tunnel>.ngrok-free.app`  
**Firebase RTDB Base:** `https://smartparking-87cee-default-rtdb.firebaseio.com`  
**Current Production AI Flag:** `ENABLE_AI_ALLOCATION=false` (Heuristic fail-safe baseline active)

---

## 1. Architectural Summary & Endpoints Overview

The Smart Parking Flask backend exposes two distinct tiers of API services:
1. **Application Core Services:** User authentication, stall telemetry retrieval, and concurrency-hardened atomic stall reservation.
2. **AI Decision Services:** Multi-agent reinforcement learning graph-convolutional allocation (`/api/ai/allocate-slot`), legacy heuristic recommendations (`/api/parking/recommendations`), and health/telemetry inspection (`/api/health`).

### Endpoints Matrix

| Endpoint | HTTP Method | Neural Inference Invoked? | State Mutated? | Concurrency Protection | Primary Consumer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | No | Yes (User store) | None | Mobile Auth |
| `/api/auth/login` | `POST` | No | No (Session token) | None | Mobile Auth |
| `/api/parking/slots` | `GET` | No | No | Read-only RTDB | Mobile Dashboard/Map |
| `/api/parking/recommendations` | `GET` | No (Legacy heuristic) | No | Read-only RTDB | Mobile Analytics |
| `/api/ai/allocate-slot` | `POST` | **Yes** (when flag=true) | No | Read-only RTDB, Stateles | Mobile Allocation |
| `/api/parking/book` | `POST` | No | **Yes** (Firebase RTDB) | **Mutex + Fail-Closed ETag** | Mobile Reservation |
| `/api/health` | `GET` | No (Inspects telemetry) | No | Read-only memory | Monitoring/DevOps |

---

## 2. Authentication Endpoints

### 2.1 `POST /api/auth/register`
Creates a new driver account in the user store.

- **Neural Inference:** No
- **State Mutated:** Yes (Appends driver record to local user database)
- **Request Headers:** `Content-Type: application/json`
- **Request Body Schema:**
```json
{
  "email": "driver@campus.edu",
  "password": "secure_password",
  "name": "Jane Driver"
}
```

- **Responses:**
  - `201 Created`:
    ```json
    {
      "success": true,
      "message": "User registered successfully",
      "user": {
        "email": "driver@campus.edu",
        "name": "Jane Driver",
        "co2_saved": 0.0
      },
      "token": "<jwt_session_token>"
    }
    ```
  - `400 Bad Request`: Email already registered or missing parameters.
  - `500 Internal Server Error`: Server exception during storage.

---

### 2.2 `POST /api/auth/login`
Authenticates an existing driver and generates a bearer session token.

- **Neural Inference:** No
- **State Mutated:** No
- **Request Headers:** `Content-Type: application/json`
- **Request Body Schema:**
```json
{
  "email": "driver@campus.edu",
  "password": "secure_password"
}
```

- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "message": "Login successful",
      "user": {
        "email": "driver@campus.edu",
        "name": "Jane Driver",
        "co2_saved": 0.42
      },
      "token": "<jwt_session_token>"
    }
    ```
  - `401 Unauthorized`: Invalid password or unknown email.
  - `500 Internal Server Error`: Internal authentication failure.

---

## 3. Parking Data & Recommendation Endpoints

### 3.1 `GET /api/parking/slots`
Retrieves live physical stall occupancies and distance metadata from Firebase RTDB.

- **Neural Inference:** No
- **State Mutated:** No
- **Request Headers:** None
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "total": 5,
      "available": 4,
      "occupied": 1,
      "slots": [
        {
          "id": "slot1",
          "number": 1,
          "available": true,
          "status": "available",
          "distance": 80.0,
          "price": 5.0
        },
        {
          "id": "slot2",
          "number": 2,
          "available": true,
          "status": "available",
          "distance": 65.0,
          "price": 5.5
        },
        {
          "id": "slot3",
          "number": 3,
          "available": true,
          "status": "available",
          "distance": 50.0,
          "price": 6.0
        },
        {
          "id": "slot4",
          "number": 4,
          "available": true,
          "status": "available",
          "distance": 50.0,
          "price": 6.5
        },
        {
          "id": "slot5",
          "number": 5,
          "available": false,
          "status": "occupied",
          "distance": 35.0,
          "price": 7.0
        }
      ]
    }
    ```
  - `404 Not Found`: Firebase RTDB `/data/states` unavailable.
  - `500 Internal Server Error`: Sensor array parsing failure.

---

### 3.2 `GET /api/parking/recommendations`
Provides campus recommendations using the legacy heuristic and GRU prediction baselines.

- **Neural Inference:** No (Uses historical heuristic `marl.py`)
- **State Mutated:** No
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "all_occupied": false,
      "recommendations": {
        "best_slot": "slot3",
        "top3_slots": ["slot3", "slot4", "slot2"],
        "available_count": 4,
        "total_slots": 5,
        "co2_saved_kg": 0.052,
        "distance_saved_m": 30.0,
        "wait_suggestion": null,
        "timestamp": "2026-11-16 18:30:00.123456"
      },
      "ai_models": {
        "marl": { "top_slot": "slot3", "all_scores": [["slot3", 85.0], ["slot4", 82.0]] },
        "gru": { "predictions": [0.85, 0.72, 0.90, 0.88, 0.10] },
        "gnn": { "optimal_route": ["entrance", "aisle_a", "slot3"], "distance_m": 50.0 }
      }
    }
    ```
  - `404 Not Found`: No sensor state available in database.
  - `500 Internal Server Error`: Processing exception.

---

## 4. Stage 8 AI Neural Allocation Endpoint

### 4.1 `POST /api/ai/allocate-slot`
Executes paper-aligned MARL-GCN neural inference using the Zhao & Yan (2025) spatial graph attention architecture. Gated by `ENABLE_AI_ALLOCATION`. Seamlessly falls back to heuristic baseline if disabled, un-warmed, or if topology validation fails.

- **Neural Inference:** **Yes** (when `ENABLE_AI_ALLOCATION=true`, model pre-warmed, and topology valid).
- **State Mutated:** No. Strictly read-only and stateless ($h_0 = \mathbf{0}, a_0 = \mathbf{0}$).
- **Concurrency Protection:** Read-only operations; thread-safe inference via PyTorch CPU evaluation context (`torch.no_grad()`).
- **Request Headers:** `Content-Type: application/json`
- **Request Body Schema (Optional):**
```json
{
  "user_id": "usr_9921",
  "preferred_slot": "slot3"
}
```

- **Response Scenarios:**

#### Scenario A: Neural Policy Active (`ENABLE_AI_ALLOCATION=true`)
```json
{
  "success": true,
  "status": "success",
  "allocated_stall": "slot3",
  "allocated_label": "A3",
  "is_fallback": false,
  "fallback_reason": null,
  "model_confidence": 0.3241,
  "latency_ms": 0.842,
  "top3_slots": ["slot3", "slot2", "slot4"],
  "ranked_slots": [
    ["slot3", 0.3241],
    ["slot2", 0.2810],
    ["slot4", 0.2450],
    ["slot1", 0.1499],
    ["slot5", 0.0]
  ],
  "model_version": "maddpg-stabilized-twin-critic-v1",
  "allocation_source": "marl_gcn_neural_policy"
}
```

#### Scenario B: Feature Flag Disabled (`ENABLE_AI_ALLOCATION=false` - Current Baseline)
```json
{
  "success": true,
  "status": "success",
  "allocated_stall": "slot5",
  "allocated_label": "B2",
  "is_fallback": true,
  "fallback_reason": "AI allocation disabled by feature flag (ENABLE_AI_ALLOCATION=false)",
  "model_confidence": null,
  "latency_ms": 0.412,
  "top3_slots": ["slot5", "slot4", "slot3"],
  "model_version": "heuristic-campus-baseline",
  "allocation_source": "heuristic_fallback"
}
```

#### Scenario C: Un-warmed Model / Checkpoint Unavailable Fallback
```json
{
  "success": true,
  "status": "success",
  "allocated_stall": "slot5",
  "allocated_label": "B2",
  "is_fallback": true,
  "fallback_reason": "Neural model not loaded or pre-warmed; heuristic fallback applied",
  "model_confidence": null,
  "latency_ms": 0.385,
  "top3_slots": ["slot5", "slot4", "slot3"],
  "model_version": "maddpg-stabilized-twin-critic-v1",
  "allocation_source": "heuristic_fallback"
}
```

#### Scenario D: Topology Mismatch Fallback ($<5$ or $>5$ Stalls)
```json
{
  "success": true,
  "status": "success",
  "allocated_stall": "slot5",
  "allocated_label": "B2",
  "is_fallback": true,
  "fallback_reason": "TopologyMismatchError: Invalid stall count: expected 5, got 6; heuristic fallback applied",
  "model_confidence": null,
  "latency_ms": 0.510,
  "top3_slots": ["slot5", "slot4", "slot3"],
  "model_version": "maddpg-stabilized-twin-critic-v1",
  "allocation_source": "heuristic_fallback"
}
```

#### Scenario E: All Stalls Occupied
```json
{
  "success": true,
  "status": "no_available_stalls",
  "allocated_stall": null,
  "allocated_label": null,
  "is_fallback": false,
  "fallback_reason": "All stalls occupied or reserved",
  "model_confidence": 0.0,
  "latency_ms": 0.620,
  "top3_slots": [],
  "ranked_slots": [],
  "model_version": "maddpg-stabilized-twin-critic-v1",
  "allocation_source": "marl_gcn_neural_policy"
}
```

- **Error Codes:**
  - `200 OK`: All normal allocations and graceful fallbacks return HTTP 200 with `is_fallback: true/false`.
  - `500 Internal Server Error`: Unhandled fatal exception with database unreachable and heuristic failure.

---

## 5. Booking & Reservation Endpoint

### 5.1 `POST /api/parking/book`
Reserves a campus parking stall for a specified duration (0.25 to 4.0 hours). Hardened in Stage 8.10 and Stage 8.12 with process-level mutex serialization and fail-closed Firebase conditional ETag enforcement.

- **Neural Inference:** No
- **State Mutated:** **Yes** (Writes active reservation to `/data/booked_slots/{slot_id}` in Firebase RTDB).
- **Concurrency & Atomicity Protection:**
  1. **Process Mutex (`_booking_lock`):** Serializes all concurrent booking threads within the backend instance.
  2. **Fail-Closed ETag Retrieval:** Requests `GET /data/booked_slots/{slot_id}.json`. If the GET fails or returns no ETag header, the operation aborts immediately with `HTTP 502 Bad Gateway`. Unconditioned PUT is strictly forbidden.
  3. **Conditional PUT (`If-Match: <etag>`):** Updates the slot resource atomically in Firebase RTDB. If another client modified the slot concurrently, Firebase returns `HTTP 412 Precondition Failed`, which this endpoint maps to `HTTP 409 Conflict`.
  4. **Duplicate Idempotency:** If the same driver email submits a duplicate request for an already-held active booking, the endpoint returns the existing reservation with `is_duplicate: true` and `HTTP 200 OK`.
- **Request Headers:** `Content-Type: application/json`
- **Request Body Schema:**
```json
{
  "slot_id": "slot3",
  "user_id": "usr_9921",
  "user_email": "driver@campus.edu",
  "booking_time": "18:30",
  "duration_hours": 1.5
}
```

- **Response Scenarios:**

#### Success (`200 OK`):
```json
{
  "success": true,
  "message": "Slot slot3 booked for 1h 30m",
  "booking_id": "bk_1763300400_slot3",
  "slot_id": "slot3",
  "user_email": "driver@campus.edu",
  "booking_time": "18:30",
  "duration_hours": 1.5,
  "duration_label": "1h 30m",
  "booked_at": "2026-11-16 18:30:00.000000",
  "expires_at": "2026-11-16T20:00:00.000000"
}
```

#### Idempotent Duplicate Request (`200 OK`):
```json
{
  "success": true,
  "message": "Slot slot3 is already reserved by you.",
  "booking_id": "bk_1763300400_slot3",
  "slot_id": "slot3",
  "user_email": "driver@campus.edu",
  "booking_time": "18:30",
  "duration_hours": 1.5,
  "duration_label": "1h 30m",
  "booked_at": "2026-11-16 18:30:00.000000",
  "expires_at": "2026-11-16T20:00:00.000000",
  "is_duplicate": true
}
```

#### Conflict / Stall Already Occupied or Reserved (`409 Conflict`):
```json
{
  "success": false,
  "message": "Stall slot3 is already reserved by another driver."
}
```
*(Or `"Stall slot3 is currently occupied."`)*  
*(Or `"Reservation conflict: stall state changed concurrently. Please retry."` on Firebase 412)*

#### Concurrency Token Retrieval Failure (`502 Bad Gateway`):
```json
{
  "success": false,
  "message": "Failed to retrieve database concurrency token (HTTP 500)."
}
```
*(Or `"Database response missing required ETag for conditional write."`)*

#### Database Unavailable (`503 Service Unavailable`):
```json
{
  "success": false,
  "message": "Database unavailable: cannot verify stall availability."
}
```

#### Database Timeout (`504 Gateway Timeout`):
```json
{
  "success": false,
  "message": "Database write timed out. Reservation could not be confirmed."
}
```

#### Bad Request (`400 Bad Request`):
```json
{
  "success": false,
  "message": "Missing required fields"
}
```

---

## 6. Health & Telemetry Endpoint

### 6.1 `GET /api/health`
Monitors backend health, feature-flag status, and neural inference pre-warming readiness.

- **Neural Inference:** No
- **State Mutated:** No
- **Responses:**
  - `200 OK` (Pre-warmed and ready):
    ```json
    {
      "status": "ok",
      "service": "Smart Parking AI",
      "ai_allocation_enabled": false,
      "ai_model_loaded": true,
      "ai_model_prewarmed": true,
      "ai_status": "ready"
    }
    ```
  - `200 OK` (Loaded but not pre-warmed):
    ```json
    {
      "status": "ok",
      "service": "Smart Parking AI",
      "ai_allocation_enabled": false,
      "ai_model_loaded": true,
      "ai_model_prewarmed": false,
      "ai_status": "loaded_not_warmed"
    }
    ```
  - `200 OK` (Model load failure):
    ```json
    {
      "status": "ok",
      "service": "Smart Parking AI",
      "ai_allocation_enabled": false,
      "ai_model_loaded": false,
      "ai_model_prewarmed": false,
      "ai_status": "load_failed: Checkpoint file missing"
    }
    ```

---

## 7. Error Handling & HTTP Status Code Matrix

| HTTP Status | Meaning | Typical Cause | Backend Action | Client Action |
| :--- | :--- | :--- | :--- | :--- |
| `200 OK` | Success | Normal allocation / booking | Returns payload | Update UI / Store reservation |
| `201 Created` | Resource Created | Account registered | Returns JWT token | Navigate to Dashboard |
| `400 Bad Request` | Invalid Input | Missing body fields | Aborts request | Highlight missing field |
| `401 Unauthorized` | Invalid Credentials | Bad password/token | Aborts request | Prompt user to log in |
| `404 Not Found` | Resource Missing | Endpoint/User not found | Aborts request | Show error notice |
| `409 Conflict` | Concurrency Conflict | Slot occupied / Booked | Rejects reservation | Refresh map; re-allocate |
| `502 Bad Gateway` | Concurrency Breach | Missing ETag / Upstream RTDB fail | Aborts conditional write | Show retry button |
| `503 Unavailable` | Pre-check Failure | Firebase RTDB unreachable | Aborts reservation | Show offline mode notice |
| `504 Gateway Timeout`| Network Timeout | Firebase write timed out | Aborts reservation | Offer retry to driver |
| `500 Server Error` | Unhandled Error | Internal python exception | Fallback to heuristic (allocation) | Show general error toast |

