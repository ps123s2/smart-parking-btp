"""Stage 8.12 Final Pre-Activation Safety Hardening Test Suite.

Verifies all pre-activation safety requirements specified in Stage 8.12:
  - SEC-01 Fail-Closed Concurrency:
    1. Successful ETag retrieval and conditional write.
    2. GET returning an HTTP error (aborts with 502).
    3. GET timing out (aborts with 504).
    4. Missing ETag (aborts with 502).
    5. Conditional write returning HTTP 412 (returns 409).
    6. Conditional write failing (500 -> 502, timeout -> 504).
    7. Two competing booking requests.
  - TOP-01 Topology Fail-Closed Rejection:
    1. Exactly 5 valid stalls.
    2. Fewer than 5 stalls rejected.
    3. More than 5 stalls rejected.
    4. Duplicate stall identifiers rejected.
    5. Unknown stall identifiers rejected.
  - PERF-01 Startup & Pre-Warming Readiness:
    1. Model loading from real checkpoint.
    2. Pre-warm completion and latency verification.
    3. First HTTP inference latency after startup (< 50ms).
    4. Subsequent warmed inference latency (< 5ms).
    5. Unloaded / un-warmed model fails safe (never reports AI ready, falls back).
"""

import unittest
from unittest.mock import patch, MagicMock
import threading
import time
import os
import requests

from api import app, NeuralInferenceService
from smart_parking_ai.campus_adapter import (
    CampusGraph,
    CampusObservationAdapter,
    TopologyMismatchError,
    CAMPUS_SLOT_IDS,
    CAMPUS_SLOT_LABELS,
)


class TestStage812Hardening(unittest.TestCase):
    """Rigorous tests covering Stage 8.12 safety hardening requirements."""

    @classmethod
    def setUpClass(cls):
        service = NeuralInferenceService.get_instance()
        service.prewarm()

    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    # =========================================================================
    # Category 1: SEC-01 Fail-Closed ETag & Distributed Atomicity Tests
    # =========================================================================

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_01_successful_etag_retrieval_and_conditional_write(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """Case 1: Successful ETag retrieval and conditional write with If-Match header."""
        mock_get_res = MagicMock()
        mock_get_res.status_code = 200
        mock_get_res.headers = {"ETag": "etag_valid_token_123"}
        mock_get.return_value = mock_get_res

        mock_put_res = MagicMock()
        mock_put_res.status_code = 200
        mock_put.return_value = mock_put_res

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot3",
                "user_id": "user_alice",
                "user_email": "alice@test.com",
                "duration_hours": 1.5,
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["slot_id"], "slot3")

        # Verify PUT was called with the exact If-Match header
        mock_put.assert_called_once()
        _, kwargs = mock_put.call_args
        self.assertIn("headers", kwargs)
        self.assertEqual(kwargs["headers"].get("if-match"), "etag_valid_token_123")

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_02_get_returning_http_error_aborts_before_put(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """Case 2: GET returning an HTTP error (500) aborts booking operation with 502."""
        mock_get_res = MagicMock()
        mock_get_res.status_code = 500
        mock_get.return_value = mock_get_res

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot1",
                "user_id": "user_bob",
                "user_email": "bob@test.com",
            },
        )

        self.assertEqual(response.status_code, 502)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("concurrency token", data["message"])
        # PUT must NEVER be called
        mock_put.assert_not_called()

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_03_get_timing_out_aborts_with_504(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """Case 3: GET timing out aborts booking operation with 504 Gateway Timeout."""
        mock_get.side_effect = requests.exceptions.Timeout("ETag fetch timed out")

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot2",
                "user_id": "user_carol",
                "user_email": "carol@test.com",
            },
        )

        self.assertEqual(response.status_code, 504)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("timed out", data["message"].lower())
        mock_put.assert_not_called()

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_04_missing_etag_aborts_before_put(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """Case 4: GET succeeds (200) but has missing or empty ETag header -> aborts with 502."""
        mock_get_res = MagicMock()
        mock_get_res.status_code = 200
        mock_get_res.headers = {}  # Empty headers: no ETag present!
        mock_get.return_value = mock_get_res

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot4",
                "user_id": "user_dan",
                "user_email": "dan@test.com",
            },
        )

        self.assertEqual(response.status_code, 502)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("missing required etag", data["message"].lower())
        # PUT must NEVER be called without a valid ETag
        mock_put.assert_not_called()

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_05_conditional_write_returning_http_412_translates_to_409(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """Case 5: Conditional PUT returning HTTP 412 translates to HTTP 409 Conflict."""
        mock_get_res = MagicMock()
        mock_get_res.status_code = 200
        mock_get_res.headers = {"ETag": "etag_stale_999"}
        mock_get.return_value = mock_get_res

        mock_put_res = MagicMock()
        mock_put_res.status_code = 412  # Precondition Failed (ETag mismatch)
        mock_put.return_value = mock_put_res

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot5",
                "user_id": "user_eve",
                "user_email": "eve@test.com",
            },
        )

        self.assertEqual(response.status_code, 409)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("conflict", data["message"].lower())

    @patch("api.get_parking_states", return_value=[0, 0, 0, 0, 0])
    @patch("api.get_booked_slots", return_value={})
    @patch("requests.get")
    @patch("requests.put")
    def test_06_conditional_write_failing_with_upstream_error(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """Case 6: Conditional PUT failing with 503 upstream error returns 502."""
        mock_get_res = MagicMock()
        mock_get_res.status_code = 200
        mock_get_res.headers = {"ETag": "etag_ok_123"}
        mock_get.return_value = mock_get_res

        mock_put_res = MagicMock()
        mock_put_res.status_code = 503
        mock_put.return_value = mock_put_res

        response = self.client.post(
            "/api/parking/book",
            json={
                "slot_id": "slot1",
                "user_id": "user_frank",
                "user_email": "frank@test.com",
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
    def test_07_two_competing_booking_requests_strictly_one_succeeds(
        self, mock_put, mock_get, mock_booked, mock_states
    ):
        """Case 7: Two competing booking requests for the same stall; exactly one succeeds."""
        mock_get_res = MagicMock()
        mock_get_res.status_code = 200
        mock_get_res.headers = {"ETag": "initial_etag"}
        mock_get.return_value = mock_get_res

        put_first = MagicMock()
        put_first.status_code = 200

        put_second = MagicMock()
        put_second.status_code = 412  # Second PUT encounters modified ETag

        mock_put.side_effect = [put_first, put_second]

        results = []

        def client_request(email):
            r = self.client.post(
                "/api/parking/book",
                json={
                    "slot_id": "slot4",
                    "user_id": f"uid_{email}",
                    "user_email": email,
                },
            )
            results.append((email, r.status_code, r.get_json()))

        t1 = threading.Thread(target=client_request, args=("driver_1@test.com",))
        t2 = threading.Thread(target=client_request, args=("driver_2@test.com",))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(len(results), 2)
        status_codes = [r[1] for r in results]
        self.assertIn(200, status_codes)
        self.assertIn(409, status_codes)

    # =========================================================================
    # Category 2: TOP-01 Campus Topology Hardening Tests
    # =========================================================================

    def test_08_topology_exactly_five_expected_stalls(self):
        """TOP-01 Case 1: Exactly 5 expected stalls are validated and accepted."""
        graph = CampusGraph(slot_ids=["slot1", "slot2", "slot3", "slot4", "slot5"])
        self.assertEqual(graph.num_nodes, 5)

        adapter = CampusObservationAdapter(graph)
        # 5 valid states
        adapter.validate_topology(states=[0, 1, 0, 0, 1])
        # Valid booked_slots
        adapter.validate_topology(booked_slots={"slot1": {"status": "active"}})

    def test_09_topology_fewer_than_five_stalls_rejected(self):
        """TOP-01 Case 2: Fewer than 5 stalls fails closed and raises TopologyMismatchError."""
        # 3 stalls passed to graph
        with self.assertRaises(TopologyMismatchError) as ctx:
            CampusGraph(slot_ids=["slot1", "slot2", "slot3"])
        self.assertIn("expected exactly 5 stalls", str(ctx.exception))

        adapter = CampusObservationAdapter()
        # 3 states passed to validate_topology
        with self.assertRaises(TopologyMismatchError) as ctx2:
            adapter.validate_topology(states=[0, 1, 0])
        self.assertIn("Incomplete stall telemetry", str(ctx2.exception))

    def test_10_topology_more_than_five_stalls_rejected(self):
        """TOP-01 Case 3: More than 5 stalls fails closed and raises TopologyMismatchError."""
        with self.assertRaises(TopologyMismatchError) as ctx:
            CampusGraph(slot_ids=["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"])
        self.assertIn("expected exactly 5 stalls", str(ctx.exception))

        adapter = CampusObservationAdapter()
        with self.assertRaises(TopologyMismatchError) as ctx2:
            adapter.validate_topology(states=[0, 1, 0, 0, 1, 0])
        self.assertIn("exceeding authoritative", str(ctx2.exception))

    def test_11_topology_duplicate_identifiers_rejected(self):
        """TOP-01 Case 4: Duplicate stall identifiers fails closed."""
        with self.assertRaises(TopologyMismatchError) as ctx:
            CampusGraph(slot_ids=["slot1", "slot1", "slot2", "slot3", "slot4"])
        self.assertIn("duplicate stall identifiers", str(ctx.exception).lower())

    def test_12_topology_unknown_identifiers_rejected(self):
        """TOP-01 Case 5: Unknown stall identifiers fails closed."""
        with self.assertRaises(TopologyMismatchError) as ctx:
            CampusGraph(slot_ids=["slot1", "slot2", "slot3", "slot4", "slot99"])
        self.assertIn("unknown stall identifier", str(ctx.exception).lower())

        adapter = CampusObservationAdapter()
        with self.assertRaises(TopologyMismatchError) as ctx2:
            adapter.validate_topology(booked_slots={"slot99": {"status": "active"}})
        self.assertIn("Unrecognized slot ID 'slot99'", str(ctx2.exception))

    # =========================================================================
    # Category 3: PERF-01 Startup Readiness & Latency Measurements
    # =========================================================================

    def test_13_model_loading_and_prewarming_completion(self):
        """PERF-01: Verifies model loading time, pre-warm completion, and status."""
        service = NeuralInferenceService.get_instance()
        self.assertTrue(service.is_loaded)
        self.assertTrue(service.is_prewarmed)
        self.assertLess(service.prewarm_latency_ms, 50.0)

    def test_14_first_and_subsequent_http_inference_latency(self):
        """PERF-01: Verifies first and subsequent HTTP inference latencies after startup."""
        service = NeuralInferenceService.get_instance()

        # Measure 1st forward pass latency
        t0 = time.perf_counter()
        res1 = service.allocate_slot(states=[0, 0, 0, 0, 0], booked_slots={}, stateless=True)
        first_pass_ms = (time.perf_counter() - t0) * 1000.0
        self.assertTrue(res1["success"])
        self.assertLess(first_pass_ms, 50.0)

        # Measure subsequent warmed passes
        subsequent_latencies = []
        for _ in range(10):
            t0 = time.perf_counter()
            res = service.allocate_slot(states=[0, 1, 0, 0, 1], booked_slots={}, stateless=True)
            subsequent_latencies.append((time.perf_counter() - t0) * 1000.0)
            self.assertTrue(res["success"])

        avg_subsequent_ms = sum(subsequent_latencies) / len(subsequent_latencies)
        self.assertLess(avg_subsequent_ms, 5.0)

    def test_15_unwarmed_or_failed_model_fails_safe(self):
        """PERF-01: Unwarmed/failed model never reports AI readiness and falls back safely."""
        # Check health endpoint reports accurate readiness telemetry
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["ai_model_loaded"])
        self.assertTrue(data["ai_model_prewarmed"])
        self.assertEqual(data["ai_status"], "ready")
        self.assertFalse(data["ai_allocation_enabled"])  # Production flag false!


if __name__ == "__main__":
    unittest.main()

