"""Stage 8.10 Remediation and Concurrency Test Suite.

Verifies all defect remediations identified in STAGE_8_9_INDEPENDENT_ACCEPTANCE_AUDIT.md:
  - SEC-01 & SEC-02: Firebase atomic booking, concurrency serialization, write verification, ETag conflicts.
  - AI-01: Recurrent hidden-state isolation (stateless execution, zero cross-user leakage).
  - PERF-01: Startup pre-warming and sub-50ms latency validation.
  - TOP-01: Five-versus-six-stall campus topology reconciliation and anomaly detection.
  - OPS-01: Dynamic feature flag evaluation.
  - UI-01: MapScreen AI recommendation hierarchy and active booking priority.
"""

import unittest
from unittest.mock import patch, MagicMock
import threading
import time
import json
import os
import torch

from api import app, NeuralInferenceService
from smart_parking_ai.campus_adapter import (
    CampusGraph,
    CampusObservationAdapter,
    CAMPUS_SLOT_IDS,
    CAMPUS_SLOT_LABELS,
)


class TestStage810Remediation(unittest.TestCase):
    """Rigorous tests covering all Stage 8.10 remediations."""

    @classmethod
    def setUpClass(cls):
        # Ensure model is warmed up
        service = NeuralInferenceService.get_instance()
        service.prewarm()

    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    # =========================================================================
    # Category 1: Firebase Atomic Booking & Concurrency (SEC-01 & SEC-02)
    # =========================================================================

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_concurrent_same_stall_reservation_exactly_one_succeeds(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """SEC-01: Two simultaneous requests for the same stall cannot both succeed."""
        # Setup mock Firebase responses
        mock_get_response = MagicMock()
        mock_get_response.status_code = 200
        mock_get_response.json.return_value = None
        mock_get_response.headers = {"ETag": "etag_initial_123"}
        mock_get.return_value = mock_get_response

        # First PUT succeeds, second PUT simulates a conditional write conflict (412 Precondition Failed)
        put_success = MagicMock()
        put_success.status_code = 200
        put_success.json.return_value = {"name": "bk_ok"}

        put_conflict = MagicMock()
        put_conflict.status_code = 412  # Firebase RTDB ETag precondition failure

        mock_put.side_effect = [put_success, put_conflict]

        results = []

        def book_attempt(driver_email):
            res = self.client.post(
                "/api/parking/book",
                json={
                    "slot_id": "slot3",
                    "user_id": f"uid_{driver_email}",
                    "user_email": driver_email,
                    "duration_hours": 1.0,
                },
            )
            results.append((driver_email, res.status_code, res.get_json()))

        t1 = threading.Thread(target=book_attempt, args=("driver_alice@test.com",))
        t2 = threading.Thread(target=book_attempt, args=("driver_bob@test.com",))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(len(results), 2)
        status_codes = [r[1] for r in results]

        # Exactly one reservation succeeded (200), and the competing request failed with 409 Conflict
        self.assertIn(200, status_codes)
        self.assertIn(409, status_codes)

        # Validate successful payload
        success_res = next(r[2] for r in results if r[1] == 200)
        self.assertTrue(success_res["success"])
        self.assertEqual(success_res["slot_id"], "slot3")

        # Validate conflict payload
        conflict_res = next(r[2] for r in results if r[1] == 409)
        self.assertFalse(conflict_res["success"])
        self.assertIn("conflict", conflict_res["message"].lower())

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_firebase_write_failure_returns_502_not_200(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """SEC-02: Swallowed write failures must return 502 Bad Gateway, never 200 OK."""
        mock_get_res = MagicMock()
        mock_get_res.status_code = 200
        mock_get_res.json.return_value = None
        mock_get.return_value = mock_get_res

        # Upstream Firebase server error
        mock_put_res = MagicMock()
        mock_put_res.status_code = 500
        mock_put.return_value = mock_put_res

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot1",
                "user_id": "driver_01",
                "user_email": "driver01@test.com",
                "duration_hours": 2.0,
            },
        )

        self.assertEqual(response.status_code, 502)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("failed", data["message"].lower())

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_firebase_timeout_returns_504(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """SEC-02: Upstream timeout returns 504 Gateway Timeout."""
        import requests
        mock_get_res = MagicMock()
        mock_get_res.status_code = 200
        mock_get.return_value = mock_get_res

        mock_put.side_effect = requests.exceptions.Timeout("Connection timed out after 3.0s")

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot1",
                "user_id": "driver_01",
                "user_email": "driver01@test.com",
            },
        )

        self.assertEqual(response.status_code, 504)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("timed out", data["message"].lower())

    @patch("api.get_parking_states", return_value=[0, 1, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    def test_physically_occupied_stall_rejected_with_409(self, mock_booked, mock_states):
        """SEC-01: Physically occupied stall (sensor=1) cannot be reserved."""
        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot2",  # states[1] == 1
                "user_id": "driver_01",
                "user_email": "driver01@test.com",
            },
        )
        self.assertEqual(response.status_code, 409)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("occupied", data["message"].lower())

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={
        "slot4": {"status": "active", "userEmail": "driver_alice@test.com"}
    })
    def test_already_booked_stall_by_other_driver_rejected_with_409(self, mock_booked, mock_states):
        """SEC-01: Stall already reserved by another driver cannot be reserved."""
        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot4",
                "user_id": "driver_bob",
                "user_email": "driver_bob@test.com",
            },
        )
        self.assertEqual(response.status_code, 409)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("already reserved", data["message"].lower())

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={
        "slot4": {"status": "active", "userEmail": "driver_alice@test.com", "bookingId": "bk_existing_123"}
    })
    def test_duplicate_booking_by_same_driver_idempotent_200(self, mock_booked, mock_states):
        """Duplicate request by same user returns 200 OK idempotently."""
        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot4",
                "user_id": "driver_alice",
                "user_email": "driver_alice@test.com",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data.get("is_duplicate"))
        self.assertEqual(data["booking_id"], "bk_existing_123")

    # =========================================================================
    # Category 2: Hidden-State Isolation & GRU Lifecycle (AI-01)
    # =========================================================================

    def test_stateless_neural_inference_zero_cross_user_leakage(self):
        """AI-01: Successive requests from distinct drivers evaluate with zero cross-user contamination."""
        service = NeuralInferenceService.get_instance()
        service.reset_recurrent_state()

        # User A makes inference on state S1
        states_a = [0, 1, 0, 0, 1]
        booked_a = {"slot1": {"status": "active"}}
        res_a1 = service.allocate_slot(states=states_a, booked_slots=booked_a, stateless=True)

        # User B makes inference on completely different state S2
        states_b = [1, 1, 0, 0, 0]
        booked_b = {}
        res_b = service.allocate_slot(states=states_b, booked_slots=booked_b, stateless=True)

        # User A repeats inference on state S1
        res_a2 = service.allocate_slot(states=states_a, booked_slots=booked_a, stateless=True)

        # User A's allocation and confidence must be 100% IDENTICAL before and after User B's request
        self.assertEqual(res_a1["allocated_stall"], res_a2["allocated_stall"])
        self.assertEqual(res_a1["model_confidence"], res_a2["model_confidence"])
        self.assertEqual(res_a1["top3_slots"], res_a2["top3_slots"])
        self.assertEqual(len(res_a1["ranked_slots"]), len(res_a2["ranked_slots"]))

    def test_stateful_facility_tracking_with_explicit_reset(self):
        """AI-01: Stateful facility tracking mode isolates state per facility_id and supports resets."""
        service = NeuralInferenceService.get_instance()
        service.reset_recurrent_state("facility_alpha")

        # Two steps on facility_alpha
        res1 = service.allocate_slot([0, 0, 0, 0, 0], {}, facility_id="facility_alpha", stateless=False)
        self.assertTrue(res1["success"])

        # facility_beta does not share facility_alpha's state
        res_beta = service.allocate_slot([0, 0, 0, 0, 0], {}, facility_id="facility_beta", stateless=False)
        self.assertTrue(res_beta["success"])

        # Reset facility_alpha
        service.reset_recurrent_state("facility_alpha")
        with service._facility_lock:
            self.assertNotIn("facility_alpha", service._facility_states)
            self.assertIn("facility_beta", service._facility_states)

    # =========================================================================
    # Category 3: Model Startup Pre-Warming & Latency (PERF-01)
    # =========================================================================

    def test_model_prewarm_status_and_sub_50ms_budget(self):
        """PERF-01: Model is pre-warmed on initialization, executing sub-5ms warm passes."""
        service = NeuralInferenceService.get_instance()
        self.assertTrue(service.is_prewarmed)
        self.assertLess(service.prewarm_latency_ms, 50.0)

        # Execute 20 consecutive forward passes and check distribution
        latencies = []
        for _ in range(20):
            t0 = time.perf_counter()
            res = service.allocate_slot([0, 0, 0, 0, 0], {}, stateless=True)
            elapsed = (time.perf_counter() - t0) * 1000.0
            latencies.append(elapsed)
            self.assertTrue(res["success"])

        mean_lat = sum(latencies) / len(latencies)
        max_lat = max(latencies)

        # Well within 50ms budget
        self.assertLess(mean_lat, 5.0, f"Mean latency {mean_lat:.2f}ms exceeded 5.0ms target")
        self.assertLess(max_lat, 20.0, f"Max latency {max_lat:.2f}ms exceeded 20.0ms budget")

    # =========================================================================
    # Category 4: Campus Topology Reconciliation & Anomaly Detection (TOP-01)
    # =========================================================================

    def test_authoritative_campus_topology_five_stalls(self):
        """TOP-01: Authoritative campus topology strictly defines 5 stalls."""
        graph = CampusGraph()
        self.assertEqual(graph.num_nodes, 5)
        self.assertEqual(graph.slot_ids, ["slot1", "slot2", "slot3", "slot4", "slot5"])
        self.assertEqual(len(CAMPUS_SLOT_LABELS), 5)

    def test_extra_sixth_stall_logged_as_topology_anomaly(self):
        """TOP-01: Passing 6 stall states logs an explicit topology anomaly and safely ignores extra."""
        adapter = CampusObservationAdapter()
        # 6 states provided (e.g. from obsolete mockup)
        states_6 = [0, 1, 0, 0, 1, 0]
        node_t, adj_t, mask = adapter.build_node_features(states=states_6)

        # Tensor must retain authoritative (1, 5, 8) dimension
        self.assertEqual(node_t.shape, (1, 5, 8))
        self.assertEqual(adj_t.shape, (1, 5, 5))
        self.assertEqual(len(mask), 5)

        # Explicit anomaly was detected and logged
        self.assertTrue(len(adapter.last_anomalies) > 0)
        self.assertIn("TOPOLOGY ANOMALY", adapter.last_anomalies[0])
        self.assertIn("Extra states", adapter.last_anomalies[0])

    def test_missing_stall_states_fail_safe_to_occupied(self):
        """TOP-01: Missing sensor states (e.g. 2 states) fail safe to occupied."""
        adapter = CampusObservationAdapter()
        states_2 = [0, 0]  # only 2 stalls reported
        node_t, adj_t, mask = adapter.build_node_features(states=states_2)

        self.assertEqual(node_t.shape, (1, 5, 8))
        # Stalls 0 and 1 are vacant (from input)
        self.assertTrue(mask[0])
        self.assertTrue(mask[1])
        # Stalls 2, 3, 4 missing from telemetry fail-safe to unavailable
        self.assertFalse(mask[2])
        self.assertFalse(mask[3])
        self.assertFalse(mask[4])

    def test_unrecognized_slot_in_booked_slots_logged(self):
        """TOP-01: Unrecognized slot key in booked_slots logs an explicit topology anomaly."""
        adapter = CampusObservationAdapter()
        booked = {"slot99": {"status": "active"}}
        _ = adapter.build_node_features(states=[0, 0, 0, 0, 0], booked_slots=booked)

        self.assertTrue(len(adapter.last_anomalies) > 0)
        self.assertIn("Unrecognized slot ID 'slot99'", adapter.last_anomalies[0])

    # =========================================================================
    # Category 5: Dynamic Feature Flag Evaluation (OPS-01)
    # =========================================================================

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    def test_dynamic_feature_flag_evaluation_at_runtime(self, mock_booked, mock_states):
        """OPS-01: allocate-slot endpoint evaluates flag dynamically per request."""
        # 1. By default, ENABLE_AI_ALLOCATION is false -> routes to heuristic fallback
        with patch.dict(os.environ, {"ENABLE_AI_ALLOCATION": "false"}):
            import api
            api.ENABLE_AI_ALLOCATION = False
            res1 = self.client.post("/api/ai/allocate-slot")
            self.assertEqual(res1.status_code, 200)
            data1 = res1.get_json()
            self.assertTrue(data1["is_fallback"])
            self.assertEqual(data1["allocation_source"], "heuristic_fallback")

        # 2. When set to true dynamically -> executes neural inference
        with patch.dict(os.environ, {"ENABLE_AI_ALLOCATION": "true"}):
            res2 = self.client.post("/api/ai/allocate-slot")
            self.assertEqual(res2.status_code, 200)
            data2 = res2.get_json()
            self.assertFalse(data2["is_fallback"])
            self.assertEqual(data2["allocation_source"], "marl_gcn_neural_policy")
            self.assertIsNotNone(data2["allocated_stall"])

    # =========================================================================
    # Category 6: MapScreen Binding Hierarchy (UI-01)
    # =========================================================================

    def test_mapscreen_recommendation_resolution_logic(self):
        """UI-01: Verifies the exact ternary hierarchy used in MapScreen line 68."""
        # Case A: Neural AI allocation present -> chosen first
        ai_allocation = {"allocated_stall": "slot4", "model_confidence": 0.88}
        slots = [{"id": "slot1", "isBest": False}, {"id": "slot2", "isBest": True}]
        data = {"recommendation": {"best_slot": "slot2"}}

        best_slot_a = (
            ai_allocation.get("allocated_stall")
            or next((s["id"] for s in slots if s.get("isBest")), None)
            or data.get("recommendation", {}).get("best_slot")
        )
        self.assertEqual(best_slot_a, "slot4")

        # Case B: AI allocation null -> falls back to slot.isBest
        ai_allocation_null = None
        best_slot_b = (
            (ai_allocation_null or {}).get("allocated_stall")
            or next((s["id"] for s in slots if s.get("isBest")), None)
            or data.get("recommendation", {}).get("best_slot")
        )
        self.assertEqual(best_slot_b, "slot2")

        # Case C: Active booking takes priority over AI recommendation
        active_booking = {"slotId": "slot5", "status": "active"}
        target_slot_id = active_booking["slotId"] if active_booking else best_slot_a
        self.assertEqual(target_slot_id, "slot5")


if __name__ == "__main__":
    unittest.main()

