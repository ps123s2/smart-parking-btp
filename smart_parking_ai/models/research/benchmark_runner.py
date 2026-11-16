"""Comparative Benchmark Runner for Smart Parking Research.

Executes rigorous head-to-head empirical benchmarking comparing:
    1. Fixed-Priority Fill (FIFO Baseline)
    2. SIRO Zone (Uniform Random)
    3. Capacity-Proportional SIRO
    4. Congestion-Aware Nearest Zone (Greedy Heuristic)
    5. Recurrent Neural PPO (Proposed)

Evaluates all 4 core simulator scenarios and 3 empirical Melbourne profiles.
Records the 9 standardized evaluation metrics + discounted return + inference latency.
Exports structured results to results/benchmark_results.json.
"""

import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch

# Ensure repository root is on sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from smart_parking_ai.models.research.neural_agent import RecurrentActorCritic, NeuralParkingPolicy
from smart_parking_ai.models.research.sim_env import CampusParkingSimEnv
from smart_parking_ai.models.research.scenario_data import ParkingRequest
from smart_parking_ai.models.research.baselines import (
    BasePolicy,
    FixedPriorityFillPolicy,
    SIROZonePolicy,
    SIROStallPolicy,
    CongestionAwareNearestZonePolicy,
    evaluate_policy_episode,
    EpisodeMetrics,
    STANDARD_SIRO_SEEDS,
)


RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def load_best_neural_policy(seed: int = 42, device: str = "cpu") -> NeuralParkingPolicy:
    """Loads trained checkpoint for neural policy evaluation."""
    ckpt_path = os.path.join(CHECKPOINT_DIR, f"best_model_seed_{seed}.pt")
    if not os.path.exists(ckpt_path):
        ckpt_path = os.path.join(CHECKPOINT_DIR, f"final_model_seed_{seed}.pt")

    model = RecurrentActorCritic()
    if os.path.exists(ckpt_path):
        ckpt = torch.load(ckpt_path, map_location=device)
        model.load_state_dict(ckpt["model_state_dict"])
        print(f"[Benchmark] Loaded trained PPO checkpoint from {ckpt_path}")
    else:
        print(f"[Benchmark] Warning: Checkpoint {ckpt_path} not found! Using initialized weights.")

    return NeuralParkingPolicy(model, deterministic=True, device=device)


def evaluate_policy_detailed(
    env: CampusParkingSimEnv,
    policy: BasePolicy,
    scenario_id: int = 1,
    deterministic_benchmark: bool = False,
    custom_requests: Optional[List[ParkingRequest]] = None,
    custom_initial_occupancy: Optional[Dict[str, Dict[str, Union[str, int, None]]]] = None,
    gamma: float = 0.99,
) -> Dict[str, Any]:
    """Runs a single episode and measures all 10 metrics including inference latency."""
    obs, info = env.reset(
        scenario_id=scenario_id,
        deterministic_benchmark=deterministic_benchmark,
        custom_requests=custom_requests,
        custom_initial_occupancy=custom_initial_occupancy,
    )
    policy.reset()

    latencies_us: List[float] = []
    rewards: List[float] = []
    discounted_return = 0.0
    terminated = False
    step_idx = 0

    while not terminated:
        mask = env.get_action_mask()

        t0 = time.perf_counter()
        action = policy.select_action(obs, mask)
        t1 = time.perf_counter()
        latencies_us.append((t1 - t0) * 1e6)

        step_res = env.step(action)
        r = float(step_res.reward)
        rewards.append(r)
        discounted_return += (gamma ** step_idx) * r

        obs = step_res.observation
        terminated = step_res.terminated
        step_idx += 1

    # Evaluate standardized metrics using audited baseline evaluator
    ep_metrics = evaluate_policy_episode(
        env=env,
        policy=policy,
        scenario_id=scenario_id,
        deterministic_benchmark=deterministic_benchmark,
        custom_requests=custom_requests,
        custom_initial_occupancy=custom_initial_occupancy,
    )

    tot_reqs = max(1, ep_metrics.total_requests)
    overflow_rate = (float(ep_metrics.overflow_count) / float(tot_reqs)) * 100.0
    conflict_rate = (float(ep_metrics.conflict_count) / float(tot_reqs)) * 100.0

    return {
        "service_volume": ep_metrics.service_volume,
        "allocation_success_rate": ep_metrics.allocation_rate,
        "occupancy_rate": ep_metrics.occupancy_rate,
        "mean_cruising_time": ep_metrics.mean_physical_cruising_time,
        "mean_walking_time": ep_metrics.mean_physical_walking_time,
        "overflow_rate": overflow_rate,
        "conflict_rate": conflict_rate,
        "cumulative_reward": ep_metrics.cumulative_reward,
        "discounted_return": float(discounted_return),
        "mean_inference_latency_us": float(np.mean(latencies_us)),
    }


def run_benchmark_suite() -> Dict[str, Any]:
    """Executes the full comparative benchmark across 5 policies and 7 scenarios."""
    os.makedirs(RESULTS_DIR, exist_ok=True)
    env = CampusParkingSimEnv()

    # Load empirical scenarios if available
    emp_scenarios_path = os.path.join(DATA_DIR, "empirical_scenarios.json")
    emp_data = {}
    if os.path.exists(emp_scenarios_path):
        with open(emp_scenarios_path) as f:
            emp_data = json.load(f).get("scenarios", {})

    policies: List[Tuple[str, BasePolicy]] = [
        ("Fixed-Priority Fill", FixedPriorityFillPolicy()),
        ("SIRO Zone", SIROZonePolicy(seed=42)),
        ("Capacity-Proportional SIRO", SIROStallPolicy(seed=42)),
        ("Congestion-Aware Nearest Zone", CongestionAwareNearestZonePolicy()),
        ("Recurrent Neural PPO", load_best_neural_policy(seed=42)),
    ]

    scenarios = [
        ("Scenario 1", 1, False, None, None),
        ("Scenario 2", 2, False, None, None),
        ("Scenario 3 Stochastic", 3, False, None, None),
        ("Scenario 3 Benchmark", 3, True, None, None),
    ]

    # Add Empirical Profiles if present
    for prof_name, prof_cfg in emp_data.items():
        reqs = [
            ParkingRequest(req_id=r["req_id"], arrival_time=r["arrival_time"], dwell_time=r["dwell_time"])
            for r in prof_cfg["requests"]
        ]
        init_occ = prof_cfg["initial_occupancy"]
        scenarios.append((prof_name, 1, False, reqs, init_occ))

    benchmark_results: Dict[str, Dict[str, Any]] = {}

    print("=" * 85)
    print(f"{'POLICY':<30} | {'SCENARIO':<22} | {'SV':<4} | {'ASR(%)':<6} | {'CRUISE(s)':<9} | {'REWARD':<7}")
    print("=" * 85)

    for pol_name, pol_instance in policies:
        benchmark_results[pol_name] = {}

        for sc_name, s_id, is_bench, cust_reqs, cust_occ in scenarios:
            res = evaluate_policy_detailed(
                env=env,
                policy=pol_instance,
                scenario_id=s_id,
                deterministic_benchmark=is_bench,
                custom_requests=cust_reqs,
                custom_initial_occupancy=cust_occ,
            )
            benchmark_results[pol_name][sc_name] = res

            cruise_str = f"{res['mean_cruising_time']:.1f}" if res["mean_cruising_time"] is not None else "N/A"
            print(
                f"{pol_name:<30} | {sc_name:<22} | {res['service_volume']:<4} | "
                f"{res['allocation_success_rate']:<6.1f} | {cruise_str:<9} | {res['cumulative_reward']:<7.2f}"
            )

    print("=" * 85)

    out_file = os.path.join(RESULTS_DIR, "benchmark_results.json")
    with open(out_file, "w") as f:
        json.dump(benchmark_results, f, indent=2)
    print(f"\n[Benchmark] Comprehensive results exported to {out_file}")

    return benchmark_results


if __name__ == "__main__":
    run_benchmark_suite()
