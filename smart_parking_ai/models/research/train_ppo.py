"""Reproducible PPO Training Pipeline for Smart Parking Research.

Executes multi-seed recurrent PPO training across the 5 planned seeds:
    Seeds: [42, 101, 2024, 777, 999]

Features:
    - Whole-episode unrolling with decoupled arrival loss masking.
    - Decoupled 4-way GAE boundary handling.
    - Regular validation callbacks on standardized deterministic benchmarks.
    - Automated checkpoint saving for best validation models.
    - Comprehensive CSV telemetry logging (policy loss, value loss, entropy, approx KL, clip frac).
    - Complete reproducibility metadata tracking.
"""

import os
import sys

# Ensure repository root is on sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import csv
import json
import random
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from torch.distributions import Categorical

from smart_parking_ai.models.research.neural_agent import (
    RecurrentActorCritic,
    RecurrentRolloutBuffer,
    PPOTrainer,
    NeuralParkingPolicy,
)
from smart_parking_ai.models.research.sim_env import CampusParkingSimEnv
from smart_parking_ai.models.research.baselines import evaluate_policy_episode, EpisodeMetrics


CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
SEEDS = [42, 101, 2024, 777, 999]


def set_seed(seed: int) -> None:
    """Sets random seeds across Python, NumPy, and PyTorch for strict reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def evaluate_validation(
    model: RecurrentActorCritic,
    env: CampusParkingSimEnv,
    device: str = "cpu",
) -> Dict[str, float]:
    """Evaluates the current model deterministically across Scenarios 1, 2, and 3 Benchmark."""
    policy = NeuralParkingPolicy(model, deterministic=True, device=device)
    val_scenarios = [
        ("Scenario 1", 1, False),
        ("Scenario 2", 2, False),
        ("Scenario 3 Benchmark", 3, True),
    ]

    tot_reward = 0.0
    tot_sv = 0
    tot_reqs = 0
    cruising_times: List[float] = []

    for name, s_id, is_bench in val_scenarios:
        ep = evaluate_policy_episode(
            env=env,
            policy=policy,
            scenario_id=s_id,
            deterministic_benchmark=is_bench,
        )
        tot_reward += ep.cumulative_reward
        tot_sv += ep.service_volume
        tot_reqs += ep.total_requests
        if ep.mean_physical_cruising_time is not None:
            cruising_times.append(ep.mean_physical_cruising_time)

    asr = (float(tot_sv) / float(max(1, tot_reqs))) * 100.0
    mean_cruise = float(np.mean(cruising_times)) if cruising_times else 0.0

    return {
        "val_cumulative_reward": tot_reward,
        "val_service_volume": tot_sv,
        "val_allocation_success_rate": asr,
        "val_mean_cruising_time": mean_cruise,
    }


def train_single_seed(
    seed: int,
    total_episodes: int = 120,
    lr: float = 3e-4,
    clip_eps: float = 0.2,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
    val_interval: int = 20,
    device_str: str = "cpu",
) -> Dict[str, Any]:
    """Executes PPO training for a single random seed."""
    set_seed(seed)
    device = torch.device(device_str)

    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    os.makedirs(LOG_DIR, exist_ok=True)

    log_file_path = os.path.join(LOG_DIR, f"training_log_seed_{seed}.csv")
    checkpoint_path = os.path.join(CHECKPOINT_DIR, f"best_model_seed_{seed}.pt")
    final_checkpoint_path = os.path.join(CHECKPOINT_DIR, f"final_model_seed_{seed}.pt")

    env = CampusParkingSimEnv()
    model = RecurrentActorCritic().to(device)
    trainer = PPOTrainer(
        model=model,
        lr=lr,
        clip_eps=clip_eps,
        vf_coef=0.5,
        ent_coef=0.01,
        max_grad_norm=0.5,
        device=device,
    )

    csv_headers = [
        "episode", "scenario_id", "episode_return", "service_volume", "conflict_count",
        "total_loss", "actor_loss", "critic_loss", "entropy_loss", "approx_kl", "clip_frac",
        "grad_norm", "val_reward", "val_asr", "val_mean_cruise"
    ]

    with open(log_file_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)

    best_val_score = -float("inf")
    training_start_time = time.time()

    # Training loop: rotate through Scenarios 1, 2, and 3 Stochastic
    training_scenarios = [1, 2, 3]

    for ep in range(1, total_episodes + 1):
        s_id = training_scenarios[(ep - 1) % len(training_scenarios)]
        obs, info = env.reset(scenario_id=s_id, deterministic_benchmark=False)
        horizon = env.horizon_minutes

        buffer = RecurrentRolloutBuffer(
            capacity=horizon + 10,
            obs_dim=18,
            action_dim=3,
            hidden_dim=64,
            gamma=gamma,
            gae_lambda=gae_lambda,
            device=device,
        )

        h_prev = torch.zeros(1, 64, dtype=torch.float32, device=device)
        ep_reward = 0.0
        terminated = False
        t_step = 0

        while not terminated:
            mask = env.get_action_mask()
            obs_t = torch.as_tensor(obs, dtype=torch.float32, device=device).unsqueeze(0)
            mask_t = torch.as_tensor(mask, dtype=torch.int32, device=device).unsqueeze(0)

            with torch.no_grad():
                m_logits, val, h_next = model.forward_step(obs_t, h_prev, mask_t)
                dist = Categorical(logits=m_logits)
                action = int(dist.sample().item())
                log_prob = float(dist.log_prob(torch.tensor(action, device=device)).item())

            step_res = env.step(action)
            reward = float(step_res.reward)
            next_obs = step_res.observation
            terminated = step_res.terminated
            truncated = step_res.truncated
            ep_reward += reward

            # Evaluate next value
            with torch.no_grad():
                if terminated:
                    next_val = 0.0
                else:
                    next_obs_t = torch.as_tensor(next_obs, dtype=torch.float32, device=device).unsqueeze(0)
                    next_mask_t = torch.as_tensor(step_res.info.get("action_mask", [1, 1, 1]), dtype=torch.int32, device=device).unsqueeze(0)
                    _, n_val, _ = model.forward_step(next_obs_t, h_next, next_mask_t)
                    next_val = float(n_val.item())

            buffer.store(
                obs=obs,
                action=action,
                reward=reward,
                next_obs=next_obs,
                log_prob=log_prob,
                action_mask=mask,
                value=float(val.item()),
                next_value=next_val,
                h_prev=h_prev,
                terminated=terminated,
                truncated=truncated,
                buffer_edge=False,
            )

            obs = next_obs
            h_prev = h_next
            t_step += 1

        # Compute GAE
        buffer.compute_gae()

        # Execute recurrent trajectory update
        n_steps = buffer.ptr
        train_metrics = trainer.train_trajectory(
            obs_seq=buffer.observations[:n_steps],
            action_seq=buffer.actions[:n_steps],
            old_log_probs=buffer.log_probs[:n_steps],
            norm_adv_seq=buffer.normalized_advantages[:n_steps],
            returns_seq=buffer.returns[:n_steps],
            masks_seq=buffer.action_masks[:n_steps],
            is_arrival_seq=buffer.is_arrival[:n_steps],
        )

        val_reward, val_asr, val_cruise = "", "", ""

        # Periodic Validation
        if ep % val_interval == 0 or ep == total_episodes:
            val_results = evaluate_validation(model, env, device_str)
            val_reward = f"{val_results['val_cumulative_reward']:.2f}"
            val_asr = f"{val_results['val_allocation_success_rate']:.1f}"
            val_cruise = f"{val_results['val_mean_cruising_time']:.1f}"

            val_score = val_results["val_cumulative_reward"] + 2.0 * val_results["val_service_volume"]
            if val_score > best_val_score:
                best_val_score = val_score
                torch.save(
                    {
                        "seed": seed,
                        "episode": ep,
                        "model_state_dict": model.state_dict(),
                        "optimizer_state_dict": trainer.optimizer.state_dict(),
                        "val_results": val_results,
                    },
                    checkpoint_path,
                )

        # Log telemetry to CSV
        with open(log_file_path, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                ep, s_id, f"{ep_reward:.2f}", env.total_physical_allocations, env.total_conflicts,
                f"{train_metrics['total_loss']:.4f}", f"{train_metrics['actor_loss']:.4f}",
                f"{train_metrics['critic_loss']:.4f}", f"{train_metrics['entropy_loss']:.4f}",
                f"{train_metrics['approx_kl']:.6f}", f"{train_metrics['clip_frac']:.4f}",
                f"{train_metrics['grad_norm']:.4f}", val_reward, val_asr, val_cruise
            ])

    # Save final model checkpoint
    torch.save(
        {
            "seed": seed,
            "total_episodes": total_episodes,
            "model_state_dict": model.state_dict(),
        },
        final_checkpoint_path,
    )

    elapsed_time = time.time() - training_start_time
    print(f"[TrainPPO] Seed {seed} completed in {elapsed_time:.1f}s. Best checkpoint saved to {checkpoint_path}")

    return {
        "seed": seed,
        "elapsed_time": elapsed_time,
        "best_checkpoint": checkpoint_path,
        "final_checkpoint": final_checkpoint_path,
        "log_file": log_file_path,
    }


def main() -> None:
    """Executes multi-seed training across all 5 planned seeds."""
    print("=" * 70)
    print("STARTING STAGE 4: MULTI-SEED RECURRENT PPO TRAINING")
    print(f"Seeds: {SEEDS}")
    print("=" * 70)

    summary_results = []
    overall_start = time.time()

    for s in SEEDS:
        print(f"\n--- Training Seed {s} ---")
        res = train_single_seed(
            seed=s,
            total_episodes=120,
            lr=3e-4,
            clip_eps=0.2,
            val_interval=20,
            device_str="cpu",
        )
        summary_results.append(res)

    total_time = time.time() - overall_start
    print("\n" + "=" * 70)
    print(f"STAGE 4 COMPLETE: 5/5 SEEDS TRAINED IN {total_time:.1f}s")
    print("=" * 70)

    summary_file = os.path.join(CHECKPOINT_DIR, "training_summary.json")
    with open(summary_file, "w") as f:
        json.dump(
            {
                "training_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "seeds": SEEDS,
                "total_time_seconds": total_time,
                "summary": summary_results,
            },
            f,
            indent=2,
        )
    print(f"[TrainPPO] Master training summary saved to {summary_file}")


if __name__ == "__main__":
    main()
