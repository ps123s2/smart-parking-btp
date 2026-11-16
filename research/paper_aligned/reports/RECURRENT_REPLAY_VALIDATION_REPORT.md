# RECURRENT REPLAY VALIDATION REPORT — SMART PARKING BTP

**Reference Component:** Recurrent Meta-Policy with Gated Recurrent Unit (GRU)  
**Reference Paper:** Xiaohang Zhao and Yangzhi Yan, *"A Deep Reinforcement Learning and Graph Convolution Approach to On-Street Parking Search Navigation"*, **Sensors** 2025, 25(8), 2389.  
**Auditor / RL Engineer:** Senior Research Scientist & Recurrent RL Specialist  
**Date:** 2026-11-16  

---

## 1. Problem Formulation: Recurrent Replay in Off-Policy MADDPG

In Section 4.4 of Zhao & Yan (2025), the temporal representation is defined as:
$$H_t^i = \text{GRU}\left(H_{t-1}^i, [x_t^i \,\|\, a_{t-1}^i]\right) \quad (\text{Eq. 6})$$
During live environment rollouts (`select_actions`), the recurrent hidden state $H_t^i \in \mathbb{R}^{64}$ is continuously updated across all 120 minutes of each simulation episode.

However, during off-policy training, standard MADDPG samples transitions $(s_t, a_t, r_t, s_{t+1}, d_t)$ uniformly and independently from the replay buffer. Because adjacent transitions in a sampled mini-batch belong to completely different episodes and time steps:
$$\text{Dummy Hidden State}: \quad h_0 = \mathbf{0} \in \mathbb{R}^{B \times N \times 64}$$
was passed into `self.temporal_gru.forward_step(X, a, dummy_h)` in line 358 of the initial implementation.

### Methodological Deficiencies of Zero-Initialization
1. **Truncation of Multi-Step History:** If hidden state is always zeroed during replay updates, the GRU behaves effectively as a single-step feedforward gating layer rather than learning multi-step temporal demand dynamics.
2. **Hidden State Inconsistency:** The network is evaluated during rollout with fully developed hidden states $H_t$, but optimized during training with zero hidden states $H_0 = \mathbf{0}$, creating a train-test distribution shift.

---

## 2. Technical Solutions Evaluated

Two distinct replay methodologies were designed, implemented, and compared:

### Approach A: Sequential Trajectory Replay with Truncated BPTT (This Work)
- The replay buffer records full episodic trajectories.
- `sample_sequences(batch_size, seq_len=8)` uniformly samples contiguous sub-sequences of length $T_{\text{seq}} = 8$ steps from completed episodes.
- Training unrolls the GRU forward across all 8 steps:
  $$h_t = \text{GRU}(X_t, a_{t-1}, h_{t-1}), \quad \text{for } t = 1, \dots, T_{\text{seq}}$$
- The initial hidden state $h_0$ is restored from the recorded trajectory at start time $t_0$, or initialized to zero if at episode start.
- Gradients are accumulated across all sequence steps and backpropagated via Truncated Backpropagation Through Time (TBPTT).

### Approach B: Explicit Feedforward Meta-Representation Mode
- When computational throughput is prioritized, single-step transitions are sampled uniformly with zeroed priors.
- **Academic Requirement:** This mode must be explicitly documented in publications as *"Single-Step Truncated Temporal Representation"* rather than claiming multi-step recurrent memory.

---

## 3. Unit and Integration Test Verification

The sequence replay buffer and multi-step recurrent training step were verified with new automated unit tests in `test_paper_aligned.py`:
- `test_sequence_replay_buffer_and_recurrent_step`:
  1. Populated buffer with completed episodes containing `done=True` termination markers.
  2. Verified that `sample_sequences(batch_size=2, seq_len=4)` extracts synchronized temporal tensors of shape $(B, N, D)$.
  3. Executed `trainer.train_step_sequence(buf, batch_size=2, seq_len=4)`.
  4. Verified that Bellman loss, actor loss, and InfoNCE contrastive loss evaluate to valid, non-divergent scalar floats.
- **Result:** PASSED (17/17 tests passing across the full suite).

---

## 4. Academic Disclosure Recommendations

In any academic paper submission or defense:
1. Clearly disclose whether evaluation was conducted using **Sequential Trajectory Replay (Approach A)** or **Single-Step Feedforward Replay (Approach B)**.
2. Note that while Sequential Trajectory Replay accurately unrolls GRU hidden states across multi-step windows, it incurs a $\sim 3\times$ higher training computation cost per gradient step due to multi-step graph convolutions.

