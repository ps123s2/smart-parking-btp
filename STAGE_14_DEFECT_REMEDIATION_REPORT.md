# SMART PARKING BTP — STAGE 14: DEFECT REMEDIATION REPORT

**Author:** Senior React Native Architect, Expo Engineer, Flask Backend Engineer, & QA Auditor  
**Date:** November 16, 2026  
**Execution Mode:** Controlled Remediation & Verification  
**Primary Deliverable:** `STAGE_14_DEFECT_REMEDIATION_REPORT.md`  
**Reference Document:** `FINAL_INDEPENDENT_EXPO_RESEARCH_AI_INTEGRATION_AUDIT.md`  
**Feature Flag Status:** `ENABLE_AI_ALLOCATION=false` (Preserved)  
**Research Checkpoint MD5:** `0a11ba44c111ed7af02246e4b4945d59` (Verified Untampered)  

---

## 1. EXECUTIVE SUMMARY

In the Stage 13 independent read-only audit (`FINAL_INDEPENDENT_EXPO_RESEARCH_AI_INTEGRATION_AUDIT.md`), four specific defects were identified in the Expo mobile application layer:
1. **`FE-INT-01`**: DashboardScreen recommendation selection priority mismatch, bypassing neural AI recommendations in favor of legacy Firebase payloads.
2. **`FE-INT-02`**: React hook memoization missing `aiAllocation` in the `useMemo` dependency array, preventing dynamic reactivity when new neural allocations arrive.
3. **`FE-INT-03`**: API client `request()` catch block returning `{ success: true, message: 'Offline mode — server unreachable' }`, masking backend and network failures as successes and corrupting hook state.
4. **`NET-01`**: API base URL hardcoded to remote Render URL (`https://smart-parking-btp.onrender.com`), creating cold-start latency and connectivity failures during local development.

Under Stage 14, all four defects were systematically remediated, validated against strict TypeScript type checking (`npx tsc --noEmit` resulting in 0 errors), and verified through 10 new contract tests in `test_stage_14_remediation.py` plus the complete 83-test regression suite (93 total tests passing).

---

## 2. DEFECT REMEDIATION SPECIFICATIONS

### 2.1 FE-INT-01: DashboardScreen Recommendation Selection Priority Reconciliation

- **File Modified:** `smart-parking-app/src/screens/DashboardScreen.tsx` (Lines 158–172)
- **Defect Class:** Logic Precedence / State Routing Defect
- **Root Cause:** Line 160 checked `data?.recommendation?.best_slot` (legacy static Firebase payload) before `slots.find((s) => s.isBest)?.id`, and omitted `aiAllocation?.allocated_stall` completely, unlike `MapScreen.tsx` which prioritized neural allocation. Consequently, even when the Flask backend supplied a valid MARL-GCN neural allocation, `DashboardScreen` displayed the stale legacy Firebase slot.
- **Remediation Implemented:**
  Reconciled the priority hierarchy into an explicit, defensive 5-tier evaluation matching `MapScreen.tsx`:
  1. **Tier 1 (Highest):** Active User Booking (`activeBooking.slotId`).
  2. **Tier 2:** Valid Neural AI Allocation (`aiAllocation.allocated_stall`, verified to exist and be unoccupied).
  3. **Tier 3:** Slot designated as `isBest` in the dynamic MARL live slots array (`slots.find((s) => s.isBest)?.id`).
  4. **Tier 4:** Legacy Firebase recommendation (`data?.recommendation?.best_slot`).
  5. **Tier 5 (Fail-safe):** First unoccupied bay, falling back to `'slot1'`.

```typescript
// smart-parking-app/src/screens/DashboardScreen.tsx
// 1. Automatically select AI recommended slot when opening app
// Priority: 1. Active User Booking
//           2. Neural / Dynamic AI Allocation (allocated_stall)
//           3. Slot designated as isBest in slots array (MARL dynamic policy)
//           4. Legacy Firebase recommendation
//           5. First available unoccupied slot / fallback 'slot1'
const neuralAllocatedId = aiAllocation?.allocated_stall;
const isNeuralAllocatedValid = neuralAllocatedId && (!slots.length || slots.some((s) => s.id === neuralAllocatedId && !s.occupied));

const aiRecommendedSlotId = activeBooking
  ? activeBooking.slotId
  : (
      isNeuralAllocatedValid
        ? neuralAllocatedId
        : (slots.find((s) => s.isBest)?.id || data?.recommendation?.best_slot || slots.find((s) => !s.occupied)?.id || 'slot1')
    );
```

---

### 2.2 FE-INT-02: React Hook Memoization Dependency Reactivity

- **File Modified:** `smart-parking-app/src/hooks/useFirebaseParking.ts` (Line 690)
- **Defect Class:** React Lifecycle / Memoization Stale Closure Defect
- **Root Cause:** Lines 661–671 in `useFirebaseParking.ts` read `aiAllocation?.allocated_stall` and `aiAllocation?.top3_slots` to compute `isBest` and `isTop3` for each stall. However, the `useMemo` dependency array on line 690 only included `[data, layout, bookedSlots, dynamicMARL]`. When `refreshAIAllocation()` resolved with a new neural inference payload, `slots` failed to recalculate because `aiAllocation` was omitted from the dependencies.
- **Remediation Implemented:**
  Added `aiAllocation` directly to the `useMemo` dependency array:
```typescript
// smart-parking-app/src/hooks/useFirebaseParking.ts
      return {
        id: slotId,
        label: SLOT_LABELS[slotId] || `S${index + 1}`,
        index,
        occupied: state === 1 || hasActiveBooking,
        isBest,
        isTop3,
        prediction: data.predictions?.[slotId] || 'Unknown',
        estMinutes: timing ? timing.est_minutes : 0,
        timingLabel: finalTimingLabel,
        coordinate: layout.slots[slotId] || {
          latitude: layout.entry.latitude + 0.0005 * (index + 1),
          longitude: layout.entry.longitude,
        },
      };
    })
    : [],
  [data, layout, bookedSlots, dynamicMARL, aiAllocation]
);
```

---

### 2.3 FE-INT-03: API Client Error Handling & Masking Remediation

- **File Modified:** `smart-parking-app/src/services/api.ts` (Lines 53–66)
- **Defect Class:** API Contract / Error Handling Defect
- **Root Cause:** Line 35 caught fetch exceptions and returned `{ success: true, message: 'Offline mode — server unreachable' } as T;`. Callers checking `res.success` (such as `refreshAIAllocation` in `useFirebaseParking.ts:143`) evaluated `res.success` as `true` and accepted the invalid fallback object into `aiAllocation` state.
- **Remediation Implemented:**
  Updated the catch block to return `success: false` with structured status metadata, explicit timeout detection via `AbortError`, and detailed error messaging:
```typescript
// smart-parking-app/src/services/api.ts
  } catch (err: any) {
    // Return a structured error response instead of masking network failure as success
    console.warn(`[API] ${endpoint} failed:`, err.message);
    const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
    return {
      success: false,
      status: 'network_error',
      message: isTimeout
        ? 'Request timed out — server unreachable'
        : (err.message || 'Network request failed'),
      is_fallback: true,
      fallback_reason: isTimeout ? 'Network timeout' : 'Network failure',
    } as T;
  }
```
In addition, `AIAllocationResponse` in `smart-parking-app/src/types/parking.ts` was extended with optional `message?: string;` to ensure strict TypeScript type compatibility.

---

### 2.4 NET-01: Environment-Aware API Base URL Resolution

- **File Modified:** `smart-parking-app/src/services/api.ts` (Lines 11–32)
- **Defect Class:** Configuration / Network Routing Defect
- **Root Cause:** Line 11 defaulted directly to `https://smart-parking-btp.onrender.com`. In local development or during offline testing, requests waited for 60-second cold starts on sleeping free-tier Render dynos or timed out completely.
- **Remediation Implemented:**
  Introduced an exported, environment-aware resolver function `resolveApiBaseUrl()` that:
  1. Inspects `process.env.EXPO_PUBLIC_API_URL` and strips trailing slashes if present.
  2. In development mode (`__DEV__`), defaults to the local Flask backend at `http://127.0.0.1:5000`.
  3. Falls back to `https://smart-parking-btp.onrender.com` only for standalone production builds without explicit environment override.
  4. Sanitizes endpoint strings in `request<T>()` with leading slash enforcement (`endpoint.startsWith('/') ? endpoint : '/${endpoint}'`).

```typescript
// smart-parking-app/src/services/api.ts
/**
 * Resolves the backend API base URL with environment awareness:
 * 1. Explicit EXPO_PUBLIC_API_URL environment variable (trailing slashes stripped)
 * 2. Development mode (__DEV__): http://127.0.0.1:5000 (local Flask backend)
 * 3. Standalone production deployment fallback: https://smart-parking-btp.onrender.com
 */
export function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/+$/, '');
  }
  // In development (Expo Go, local simulator, web dev), default to local Flask server
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://127.0.0.1:5000';
  }
  // Standalone production deployment fallback
  return 'https://smart-parking-btp.onrender.com';
}

export const API_BASE = resolveApiBaseUrl();
```

---

## 3. VERIFICATION & STATIC QUALITY AUDIT

### 3.1 TypeScript Static Type Check
- **Command:** `cd smart-parking-app && npx tsc --noEmit`
- **Result:** Exited with code `0`. Exactly `0` type errors or warnings detected across the entire Expo project.

### 3.2 Stage 14 Remediation Contract Tests
- **Test File:** `test_stage_14_remediation.py`
- **Command:** `/opt/anaconda3/bin/python3 -m unittest test_stage_14_remediation.py`
- **Results:** 10/10 tests passed in 0.001s:
  - `TestStage14DashboardPriority.test_priority_logic_present`: PASS
  - `TestStage14DashboardPriority.test_priority_precedence_order`: PASS
  - `TestStage14DashboardPriority.test_pure_priority_simulation`: PASS
  - `TestStage14HookMemoization.test_ai_allocation_in_slots_dependency_array`: PASS
  - `TestStage14ApiClientFailureContract.test_catch_block_returns_success_false`: PASS
  - `TestStage14ApiClientFailureContract.test_timeout_detection_present`: PASS
  - `TestStage14ApiBaseUrlResolution.test_resolve_api_base_url_exported`: PASS
  - `TestStage14ApiBaseUrlResolution.test_environment_awareness_logic`: PASS
  - `TestStage14ApiBaseUrlResolution.test_trailing_slash_stripped`: PASS
  - `TestStage14ApiBaseUrlResolution.test_pure_url_resolution_logic`: PASS

---

## 4. DEFECT STATUS MATRIX

| Defect ID | Description | Severity | Target File | Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`FE-INT-01`** | DashboardScreen recommendation priority mismatch | High | `DashboardScreen.tsx` | **RESOLVED** | Simulated priority test & typecheck PASS |
| **`FE-INT-02`** | Missing `aiAllocation` in hook memoization array | Medium | `useFirebaseParking.ts` | **RESOLVED** | AST dependency verification test PASS |
| **`FE-INT-03`** | API client masking network errors as `success: true` | High | `api.ts` | **RESOLVED** | Structured error contract test PASS |
| **`NET-01`** | API base URL defaulting to remote Render in dev | Medium | `api.ts` | **RESOLVED** | URL resolution & slash stripping test PASS |

---

## 5. SAFETY & INVARIANT AUDIT

1. **Feature Flag Invariant:** `ENABLE_AI_ALLOCATION` in `api.py:33` remains strictly set to default `false`.
2. **PyTorch Model Checkpoint:** MD5 hash of `research/paper_aligned/checkpoints/best_maddpg_stabilized_seed_42.pt` is `0a11ba44c111ed7af02246e4b4945d59` (zero modification).
3. **Database Write Invariant:** Zero writes performed to production Firebase Realtime Database (`smartparking-87cee-default-rtdb.firebaseio.com`).
4. **Background Process Invariant:** Active Expo and ngrok processes remain completely uninterrupted:
   - PID 44535: Expo Tunnel (`expo start --tunnel -p 8081`)
   - PID 44619: ngrok daemon
   - PID 60625: Expo Local (`expo start`)

