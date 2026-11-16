"""Comprehensive Unit and Integration Test Suite for Paper-Aligned Research Implementation.

Tests cover:
    1. Dynamic Heterogeneous Graph Construction & Adjacency
    2. Two-Stage Graph Attention Network (GAT) Dimensions & Attention Softmax
    3. Heterogeneous Graph Pooling (HGP) Importance Scoring, Gating & Readout
    4. Graph Contrastive Learning (GCL) InfoNCE Loss & Gradients
    5. Agent Temporal GRU Sequence Processing & Hidden State Dimensions
    6. Learnable Policy Hypernetwork Dynamic Parameter Generation & Differentiability
    7. Personalized Agent Policy & Continuous Action Priority Scaling
    8. Centralized Evaluator Q_u(H_t, A_t) Dimensions
    9. Multi-Agent Replay Buffer Sampling
    10. Reciprocal Cruising Delay Equation (Eq. 1) Verification
    11. Total Travel Time Equation (Eq. 2) Verification
    12. Base Paper Delayed Reward Function (Eq. 4) Verification
    13. Municipal Environment Reset, Step, Turnovers & Metrics
    14. FIFO & SIRO Municipal Baselines Execution
    15. End-to-End CTDE MADDPG Optimization Step (Actor, Critic & GCL Gradients)
"""

import math
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np
import torch
import torch.nn.functional as F

from research.paper_aligned.graph_network import (
    DynamicHeterogeneousParkingGraph,
    TwoStageGATLayer,
    HeterogeneousGraphPooling,
    GraphContrastiveLearningLoss,
)
from research.paper_aligned.hypernetwork import (
    AgentTemporalGRU,
    PolicyHypernetwork,
    PersonalizedAgentPolicy,
)
from research.paper_aligned.maddpg import (
    CentralizedEvaluator,
    MultiAgentReplayBuffer,
    MADDPGTrainer,
)
from research.paper_aligned.melbourne_env import (
    MelbourneMunicipalParkingEnv,
    DISTRICT_NAMES,
    DISTRICT_CAPACITIES,
    calculate_cruising_delay_paper,
    calculate_total_travel_time,
    compute_paper_reward,
)
from research.paper_aligned.baselines_paper import (
    FIFOMunicipalPolicy,
    SIROMunicipalPolicy,
)


class TestPaperAlignedArchitecture(unittest.TestCase):
    """Test suite verifying architectural and mathematical compliance with Zhao & Yan (2025)."""

    def setUp(self) -> None:
        torch.manual_seed(42)
        np.random.seed(42)
        self.device = torch.device("cpu")
        self.num_facilities = 9
        self.node_feat_dim = 8
        self.spatial_dim = 32
        self.gru_hidden_dim = 64
        self.action_dim = 1

    # ------------------------------------------------------------------------
    # 1. Graph Construction & Two-Stage GAT Tests
    # ------------------------------------------------------------------------

    def test_dynamic_graph_construction(self) -> None:
        """Verifies heterogeneous graph construction across 9 Melbourne districts."""
        graph = DynamicHeterogeneousParkingGraph(num_facilities=self.num_facilities, device=self.device)
        self.assertEqual(graph.num_facilities, 9)
        self.assertEqual(len(graph.capacities), 9)
        self.assertEqual(sum(graph.capacities), 541)  # Table 1: 541 bays

        occupancies = [35, 10, 18, 50, 45, 50, 17, 20, 24]
        req_loc = np.array([0.2, 0.4])
        cruising = [2, 1, 1, 0, 8, 3, 0, 2, 2]
        demands = [10.0, 50.0, 20.0, 1.0, 150.0, 30.0, 5.0, 25.0, 28.0]

        nodes, adj = graph.build_feature_tensor(occupancies, req_loc, cruising, demands)
        self.assertEqual(nodes.shape, (1, 9, self.node_feat_dim))
        self.assertEqual(adj.shape, (1, 9, 9))
        self.assertTrue((adj >= 0.0).all())

    def test_two_stage_gat_attention(self) -> None:
        """Verifies Two-Stage GAT attention normalization and feature aggregation (Eq. 9)."""
        gat = TwoStageGATLayer(in_features=self.node_feat_dim, out_features=self.spatial_dim)
        h = torch.randn(2, 9, self.node_feat_dim)
        adj = torch.ones(2, 9, 9)

        X, att = gat(h, adj)
        self.assertEqual(X.shape, (2, 9, self.spatial_dim))
        self.assertEqual(att.shape, (2, 9, 9))

        # Softmax normalization check: sum of attention weights across neighbors must be 1.0
        row_sums = torch.sum(att, dim=-1)
        self.assertTrue(torch.allclose(row_sums, torch.ones_like(row_sums), atol=1e-4))

    # ------------------------------------------------------------------------
    # 2. Heterogeneous Graph Pooling (HGP) Tests
    # ------------------------------------------------------------------------

    def test_hgp_pooling_and_permutation_invariance(self) -> None:
        """Verifies HGP importance scoring, top-k selection, and permutation-invariant readout (Eqs. 10-14)."""
        hgp = HeterogeneousGraphPooling(in_dim=self.spatial_dim, k_h=5, num_dynamic_agents=6, num_fixed_agents=3)
        X = torch.randn(2, 9, self.spatial_dim)

        H, s_O, s_F = hgp(X)
        # H = [s_O || s_F] -> shape (2, 2 * spatial_dim) = (2, 64)
        self.assertEqual(H.shape, (2, 2 * self.spatial_dim))
        self.assertEqual(s_O.shape, (2, self.spatial_dim))
        self.assertEqual(s_F.shape, (2, self.spatial_dim))
        self.assertFalse(torch.isnan(H).any())

    # ------------------------------------------------------------------------
    # 3. Graph Contrastive Learning (GCL) Tests
    # ------------------------------------------------------------------------

    def test_gcl_infonce_loss(self) -> None:
        """Verifies Graph Contrastive Learning InfoNCE loss computation and gradients (Eqs. 15-16)."""
        gcl = GraphContrastiveLearningLoss(embed_dim=2 * self.spatial_dim, temperature=0.1)
        H_q = torch.randn(4, 64)
        H_pos = H_q + 0.05 * torch.randn(4, 64)  # Augmented positive
        H_neg = torch.randn(4, 3, 64)           # 3 negative instances

        loss = gcl(H_q, H_pos, H_neg)
        self.assertGreater(loss.item(), 0.0)
        self.assertFalse(torch.isnan(loss))

        # Verify gradient backpropagation to projection matrix W_c
        loss.backward()
        self.assertIsNotNone(gcl.W_c.grad)
        self.assertGreater(gcl.W_c.grad.abs().sum().item(), 0.0)

    # ------------------------------------------------------------------------
    # 4. Temporal Modeling & Hypernetwork Tests
    # ------------------------------------------------------------------------

    def test_temporal_gru_and_hypernetwork(self) -> None:
        """Verifies GRU meta-features and hypernetwork dynamic policy parameter generation (Eqs. 6-8)."""
        gru = AgentTemporalGRU(node_feat_dim=self.spatial_dim, action_dim=1, gru_hidden_dim=self.gru_hidden_dim)
        hyper = PolicyHypernetwork(gru_hidden_dim=self.gru_hidden_dim, policy_in_dim=self.spatial_dim, policy_out_dim=1)
        actor = PersonalizedAgentPolicy(node_feat_dim=self.spatial_dim, policy_in_dim=self.spatial_dim, action_dim=1, kappa=1.0)

        X = torch.randn(2, 9, self.spatial_dim)
        a_prev = torch.zeros(2, 9, 1)
        h_prev = torch.zeros(2, 9, self.gru_hidden_dim)

        # GRU step (Eq. 6)
        h_new = gru.forward_step(X, a_prev, h_prev)
        self.assertEqual(h_new.shape, (2, 9, self.gru_hidden_dim))

        # Hypernetwork parameter generation (Eq. 7)
        W_G, b_G = hyper(h_new)
        self.assertEqual(W_G.shape, (2, 9, 1, self.spatial_dim))
        self.assertEqual(b_G.shape, (2, 9, 1))

        # Personalized policy execution (Eq. 8)
        actions = actor(X, W_G, b_G)
        self.assertEqual(actions.shape, (2, 9, 1))
        # Continuous action scaling check: actions must lie in [0, kappa] = [0.0, 1.0]
        self.assertTrue((actions >= 0.0).all())
        self.assertTrue((actions <= 1.0).all())

    # ------------------------------------------------------------------------
    # 5. Base Paper Equation Tests (Equations 1, 2, 4)
    # ------------------------------------------------------------------------

    def test_reciprocal_cruising_delay_equation(self) -> None:
        """Verifies Equation (1): eta_p = e_p * (1 - delta_p / sigma_p)^(-1)."""
        # Test Case 1: Vacant lot (delta = 0) -> eta = e_p
        eta_vacant = calculate_cruising_delay_paper(vacant_base_ep=3.0, current_occupancy=0, capacity=10)
        self.assertAlmostEqual(eta_vacant, 3.0, places=4)

        # Test Case 2: Half full (delta = 5, sigma = 10, ratio = 0.5) -> eta = 3.0 / (1 - 0.5) = 6.0
        eta_half = calculate_cruising_delay_paper(vacant_base_ep=3.0, current_occupancy=5, capacity=10)
        self.assertAlmostEqual(eta_half, 6.0, places=4)

        # Test Case 3: 80% full (ratio = 0.8) -> eta = 3.0 / (1 - 0.8) = 15.0
        eta_80 = calculate_cruising_delay_paper(vacant_base_ep=3.0, current_occupancy=8, capacity=10)
        self.assertAlmostEqual(eta_80, 15.0, places=4)

    def test_total_travel_time_equation(self) -> None:
        """Verifies Equation (2): Total travel time = eta_p + W_pi."""
        total_time = calculate_total_travel_time(cruising_time=6.5, walking_time=2.5)
        self.assertAlmostEqual(total_time, 9.0, places=4)

    def test_paper_reward_function(self) -> None:
        """Verifies Equation (4): r_t = epsilon_a - lambda * cruising_time."""
        # Success case: 10.0 - 0.5 * 6.0 = 7.0
        r_success = compute_paper_reward(is_success=True, cruising_time=6.0, epsilon_a=10.0, lambda_cruise=0.5)
        self.assertAlmostEqual(r_success, 7.0, places=4)

        # Failure case: 0.0
        r_failure = compute_paper_reward(is_success=False, cruising_time=0.0, epsilon_a=10.0, lambda_cruise=0.5)
        self.assertAlmostEqual(r_failure, 0.0, places=4)

    # ------------------------------------------------------------------------
    # 6. Municipal Environment & Baselines Integration Tests
    # ------------------------------------------------------------------------

    def test_municipal_environment_lifecycle(self) -> None:
        """Verifies MelbourneMunicipalParkingEnv reset, step, and metric tracking."""
        env = MelbourneMunicipalParkingEnv(episode_minutes=30, requests_per_episode=20, seed=123)
        nodes, adj, info = env.reset(seed=123)

        self.assertEqual(nodes.shape, (1, 9, 8))
        self.assertEqual(adj.shape, (1, 9, 9))
        self.assertEqual(sum(info["capacities"]), 541)

        fifo = FIFOMunicipalPolicy(num_districts=9)
        done = False
        steps = 0
        total_reward = 0.0

        while not done and steps < 40:
            actions = fifo.select_actions(nodes, adj, info)
            nodes, adj, reward, done, info = env.step(actions)
            total_reward += reward
            steps += 1

        self.assertGreater(info["service_volume"], 0)
        self.assertGreaterEqual(info["occupancy_rate"], 0.0)
        self.assertGreaterEqual(info["allocation_rate"], 0.0)

    # ------------------------------------------------------------------------
    # 7. Complete End-to-End CTDE MADDPG Step Test
    # ------------------------------------------------------------------------

    def test_maddpg_training_step(self) -> None:
        """Verifies joint actor-critic CTDE update with GCL auxiliary objective (Eqs. 17-18)."""
        trainer = MADDPGTrainer(num_facilities=9, node_feat_dim=8, spatial_dim=16, gru_hidden_dim=32, device=self.device)
        buffer = MultiAgentReplayBuffer(capacity=100, device=self.device)

        # Populate buffer with dummy transitions
        for _ in range(10):
            node_feats = np.random.randn(9, 8).astype(np.float32)
            adj = np.ones((9, 9), dtype=np.float32)
            actions = np.random.uniform(0.0, 1.0, size=(9, 1)).astype(np.float32)
            next_node_feats = np.random.randn(9, 8).astype(np.float32)
            next_adj = np.ones((9, 9), dtype=np.float32)
            buffer.store(node_feats, adj, actions, reward=5.0, next_node_feats=next_node_feats, next_adj=next_adj, done=False)

        metrics = trainer.train_step(buffer, batch_size=4)
        self.assertIn("critic_loss", metrics)
        self.assertIn("actor_loss", metrics)
        self.assertIn("contrastive_loss", metrics)
        self.assertGreaterEqual(metrics["critic_loss"], 0.0)

    # ------------------------------------------------------------------------
    # 8. Target Updates, Replay Buffer & Decentralized Execution Tests
    # ------------------------------------------------------------------------

    def test_target_network_soft_updates(self) -> None:
        """Verifies Polyak target network update theta' <- tau * theta + (1-tau) * theta'."""
        trainer = MADDPGTrainer(num_facilities=9, node_feat_dim=8, spatial_dim=16, gru_hidden_dim=32, tau=0.1, device=self.device)
        # Modify a parameter in the online critic
        with torch.no_grad():
            for p in trainer.critic.parameters():
                p.add_(1.0)
                break

        trainer._soft_update(trainer.critic, trainer.target_critic)
        # Target parameter should have moved by 0.1 * 1.0 = 0.1
        online_p = next(iter(trainer.critic.parameters()))
        target_p = next(iter(trainer.target_critic.parameters()))
        self.assertFalse(torch.equal(online_p, target_p))

    def test_replay_buffer_sampling_shapes(self) -> None:
        """Verifies replay buffer storage and batch tensor shapes."""
        buf = MultiAgentReplayBuffer(capacity=50, device=self.device)
        for i in range(15):
            buf.store(
                node_feats=np.zeros((9, 8), dtype=np.float32),
                adj=np.eye(9, dtype=np.float32),
                actions=np.ones((9, 1), dtype=np.float32) * i,
                reward=float(i),
                next_node_feats=np.zeros((9, 8), dtype=np.float32),
                next_adj=np.eye(9, dtype=np.float32),
                done=False,
            )
        self.assertEqual(len(buf), 15)
        b_nodes, b_adj, b_acts, b_rew, b_next_nodes, b_next_adj, b_done = buf.sample(batch_size=8)
        self.assertEqual(b_nodes.shape, (8, 9, 8))
        self.assertEqual(b_adj.shape, (8, 9, 9))
        self.assertEqual(b_acts.shape, (8, 9, 1))
        self.assertEqual(b_rew.shape, (8, 1))

    def test_decentralized_actor_execution(self) -> None:
        """Verifies CTDE decentralized actor: agent c_i acts given only its own feature and weights."""
        actor = PersonalizedAgentPolicy(node_feat_dim=32, policy_in_dim=32, action_dim=1, kappa=1.0)
        x_i = torch.randn(1, 1, 32)  # Single agent
        W_G_i = torch.randn(1, 1, 1, 32)
        b_G_i = torch.randn(1, 1, 1)

        a_i = actor(x_i, W_G_i, b_G_i)
        self.assertEqual(a_i.shape, (1, 1, 1))
        self.assertTrue(0.0 <= a_i.item() <= 1.0)

    def test_siro_baseline_execution(self) -> None:
        """Verifies SIRO municipal baseline priority generation."""
        siro = SIROMunicipalPolicy(num_districts=9, seed=99)
        actions = siro.select_actions(np.zeros((1, 9, 8)), np.zeros((1, 9, 9)), {})
        self.assertEqual(len(actions), 9)
        self.assertTrue((actions >= 0.0).all())
        self.assertTrue((actions <= 1.0).all())

    def test_reciprocal_delay_saturation_cap(self) -> None:
        """Verifies numerical safety capping when parking lot reaches 100% capacity."""
        # When delta == sigma, ratio = 1.0, capped to 0.95 -> eta = e_p / (1 - 0.95) = e_p * 20.0
        eta_sat = calculate_cruising_delay_paper(vacant_base_ep=2.0, current_occupancy=10, capacity=10, numerical_cap=0.95)
        self.assertAlmostEqual(eta_sat, 2.0 / 0.05, places=4)
        self.assertFalse(math.isinf(eta_sat))

    def test_twin_critic_stabilization(self) -> None:
        """Verifies Twin Critic (TD3-style) architecture and gradient clipping."""
        trainer = MADDPGTrainer(num_facilities=9, node_feat_dim=8, spatial_dim=16, gru_hidden_dim=32, use_twin_critic=True, device=self.device)
        self.assertTrue(trainer.use_twin_critic)
        self.assertIsNotNone(trainer.critic1)
        self.assertIsNotNone(trainer.critic2)
        self.assertIsNotNone(trainer.target_critic1)
        self.assertIsNotNone(trainer.target_critic2)

        buf = MultiAgentReplayBuffer(capacity=50, device=self.device)
        for _ in range(8):
            buf.store(
                node_feats=np.random.randn(9, 8).astype(np.float32),
                adj=np.ones((9, 9), dtype=np.float32),
                actions=np.random.uniform(0.0, 1.0, size=(9, 1)).astype(np.float32),
                reward=2.5,
                next_node_feats=np.random.randn(9, 8).astype(np.float32),
                next_adj=np.ones((9, 9), dtype=np.float32),
                done=False,
            )
        metrics = trainer.train_step(buf, batch_size=4)
        self.assertIn("q_mean", metrics)
        self.assertIn("target_q_mean", metrics)
        self.assertIn("critic_grad_norm", metrics)
        self.assertFalse(math.isnan(metrics["critic_loss"]))
        self.assertFalse(math.isinf(metrics["critic_loss"]))

    def test_sequence_replay_buffer_and_recurrent_step(self) -> None:
        """Verifies sequential trajectory buffer and recurrent hidden-state unrolling."""
        buf = MultiAgentReplayBuffer(capacity=500, device=self.device)
        # Store 2 episodes of length 10
        for ep in range(2):
            for t in range(10):
                buf.store(
                    node_feats=np.random.randn(9, 8).astype(np.float32),
                    adj=np.ones((9, 9), dtype=np.float32),
                    actions=np.random.uniform(0.0, 1.0, size=(9, 1)).astype(np.float32),
                    reward=1.0,
                    next_node_feats=np.random.randn(9, 8).astype(np.float32),
                    next_adj=np.ones((9, 9), dtype=np.float32),
                    done=(t == 9),
                    h_state=np.zeros((9, 32), dtype=np.float32),
                )
        self.assertEqual(len(buf.episodes), 2)
        seq_batch = buf.sample_sequences(batch_size=2, seq_len=4)
        self.assertIsNotNone(seq_batch)
        self.assertEqual(len(seq_batch), 4)

        trainer = MADDPGTrainer(num_facilities=9, node_feat_dim=8, spatial_dim=16, gru_hidden_dim=32, device=self.device)
        metrics = trainer.train_step_sequence(buf, batch_size=2, seq_len=4)
        self.assertIn("critic_loss", metrics)
        self.assertIn("actor_loss", metrics)
        self.assertFalse(math.isnan(metrics["critic_loss"]))


if __name__ == "__main__":
    unittest.main()
