"""
Smart Parking AI - Flask API Server
Authentication and parking data endpoints
Integrates real parking data from firebase_dashboard.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from smart_parking_ai.auth import (
    register_user,
    login_user,
    verify_token,
    get_user_by_email,
    update_co2_saved,
)
from smart_parking_ai.firebase_config import FIREBASE_URL
from smart_parking_ai.services.firebase_service import (
    get_parking_states,
)
from smart_parking_ai.models.marl import select_best_slots, compute_scores
from smart_parking_ai.models.gru import predict_availability
from smart_parking_ai.models.gnn import get_route_to_slot
from smart_parking_ai.services.co2_service import calculate_co2
from smart_parking_ai.utils.distance import get_slot_distances

app = Flask(__name__)
CORS(app)  # Enable CORS for Flutter web


# ============ Authentication Endpoints ============

@app.route("/api/auth/register", methods=["POST"])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        email = data.get("email", "").strip()
        password = data.get("password", "")
        name = data.get("name", "").strip()
        
        result = register_user(email, password, name)
        status_code = 201 if result["success"] else 400
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    """Login a user"""
    try:
        data = request.get_json()
        email = data.get("email", "").strip()
        password = data.get("password", "")
        
        result = login_user(email, password)
        status_code = 200 if result["success"] else 401
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/auth/verify", methods=["POST"])
def verify():
    """Verify a token"""
    try:
        data = request.get_json()
        token = data.get("token", "")
        
        user = verify_token(token)
        if user:
            return jsonify({"success": True, "user": user}), 200
        else:
            return jsonify({"success": False, "message": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/auth/user/<email>", methods=["GET"])
def get_user(email):
    """Get user profile"""
    try:
        # Optional: verify token from Authorization header
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if token:
            user = verify_token(token)
            if not user:
                return jsonify({"success": False, "message": "Invalid token"}), 401
        
        user = get_user_by_email(email)
        if user:
            return jsonify({"success": True, "user": user}), 200
        else:
            return jsonify({"success": False, "message": "User not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ============ Parking Data Endpoints ============

@app.route("/api/parking/slots", methods=["GET"])
def get_slots():
    """Get all parking slots and their status"""
    try:
        states = get_parking_states(FIREBASE_URL)
        if not states:
            return jsonify({"success": False, "message": "No parking data available"}), 404
        
        # Get distance data for each slot
        slot_distances = get_slot_distances(len(states))
        
        # Format slots data with real status
        slots = []
        for index, state in enumerate(states):
            slot_id = index + 1
            distance = slot_distances.get(slot_id, 500 + (index * 100))  # Default distances
            
            slots.append({
                "id": f"slot{slot_id}",
                "number": slot_id,
                "available": state == 0,  # 0 = available, 1 = occupied
                "status": "available" if state == 0 else "occupied",
                "distance": distance,  # Distance in meters
                "price": round(5 + (index * 0.5), 2),  # Price per hour
            })
        
        available_count = sum(1 for s in slots if s["available"])
        return jsonify({
            "success": True,
            "slots": slots,
            "total": len(slots),
            "available": available_count,
            "occupied": len(slots) - available_count
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/parking/recommendations", methods=["GET"])
def get_parking_recommendations():
    """Get parking recommendations using MARL, GRU, and GNN AI models"""
    try:
        states = get_parking_states(FIREBASE_URL)
        if not states:
            return jsonify({"success": False, "message": "No recommendations available"}), 404
        
        slot_distances = get_slot_distances(len(states))
        
        # Get AI recommendations using MARL model (Multi-Agent Reinforcement Learning)
        ranked_slots, best_slot, top3_slots = select_best_slots(states)
        
        # Get MARL scores for detailed breakdown
        marl_scores = compute_scores(states)
        
        # Get predictions using GRU model (Gated Recurrent Unit)
        predictions = predict_availability(states)
        
        # Convert marl_scores to proper format — compute_scores returns (slot_idx, score, details)
        marl_scores_list = []
        for item in marl_scores:
            if isinstance(item, tuple) and len(item) == 3:
                slot_idx, score, _details = item
            elif isinstance(item, tuple) and len(item) == 2:
                slot_idx, score = item
            else:
                slot_idx = item.get('slot', 1)
                score = item.get('score', 0)
            marl_scores_list.append((int(slot_idx), float(score)))
        
        # Check if all slots are occupied
        all_occupied = all(s == 1 for s in states)
        
        # Use the real GNN parking graph for route optimization
        if best_slot:
            gnn_route, gnn_distance = get_route_to_slot(best_slot)
        else:
            gnn_route = []
            gnn_distance = 0
        
        # Calculate CO2 savings
        if best_slot:
            best_slot_index = int(best_slot.replace("slot", "")) if isinstance(best_slot, str) else 1
            best_distance = slot_distances.get(best_slot_index, 500)
            max_distance = max(slot_distances.values()) if slot_distances else 1000
            distance_saved = max_distance - best_distance
            co2_saved = calculate_co2(distance_saved)
        else:
            co2_saved = 0
            distance_saved = 0
        
        # Build wait suggestion when all occupied (GRU predicts which frees soonest)
        wait_suggestion = None
        if all_occupied:
            from smart_parking_ai.models.gru import get_availability_scores
            gru_scores = get_availability_scores(states)
            likely_free = sorted(
                gru_scores.items(), key=lambda x: x[1][0], reverse=True
            )
            if likely_free:
                candidate, (avail, conf) = likely_free[0]
                wait_suggestion = {
                    "slot": candidate,
                    "predicted_availability": round(avail, 3),
                    "confidence": round(conf, 3),
                    "message": f"GRU predicts {candidate} is most likely to free up ({avail:.0%} chance, {conf:.0%} confidence)"
                }
        
        return jsonify({
            "success": True,
            "all_occupied": all_occupied,
            "recommendations": {
                "best_slot": best_slot,
                "top3_slots": top3_slots,
                "available_count": sum(1 for s in states if s == 0),
                "total_slots": len(states),
                "co2_saved_kg": round(co2_saved / 1000, 3),
                "distance_saved_m": round(distance_saved, 1),
                "wait_suggestion": wait_suggestion,
                "timestamp": str(__import__('datetime').datetime.now())
            },
            "ai_models": {
                "gnn": {
                    "optimal_route": gnn_route,
                    "distance_m": gnn_distance,
                },
                "marl": {
                    "top_slot": best_slot,
                    "all_scores": [(s, sc) for s, sc in ranked_slots],
                },
                "gru": {
                    "predictions": predictions,
                },
            }
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/parking/co2", methods=["POST"])
def add_co2_saved():
    """Record CO2 saved for a user"""
    try:
        data = request.get_json()
        email = data.get("email", "").strip()
        co2_amount = float(data.get("co2_amount", 0))
        
        if co2_amount < 0:
            return jsonify({"success": False, "message": "CO2 amount must be positive"}), 400
        
        if update_co2_saved(email, co2_amount):
            user = get_user_by_email(email)
            return jsonify({"success": True, "user": user}), 200
        else:
            return jsonify({"success": False, "message": "User not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ============ IoT Sensor Endpoints ============

@app.route("/api/parking/update", methods=["POST"])
def update_sensor_data():
    """Receive real-time sensor data from Arduino/ESP32 and update Firebase"""
    try:
        data = request.get_json()
        slot_id = data.get("slot_id", "slot1")
        distance = float(data.get("distance", 0))
        occupied = data.get("occupied", False)
        
        # Validate inputs
        if distance < 0 or distance > 400:
            return jsonify({"success": False, "message": "Invalid distance value"}), 400
        
        # Log sensor update
        print(f"📡 Sensor Update - {slot_id}: {distance:.1f}cm → {'🚗 OCCUPIED' if occupied else '✓ AVAILABLE'}")
        
        # Write to Firebase: update the states array
        try:
            slot_index = int(slot_id.replace("slot", "")) - 1
            states = get_parking_states(FIREBASE_URL)
            if states and 0 <= slot_index < len(states):
                states[slot_index] = 1 if occupied else 0
                # Write updated states back to Firebase
                import requests as req
                base_url = FIREBASE_URL.replace("/data.json", "")
                req.patch(
                    f"{base_url}/data.json",
                    json={"states": states},
                    timeout=5,
                )
                print(f"   ✅ Firebase updated: states = {states}")
        except Exception as fb_err:
            print(f"   ⚠️ Firebase write failed: {fb_err}")
        
        return jsonify({
            "success": True,
            "message": f"Slot {slot_id} updated",
            "slot_id": slot_id,
            "distance": distance,
            "occupied": occupied,
            "timestamp": str(__import__('datetime').datetime.now())
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/parking/sensor/<slot_id>", methods=["GET"])
def get_sensor_status(slot_id):
    """Get latest sensor status for a specific slot"""
    try:
        # Get parking states from Firebase
        states = get_parking_states(FIREBASE_URL)
        if not states:
            return jsonify({"success": False, "message": "No data available"}), 404
        
        # Parse slot ID (e.g., "slot1" -> index 0)
        try:
            slot_index = int(slot_id.replace("slot", "")) - 1
            if slot_index < 0 or slot_index >= len(states):
                return jsonify({"success": False, "message": "Slot not found"}), 404
            
            state = states[slot_index]
            occupied = state == 1
            
            return jsonify({
                "success": True,
                "slot_id": slot_id,
                "occupied": occupied,
                "status": "occupied" if occupied else "available"
            }), 200
        except (ValueError, IndexError):
            return jsonify({"success": False, "message": "Invalid slot ID format"}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ============ Booking Endpoints ============

@app.route("/api/parking/book", methods=["POST"])
def book_parking_slot():
    """Book a parking slot — supports fractional hours (e.g. 1.5 = 1h 30m).
    Also writes to Firebase so all connected phones see the booking in real-time.
    """
    try:
        from datetime import datetime, timedelta
        import requests as http_requests
        
        data = request.get_json()
        
        slot_id = data.get("slot_id", "").strip()
        user_id = data.get("user_id", "").strip()
        user_email = data.get("user_email", "").strip()
        booking_time = data.get("booking_time", "")
        duration_hours = float(data.get("duration_hours", 2))
        
        if not slot_id or not user_email:
            return jsonify({"success": False, "message": "Missing required fields"}), 400
        
        # Enforce max 4 hours
        if duration_hours > 4:
            duration_hours = 4.0
        if duration_hours < 0.25:
            duration_hours = 0.25
        
        booking_id = f"bk_{int(datetime.now().timestamp())}_{slot_id}"
        now = datetime.now()
        expires_at = now + timedelta(hours=duration_hours)
        
        # Format duration for display
        total_min = int(round(duration_hours * 60))
        h, m = divmod(total_min, 60)
        if h > 0 and m > 0:
            dur_label = f"{h}h {m}m"
        elif h > 0:
            dur_label = f"{h}h"
        else:
            dur_label = f"{m}m"
        
        # Write booking to Firebase /data/booked_slots/{slotId} for real-time multi-device sync
        # This path is inside /data/ which both phones already listen to via onValue('data')
        try:
            fb_base = FIREBASE_URL.replace("/data.json", "")
            fb_booking_url = f"{fb_base}/data/booked_slots/{slot_id}.json"
            fb_payload = {
                "slotLabel": slot_id.replace("slot", "S"),
                "duration": duration_hours,
                "bookedAt": now.isoformat(),
                "expiresAt": expires_at.isoformat(),
                "status": "active",
                "userEmail": user_email,
            }
            http_requests.put(fb_booking_url, json=fb_payload, timeout=3)
            print(f"🔥 Firebase sync OK → /data/booked_slots/{slot_id}")
        except Exception as fb_err:
            print(f"⚠️ Firebase booking sync failed: {fb_err}")
        
        # Log the booking
        print(f"✅ Booking confirmed - {slot_id} for {user_email}")
        print(f"   Booking ID: {booking_id}")
        print(f"   Time: {booking_time}")
        print(f"   Duration: {dur_label} ({duration_hours}h)")
        print(f"   Expires: {expires_at.isoformat()}")
        
        return jsonify({
            "success": True,
            "message": f"Slot {slot_id} booked for {dur_label}",
            "booking_id": booking_id,
            "slot_id": slot_id,
            "user_email": user_email,
            "booking_time": booking_time,
            "duration_hours": duration_hours,
            "duration_label": dur_label,
            "booked_at": str(now),
            "expires_at": expires_at.isoformat(),
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ============ Health Check ============

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "Smart Parking AI"}), 200


@app.route("/api/init/test-data", methods=["POST"])
def init_test_data():
    """Initialize test parking data (development only)"""
    try:
        import json
        
        # Test parking slots matching UI mockup (A1-C2 = 6 slots total)
        test_slots = {
            "slot1": {"label": "A1", "occupied": False, "distance": 180.5, "co2_saved": 0.35},
            "slot2": {"label": "A2", "occupied": True, "distance": 45.2, "co2_saved": 0.45},
            "slot3": {"label": "B1", "occupied": False, "distance": 210.0, "co2_saved": 0.28},
            "slot4": {"label": "B2", "occupied": True, "distance": 50.0, "co2_saved": 0.50},
            "slot5": {"label": "C1", "occupied": False, "distance": 190.3, "co2_saved": 0.32},
            "slot6": {"label": "C2", "occupied": False, "distance": 220.0, "co2_saved": 0.41},
        }
        
        # Save test data to JSON file for reference
        with open('test_parking_data.json', 'w') as f:
            json.dump(test_slots, f, indent=2)
        
        return jsonify({
            "success": True,
            "message": "Test data initialized",
            "slots": test_slots,
            "total": len(test_slots),
            "free": sum(1 for s in test_slots.values() if not s["occupied"]),
            "occupied": sum(1 for s in test_slots.values() if s["occupied"]),
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ============ Error Handlers ============

@app.errorhandler(404)
def not_found(error):
    return jsonify({"success": False, "message": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(error):
    return jsonify({"success": False, "message": "Internal server error"}), 500


if __name__ == "__main__":
    print("🚗 Starting Smart Parking AI API Server...")
    print("📍 API running at http://localhost:5000")
    print("📚 Authentication Endpoints:")
    print("  POST   /api/auth/register - Register new user")
    print("  POST   /api/auth/login - Login user")
    print("  POST   /api/auth/verify - Verify token")
    print("  GET    /api/auth/user/<email> - Get user profile")
    print("📚 Parking Data Endpoints:")
    print("  GET    /api/parking/slots - Get all parking slots")
    print("  GET    /api/parking/recommendations - Get recommendations")
    print("  POST   /api/parking/co2 - Record CO2 saved")
    print("📚 IoT Sensor Endpoints:")
    print("  POST   /api/parking/update - Receive sensor data from Arduino")
    print("  GET    /api/parking/sensor/<slot_id> - Get sensor status")
    print("\n")
    
    app.run(debug=True, host="0.0.0.0", port=5000)
