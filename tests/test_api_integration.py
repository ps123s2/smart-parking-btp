"""Unit and integration tests for Flask backend Stage 8 integration."""

import unittest
from unittest.mock import patch
import json

from api import app, ENABLE_AI_ALLOCATION
from smart_parking_ai.neural_inference_service import NeuralInferenceService


class TestFlaskBackendIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Warm up the inference service singleton once at test suite start
        NeuralInferenceService.get_instance()

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_health_check_endpoint(self):
        response = self.app.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "ok")

    def test_default_feature_flag_is_false(self):
        import api
        self.assertFalse(api.ENABLE_AI_ALLOCATION)

    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 1])
    @patch("api.get_booked_slots", return_value={"slot1": {"status": "active"}})
    def test_allocate_slot_feature_flag_disabled(self, mock_booked, mock_states):
        # When ENABLE_AI_ALLOCATION is False, should cleanly return heuristic fallback
        response = self.app.post("/api/ai/allocate-slot", json={"user_id": "test_user"})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["is_fallback"])
        self.assertEqual(data["allocation_source"], "heuristic_fallback")
        self.assertIn("disabled by feature flag", data["fallback_reason"])
        self.assertIsNotNone(data["allocated_stall"])

    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 1])
    @patch("api.get_booked_slots", return_value={"slot1": {"status": "active"}})
    def test_allocate_slot_feature_flag_enabled(self, mock_booked, mock_states):
        # Temporarily enable feature flag in memory for isolated test
        import api
        original_flag = api.ENABLE_AI_ALLOCATION
        try:
            api.ENABLE_AI_ALLOCATION = True
            response = self.app.post("/api/ai/allocate-slot", json={"user_id": "test_user"})
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertTrue(data["success"])
            self.assertFalse(data["is_fallback"])
            self.assertEqual(data["allocation_source"], "marl_gcn_neural_policy")
            self.assertIsNotNone(data["allocated_stall"])
            self.assertIsNotNone(data["allocated_label"])
            self.assertGreater(data["model_confidence"], 0.0)
            self.assertLess(data["latency_ms"], 50.0)
            print(f"Flask API AI Latency: {data['latency_ms']:.2f} ms")
        finally:
            api.ENABLE_AI_ALLOCATION = original_flag

    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 1])
    def test_existing_recommendations_endpoint_backward_compatibility(self, mock_states):
        # Verify existing /api/parking/recommendations endpoint operates with zero regressions
        response = self.app.get("/api/parking/recommendations")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertIn("recommendations", data)


if __name__ == "__main__":
    unittest.main()
