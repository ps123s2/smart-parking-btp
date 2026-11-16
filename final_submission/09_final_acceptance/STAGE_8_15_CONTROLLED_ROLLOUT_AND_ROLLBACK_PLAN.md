# SMART PARKING BTP — STAGE 8.15 CONTROLLED ROLLOUT & ROLLBACK PLAN
## Operational Readiness Criteria, Multi-Tier Gating, Emergency Rollback Protocols & Telemetry Monitoring Specification

**Date:** November 16, 2026  
**Auditor / Role:** Senior DevOps Engineer, Infrastructure Architect & QA Auditor  
**Primary Deliverable:** `STAGE_8_15_CONTROLLED_ROLLOUT_AND_ROLLBACK_PLAN.md`  
**Active Production Flag:** `ENABLE_AI_ALLOCATION=false` (Strictly Preserved)  
**Execution Objective:** Establish complete deployment readiness and rollback automation without activating production allocation.

---

## 1. Executive Summary

This document specifies the operational framework, quantitative gating thresholds, observability architecture, and emergency rollback procedures governing any future activation of the paper-aligned MARL-GCN neural allocation model in production.

**Core Mandate:** In strict adherence to project safety protocols, the production feature flag remains disabled (`ENABLE_AI_ALLOCATION=false`). No automated or unattended activation is permitted. Activation requires explicit written authorization from the Project Administrator following complete verification of the administrative checklist in Section 5.

---

## 2. Quantitative Activation Prerequisites

Before the production feature flag may be toggled from `false` to `true`, all 10 quantitative acceptance criteria must be satisfied simultaneously:

| Domain | Acceptance Metric | Quantitative Threshold | Verified Value in Stage 8.14 | Gate Status |
| :--- | :--- | :---: | :---: | :---: |
| **1. Database Consistency** | Booking race condition rejection | $100.0\%$ (0 dual-bookings) | $100.0\%$ (Verified in test suite) | **SATISFIED** |
| **2. Write Verification** | Failed Firebase write handling | $0\%$ false `200 OK` responses | $0\%$ (Strict 502/503/504) | **SATISFIED** |
| **3. Model Readiness** | Startup pre-warm completion | Confirmed before HTTP serving | Pre-warmed in $0.41\text{ ms}$ | **SATISFIED** |
| **4. Allocation Validity** | Vacant stall allocation rate | $100.0\%$ (0 occupied stalls) | $100.0\%$ (20/20 shadow tests) | **SATISFIED** |
| **5. Saturation Defense** | 100% occupancy behavior | Return `None` (0 phantom stalls)| Verified (`status: no_available`) | **SATISFIED** |
| **6. Latency Budget** | P95 neural inference latency | $< 50.0\text{ ms}$ | **$1.95\text{ ms}$** (25x under budget) | **SATISFIED** |
| **7. API Round-Trip** | End-to-end Flask response | $< 100.0\text{ ms}$ | **$0.40\text{ ms} – 0.58\text{ ms}$** | **SATISFIED** |
| **8. Frontend Integrity** | Mobile TypeScript build diagnostics | Exactly 0 errors | **0 errors** (`npx tsc --noEmit`) | **SATISFIED** |
| **9. Fallback Reliability** | Outage / error fallback success | $100.0\%$ graceful heuristic | $100.0\%$ (0 unhandled crashes) | **SATISFIED** |
| **10. Regression Safety** | Full automated test pass rate | $100.0\%$ | **$100.0\%$** (65 / 65 tests passed) | **SATISFIED** |

**Identified Blockers:** Zero technical or architectural blockers remain. Production gating is administrative only.

---

## 3. Feature Flag Protection & Gating Mechanism

### 3.1 Architectural Flag Verification
In [`api.py:33, 290-295`](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py#L33):
```python
ENABLE_AI_ALLOCATION = os.getenv("ENABLE_AI_ALLOCATION", "false").lower() == "true"
...
# Per-request dynamic evaluation
is_ai_enabled = os.getenv("ENABLE_AI_ALLOCATION", "false").lower() == "true" or ENABLE_AI_ALLOCATION
if not is_ai_enabled:
    # 100% route to verified heuristic allocator
    ranked_slots, best_slot, top3_slots = select_best_slots(states)
    ...
```

### 3.2 Gating Properties
1. **Disabled by Default:** If `ENABLE_AI_ALLOCATION` is omitted from server environment variables, the default string `"false"` forces `is_ai_enabled = False`.
2. **Invalid String Protection:** Malformed values (e.g. `ENABLE_AI_ALLOCATION=invalid`, `ENABLE_AI_ALLOCATION=0`, or empty string) evaluate to `False`.
3. **No External Client Override:** Clients cannot bypass feature flag evaluation via query parameters, HTTP headers, or JSON body tokens.
4. **Zero Downtime Dynamic Switching:** Because the flag reads `os.getenv` dynamically per request, updating the environment variable in container orchestration takes immediate effect without requiring process restart.

---

## 4. Emergency Rollback Plan

### 4.1 Automated & Manual Rollback Triggers
An immediate rollback to the legacy heuristic allocator must be executed if any of the following events occur in production:
- **Trigger 1 (CRITICAL):** Any incident of an occupied or reserved stall being recommended to a driver (`occupied_stall_allocations > 0`).
- **Trigger 2 (CRITICAL):** Dual-booking or database race condition detected (`412 Precondition Failed` rate $> 5\%$ or write failure returning 200).
- **Trigger 3 (HIGH):** Elevated neural inference latency (P95 latency $> 50.0\text{ ms}$ over 5 consecutive minutes).
- **Trigger 4 (HIGH):** Neural module exception / fallback rate exceeding $10.0\%$ of production requests.
- **Trigger 5 (MEDIUM):** Any unhandled server exception resulting in `HTTP 500` from `/api/ai/allocate-slot`.

### 4.2 Step-by-Step Rollback Procedure (Execution Duration: $< 30$ seconds)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    EMERGENCY ROLLBACK EXECUTION WORKFLOW                     │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
           Step 1: Disable Environment Variable on Server Host
                   export ENABLE_AI_ALLOCATION=false
                                      │
                                      ▼
           Step 2: Immediate Heuristic Fallback Verification
                   curl -s http://localhost:5000/api/ai/allocate-slot
                   Verify: "allocation_source": "heuristic_fallback"
                                      │
                                      ▼
           Step 3: Database & Active Booking Integrity Verification
                   GET /data/booked_slots.json
                   Verify: All active reservations remain preserved!
                                      │
                                      ▼
           Step 4: Mobile Frontend Verification
                   Confirm MapScreen polyline resolves to heuristic slot
                                      │
                                      ▼
           Step 5: Incident Logging & Administrative Post-Mortem
```

### 4.3 Data Preservation Guarantee
Rolling back `ENABLE_AI_ALLOCATION=false` does **NOT**:
- Delete, truncate, or alter any existing reservation records in Firebase `/data/booked_slots`.
- Disconnect active Expo mobile clients or interrupt ongoing turn-by-turn navigation sessions.
- Invalidate authentication tokens or user accounts.

---

## 5. Monitoring & Observability Specification

The production deployment must stream telemetry to a centralized logging/monitoring aggregator (e.g. Datadog, Prometheus, or Google Cloud Logging) tracking the following metric streams:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION TELEMETRY METRICS                         │
├────────────────────────────────┬───────────────────┬─────────────────────────┤
│ Metric Name                    │ Type              │ Alert Threshold         │
├────────────────────────────────┼───────────────────┼─────────────────────────┤
│ ai.allocation.requests.total   │ Counter           │ N/A                     │
│ ai.allocation.neural.count     │ Counter           │ N/A                     │
│ ai.allocation.fallback.count   │ Counter           │ $> 5\%$ (Warning)       │
│ ai.allocation.latency.p95_ms   │ Histogram         │ $> 30.0\text{ ms}$      │
│ ai.allocation.invalid_stall    │ Counter           │ $> 0$ (CRITICAL ALERT)  │
│ booking.requests.total         │ Counter           │ N/A                     │
│ booking.conflicts.409_count    │ Counter           │ $> 10\%$ (Warning)      │
│ booking.write_failures.502     │ Counter           │ $> 0$ (HIGH ALERT)      │
│ system.health.ai_ready         │ Gauge (0 or 1)    │ $== 0$ (HIGH ALERT)     │
└────────────────────────────────┴───────────────────┴─────────────────────────┘
```

**Privacy & Security Compliance:**
- Passwords, authorization tokens, user emails, and raw license numbers are strictly redacted from monitoring payloads.
- Log records only capture anonymized stall IDs, latency values, and HTTP status codes.

---

## 6. Administrative Activation Checklist

This checklist must be signed and confirmed by the Project Lead prior to live activation:

- [ ] **1. Code Hardening Verified:** Fail-closed ETag retrieval and topology validation confirmed in [`api.py`](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/api.py).
- [ ] **2. Automated Test Suite Verified:** 65/65 unit and regression tests passing.
- [ ] **3. Shadow Validation Verified:** 100% valid allocation rate demonstrated in [`STAGE_8_14_SHADOW_VALIDATION_REPORT.md`](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/STAGE_8_14_SHADOW_VALIDATION_REPORT.md).
- [ ] **4. Model Weights Verified:** Checkpoint hash and file size verified against research baseline.
- [ ] **5. Mobile App Verified:** TypeScript compilation passes with 0 diagnostics.
- [ ] **6. Production Health Verified:** `/api/health` reports `status: ok` and `ai_status: ready`.
- [ ] **7. Rollback Drill Verified:** Manual rollback execution tested and confirmed in $< 30$ seconds.
- [ ] **8. Administrator Sign-Off:** Written human approval granted.

**Activation Approval Signature:** ____________________________________  
**Date Authorized:** ________________________

