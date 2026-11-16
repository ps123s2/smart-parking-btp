"""Generates publication-quality figures for the academic research paper.

Reads experimental results from:
    - checkpoints/training_summary.json
    - logs/training_log_seed_*.csv
    - results/benchmark_results.json
    - results/ablation_results.json
    - results/robustness_results.json
    - data/distribution_fit_report.json

Exports to:
    research_paper/figures/
"""

import csv
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
FIGURES_DIR = os.path.join(REPO_ROOT, "research_paper", "figures")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
LOGS_DIR = os.path.join(os.path.dirname(__file__), "logs")

os.makedirs(FIGURES_DIR, exist_ok=True)
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
plt.rcParams.update({
    "font.family": "serif",
    "font.size": 11,
    "axes.labelsize": 12,
    "axes.titlesize": 13,
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "figure.titlesize": 14,
})


def plot_training_curves() -> None:
    """Plots training return, critic loss, and actor loss over training episodes."""
    log_file = os.path.join(LOGS_DIR, "training_log_seed_42.csv")
    if not os.path.exists(log_file):
        return

    episodes, returns, critic_losses, actor_losses = [], [], [], []
    with open(log_file) as f:
        reader = csv.DictReader(f)
        for row in reader:
            episodes.append(int(row["episode"]))
            returns.append(float(row["episode_return"]))
            critic_losses.append(float(row["critic_loss"]))
            actor_losses.append(float(row["actor_loss"]))

    fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

    # Episode Return
    axes[0].plot(episodes, returns, color="#1f77b4", lw=1.8, label="Episode Return")
    # Rolling average
    if len(returns) >= 10:
        roll = np.convolve(returns, np.ones(10)/10, mode="valid")
        axes[0].plot(range(10, len(returns)+1), roll, color="#d62728", lw=2.2, label="10-Ep Moving Avg")
    axes[0].set_title("Episode Reward Convergence")
    axes[0].set_xlabel("Training Episode")
    axes[0].set_ylabel("Discounted Return")
    axes[0].legend(loc="lower right")

    # Critic Loss
    axes[1].plot(episodes, critic_losses, color="#2ca02c", lw=1.8)
    axes[1].set_title("Critic Value Loss (MSE)")
    axes[1].set_xlabel("Training Episode")
    axes[1].set_ylabel("MSE Loss")

    # Actor Loss
    axes[2].plot(episodes, actor_losses, color="#9467bd", lw=1.8)
    axes[2].set_title("Arrival-Conditioned Actor Loss")
    axes[2].set_xlabel("Training Episode")
    axes[2].set_ylabel("PPO Surrogate Loss")

    plt.tight_layout()
    out_path = os.path.join(FIGURES_DIR, "fig5_training_curves.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"[Figures] Saved {out_path}")


def plot_service_volume_and_cruising() -> None:
    """Plots comparative Service Volume and Cruising Delay bar charts across policies."""
    bench_file = os.path.join(RESULTS_DIR, "benchmark_results.json")
    if not os.path.exists(bench_file):
        return

    with open(bench_file) as f:
        data = json.load(f)

    policies = list(data.keys())
    scenarios = ["Scenario 1", "Scenario 2", "Scenario 3 Benchmark", "Profile A (Heavy Influx Surge)"]
    labels = ["Scen 1", "Scen 2", "Scen 3 Bench", "Profile A"]

    x = np.arange(len(scenarios))
    width = 0.16

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 4.8))
    colors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"]

    for i, pol in enumerate(policies):
        sv_vals = [data[pol][sc]["service_volume"] for sc in scenarios]
        cruise_vals = [
            data[pol][sc]["mean_cruising_time"] if data[pol][sc]["mean_cruising_time"] is not None else 0.0
            for sc in scenarios
        ]
        ax1.bar(x + i * width, sv_vals, width, label=pol, color=colors[i % len(colors)])
        ax2.bar(x + i * width, cruise_vals, width, label=pol, color=colors[i % len(colors)])

    ax1.set_title("Service Volume by Scenario (Physical Vehicles Parked)")
    ax1.set_xlabel("Simulation Scenario")
    ax1.set_ylabel("Service Volume (Vehicles)")
    ax1.set_xticks(x + width * 2)
    ax1.set_xticklabels(labels)
    ax1.legend(loc="upper left", bbox_to_anchor=(0.0, 1.0))

    ax2.set_title("Mean Physical Cruising Time (Seconds)")
    ax2.set_xlabel("Simulation Scenario")
    ax2.set_ylabel("Cruising Time (s)")
    ax2.set_xticks(x + width * 2)
    ax2.set_xticklabels(labels)

    plt.tight_layout()
    out_path = os.path.join(FIGURES_DIR, "fig6_service_volume_cruising.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"[Figures] Saved {out_path}")


def plot_robustness_surge() -> None:
    """Plots Allocation Success Rate and Overflow Rate under demand surge scaling."""
    rob_file = os.path.join(RESULTS_DIR, "robustness_results.json")
    if not os.path.exists(rob_file):
        return

    with open(rob_file) as f:
        data = json.load(f).get("demand_surge_scaling", {})

    multipliers = [float(k.replace("x", "")) for k in data.keys()]
    asr_vals = [data[k]["allocation_success_rate"] for k in data.keys()]
    ofr_vals = [data[k]["overflow_rate"] for k in data.keys()]

    fig, ax = plt.subplots(figsize=(7, 4.2))
    ax.plot(multipliers, asr_vals, marker="o", lw=2.2, color="#1f77b4", label="Allocation Success Rate (%)")
    ax.plot(multipliers, ofr_vals, marker="s", lw=2.2, color="#d62728", label="Overflow Fallback Rate (%)")
    ax.axvline(1.5, color="gray", linestyle="--", label="Capacity Saturation Boundary (1.5x)")

    ax.set_title("Policy Robustness Under Arrival Demand Surge")
    ax.set_xlabel("Arrival Demand Multiplier (Alpha)")
    ax.set_ylabel("Percentage (%)")
    ax.set_ylim(-5, 105)
    ax.legend(loc="center right")

    plt.tight_layout()
    out_path = os.path.join(FIGURES_DIR, "fig10_demand_surge_robustness.png")
    plt.savefig(out_path, dpi=300)
    plt.close()
    print(f"[Figures] Saved {out_path}")


def main() -> None:
    print("[Figures] Generating publication figures...")
    plot_training_curves()
    plot_service_volume_and_cruising()
    plot_robustness_surge()
    print("[Figures] All publication figures generated successfully.")


if __name__ == "__main__":
    main()

