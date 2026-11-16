"""Unit tests for CampusGraph and CampusObservationAdapter."""

import unittest
import torch
import numpy as np

from smart_parking_ai.campus_adapter import (
    CampusGraph,
    CampusObservationAdapter,
    decode_actions,
    CAMPUS_SLOT_IDS,
    CAMPUS_SLOT_LABELS,
)


class TestCampusAdapter(unittest.TestCase):

    def setUp(self):
        self.graph = CampusGraph()
        self.adapter = CampusObservationAdapter(self.graph)

    def test_graph_construction(self):
        self.assertEqual(self.graph.num_nodes, 5)
        adj = self.graph.adjacency_matrix
        self.assertEqual(adj.shape, (5, 5))
        # Verify self-loops
        for i in range(5):
            self.assertEqual(adj[i, i], 1.0)
        # Verify symmetry
        np.testing.assert_array_equal(adj, adj.T)
        # Verify slot1 (A1) connects to slot2 (A2)
        idx_s1 = self.graph.slot_to_idx["slot1"]
        idx_s2 = self.graph.slot_to_idx["slot2"]
        self.assertEqual(adj[idx_s1, idx_s2], 1.0)

    def test_observation_dimensions(self):
        states = [0, 1, 0, 0, 1]  # slots 2 and 5 occupied
        booked = {"slot1": {"status": "active"}}  # slot 1 booked
        nodes, adj, mask = self.adapter.build_node_features(states, booked)

        self.assertEqual(nodes.shape, (1, 5, 8))
        self.assertEqual(adj.shape, (1, 5, 5))
        self.assertEqual(len(mask), 5)

        # slot1 is booked -> unavailable (False)
        self.assertFalse(mask[0])
        # slot2 is occupied -> unavailable (False)
        self.assertFalse(mask[1])
        # slot3 is vacant & unbooked -> available (True)
        self.assertTrue(mask[2])
        # slot4 is vacant & unbooked -> available (True)
        self.assertTrue(mask[3])
        # slot5 is occupied -> unavailable (False)
        self.assertFalse(mask[4])

    def test_action_decoding_and_masking(self):
        # Neural scores: slot2 has highest raw score (0.9), but is occupied!
        raw_actions = torch.tensor([[[0.4], [0.9], [0.7], [0.8], [0.2]]])
        mask = [True, False, True, True, False]  # slot2 and slot5 occupied

        result = decode_actions(raw_actions, mask, CAMPUS_SLOT_IDS)

        self.assertEqual(result["status"], "success")
        # slot4 has highest priority (0.8) among available slots [slot1(0.4), slot3(0.7), slot4(0.8)]
        self.assertEqual(result["allocated_stall"], "slot4")
        self.assertEqual(result["allocated_label"], "B1")
        self.assertEqual(result["top3_slots"], ["slot4", "slot3", "slot1"])

    def test_all_occupied_handling(self):
        raw_actions = torch.tensor([[[0.5], [0.6], [0.7], [0.8], [0.9]]])
        mask = [False, False, False, False, False]  # All stalls occupied!

        result = decode_actions(raw_actions, mask, CAMPUS_SLOT_IDS)

        self.assertEqual(result["status"], "no_available_stalls")
        self.assertIsNone(result["allocated_stall"])
        self.assertIsNone(result["allocated_label"])
        self.assertEqual(result["top3_slots"], [])

    def test_missing_and_corrupt_firebase_data(self):
        # Empty states
        nodes, adj, mask = self.adapter.build_node_features(None, None)
        self.assertEqual(nodes.shape, (1, 5, 8))
        self.assertTrue(all(mask))  # All default to available

        # Malformed states (e.g. only 2 items)
        nodes2, adj2, mask2 = self.adapter.build_node_features([1, 0], None)
        self.assertEqual(nodes2.shape, (1, 5, 8))
        self.assertFalse(mask2[0])
        self.assertTrue(mask2[1])


if __name__ == "__main__":
    unittest.main()

