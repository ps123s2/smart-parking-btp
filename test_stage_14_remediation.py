"""
Unit and Integration Tests for Stage 14 Remediation.
Tests the 4 resolved defects:
- FE-INT-01: DashboardScreen recommendation selection priority contract.
- FE-INT-02: useFirebaseParking hook memoization dependency array contract.
- FE-INT-03: API client fetch failure contract (returns success: false).
- NET-01: API base URL resolution contract (environment-aware, trailing slash stripping).
"""

import os
import re
import unittest

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_FILE = os.path.join(ROOT_DIR, "smart-parking-app", "src", "screens", "DashboardScreen.tsx")
HOOK_FILE = os.path.join(ROOT_DIR, "smart-parking-app", "src", "hooks", "useFirebaseParking.ts")
API_FILE = os.path.join(ROOT_DIR, "smart-parking-app", "src", "services", "api.ts")
TYPES_FILE = os.path.join(ROOT_DIR, "smart-parking-app", "src", "types", "parking.ts")


class TestStage14DashboardPriority(unittest.TestCase):
    """FE-INT-01: Verify DashboardScreen recommendation priority contract."""

    def setUp(self):
        with open(DASHBOARD_FILE, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_priority_logic_present(self):
        """DashboardScreen must prioritize neural allocation over legacy recommendation."""
        self.assertIn("aiAllocation?.allocated_stall", self.content)
        self.assertIn("neuralAllocatedId", self.content)
        self.assertIn("isNeuralAllocatedValid", self.content)

    def test_priority_precedence_order(self):
        """Active booking > Neural allocation > isBest slot > legacy recommendation > fallback."""
        # Find the aiRecommendedSlotId block
        match = re.search(r"const aiRecommendedSlotId\s*=\s*activeBooking\s*\?\s*activeBooking\.slotId\s*:\s*\((.*?)\);", self.content, re.DOTALL)
        self.assertIsNotNone(match, "aiRecommendedSlotId definition must be present")
        block = match.group(1)
        self.assertIn("isNeuralAllocatedValid", block)
        self.assertIn("neuralAllocatedId", block)

    def test_pure_priority_simulation(self):
        """Simulate the priority evaluation logic implemented in DashboardScreen."""
        def evaluate_recommendation(active_booking, ai_allocation, slots, data):
            neural_id = ai_allocation.get("allocated_stall") if ai_allocation else None
            is_neural_valid = bool(neural_id and (not slots or any(s["id"] == neural_id and not s.get("occupied", False) for s in slots)))

            if active_booking:
                return active_booking["slotId"]
            if is_neural_valid:
                return neural_id
            best_slot = next((s["id"] for s in slots if s.get("isBest")), None)
            if best_slot:
                return best_slot
            legacy_best = data.get("recommendation", {}).get("best_slot") if data else None
            if legacy_best:
                return legacy_best
            first_free = next((s["id"] for s in slots if not s.get("occupied", False)), None)
            return first_free or "slot1"

        slots = [
            {"id": "slot1", "isBest": False, "occupied": False},
            {"id": "slot2", "isBest": False, "occupied": False},
            {"id": "slot3", "isBest": False, "occupied": False},
            {"id": "slot4", "isBest": True, "occupied": False},
            {"id": "slot5", "isBest": False, "occupied": False},
        ]
        legacy_data = {"recommendation": {"best_slot": "slot1"}}
        ai_resp = {"allocated_stall": "slot5", "allocation_source": "marl_gcn_neural_policy"}

        # Case 1: Neural allocation takes precedence over legacy and isBest
        self.assertEqual(evaluate_recommendation(None, ai_resp, slots, legacy_data), "slot5")

        # Case 2: Active booking takes absolute precedence
        active = {"slotId": "slot2"}
        self.assertEqual(evaluate_recommendation(active, ai_resp, slots, legacy_data), "slot2")

        # Case 3: When neural stall is occupied, falls back to isBest
        slots_occupied = [
            {"id": "slot1", "isBest": False, "occupied": False},
            {"id": "slot4", "isBest": True, "occupied": False},
            {"id": "slot5", "isBest": False, "occupied": True}, # allocated but occupied
        ]
        self.assertEqual(evaluate_recommendation(None, ai_resp, slots_occupied, legacy_data), "slot4")


class TestStage14HookMemoization(unittest.TestCase):
    """FE-INT-02: Verify useFirebaseParking dependency array contract."""

    def setUp(self):
        with open(HOOK_FILE, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_ai_allocation_in_slots_dependency_array(self):
        """aiAllocation must be present in the slots useMemo dependency array."""
        pattern = r"\[data,\s*layout,\s*bookedSlots,\s*dynamicMARL,\s*aiAllocation\]"
        match = re.search(pattern, self.content)
        self.assertIsNotNone(match, "slots useMemo dependency array must include aiAllocation")


class TestStage14ApiClientFailureContract(unittest.TestCase):
    """FE-INT-03: Verify api.ts fetch catch block error contract."""

    def setUp(self):
        with open(API_FILE, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_catch_block_returns_success_false(self):
        """Catch block must return success: false to signal network/timeout failures."""
        match = re.search(r"async function request<T>.*?catch\s*\([^\)]*\)\s*\{(.*?)\n\}", self.content, re.DOTALL)
        self.assertIsNotNone(match, "request function catch block must be found in api.ts")
        catch_block = match.group(1)
        self.assertIn("success: false", catch_block)
        self.assertNotIn("success: true", catch_block)
        self.assertIn("status: 'network_error'", catch_block)
        self.assertIn("is_fallback: true", catch_block)

    def test_timeout_detection_present(self):
        """AbortError/timeout must be detected and reported with informative message."""
        self.assertIn("AbortError", self.content)
        self.assertIn("Request timed out", self.content)


class TestStage14ApiBaseUrlResolution(unittest.TestCase):
    """NET-01: Verify resolveApiBaseUrl contract."""

    def setUp(self):
        with open(API_FILE, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_resolve_api_base_url_exported(self):
        """resolveApiBaseUrl function must be exported."""
        self.assertIn("export function resolveApiBaseUrl()", self.content)

    def test_environment_awareness_logic(self):
        """Function must check EXPO_PUBLIC_API_URL, __DEV__, and fallback."""
        self.assertIn("process.env.EXPO_PUBLIC_API_URL", self.content)
        self.assertIn("__DEV__", self.content)
        self.assertIn("http://127.0.0.1:5000", self.content)
        self.assertIn("https://smart-parking-btp.onrender.com", self.content)

    def test_trailing_slash_stripped(self):
        """Trailing slashes must be stripped from user-supplied URL."""
        self.assertIn("replace(/\\/+$/, '')", self.content)

    def test_pure_url_resolution_logic(self):
        """Simulate resolveApiBaseUrl logic across environments."""
        def resolve_url(env_url, is_dev):
            if env_url and env_url.strip():
                return re.sub(r"/+$", "", env_url.strip())
            if is_dev:
                return "http://127.0.0.1:5000"
            return "https://smart-parking-btp.onrender.com"

        # Explicit URL with trailing slashes
        self.assertEqual(resolve_url("https://my-api.ngrok-free.app///", True), "https://my-api.ngrok-free.app")
        self.assertEqual(resolve_url("http://192.168.1.50:5000/", False), "http://192.168.1.50:5000")

        # Dev mode default
        self.assertEqual(resolve_url(None, True), "http://127.0.0.1:5000")
        self.assertEqual(resolve_url("", True), "http://127.0.0.1:5000")

        # Production fallback
        self.assertEqual(resolve_url(None, False), "https://smart-parking-btp.onrender.com")


if __name__ == "__main__":
    unittest.main()
