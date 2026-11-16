# SMART PARKING BTP — LIVE DEMONSTRATION GUIDE
## Step-by-Step Academic Evaluation & Viva Demonstration Protocol

**Project:** Smart Parking System Using MARL-GCN  
**Audience:** Academic Supervisor, Project Evaluators, External Examiners, and Viva Committee  
**Execution Objective:** Demonstrate the complete integrated Smart Parking system using safe, isolated test fixtures without altering production Firebase data.  
**Safety Protocol:** `ENABLE_AI_ALLOCATION=false` (Production baseline preserved; test queries run via isolated parameters and mock routes).  
**Estimated Demo Duration:** 10 – 15 minutes.

---

## 1. Demonstration Setup & Pre-Flight Verification

Before inviting the evaluation committee, verify that the local environment and background processes are operational.

### Step 1.1: Verify Background Daemons
Open a terminal and run:
```bash
ps aux | grep -E "expo|ngrok" | grep -v grep
```
**Expected Output:**
- `expo start --tunnel -p 8081` is running.
- `ngrok start` is active.
- `expo start` is serving the web/mobile bundle.

### Step 1.2: Verify Backend Health & Pre-Warming Telemetry
Execute a health query against the Flask microservice:
```bash
curl -s http://localhost:5000/api/health | jq .
```
**Expected Response:**
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
*Talking Point:* Explain that `ai_model_loaded: true` and `ai_model_prewarmed: true` confirm the PyTorch weights are warm in memory, eliminating cold-start latency for drivers.

---

## 2. Live Demonstration Sequence

### Step 2.1: Mobile Dashboard Presentation
1. Open the mobile client in Chrome/Safari: `http://localhost:8081` (or scan the Expo QR code on a mobile device).
2. **Key UI Elements to Highlight:**
   - **Facility Availability Row:** Show total bays (5), vacant bays (4), and occupied bays (1).
   - **Real-Time Synchronized Indicator:** Explain that updates reflect live Firebase RTDB streaming.
   - **CO2 Savings Metric Card:** Displays cumulative kilograms of CO2 prevented by optimized parking navigation.
   - **AI Allocation Recommendation Banner:** Displays the recommended optimal stall with confidence score and latency badge.

### Step 2.2: Interactive Map Navigation & Visual State Encoding
1. Tap the **"View Map"** button to navigate to `MapScreen.tsx`.
2. **Visual Encoding to Highlight:**
   - **Stall Statuses:** Green = Available, Red = Occupied, Blue = User Reserved.
   - **Aisle Layout:** North Aisle A (stalls A1, A2, A3) and South Aisle B (stalls B1, B2).
   - **Walking Route Polyline:** Illustrates walking guidance from the parking entrance to the allocated bay.
   - **Active Booking Protection:** Explain that when a driver reserves a stall, the map prioritizes their active booking over AI refreshes, preventing visual disorientation.

### Step 2.3: Safe Isolated Booking Demonstration
To demonstrate booking without writing test data to production Firebase:
1. Demonstrate the test suite booking verification via terminal:
   ```bash
   /opt/anaconda3/bin/python3 -m unittest test_stage_8_10_remediation.py -k test_01_booking_lock_and_etag_conditional_put
   ```
2. **Demonstrate Conflict Handling (Double-Booking Rejection):**
   ```bash
   /opt/anaconda3/bin/python3 -m unittest test_stage_8_10_remediation.py -k test_03_concurrent_race_condition_conflict
   ```
   *Talking Point:* Point out that when a second driver attempts to book an already-claimed stall, the backend receives HTTP 412 from Firebase and maps it to HTTP 409 Conflict, rejecting the duplicate reservation.

### Step 2.4: Demonstrating Heuristic Fail-Safe Fallback
Demonstrate that when the AI model is disabled or encounters an anomaly, the system seamlessly maintains 100% availability via heuristic fallback:
1. Run the fallback test:
   ```bash
   /opt/anaconda3/bin/python3 -m unittest test_api_integration.py -k test_03_fallback_when_disabled
   ```
2. Inspect the JSON payload:
   ```json
   {
     "success": true,
     "allocated_stall": "slot5",
     "is_fallback": true,
     "fallback_reason": "AI allocation disabled by feature flag (ENABLE_AI_ALLOCATION=false)",
     "allocation_source": "heuristic_fallback"
   }
   ```
   *Talking Point:* Emphasize that the driver experiences zero errors or downtime; the campus heuristic (`marl.py`) serves the request instantly ($0.199\text{ ms}$).

### Step 2.5: Explaining Municipal Research vs. Campus Deployment
Conclude the demonstration by presenting the architectural distinction:
- **Municipal Research Simulation:** Evaluated over 9 districts, 541 parking bays in Melbourne under 8 traffic scenarios with 240 simulation runs.
- **Physical Campus Deployment:** Implemented across 5 physical stalls (A1–A3, B1–B2) instrumented with ultrasonic sensors and integrated into the Expo mobile application.

---

## 3. Demo Troubleshooting & Quick Recovery

- **Issue:** Flask port 5000 occupied or not responding.  
  **Resolution:** Run `python api.py` in a separate terminal.
- **Issue:** Expo web interface displays blank screen.  
  **Resolution:** Hard refresh browser with `Cmd + Shift + R` (macOS) or `Ctrl + Shift + R`.
- **Issue:** Health endpoint reports `ai_model_prewarmed: false`.  
  **Resolution:** The backend pre-warms on startup; restart with `python api.py` and inspect console log `🔥 MARL-GCN Neural Inference Service pre-warmed`.
