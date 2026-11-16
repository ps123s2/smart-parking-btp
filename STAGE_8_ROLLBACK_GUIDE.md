# STAGE 8 — ROLLBACK & DECOUPLING GUIDE

This document defines the emergency rollback and decoupling procedures for Stage 8 integration.

---

## 1. Zero-Downtime Rollback via Feature Flag (Recommended)

To instantly decouple the neural policy and revert 100% of allocation decisions to the pre-existing campus heuristic without restarting services:

### Step 1: Set Feature Flag to `false`
In your environment file or deployment dashboard (e.g. Render / local shell):
```bash
export ENABLE_AI_ALLOCATION=false
```

### Step 2: Verification
Send a probe request to verify fallback behavior:
```bash
curl -X POST http://localhost:5000/api/ai/allocate-slot \
  -H "Content-Type: application/json" \
  -d '{"user_id": "probe"}'
```
Expected response:
```json
{
  "success": true,
  "status": "success",
  "allocation_source": "heuristic_fallback",
  "is_fallback": true,
  "fallback_reason": "AI allocation disabled by feature flag (ENABLE_AI_ALLOCATION=false)"
}
```
**Outcome:** The Flask backend immediately bypasses all PyTorch neural inference, GAT message passing, and hypernetwork evaluation. 100% of allocation requests are serviced by `smart_parking_ai.models.marl.select_best_slots()`.

---

## 2. Complete Codebase Rollback via Git

If a complete reversion of all Stage 8 source code changes is required:

### Step 1: Revert Modified Production Files
```bash
git checkout HEAD -- api.py \
  smart-parking-app/src/types/parking.ts \
  smart-parking-app/src/services/api.ts \
  smart-parking-app/src/hooks/useFirebaseParking.ts \
  smart-parking-app/src/screens/DashboardScreen.tsx
```

### Step 2: Remove Newly Created Integration Modules (Optional)
```bash
rm smart_parking_ai/campus_adapter.py \
   smart_parking_ai/neural_inference_service.py \
   test_campus_adapter.py \
   test_neural_inference_service.py \
   test_api_integration.py \
   test_shadow_evaluation.py \
   test_end_to_end_regression.py
```

### Step 3: Verify Application Liveness
Check that the Expo development server compiles cleanly:
```bash
cd smart-parking-app && npx tsc --noEmit
```
Check that Flask starts cleanly:
```bash
python3 -m py_compile api.py
```

---

## 3. Database Safety Guarantee

Stage 8 required **zero database schema migrations** in Firebase Realtime Database. Reverting the backend or client files leaves Firebase completely intact and fully backward-compatible with all pre-existing app versions.

