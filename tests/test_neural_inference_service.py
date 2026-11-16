"""Unit tests for NeuralInferenceService."""

import unittest
import os
import threading

from smart_parking_ai.neural_inference_service import NeuralInferenceService


class TestNeuralInferenceService(unittest.TestCase):

    def setUp(self):
        self.service = NeuralInferenceService()

    def test_service_initialization(self):
        self.assertTrue(self.service.is_loaded, f"Failed to load: {self.service.load_error}")
        self.assertIsNone(self.service.load_error)

    def test_valid_inference_latency(self):
        # Stalls 2 and 5 occupied
        states = [0, 1, 0, 0, 1]
        booked = {"slot1": {"status": "active"}}

        result = self.service.allocate_slot(states, booked)

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "success")
        self.assertIn(result["allocated_stall"], ["slot3", "slot4"])  # slot1 booked, 2 & 5 occupied
        self.assertFalse(result["is_fallback"])
        # Verify latency is sub-50ms
        self.assertLess(result["latency_ms"], 50.0)
        print(f"Measured CPU Inference Latency: {result['latency_ms']:.2f} ms")

    def test_all_occupied_scenario(self):
        states = [1, 1, 1, 1, 1]
        booked = {}

        result = self.service.allocate_slot(states, booked)

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "no_available_stalls")
        self.assertIsNone(result["allocated_stall"])
        self.assertEqual(result["top3_slots"], [])

    def test_missing_checkpoint_handling(self):
        bogus_service = NeuralInferenceService(checkpoint_path="/non/existent/path/ckpt.pt")
        self.assertFalse(bogus_service.is_loaded)

        result = bogus_service.allocate_slot([0, 0, 0, 0, 0], {})
        self.assertFalse(result["success"])
        self.assertTrue(result["is_fallback"])
        self.assertIn("failed to load", result["fallback_reason"])

    def test_concurrent_thread_safety(self):
        results = []
        errors = []

        def worker(tid):
            try:
                states = [0, 1, 0, 1, 0] if tid % 2 == 0 else [1, 0, 1, 0, 0]
                res = self.service.allocate_slot(states, {})
                results.append(res)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)
        self.assertEqual(len(results), 10)
        for r in results:
            self.assertTrue(r["success"])
            self.assertFalse(r["is_fallback"])


if __name__ == "__main__":
    unittest.main()

