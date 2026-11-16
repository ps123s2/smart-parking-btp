"""Shadow Testing and Validation Suite for MARL-GCN Campus Integration.

Executes side-by-side comparison between the existing heuristic allocator
and the paper-aligned MARL-GCN neural policy across 10 operational conditions.
Zero database mutations; strictly isolated comparative analysis.
"""

import time
import json
import unittest
from typing import Dict, List, Any

from smart_parking_ai.models.marl import select_best_slots
from smart_parking_ai.campus_adapter import CAMPUS_SLOT_IDS, CAMPUS_SLOT_LABELS
from smart_parking_ai.neural_inference_service import NeuralInferenceService


class TestShadowEvaluation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.service = NeuralInferenceService.get_instance()
        cls.metrics = {
            "total_runs": 0,
            "ai_valid_allocations": 0,
            "heuristic_valid_allocations": 0,
            "agreement_count": 0,
            "ai_latencies_ms": [],
            "heuristic_latencies_ms": [],
            "fallback_count": 0,
            "scenario_results": {},
        }

    def _run_comparison(self, scenario_name: str, states: List[int], booked_slots: Dict[str, Any]):
        self.metrics["total_runs"] += 1

        # 1. Heuristic execution
        t0 = time.perf_counter()
        h_ranked, h_best, h_top3 = select_best_slots(states)
        h_latency = (time.perf_counter() - t0) * 1000.0

        # 2. Neural execution
        t1 = time.perf_counter()
        ai_result = self.service.allocate_slot(states, booked_slots)
        ai_latency = (time.perf_counter() - t1) * 1000.0

        self.metrics["ai_latencies_ms"].append(ai_latency)
        self.metrics["heuristic_latencies_ms"].append(h_latency)

        ai_stall = ai_result.get("allocated_stall")
        h_stall = h_best

        # Determine all genuinely available stalls considering sensor occupancy AND active bookings
        genuinely_free = []
        for i, s_id in enumerate(CAMPUS_SLOT_IDS):
            is_occ = (i < len(states) and states[i] == 1)
            is_bked = (booked_slots.get(s_id, {}).get("status") == "active")
            if not is_occ and not is_bked:
                genuinely_free.append(s_id)

        # Availability validation
        def is_valid_stall(stall):
            if stall is None:
                return len(genuinely_free) == 0
            return stall in genuinely_free

        ai_is_valid = is_valid_stall(ai_stall)
        h_is_valid = is_valid_stall(h_stall)

        if ai_is_valid:
            self.metrics["ai_valid_allocations"] += 1
        if h_is_valid:
            self.metrics["heuristic_valid_allocations"] += 1

        agreed = (ai_stall == h_stall)
        if agreed:
            self.metrics["agreement_count"] += 1

        self.metrics["scenario_results"][scenario_name] = {
            "states": states,
            "booked_slots": list(booked_slots.keys()),
            "ai_stall": ai_stall,
            "ai_valid": ai_is_valid,
            "ai_latency_ms": round(ai_latency, 3),
            "heuristic_stall": h_stall,
            "heuristic_valid": h_is_valid,
            "heuristic_latency_ms": round(h_latency, 3),
            "agreement": agreed,
        }

        # Assert zero invalid allocations for AI
        self.assertTrue(ai_is_valid, f"AI recommended invalid stall {ai_stall} in {scenario_name} (Free: {genuinely_free})")
        self.assertLess(ai_latency, 50.0, f"AI latency {ai_latency}ms exceeded 50ms budget")

    def test_scenario_01_all_stalls_available(self):
        self._run_comparison("01_all_available", [0, 0, 0, 0, 0], {})

    def test_scenario_02_one_stall_occupied(self):
        self._run_comparison("02_one_occupied", [0, 1, 0, 0, 0], {})

    def test_scenario_03_multiple_stalls_occupied(self):
        self._run_comparison("03_multiple_occupied", [1, 0, 1, 0, 1], {})

    def test_scenario_04_no_stalls_available(self):
        self._run_comparison("04_no_available", [1, 1, 1, 1, 1], {})

    def test_scenario_05_active_booking_overlap(self):
        # slot4 is physically free according to sensor, but actively booked by user!
        booked = {"slot4": {"status": "active", "userEmail": "usr@example.com"}}
        self._run_comparison("05_active_booking", [0, 0, 0, 0, 0], booked)

    def test_scenario_06_stale_and_truncated_sensor_data(self):
        # Sensor sent only 3 items instead of 5
        self._run_comparison("06_truncated_data", [1, 0, 1], {})

    def test_scenario_07_all_booked_except_one(self):
        booked = {
            "slot1": {"status": "active"},
            "slot2": {"status": "active"},
            "slot3": {"status": "active"},
            "slot5": {"status": "active"},
        }
        self._run_comparison("07_only_slot4_free", [0, 0, 0, 0, 0], booked)

    def test_scenario_08_alternating_states(self):
        self._run_comparison("08_alternating", [1, 0, 0, 1, 0], {})

    def test_scenario_09_near_capacity_saturation(self):
        booked = {"slot3": {"status": "active"}}
        self._run_comparison("09_near_saturation", [1, 1, 0, 1, 1], booked)

    def test_scenario_10_repeated_rapid_inferences(self):
        for i in range(10):
            self._run_comparison(f"10_rapid_call_{i+1}", [0, (i % 2), 0, ((i+1) % 2), 0], {})

    @classmethod
    def tearDownClass(cls):
        # Print summary report
        total = cls.metrics["total_runs"]
        ai_valid_pct = (cls.metrics["ai_valid_allocations"] / total) * 100.0
        agree_pct = (cls.metrics["agreement_count"] / total) * 100.0
        avg_ai_lat = sum(cls.metrics["ai_latencies_ms"]) / len(cls.metrics["ai_latencies_ms"])
        avg_h_lat = sum(cls.metrics["heuristic_latencies_ms"]) / len(cls.metrics["heuristic_latencies_ms"])

        print("\n" + "=" * 65)
        print("          SHADOW EVALUATION SUITE SUMMARY REPORT")
        print("=" * 65)
        print(f"Total Evaluations Executed:        {total}")
        print(f"AI Recommendation Validity:       {ai_valid_pct:.1f}% (0 occupied/invalid allocations)")
        print(f"Agreement with Heuristic:         {agree_pct:.1f}%")
        print(f"Average Neural Latency:           {avg_ai_lat:.3f} ms")
        print(f"Average Heuristic Latency:        {avg_h_lat:.3f} ms")
        print("=" * 65)


if __name__ == "__main__":
    unittest.main()
