"""Comparative Evaluation Runner for Paper-Aligned Implementation.

Evaluates and compares:
    1. Paper-Aligned MADDPG + Two-Stage GAT + HGP + GCL + Hypernetwork
    2. FIFO Baseline (Sandholm & Lai 2010 [9])
    3. SIRO Baseline (Larson & Sasanuma 2007 [10])

Records:
    - Service Volume (SV, Definition 3)
    - Occupancy Rate (OR, Equation 19)
    - Allocation Rate (AR, Equation 20)
    - Mean Cruising Time (Equation 1)
    - Cumulative Return (Equation 4)
    - Inference Latency per decision
Stores raw episode-level results in JSON for full scientific reproducibility.
"""

import json
import os
import sys
import time
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np
import torch

from research.paper_aligned.baselines_paper import FIFOMunicipalPolicy, SIROMunicipalPolicy
from research.paper_aligned.maddpg import MADDPGTrainer
from research.paper_aligned.melbourne_env import MelbourneMunicipalParkingEnv


def run_comparative_benchmark(
    num_eval_episodes: int = 10,
    requests_per_episode: int = 120,
    checkpoint_path: Optional[str] = None,
    output_dir: str = "research/paper_aligned",
    seed_base: int = 2026,
) -> Dict[str, Any]:
    """Runs paired comparative benchmark across MADDPG, FIFO, and SIRO."""
    device = torch.device("cpu")
    results_dir = os.path.join(output_dir, "results")
    os.makedirs(results_dir, exist_ok=True)

    # 1. Initialize Environment
    env = MelbourneMunicipalParkingEnv(
        episode_minutes=120,
        requests_per_episode=requests_per_episode,
        seed=seed_base,
    )

    # 2. Initialize Models
    maddpg_trainer = MADDPGTrainer(
        num_facilities=9,
        node_feat_dim=8,
        spatial_dim=32,
        gru_hidden_dim=64,
        device=device,
    )

    # Load trained weights if checkpoint exists
    if checkpoint_path and os.path.exists(checkpoint_path):
        print(f"[Benchmark] Loading MADDPG checkpoint from {checkpoint_path}...")
        ckpt = torch.load(checkpoint_path, map_location=device)
        maddpg_trainer.gat.load_state_dict(ckpt["gat_state"])
        maddpg_trainer.temporal_gru.load_state_dict(ckpt["temporal_gru_state"])
        maddpg_trainer.hypernetwork.load_state_dict(ckpt["hypernetwork_state"])
        maddpg_trainer.actor.load_state_dict(ckpt["actor_state"])
        if "critic_state" in ckpt:
            maddpg_trainer.critic.load_state_dict(ckpt["critic_state"])
        print("[Benchmark] Checkpoint loaded successfully.")
    else:
        print("[Benchmark] No checkpoint provided or found; evaluating initialized weights.")

    fifo_policy = FIFOMunicipalPolicy(num_districts=9)
    siro_policy = SIROMunicipalPolicy(num_districts=9, seed=seed_base)

    policies = {
        "MARL-GCN (MADDPG Paper-Aligned)": maddpg_trainer,
        "FIFO": fifo_policy,
        "SIRO": siro_policy,
    }

    benchmark_data: Dict[str, Any] = {
        "metadata": {
            "eval_episodes": num_eval_episodes,
            "requests_per_episode": requests_per_episode,
            "topology": "Melbourne 9-District Network (541 bays)",
            "seed_base": seed_base,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "raw_episodes": {},
        "summary": {},
    }

    print(f"\n=== STARTING COMPARATIVE BENCHMARK ({num_eval_episodes} Paired Episodes) ===")

    for pol_name, policy in policies.items():
        print(f"\nEvaluating Policy: {pol_name}...")
        ep_records = []
        latencies = []

        for ep_idx in range(num_eval_episodes):
            eval_seed = seed_base + ep_idx * 100
            nodes, adj, info = env.reset(seed=eval_seed)

            h_prev = torch.zeros(1, 9, 64, device=device)
            a_prev = torch.zeros(1, 9, 1, device=device)
            done = False
            ep_reward = 0.0

            while not done:
                t0 = time.perf_counter()

                if pol_name == "MARL-GCN (MADDPG Paper-Aligned)":
                    t_nodes = torch.tensor(nodes, dtype=torch.float32, device=device)
                    t_adj = torch.tensor(adj, dtype=torch.float32, device=device)
                    actions, h_new = policy.select_actions(t_nodes, t_adj, h_prev, a_prev, explore_noise=0.0)
                    act_input = actions.squeeze(0).cpu().numpy()
                    h_prev = h_new
                    a_prev = actions
                else:
                    act_input = policy.select_actions(nodes, adj, info)

                lat = (time.perf_counter() - t0) * 1000.0  # ms
                latencies.append(lat)

                nodes, adj, reward, done, info = env.step(act_input)
                ep_reward += reward

            sv = info["service_volume"]
            current_or = info["occupancy_rate"]
            current_ar = info["allocation_rate"]
            mean_cruise = env.cumulative_cruising_time / max(sv, 1)

            record = {
                "episode": ep_idx + 1,
                "seed": eval_seed,
                "service_volume": sv,
                "occupancy_rate": current_or,
                "allocation_rate": current_ar,
                "cumulative_reward": ep_reward,
                "mean_cruising_time_min": mean_cruise,
            }
            ep_records.append(record)

        # Summary statistics
        ar_list = [r["allocation_rate"] for r in ep_records]
        or_list = [r["occupancy_rate"] for r in ep_records]
        sv_list = [r["service_volume"] for r in ep_records]
        cr_list = [r["mean_cruising_time_min"] for r in ep_records]
        rew_list = [r["cumulative_reward"] for r in ep_records]

        benchmark_data["raw_episodes"][pol_name] = ep_records
        benchmark_data["summary"][pol_name] = {
            "mean_service_volume": float(np.mean(sv_list)),
            "std_service_volume": float(np.std(sv_list)),
            "mean_occupancy_rate": float(np.mean(or_list)),
            "std_occupancy_rate": float(np.std(or_list)),
            "mean_allocation_rate": float(np.mean(ar_list)),
            "std_allocation_rate": float(np.std(ar_list)),
            "mean_cruising_time_min": float(np.mean(cr_list)),
            "std_cruising_time_min": float(np.std(cr_list)),
            "mean_cumulative_reward": float(np.mean(rew_list)),
            "std_cumulative_reward": float(np.std(rew_list)),
            "mean_latency_ms": float(np.mean(latencies)),
            "p95_latency_ms": float(np.percentile(latencies, 95)),
        }

        s = benchmark_data["summary"][pol_name]
        print(f"  Result -> AR: {s['mean_allocation_rate']:.2f}% ± {s['std_allocation_rate']:.2f}% | "
              f"OR: {s['mean_occupancy_rate']:.2f}% | SV: {s['mean_service_volume']:.1f} | "
              f"Cruise: {s['mean_cruising_time_min']:.2f}m | Latency: {s['mean_latency_ms']:.3f}ms")

    # Export benchmark results
    out_file = os.path.join(results_dir, "benchmark_comparison_results.json")
    with open(out_file, "w") as f:
        json.dump(benchmark_data, f, indent=2)

    print(f"\n[Benchmark] Complete raw and summary results exported to: {out_file}")
    return benchmark_data


if __name__ == "__main__":
    ckpt = "research/paper_aligned/checkpoints/best_maddpg_seed_42.pt"
    run_comparative_benchmark(num_eval_episodes=5, requests_per_episode=100, checkpoint_path=ckpt)
