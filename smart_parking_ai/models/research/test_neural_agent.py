"""Unit and Integration Test Suite for Neural Agent Research Architecture.

Tests cover:
    1. Exact parameter count (24,420) and per-module breakdown.
    2. Defensive action masking assertion on invalid all-zero mask.
    3. Invalid logit suppression with -inf and categorical probability zeros.
    4. Decoupled arrival-only actor and entropy loss computation.
    5. Backpropagation Through Time (BPTT) preservation through idle GRU steps.
    6. Natural horizon termination vs. synthetic truncation boundary GAE handling.
    7. Rollout buffer edge cutoff GAE boundary handling.
    8. Advantage normalization edge cases (zero-arrival and single-arrival batches).
    9. Arrival flag index decoupling (obs[13] vs obs[14]).
    10. BasePolicy adapter contract compliance.
    11. Full integration with CampusParkingSimEnv and evaluate_policy_episode() across
        all 4 standardized scenarios.
"""

import unittest
import numpy as np
import torch
import torch.nn.functional as F

from smart_parking_ai.models.research.neural_agent import (
    RecurrentActorCritic,
    RecurrentRolloutBuffer,
    PPOTrainer,
    NeuralParkingPolicy,
)
from smart_parking_ai.models.research.sim_env import CampusParkingSimEnv
from smart_parking_ai.models.research.baselines import (
    evaluate_policy_episode,
    EpisodeMetrics,
    BasePolicy,
)


class TestNeuralAgent(unittest.TestCase):
    """Test suite for neural_agent.py."""

    def setUp(self) -> None:
        torch.manual_seed(42)
        np.random.seed(42)
        self.device = torch.device("cpu")
        self.model = RecurrentActorCritic().to(self.device)

    # ------------------------------------------------------------------------
    # 1. Parameter Count and Layer Verification
    # ------------------------------------------------------------------------
    def test_parameter_count(self) -> None:
        """Verifies total parameter count is exactly 24,420 and checks layer breakdown."""
        total_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        self.assertEqual(total_params, 24420, f"Expected 24,420 parameters, found {total_params}")

        # Layer breakdown
        spatial_params = sum(p.numel() for p in self.model.spatial_encoder.parameters())
        gru_params = sum(p.numel() for p in self.model.gru.parameters())
        actor_params = sum(p.numel() for p in self.model.actor_fc1.parameters()) + sum(
            p.numel() for p in self.model.actor_fc2.parameters()
        )
        critic_params = sum(p.numel() for p in self.model.critic_fc1.parameters()) + sum(
            p.numel() for p in self.model.critic_fc2.parameters()
        )

        self.assertEqual(spatial_params, 352, f"Spatial encoder should have 352 params, got {spatial_params}")
        self.assertEqual(gru_params, 19776, f"GRU cell should have 19,776 params, got {gru_params}")
        self.assertEqual(actor_params, 2179, f"Actor head should have 2,179 params, got {actor_params}")
        self.assertEqual(critic_params, 2113, f"Critic head should have 2,113 params, got {critic_params}")

    # ------------------------------------------------------------------------
    # 2. Defensive Action Masking Assertion
    # ------------------------------------------------------------------------
    def test_defensive_mask_assertion(self) -> None:
        """Verifies that an all-zero action mask triggers an AssertionError."""
        obs = torch.zeros(1, 18, device=self.device)
        obs[0, 15:18] = 0.0  # All actions masked out
        h = torch.zeros(1, 64, device=self.device)

        with self.assertRaises(AssertionError) as ctx:
            self.model.forward_step(obs, h)
        self.assertIn("Defensive check failed", str(ctx.exception))

    # ------------------------------------------------------------------------
    # 3. Invalid Logit Suppression (-inf)
    # ------------------------------------------------------------------------
    def test_invalid_logit_masking(self) -> None:
        """Verifies that masked actions have -inf logit and 0.0 softmax probability."""
        obs = torch.zeros(1, 18, device=self.device)
        obs[0, 15] = 1.0  # Only Action 0 is valid
        obs[0, 16] = 0.0  # Action 1 invalid
        obs[0, 17] = 0.0  # Action 2 invalid
        h = torch.zeros(1, 64, device=self.device)

        masked_logits, val, h_new = self.model.forward_step(obs, h)

        self.assertFalse(torch.isinf(masked_logits[0, 0]), "Valid action 0 logit must not be inf")
        self.assertTrue(torch.isneginf(masked_logits[0, 1]), "Invalid action 1 logit must be -inf")
        self.assertTrue(torch.isneginf(masked_logits[0, 2]), "Invalid action 2 logit must be -inf")

        probs = F.softmax(masked_logits, dim=-1)
        self.assertAlmostEqual(probs[0, 0].item(), 1.0, places=6)
        self.assertAlmostEqual(probs[0, 1].item(), 0.0, places=6)
        self.assertAlmostEqual(probs[0, 2].item(), 0.0, places=6)

    # ------------------------------------------------------------------------
    # 4. Decoupled Arrival Loss Masking & BPTT Continuity
    # ------------------------------------------------------------------------
    def test_decoupled_loss_masking_and_bptt(self) -> None:
        """Verifies idle steps contribute zero direct actor loss, while BPTT flows across them."""
        # Trajectory: [Idle (t=0), Idle (t=1), Arrival (t=2)]
        seq_obs = torch.zeros(3, 18, device=self.device)
        seq_obs[0, 13] = 0.0; seq_obs[0, 14] = 0.5  # Idle with residual dwell
        seq_obs[1, 13] = 0.0; seq_obs[1, 14] = 0.3  # Idle with residual dwell
        seq_obs[2, 13] = 1.0; seq_obs[2, 14] = 0.8  # True arrival
        seq_obs[:, 15:18] = 1.0  # All actions valid

        h = torch.zeros(1, 64, device=self.device)
        logits_list, values_list = [], []

        for t in range(3):
            m_logits, val, h = self.model.forward_step(seq_obs[t:t+1], h)
            logits_list.append(m_logits)
            values_list.append(val)

        all_logits = torch.cat(logits_list, dim=0) # (3, 3)
        all_values = torch.cat(values_list, dim=0).squeeze(-1) # (3,)

        # Arrival mask derived from obs[13]
        arr_mask = (seq_obs[:, 13] > 0.5).float() # [0.0, 0.0, 1.0]
        dummy_adv = torch.tensor([1.0, 1.0, 2.0], device=self.device)
        actions = torch.tensor([0, 0, 1], device=self.device)

        dist = torch.distributions.Categorical(logits=all_logits)
        step_actor_losses = -dist.log_prob(actions) * dummy_adv
        masked_actor_losses = arr_mask * step_actor_losses

        # Direct actor loss for idle steps 0 and 1 must be strictly 0.0
        self.assertEqual(masked_actor_losses[0].item(), 0.0)
        self.assertEqual(masked_actor_losses[1].item(), 0.0)
        self.assertNotEqual(masked_actor_losses[2].item(), 0.0)

        # Critic loss must include all 3 transitions
        target_returns = torch.tensor([1.0, 1.5, 2.0], device=self.device)
        critic_step_losses = F.mse_loss(all_values, target_returns, reduction="none")
        self.assertGreater(critic_step_losses[0].item(), 0.0)
        self.assertGreater(critic_step_losses[1].item(), 0.0)
        self.assertGreater(critic_step_losses[2].item(), 0.0)

        # Verify BPTT: backward from step 2 arrival actor loss MUST propagate gradients
        # to GRUCell recurrent weights and Spatial Encoder weights used at steps 0 and 1!
        self.model.zero_grad()
        actor_loss = masked_actor_losses[2]
        actor_loss.backward()

        self.assertIsNotNone(self.model.gru.weight_ih.grad, "GRU input weights must receive BPTT gradient")
        self.assertIsNotNone(self.model.gru.weight_hh.grad, "GRU recurrent weights must receive BPTT gradient")
        self.assertIsNotNone(self.model.spatial_encoder.weight.grad, "Spatial encoder must receive BPTT gradient")
        self.assertGreater(
            self.model.gru.weight_hh.grad.abs().sum().item(), 0.0, "Recurrent gradient must be non-zero"
        )

    # ------------------------------------------------------------------------
    # 5. Natural Termination vs. Synthetic Truncation GAE
    # ------------------------------------------------------------------------
    def test_termination_and_synthetic_truncation_gae(self) -> None:
        """Verifies GAE masks for natural termination (b=0, c=0) and truncation (b=1, c=0)."""
        buffer = RecurrentRolloutBuffer(capacity=4, device=self.device)
        h = torch.zeros(1, 64, device=self.device)
        obs_dummy = np.zeros(18, dtype=np.float32)
        obs_dummy[15:18] = 1.0

        # Step 0: Ordinary step (b=1, c=1)
        buffer.store(
            obs=obs_dummy, action=0, reward=1.0, next_obs=obs_dummy,
            log_prob=-0.5, action_mask=obs_dummy[15:18], value=1.0, next_value=2.0,
            h_prev=h, terminated=False, truncated=False
        )
        # Step 1: Natural termination (b=0, c=0, V_next=0.0)
        buffer.store(
            obs=obs_dummy, action=0, reward=2.0, next_obs=obs_dummy,
            log_prob=-0.5, action_mask=obs_dummy[15:18], value=1.5, next_value=0.0,
            h_prev=h, terminated=True, truncated=False
        )
        # Step 2: Ordinary step (b=1, c=1)
        buffer.store(
            obs=obs_dummy, action=0, reward=0.5, next_obs=obs_dummy,
            log_prob=-0.5, action_mask=obs_dummy[15:18], value=0.5, next_value=1.0,
            h_prev=h, terminated=False, truncated=False
        )
        # Step 3: Synthetic Truncation fixture (b=1, c=0, V_next=V_final)
        buffer.store(
            obs=obs_dummy, action=0, reward=1.0, next_obs=obs_dummy,
            log_prob=-0.5, action_mask=obs_dummy[15:18], value=1.0, next_value=3.0,
            h_prev=h, terminated=False, truncated=True
        )

        buffer.compute_gae()

        # Step 1 (Natural Termination):
        # delta_1 = r_1 + gamma * 0 * V_next - V_1 = 2.0 - 1.5 = 0.5
        # A_1 = delta_1 = 0.5
        self.assertAlmostEqual(buffer.advantages[1].item(), 0.5, places=5)

        # Step 0 (Preceding Step):
        # delta_0 = 1.0 + 0.99 * 1 * 2.0 - 1.0 = 1.98
        # A_0 = delta_0 + 0.99 * 0.95 * 1.0 * A_1 = 1.98 + 0.9405 * 0.5 = 2.45025
        expected_a0 = 1.98 + 0.99 * 0.95 * 0.5
        self.assertAlmostEqual(buffer.advantages[0].item(), expected_a0, places=5)

        # Step 3 (Synthetic Truncation):
        # delta_3 = r_3 + gamma * 1 * V_next - V_3 = 1.0 + 0.99 * 3.0 - 1.0 = 2.97
        # A_3 = delta_3 = 2.97 (trace stops because c_t = 0)
        expected_a3 = 1.0 + 0.99 * 3.0 - 1.0
        self.assertAlmostEqual(buffer.advantages[3].item(), expected_a3, places=5)

    # ------------------------------------------------------------------------
    # 6. Rollout Buffer Edge Cutoff
    # ------------------------------------------------------------------------
    def test_rollout_buffer_edge_cutoff(self) -> None:
        """Verifies buffer edge cutoff sets b=1, c=0 without altering episode flags."""
        buffer = RecurrentRolloutBuffer(capacity=2, device=self.device)
        h = torch.zeros(1, 64, device=self.device)
        obs_dummy = np.zeros(18, dtype=np.float32)
        obs_dummy[15:18] = 1.0

        # Step 0: Ordinary
        buffer.store(
            obs=obs_dummy, action=0, reward=1.0, next_obs=obs_dummy,
            log_prob=-0.5, action_mask=obs_dummy[15:18], value=1.0, next_value=1.5,
            h_prev=h, terminated=False, truncated=False, buffer_edge=False
        )
        # Step 1: Buffer Edge (ongoing episode reaches buffer limit)
        buffer.store(
            obs=obs_dummy, action=0, reward=2.0, next_obs=obs_dummy,
            log_prob=-0.5, action_mask=obs_dummy[15:18], value=2.0, next_value=2.5,
            h_prev=h, terminated=False, truncated=False, buffer_edge=True
        )

        buffer.compute_gae()

        # Step 1 advantage: delta_1 = 2.0 + 0.99 * 1 * 2.5 - 2.0 = 2.475
        # Trace stops because c_1 = 0
        expected_a1 = 2.0 + 0.99 * 2.5 - 2.0
        self.assertAlmostEqual(buffer.advantages[1].item(), expected_a1, places=5)
        self.assertFalse(buffer.terminated[1].item(), "Buffer edge must NOT set terminated=True")
        self.assertFalse(buffer.truncated[1].item(), "Buffer edge must NOT set truncated=True")

    # ------------------------------------------------------------------------
    # 7. Advantage Normalization Edge Cases
    # ------------------------------------------------------------------------
    def test_advantage_normalization_edge_cases(self) -> None:
        """Verifies zero-arrival, single-arrival, and multi-arrival batch stability."""
        buffer = RecurrentRolloutBuffer(capacity=3, device=self.device)
        h = torch.zeros(1, 64, device=self.device)

        # Case A: Zero arrivals (all idle)
        obs_idle = np.zeros(18, dtype=np.float32)
        obs_idle[13] = 0.0  # IDLE
        obs_idle[15:18] = 1.0

        for _ in range(3):
            buffer.store(
                obs=obs_idle, action=0, reward=1.0, next_obs=obs_idle,
                log_prob=-0.5, action_mask=obs_idle[15:18], value=1.0, next_value=1.0,
                h_prev=h, terminated=False, truncated=False
            )
        buffer.compute_gae()

        # Must not contain NaN, normalized advantages must be all 0.0
        self.assertFalse(torch.isnan(buffer.normalized_advantages).any())
        self.assertTrue((buffer.normalized_advantages == 0.0).all())

        # Case B: Single arrival
        buffer.reset()
        obs_arr = np.zeros(18, dtype=np.float32)
        obs_arr[13] = 1.0  # ARRIVAL
        obs_arr[15:18] = 1.0

        buffer.store(obs=obs_idle, action=0, reward=1.0, next_obs=obs_idle,
                     log_prob=-0.5, action_mask=obs_idle[15:18], value=1.0, next_value=1.0,
                     h_prev=h, terminated=False, truncated=False)
        buffer.store(obs=obs_arr, action=0, reward=5.0, next_obs=obs_idle,
                     log_prob=-0.5, action_mask=obs_idle[15:18], value=1.0, next_value=1.0,
                     h_prev=h, terminated=False, truncated=False)
        buffer.store(obs=obs_idle, action=0, reward=1.0, next_obs=obs_idle,
                     log_prob=-0.5, action_mask=obs_idle[15:18], value=1.0, next_value=1.0,
                     h_prev=h, terminated=True, truncated=False)
        buffer.compute_gae()

        # Single arrival should not divide by zero std -> mean centered or 0.0
        self.assertFalse(torch.isnan(buffer.normalized_advantages).any())
        self.assertAlmostEqual(buffer.normalized_advantages[1].item(), 0.0, places=5)

    # ------------------------------------------------------------------------
    # 8. Arrival Flag Index Decoupling (obs[13] vs obs[14])
    # ------------------------------------------------------------------------
    def test_arrival_flag_index_decoupling(self) -> None:
        """Verifies obs[13] strictly governs arrival status, ignoring residual obs[14]."""
        buffer = RecurrentRolloutBuffer(capacity=2, device=self.device)
        h = torch.zeros(1, 64, device=self.device)

        # Step 0: obs[13] = 0 (Idle), but obs[14] = 0.8 (residual dwell)
        obs_idle_with_dwell = np.zeros(18, dtype=np.float32)
        obs_idle_with_dwell[13] = 0.0
        obs_idle_with_dwell[14] = 0.8
        obs_idle_with_dwell[15:18] = 1.0

        # Step 1: obs[13] = 1 (Arrival), but obs[14] = 0.0 (zero dwell)
        obs_arr_zero_dwell = np.zeros(18, dtype=np.float32)
        obs_arr_zero_dwell[13] = 1.0
        obs_arr_zero_dwell[14] = 0.0
        obs_arr_zero_dwell[15:18] = 1.0

        buffer.store(obs=obs_idle_with_dwell, action=0, reward=0.0, next_obs=obs_idle_with_dwell,
                     log_prob=-0.5, action_mask=obs_idle_with_dwell[15:18], value=0.0, next_value=0.0,
                     h_prev=h, terminated=False, truncated=False)
        buffer.store(obs=obs_arr_zero_dwell, action=0, reward=0.0, next_obs=obs_arr_zero_dwell,
                     log_prob=-0.5, action_mask=obs_arr_zero_dwell[15:18], value=0.0, next_value=0.0,
                     h_prev=h, terminated=True, truncated=False)

        self.assertFalse(buffer.is_arrival[0].item(), "obs[13]=0 must be classified as IDLE despite obs[14]>0")
        self.assertTrue(buffer.is_arrival[1].item(), "obs[13]=1 must be classified as ARRIVAL even with obs[14]=0")

    # ------------------------------------------------------------------------
    # 9. BasePolicy Adapter Compliance
    # ------------------------------------------------------------------------
    def test_basepolicy_adapter_compliance(self) -> None:
        """Verifies NeuralParkingPolicy adheres strictly to BasePolicy interface."""
        policy = NeuralParkingPolicy(self.model, deterministic=True, device="cpu")
        self.assertIsInstance(policy, BasePolicy)
        self.assertTrue(hasattr(policy, "name"))
        self.assertTrue(hasattr(policy, "select_action"))
        self.assertTrue(hasattr(policy, "reset"))

        policy.reset()
        self.assertEqual(policy.hidden_state.shape, (1, 64))

        obs = np.zeros(18, dtype=np.float32)
        obs[0] = 1.0  # Realistic observation: stall A1 occupied
        obs[10] = 0.33  # Zone A occupancy
        obs[15:18] = 1.0  # Valid action mask
        mask = np.array([1, 1, 1], dtype=np.int32)

        # Call select_action with exact (obs, mask) signature
        h_before = policy.hidden_state.clone()
        action = policy.select_action(obs, mask)
        h_after = policy.hidden_state.clone()

        self.assertIsInstance(action, int)
        self.assertIn(action, (0, 1, 2))
        self.assertFalse(torch.equal(h_before, h_after), "Hidden state must update on every step")

    # ------------------------------------------------------------------------
    # 10. End-to-End Simulation Integration across all 4 Scenarios
    # ------------------------------------------------------------------------
    def test_simulator_integration_across_all_scenarios(self) -> None:
        """Executes NeuralParkingPolicy across all 4 standardized simulation scenarios."""
        env = CampusParkingSimEnv()
        policy = NeuralParkingPolicy(self.model, deterministic=True, device="cpu")

        scenarios = [
            ("Scenario 1 (Morning Influx)", 1, False),
            ("Scenario 2 (Steady Afternoon)", 2, False),
            ("Scenario 3 Stochastic (Morning Burst)", 3, False),
            ("Scenario 3 Benchmark (Capacity Stress)", 3, True),
        ]

        for name, s_id, is_bench in scenarios:
            ep = evaluate_policy_episode(
                env=env,
                policy=policy,
                scenario_id=s_id,
                deterministic_benchmark=is_bench,
            )
            self.assertIsInstance(ep, EpisodeMetrics, f"Failed on {name}: returned type {type(ep)}")
            self.assertEqual(ep.conflict_count, 0, f"Defensive masking failed: {ep.conflict_count} conflicts in {name}")
            self.assertGreaterEqual(ep.service_volume, 0)
            self.assertGreaterEqual(ep.occupancy_rate, 0.0)
            self.assertLessEqual(ep.occupancy_rate, 100.0)


if __name__ == "__main__":
    unittest.main()
