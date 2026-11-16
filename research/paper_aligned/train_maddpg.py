"""Training Runner for Paper-Aligned MADDPG Architecture on Melbourne Municipal Network.

Executes CTDE training loop integrating:
    - Dynamic Heterogeneous Graph & Two-Stage GAT
    - Heterogeneous Graph Pooling (HGP)
    - Graph Contrastive Learning (GCL)
    - Agent Temporal GRU & Policy Hypernetwork
    - Centralized Evaluator Q_u with Twin Critics and Gradient Norm Clipping
    - Periodic held-out evaluation without exploration noise
"""

import csv
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np
import torch

from research.paper_aligned.maddpg import MADDPGTrainer, MultiAgentReplayBuffer
from research.paper_aligned.melbourne_env import MelbourneMunicipalParkingEnv


def evaluate_policy(
    trainer: MADDPGTrainer,
    eval_episodes: int = 3,
    requests_per_episode: int = 150,
    seed_base: int = 9000,
) -> Dict[str, float]:
    """Evaluates the trained decentralized policy deterministically without exploration noise."""
    eval_ars = []
    eval_ors = []
    eval_svs = []
    eval_returns = []
    eval_cruises = []

    for ep in range(eval_episodes):
        env = MelbourneMunicipalParkingEnv(
            episode_minutes=120,
            requests_per_episode=requests_per_episode,
            seed=seed_base + ep,
        )
        nodes, adj, _ = env.reset(seed=seed_base + ep)
        h_prev = torch.zeros(1, 9, 64, device=trainer.device)
        a_prev = torch.zeros(1, 9, 1, device=trainer.device)
        done = False
        ep_ret = 0.0

        while not done:
            t_nodes = torch.tensor(nodes, dtype=torch.float32, device=trainer.device)
            t_adj = torch.tensor(adj, dtype=torch.float32, device=trainer.device)

            # Pure deterministic greedy evaluation
            actions, h_new = trainer.select_actions(t_nodes, t_adj, h_prev, a_prev, explore_noise=0.0)
            act_np = actions.squeeze(0).cpu().numpy()
            next_nodes, next_adj, reward, done, step_info = env.step(act_np)

            ep_ret += reward
            nodes, adj = next_nodes, next_adj
            h_prev = h_new
            a_prev = actions

        eval_ars.append(step_info["allocation_rate"])
        eval_ors.append(step_info["occupancy_rate"])
        eval_svs.append(step_info["service_volume"])
        eval_returns.append(ep_ret)
        eval_cruises.append(env.cumulative_cruising_time / max(step_info["service_volume"], 1))

    return {
        "eval_ar": float(np.mean(eval_ars)),
        "eval_or": float(np.mean(eval_ors)),
        "eval_sv": float(np.mean(eval_svs)),
        "eval_return": float(np.mean(eval_returns)),
        "eval_cruising_time": float(np.mean(eval_cruises)),
    }


def run_maddpg_training(
    num_episodes: int = 30,
    requests_per_episode: int = 150,
    batch_size: int = 32,
    seed: int = 42,
    output_dir: str = "research/paper_aligned",
    stabilized: bool = True,
    use_sequence_replay: bool = False,
    eval_interval: int = 5,
) -> Dict[str, Any]:
    """Runs stabilized training loop for paper-aligned MADDPG architecture."""
    torch.manual_seed(seed)
    np.random.seed(seed)
    device = torch.device("cpu")

    ckpt_dir = os.path.join(output_dir, "checkpoints")
    log_dir = os.path.join(output_dir, "logs")
    os.makedirs(ckpt_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)

    env = MelbourneMunicipalParkingEnv(
        episode_minutes=120,
        requests_per_episode=requests_per_episode,
        seed=seed,
    )

    trainer = MADDPGTrainer(
        num_facilities=9,
        node_feat_dim=8,
        spatial_dim=32,
        gru_hidden_dim=64,
        action_dim=1,
        gamma=0.99,
        tau=0.01,
        lr_actor=1e-4,
        lr_critic=3e-4,
        lambda_cl=0.1,
        kappa=1.0,
        device=device,
        use_twin_critic=stabilized,
        clip_grad_norm=5.0 if stabilized else 0.0,
        reward_scale=0.1 if stabilized else 1.0,
        policy_noise=0.1 if stabilized else 0.0,
        noise_clip=0.2 if stabilized else 0.0,
    )

    replay_buffer = MultiAgentReplayBuffer(capacity=5000, device=device)

    tag = "stabilized" if stabilized else "baseline"
    log_csv = os.path.join(log_dir, f"training_log_maddpg_{tag}_seed_{seed}.csv")
    csv_file = open(log_csv, "w", newline="")
    csv_writer = csv.writer(csv_file)
    csv_writer.writerow([
        "episode", "step_count", "service_volume", "occupancy_rate", "allocation_rate",
        "episode_reward", "eval_return", "mean_cruising_time",
        "critic_loss", "bellman_loss", "actor_loss", "contrastive_loss",
        "q_mean", "q_std", "target_q_mean", "critic_grad_norm", "actor_grad_norm"
    ])

    best_eval_return = -1e9
    start_time = time.time()
    total_steps = 0

    mode_str = f"Stabilized Twin-Critic (SeqReplay={use_sequence_replay})" if stabilized else "Unstabilized Baseline"
    print(f"[MADDPG Training] Starting {num_episodes} episodes [{mode_str}] (Seed={seed})...")

    for ep in range(1, num_episodes + 1):
        nodes, adj, info = env.reset(seed=seed + ep)
        h_prev = torch.zeros(1, 9, 64, device=device)
        a_prev = torch.zeros(1, 9, 1, device=device)

        done = False
        ep_reward = 0.0
        step_count = 0
        losses = {
            "critic_loss": 0.0, "bellman_loss": 0.0, "actor_loss": 0.0,
            "contrastive_loss": 0.0, "q_mean": 0.0, "q_std": 0.0,
            "target_q_mean": 0.0, "critic_grad_norm": 0.0, "actor_grad_norm": 0.0
        }

        while not done:
            t_nodes = torch.tensor(nodes, dtype=torch.float32, device=device)
            t_adj = torch.tensor(adj, dtype=torch.float32, device=device)

            # Epsilon-greedy exploration noise decaying over training
            noise = max(0.05, 0.3 * (1.0 - ep / num_episodes))
            actions, h_new = trainer.select_actions(t_nodes, t_adj, h_prev, a_prev, explore_noise=noise)

            act_np = actions.squeeze(0).cpu().numpy()
            next_nodes, next_adj, reward, done, step_info = env.step(act_np)

            ep_reward += reward
            step_count += 1
            total_steps += 1

            # Store in replay buffer
            replay_buffer.store(
                node_feats=nodes.squeeze(0),
                adj=adj.squeeze(0),
                actions=act_np,
                reward=reward,
                next_node_feats=next_nodes.squeeze(0),
                next_adj=next_adj.squeeze(0),
                done=done,
                h_state=h_prev.squeeze(0).cpu().numpy(),
            )

            # Training step
            if use_sequence_replay and len(replay_buffer.episodes) >= 4:
                step_losses = trainer.train_step_sequence(replay_buffer, batch_size=8, seq_len=8)
            else:
                step_losses = trainer.train_step(replay_buffer, batch_size=batch_size)

            for k in losses:
                losses[k] += step_losses.get(k, 0.0)

            nodes, adj = next_nodes, next_adj
            h_prev = h_new
            a_prev = actions

        # Periodic held-out evaluation
        if ep % eval_interval == 0 or ep == num_episodes:
            eval_metrics = evaluate_policy(trainer, eval_episodes=2, requests_per_episode=requests_per_episode, seed_base=9000 + ep)
            eval_ret = eval_metrics["eval_return"]
        else:
            eval_ret = float("nan")

        sv = step_info["service_volume"]
        cur_or = step_info["occupancy_rate"]
        cur_ar = step_info["allocation_rate"]
        mean_cruise = env.cumulative_cruising_time / max(sv, 1)

        c_loss = losses["critic_loss"] / max(step_count, 1)
        b_loss = losses["bellman_loss"] / max(step_count, 1)
        a_loss = losses["actor_loss"] / max(step_count, 1)
        cl_loss = losses["contrastive_loss"] / max(step_count, 1)
        q_m = losses["q_mean"] / max(step_count, 1)
        q_s = losses["q_std"] / max(step_count, 1)
        tq_m = losses["target_q_mean"] / max(step_count, 1)
        c_gnorm = losses["critic_grad_norm"] / max(step_count, 1)
        a_gnorm = losses["actor_grad_norm"] / max(step_count, 1)

        csv_writer.writerow([
            ep, step_count, sv, f"{cur_or:.2f}", f"{cur_ar:.2f}",
            f"{ep_reward:.2f}", f"{eval_ret:.2f}" if not np.isnan(eval_ret) else "",
            f"{mean_cruise:.2f}", f"{c_loss:.4f}", f"{b_loss:.4f}", f"{a_loss:.4f}",
            f"{cl_loss:.4f}", f"{q_m:.4f}", f"{q_s:.4f}", f"{tq_m:.4f}",
            f"{c_gnorm:.4f}", f"{a_gnorm:.4f}"
        ])
        csv_file.flush()

        # Checkpoint selection on eval return
        if not np.isnan(eval_ret) and eval_ret > best_eval_return:
            best_eval_return = eval_ret
            best_ckpt = os.path.join(ckpt_dir, f"best_maddpg_{tag}_seed_{seed}.pt")
            torch.save({
                "episode": ep,
                "step": total_steps,
                "best_eval_return": best_eval_return,
                "gat_state": trainer.gat.state_dict(),
                "temporal_gru_state": trainer.temporal_gru.state_dict(),
                "hypernetwork_state": trainer.hypernetwork.state_dict(),
                "actor_state": trainer.actor.state_dict(),
                "critic1_state": trainer.critic1.state_dict(),
                "critic2_state": trainer.critic2.state_dict(),
                "hgp_state": trainer.hgp.state_dict(),
                "gcl_state": trainer.gcl.state_dict(),
                "actor_optimizer": trainer.actor_optimizer.state_dict(),
                "critic_optimizer": trainer.critic_optimizer.state_dict(),
                "config": {
                    "seed": seed,
                    "stabilized": stabilized,
                    "reward_scale": trainer.reward_scale,
                    "clip_grad_norm": trainer.clip_grad_norm,
                }
            }, best_ckpt)

        if ep % 5 == 0 or ep == num_episodes:
            eval_str = f" | EvalRet: {eval_ret:5.1f}" if not np.isnan(eval_ret) else ""
            print(f"  [Ep {ep:2d}/{num_episodes}] AR: {cur_ar:5.1f}% | Ret: {ep_reward:5.1f}{eval_str} | Q-mean: {q_m:6.2f} | CriticLoss: {c_loss:6.2f} | GradNorm: {c_gnorm:4.2f}")

    csv_file.close()
    elapsed = time.time() - start_time

    # Save final model
    final_ckpt = os.path.join(ckpt_dir, f"final_maddpg_{tag}_seed_{seed}.pt")
    torch.save({
        "total_episodes": num_episodes,
        "final_step": total_steps,
        "gat_state": trainer.gat.state_dict(),
        "temporal_gru_state": trainer.temporal_gru.state_dict(),
        "hypernetwork_state": trainer.hypernetwork.state_dict(),
        "actor_state": trainer.actor.state_dict(),
        "critic1_state": trainer.critic1.state_dict(),
        "critic2_state": trainer.critic2.state_dict(),
        "hgp_state": trainer.hgp.state_dict(),
        "gcl_state": trainer.gcl.state_dict(),
    }, final_ckpt)

    summary = {
        "seed": seed,
        "stabilized": stabilized,
        "use_sequence_replay": use_sequence_replay,
        "total_episodes": num_episodes,
        "total_steps": total_steps,
        "best_eval_return": float(best_eval_return),
        "final_train_reward": float(ep_reward),
        "final_critic_loss": float(c_loss),
        "final_q_mean": float(q_m),
        "elapsed_seconds": float(elapsed),
        "best_checkpoint": os.path.join(ckpt_dir, f"best_maddpg_{tag}_seed_{seed}.pt"),
        "final_checkpoint": final_ckpt,
        "log_file": log_csv,
    }

    summary_path = os.path.join(ckpt_dir, f"training_summary_maddpg_{tag}_seed_{seed}.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"[MADDPG Training] Completed in {elapsed:.2f}s. Summary saved to {summary_path}")
    return summary


if __name__ == "__main__":
    run_maddpg_training(num_episodes=30, requests_per_episode=150, seed=42, stabilized=True)
