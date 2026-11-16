"""Complete End-to-End Regression Test Suite for Stage 8 Integration."""

import unittest
from unittest.mock import patch
import json
import threading
import time

from api import app, ENABLE_AI_ALLOCATION
from smart_parking_ai.campus_adapter import CAMPUS_SLOT_IDS, CAMPUS_SLOT_LABELS
from smart_parking_ai.neural_inference_service import NeuralInferenceService


class TestEndToEndRegression(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Warm up neural model singleton
        NeuralInferenceService.get_instance()

    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    # ------------------------------------------------------------------------
    # Flow 1: Successful AI Recommendation (When Feature Flag = True)
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 1])
    @patch("api.get_booked_slots", return_value={})
    def test_01_successful_ai_recommendation(self, mock_booked, mock_states):
        import api
        original_flag = api.ENABLE_AI_ALLOCATION
        try:
            api.ENABLE_AI_ALLOCATION = True
            response = self.client.post("/api/ai/allocate-slot", json={"user_id": "driver_01"})
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["status"], "success")
            self.assertFalse(data["is_fallback"])
            self.assertEqual(data["allocation_source"], "marl_gcn_neural_policy")
            self.assertIn(data["allocated_stall"], ["slot1", "slot3", "slot4"])
            self.assertGreater(data["model_confidence"], 0.0)
            self.assertLess(data["latency_ms"], 50.0)
        finally:
            api.ENABLE_AI_ALLOCATION = original_flag

    # ------------------------------------------------------------------------
    # Flow 2: Successful Fallback Recommendation (When Feature Flag = False)
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 1])
    @patch("api.get_booked_slots", return_value={})
    def test_02_successful_fallback_recommendation(self, mock_booked, mock_states):
        import api
        self.assertFalse(api.ENABLE_AI_ALLOCATION)  # Default must be False
        response = self.client.post("/api/ai/allocate-slot", json={"user_id": "driver_02"})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["is_fallback"])
        self.assertEqual(data["allocation_source"], "heuristic_fallback")
        self.assertIn("disabled by feature flag", data["fallback_reason"])
        self.assertIsNotNone(data["allocated_stall"])

    # ------------------------------------------------------------------------
    # Flow 3: Occupied Stall Rejection & Validation
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 0])  # Slot 2 is physically occupied
    @patch("api.get_booked_slots", return_value={})
    def test_03_occupied_stall_rejection(self, mock_booked, mock_states):
        response = self.client.post("/api/parking/book", json={
            "slot_id": "slot2",
            "user_email": "intruder@example.com",
            "duration_hours": 1.0,
        })
        self.assertEqual(response.status_code, 409)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("occupied", data["message"].lower())

    # ------------------------------------------------------------------------
    # Flow 4: No Available Stalls (Capacity Full)
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[1, 1, 1, 1, 1])  # All 5 stalls full
    @patch("api.get_booked_slots", return_value={})
    def test_04_no_available_stalls(self, mock_booked, mock_states):
        import api
        original_flag = api.ENABLE_AI_ALLOCATION
        try:
            api.ENABLE_AI_ALLOCATION = True
            response = self.client.post("/api/ai/allocate-slot", json={})
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["status"], "no_available_stalls")
            self.assertIsNone(data["allocated_stall"])
            self.assertEqual(data["top3_slots"], [])
        finally:
            api.ENABLE_AI_ALLOCATION = original_flag

    # ------------------------------------------------------------------------
    # Flow 5: Simultaneous Concurrent Requests (Thread Safety)
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[0, 0, 1, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    def test_05_simultaneous_requests(self, mock_booked, mock_states):
        import api
        original_flag = api.ENABLE_AI_ALLOCATION
        try:
            api.ENABLE_AI_ALLOCATION = True
            results = []
            errors = []

            def send_req(i):
                try:
                    res = self.client.post("/api/ai/allocate-slot", json={"user_id": f"driver_{i}"})
                    results.append(res)
                except Exception as e:
                    errors.append(e)

            threads = [threading.Thread(target=send_req, args=(i,)) for i in range(12)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            self.assertEqual(len(errors), 0)
            self.assertEqual(len(results), 12)
            for r in results:
                self.assertEqual(r.status_code, 200)
                data = r.get_json()
                self.assertTrue(data["success"])
                self.assertIsNotNone(data["allocated_stall"])
        finally:
            api.ENABLE_AI_ALLOCATION = original_flag

    # ------------------------------------------------------------------------
    # Flow 6: Duplicate Booking Prevention
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={
        "slot4": {"status": "active", "userEmail": "alice@example.com"}
    })
    def test_06_duplicate_booking_prevention(self, mock_booked, mock_states):
        response = self.client.post("/api/parking/book", json={
            "slot_id": "slot4",
            "user_email": "bob@example.com",
            "duration_hours": 2.0,
        })
        self.assertEqual(response.status_code, 409)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("already reserved", data["message"].lower())

    # ------------------------------------------------------------------------
    # Flow 7: Backend Failure Resilience (Malformed Input)
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    def test_07_backend_failure_resilience(self, mock_booked, mock_states):
        response = self.client.post(
            "/api/ai/allocate-slot",
            data="corrupted_not_json",
            content_type="text/plain"
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])

    # ------------------------------------------------------------------------
    # Flow 8: Model Failure Resilience (Fallback Triggered)
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch.object(NeuralInferenceService, "allocate_slot", return_value={
        "success": False,
        "is_fallback": True,
        "fallback_reason": "Simulated hardware failure",
        "status": "inference_error"
    })
    def test_08_model_failure_resilience(self, mock_infer, mock_booked, mock_states):
        import api
        original_flag = api.ENABLE_AI_ALLOCATION
        try:
            api.ENABLE_AI_ALLOCATION = True
            response = self.client.post("/api/ai/allocate-slot", json={})
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertTrue(data["success"])
            self.assertTrue(data["is_fallback"])
            self.assertEqual(data["allocation_source"], "heuristic_fallback")
        finally:
            api.ENABLE_AI_ALLOCATION = original_flag

    # ------------------------------------------------------------------------
    # Flow 9: Firebase Network Disconnection Resilience
    # ------------------------------------------------------------------------
    @patch("api.get_parking_states", side_effect=ConnectionError("Firebase DNS unreachable"))
    @patch("api.get_booked_slots", side_effect=ConnectionError("Firebase DNS unreachable"))
    def test_09_firebase_unreachable_offline_resilience(self, mock_booked, mock_states):
        response = self.client.post("/api/ai/allocate-slot", json={})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertIsNotNone(data["allocated_stall"])

    # ------------------------------------------------------------------------
    # Flow 10: Auth and Legacy Endpoints Regression
    # ------------------------------------------------------------------------
    def test_10_auth_and_legacy_endpoints_regression(self):
        res_health = self.client.get("/api/health")
        self.assertEqual(res_health.status_code, 200)

        res_login = self.client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "wrong"})
        self.assertIn(res_login.status_code, [400, 401])


if __name__ == "__main__":
    unittest.main()
