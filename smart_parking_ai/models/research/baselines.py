"""
Baseline Allocation Policies and Evaluation Framework for Smart Parking BTP Research.

Stage 3B: Canonical implementation of heuristic, static, and stochastic baseline
allocation policies evaluated against the offline discrete-event simulation environment
(CampusParkingSimEnv).

Implemented Policies:
1. FixedPriorityFillPolicy:
   - Non-adaptive static fill priority (Zone A -> Zone B -> Overflow).
   - Inspired by the published paper's FIFO baseline (Zhao & Yan, Sensors 2025).
   - Documented as spatial fixed-priority fill, not a queue-theoretic waiting buffer.
2. SIROZonePolicy:
   - Service-In-Random-Order at the zone level.
   - Samples uniformly across currently valid physical zones; falls back to Overflow when full.
3. SIROStallPolicy:
   - Service-In-Random-Order at the stall level (Capacity-Proportional Zone Draw).
   - Samples physical zones with probability proportional to available stall capacity.
   - Documented: aggregate selection probability is uniform across all vacant physical stalls,
     while intra-zone assignment is resolved by the simulator's deterministic tie-breaker.
4. CongestionAwareNearestZonePolicy:
   - Dynamic heuristic minimizing real-time cruising plus walking impedance.
   - Uses reciprocal delay formula matching the simulator's congestion mechanics.

Standardized Evaluation Metrics:
- Service Volume (SV), Occupancy Rate (OR, post-decision interval integration),
  Allocation Rate (AR), Mean Physical Cruising/Walking Time (None when SV == 0, never 0.0),
  Mean System Cruising/Walking Time, Overflow Count, Conflict Count, Cumulative Reward.

Dependencies: numpy only. Zero dependencies on Flask, Firebase, Expo, or production code.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any, Union, Sequence
import numpy as np

from .sim_env import (
    CampusParkingSimEnv,
    BASE_CRUISING_SECONDS,
    WALKING_SECONDS,
    OVERFLOW_CRUISING_SECONDS,
    OVERFLOW_WALKING_SECONDS,
    ZONE_CAPACITIES,
    OCCUPANCY_RATIO_CAP,
    ALL_PHYSICAL_STALLS,
)
from .scenario_data import ParkingRequest, ScenarioConfig, get_scenario


# Approved SIRO Evaluation Random Seeds (10-seed standard protocol)
STANDARD_SIRO_SEEDS: Tuple[int, ...] = (42, 101, 202, 303, 404, 505, 606, 707, 808, 909)


# ============================================================================
# BASE POLICY ABSTRACT CLASS
# ============================================================================

class BasePolicy(ABC):
    """Abstract base class for all parking allocation policies."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable policy name."""
        pass

    @abstractmethod
    def select_action(self, observation: np.ndarray, action_mask: np.ndarray) -> int:
        """Selects an action for an active parking search request.

        Args:
            observation: Standardized 18-element float32 observation vector.
            action_mask: 3-element int array [M_0, M_1, M_2] where 1 indicates valid.

        Returns:
            action: 0 (Zone A), 1 (Zone B), or 2 (Abstract Overflow Fallback).
        """
        pass

    def reset(self) -> None:
        """Optional lifecycle hook called at the beginning of each simulation episode."""
        pass


# ============================================================================
# POLICY 1: FIXED-PRIORITY FILL (FIFO SPATIAL ADAPTATION)
# ============================================================================

class FixedPriorityFillPolicy(BasePolicy):
    """Fixed-Priority Static Fill Policy (Zone A -> Zone B -> Overflow).

    Inspired by the First-In-First-Out (FIFO) baseline from Zhao & Yan (Sensors 2025).
    In this discrete single-arrival-per-minute simulation without a central waiting buffer,
    all policies process requests in arrival order. This policy represents the standard
    uncoordinated driver convention of seeking the closest entrance-adjacent lot (Zone A)
    first, spilling to secondary parking (Zone B) when full, and diverting to Overflow (2)
    only when all campus stalls are saturated.

    Note: This is a spatial fixed-priority fill policy, NOT a queue-theoretic waiting queue.
    """

    @property
    def name(self) -> str:
        return "Fixed-Priority Fill (FIFO Adaptation)"

    def select_action(self, observation: np.ndarray, action_mask: np.ndarray) -> int:
        # Strictly respect action mask: Zone A (0) -> Zone B (1) -> Overflow (2)
        if action_mask[0] == 1:
            return 0
        elif action_mask[1] == 1:
            return 1
        return 2


# ============================================================================
# POLICY 2: SIRO-ZONE (UNIFORM RANDOM ACROSS AVAILABLE ZONES)
# ============================================================================

class SIROZonePolicy(BasePolicy):
    """Service-In-Random-Order Policy (Zone-Level Uniform Draw).

    Draws uniformly from available physical zones {z in {0, 1} | mask[z] == 1}.
    If neither physical zone is available, routes to Overflow (Action 2).

    Uses an independent seeded NumPy PRNG decoupled from scenario generation.
    """

    def __init__(self, seed: Optional[int] = None) -> None:
        self.initial_seed: Optional[int] = seed
        self.rng: np.random.Generator = np.random.default_rng(seed)

    @property
    def name(self) -> str:
        return "SIRO-Zone (Uniform Zone Draw)"

    def reset(self) -> None:
        """Re-initializes PRNG to ensure reproducibility across episodes."""
        if self.initial_seed is not None:
            self.rng = np.random.default_rng(self.initial_seed)

    def select_action(self, observation: np.ndarray, action_mask: np.ndarray) -> int:
        physical_valid = [z for z in (0, 1) if action_mask[z] == 1]
        if physical_valid:
            return int(self.rng.choice(physical_valid))
        return 2


# ============================================================================
# POLICY 3: SIRO-STALL (CAPACITY-PROPORTIONAL ZONE DRAW)
# ============================================================================

class SIROStallPolicy(BasePolicy):
    """Service-In-Random-Order Policy (Stall-Level Uniform Random Draw).

    In an uncoordinated facility where drivers stumble upon vacant spaces at random,
    every open stall in the lot has an equal probability 1 / n_vacant of being claimed.
    Because the simulator's action space is zone-based (0: Zone A, 1: Zone B), this policy
    selects each zone with probability proportional to its number of currently vacant stalls:
        P(Zone A) = n_vacant(A) / (n_vacant(A) + n_vacant(B))
        P(Zone B) = n_vacant(B) / (n_vacant(A) + n_vacant(B))

    Architectural Note:
    Once a zone is chosen, the simulator deterministically assigns the lowest-alphanumeric
    vacant stall in that zone (e.g. A1 before A2). Thus, the policy is uniform over available
    stalls in aggregate probability mass across zones, while intra-zone assignment is resolved
    by the simulator's deterministic tie-breaker. Because stalls within a zone have identical
    cruising delays and walking times, this introduces zero metric distortion.

    Uses an independent seeded NumPy PRNG decoupled from scenario generation.
    """

    def __init__(self, seed: Optional[int] = None) -> None:
        self.initial_seed: Optional[int] = seed
        self.rng: np.random.Generator = np.random.default_rng(seed)

    @property
    def name(self) -> str:
        return "SIRO-Stall (Capacity-Proportional Draw)"

    def reset(self) -> None:
        """Re-initializes PRNG to ensure reproducibility across episodes."""
        if self.initial_seed is not None:
            self.rng = np.random.default_rng(self.initial_seed)

    def select_action(self, observation: np.ndarray, action_mask: np.ndarray) -> int:
        # Calculate vacant stalls in each zone from observation vector
        # observation[0..2] correspond to stalls A1, A2, A3
        # observation[3..4] correspond to stalls B1, B2
        vacant_a = int(sum(1 for i in range(3) if observation[i] < 0.5)) if action_mask[0] == 1 else 0
        vacant_b = int(sum(1 for i in range(3, 5) if observation[i] < 0.5)) if action_mask[1] == 1 else 0

        total_vacant = vacant_a + vacant_b
        if total_vacant <= 0:
            return 2  # Physical lot full -> Overflow

        # Sample zone proportionally to vacant stall count
        p_a = float(vacant_a) / float(total_vacant)
        draw = self.rng.random()
        return 0 if (draw < p_a) else 1


# ============================================================================
# POLICY 4: CONGESTION-AWARE NEAREST-ZONE (DYNAMIC GREEDY)
# ============================================================================

class CongestionAwareNearestZonePolicy(BasePolicy):
    """Dynamic Congestion-Aware Nearest-Zone Policy.

    Campus adaptation representing an intelligent driver seeking to minimize
    total trip impedance (cruising time + walking time) under real-time congestion.

    Formula:
        For valid physical zones (action_mask[z] == 1):
            ratio_z = observation[10 + z]  (zone occupancy ratio)
            T_cruise(z) = BASE_CRUISING_SECONDS[z] / (1.0 - min(ratio_z, 0.95))
            J(z) = T_cruise(z) + WALKING_SECONDS[z]
            action = argmin_{z in valid} J(z)

    If neither physical zone is valid, falls back to Overflow (Action 2).
    """

    def __init__(
        self,
        base_cruise: Optional[Dict[int, float]] = None,
        walking_time: Optional[Dict[int, float]] = None
    ) -> None:
        self.base_cruise = base_cruise if base_cruise is not None else BASE_CRUISING_SECONDS
        self.walking_time = walking_time if walking_time is not None else WALKING_SECONDS

    @property
    def name(self) -> str:
        return "Congestion-Aware Nearest-Zone (Dynamic Greedy)"

    def select_action(self, observation: np.ndarray, action_mask: np.ndarray) -> int:
        # Strictly evaluate valid physical zones only
        valid_zones = [z for z in (0, 1) if action_mask[z] == 1]
        if not valid_zones:
            return 2  # Overflow

        costs: Dict[int, float] = {}
        for z in valid_zones:
            occ_ratio = float(observation[10 + z])
            capped_ratio = min(occ_ratio, OCCUPANCY_RATIO_CAP)
            est_cruise = self.base_cruise[z] / (1.0 - capped_ratio)
            est_walk = self.walking_time[z]
            costs[z] = est_cruise + est_walk

        # Select valid zone minimizing total trip impedance; break ties toward lowest zone ID
        best_zone = min(valid_zones, key=lambda z: (costs[z], z))
        return int(best_zone)


# ============================================================================
# EVALUATION METRICS DATA STRUCTURES
# ============================================================================

@dataclass
class EpisodeMetrics:
    """Standardized performance metrics from a single simulation episode."""
    scenario_id: int
    scenario_name: str
    horizon_minutes: int
    total_requests: int
    service_volume: int
    occupancy_rate: float                              # Percentage [0.0, 100.0]
    allocation_rate: float                             # Percentage [0.0, 100.0]
    mean_physical_cruising_time: Optional[float]       # Seconds, None when SV == 0
    mean_physical_walking_time: Optional[float]        # Seconds, None when SV == 0
    mean_system_cruising_time: float                   # Seconds (includes overflow penalty)
    mean_system_walking_time: float                    # Seconds (includes overflow penalty)
    overflow_count: int
    conflict_count: int
    cumulative_reward: float
    occupancy_history: List[int]                       # Post-decision occupancy at each minute t


@dataclass
class AggregatedMetrics:
    """Aggregated metrics across multiple runs or random seeds."""
    policy_name: str
    scenario_id: int
    scenario_name: str
    num_runs: int
    service_volume_mean: float
    service_volume_std: float
    occupancy_rate_mean: float
    occupancy_rate_std: float
    allocation_rate_mean: float
    allocation_rate_std: float
    mean_physical_cruising_time_mean: Optional[float]
    mean_physical_cruising_time_std: Optional[float]
    mean_physical_walking_time_mean: Optional[float]
    mean_physical_walking_time_std: Optional[float]
    mean_system_cruising_time_mean: float
    mean_system_cruising_time_std: float
    mean_system_walking_time_mean: float
    mean_system_walking_time_std: float
    overflow_count_mean: float
    overflow_count_std: float
    conflict_count_mean: float
    conflict_count_std: float
    cumulative_reward_mean: float
    cumulative_reward_std: float


# ============================================================================
# EVALUATION HARNESS FUNCTIONS
# ============================================================================

def evaluate_policy_episode(
    env: CampusParkingSimEnv,
    policy: BasePolicy,
    scenario_id: int = 1,
    deterministic_benchmark: bool = False,
    custom_requests: Optional[List[ParkingRequest]] = None,
    custom_initial_occupancy: Optional[Dict[str, Dict[str, Union[str, int, None]]]] = None,
) -> EpisodeMetrics:
    """Executes a single simulation episode and computes standardized metrics.

    Critical Timing & Metric Rules:
    1. Occupancy sampling:
       Post-decision occupancy for interval [t, t+1) is:
           occupancy(t) = pre_decision_occupancy(t) + (1 if physical allocation occurs at t else 0)
       This strictly counts the full dwell duration of all parked vehicles without undercounting.
    2. Undefined physical means:
       When Service Volume (SV) == 0, physical cruising and walking times are None (never 0.0).
    3. System-level means:
       Use total incoming requests as denominator, incorporating overflow fallback constants
       (480.0s cruising, 336.0s walking).
    4. Initial occupancy:
       Pre-existing occupants at t=0 are excluded from Service Volume, but included in Occupancy Rate.
    """
    obs, info = env.reset(
        scenario_id=scenario_id,
        deterministic_benchmark=deterministic_benchmark,
        custom_requests=custom_requests,
        custom_initial_occupancy=custom_initial_occupancy,
    )
    policy.reset()

    horizon = env.horizon_minutes
    scenario_name = env.active_scenario_config.name if env.active_scenario_config else f"Scenario {scenario_id}"
    total_requests = len(env.requests_by_time)

    physical_cruising_times: List[float] = []
    physical_walking_times: List[float] = []
    occupancy_history: List[int] = []
    cumulative_reward: float = 0.0
    overflow_count: int = 0
    conflict_count: int = 0
    service_volume: int = 0

    terminated = False
    while not terminated:
        # Pre-decision physical occupancy at the current minute
        pre_occ = env.get_total_occupancy()

        mask = env.get_action_mask()
        action = policy.select_action(obs, mask)

        # Step environment
        step_res = env.step(action)
        cumulative_reward += float(step_res.reward)

        step_info = step_res.info
        allocated_stall = step_info.get("allocated_stall")
        is_conflict = bool(step_info.get("conflict", False))

        # Check physical allocation
        if allocated_stall in ALL_PHYSICAL_STALLS:
            service_volume += 1
            physical_cruising_times.append(float(step_info.get("cruising_seconds", 0.0)))
            physical_walking_times.append(float(step_info.get("walking_seconds", 0.0)))
            post_occ = pre_occ + 1
        else:
            post_occ = pre_occ

        if allocated_stall == "OVERFLOW":
            overflow_count += 1
        elif is_conflict:
            conflict_count += 1

        occupancy_history.append(post_occ)
        obs = step_res.observation
        terminated = step_res.terminated

    # Ensure occupancy history spans exactly horizon intervals
    assert len(occupancy_history) == horizon, (
        f"Occupancy history length ({len(occupancy_history)}) must match horizon ({horizon})."
    )

    # Occupancy Rate: time-averaged fraction of physical capacity (5 stalls) utilized
    occupancy_rate = (sum(occupancy_history) / (float(horizon) * 5.0)) * 100.0

    # Allocation Rate: SV / total incoming requests
    allocation_rate = (float(service_volume) / float(total_requests) * 100.0) if total_requests > 0 else 0.0

    # Physical means: None if SV == 0, never 0.0
    if service_volume > 0:
        mean_physical_cruising_time: Optional[float] = float(np.mean(physical_cruising_times))
        mean_physical_walking_time: Optional[float] = float(np.mean(physical_walking_times))
    else:
        mean_physical_cruising_time = None
        mean_physical_walking_time = None

    # System-level means: total trip time across all incoming requests including overflow
    if total_requests > 0:
        total_system_cruise = sum(physical_cruising_times) + (float(overflow_count) * OVERFLOW_CRUISING_SECONDS)
        total_system_walk = sum(physical_walking_times) + (float(overflow_count) * OVERFLOW_WALKING_SECONDS)
        mean_system_cruising_time = float(total_system_cruise / float(total_requests))
        mean_system_walking_time = float(total_system_walk / float(total_requests))
    else:
        mean_system_cruising_time = 0.0
        mean_system_walking_time = 0.0

    return EpisodeMetrics(
        scenario_id=scenario_id,
        scenario_name=scenario_name,
        horizon_minutes=horizon,
        total_requests=total_requests,
        service_volume=service_volume,
        occupancy_rate=occupancy_rate,
        allocation_rate=allocation_rate,
        mean_physical_cruising_time=mean_physical_cruising_time,
        mean_physical_walking_time=mean_physical_walking_time,
        mean_system_cruising_time=mean_system_cruising_time,
        mean_system_walking_time=mean_system_walking_time,
        overflow_count=overflow_count,
        conflict_count=conflict_count,
        cumulative_reward=cumulative_reward,
        occupancy_history=occupancy_history,
    )


def aggregate_episodes(
    policy_name: str,
    episodes: List[EpisodeMetrics]
) -> AggregatedMetrics:
    """Aggregates multiple episode metrics into mean and standard deviation."""
    assert len(episodes) > 0, "Cannot aggregate empty list of episodes."
    first = episodes[0]

    sv_list = [float(e.service_volume) for e in episodes]
    or_list = [float(e.occupancy_rate) for e in episodes]
    ar_list = [float(e.allocation_rate) for e in episodes]
    sys_c_list = [float(e.mean_system_cruising_time) for e in episodes]
    sys_w_list = [float(e.mean_system_walking_time) for e in episodes]
    of_list = [float(e.overflow_count) for e in episodes]
    cf_list = [float(e.conflict_count) for e in episodes]
    rew_list = [float(e.cumulative_reward) for e in episodes]

    # Handle optional physical means (may be None if SV == 0)
    phys_c_valid = [e.mean_physical_cruising_time for e in episodes if e.mean_physical_cruising_time is not None]
    phys_w_valid = [e.mean_physical_walking_time for e in episodes if e.mean_physical_walking_time is not None]

    phys_c_mean = float(np.mean(phys_c_valid)) if phys_c_valid else None
    phys_c_std = float(np.std(phys_c_valid)) if len(phys_c_valid) > 1 else (0.0 if phys_c_valid else None)

    phys_w_mean = float(np.mean(phys_w_valid)) if phys_w_valid else None
    phys_w_std = float(np.std(phys_w_valid)) if len(phys_w_valid) > 1 else (0.0 if phys_w_valid else None)

    return AggregatedMetrics(
        policy_name=policy_name,
        scenario_id=first.scenario_id,
        scenario_name=first.scenario_name,
        num_runs=len(episodes),
        service_volume_mean=float(np.mean(sv_list)),
        service_volume_std=float(np.std(sv_list)),
        occupancy_rate_mean=float(np.mean(or_list)),
        occupancy_rate_std=float(np.std(or_list)),
        allocation_rate_mean=float(np.mean(ar_list)),
        allocation_rate_std=float(np.std(ar_list)),
        mean_physical_cruising_time_mean=phys_c_mean,
        mean_physical_cruising_time_std=phys_c_std,
        mean_physical_walking_time_mean=phys_w_mean,
        mean_physical_walking_time_std=phys_w_std,
        mean_system_cruising_time_mean=float(np.mean(sys_c_list)),
        mean_system_cruising_time_std=float(np.std(sys_c_list)),
        mean_system_walking_time_mean=float(np.mean(sys_w_list)),
        mean_system_walking_time_std=float(np.std(sys_w_list)),
        overflow_count_mean=float(np.mean(of_list)),
        overflow_count_std=float(np.std(of_list)),
        conflict_count_mean=float(np.mean(cf_list)),
        conflict_count_std=float(np.std(cf_list)),
        cumulative_reward_mean=float(np.mean(rew_list)),
        cumulative_reward_std=float(np.std(rew_list)),
    )


def evaluate_policy_across_scenarios(
    env: CampusParkingSimEnv,
    policy_factory: Any,
    policy_name: str,
    is_stochastic: bool = False,
    seeds: Sequence[int] = STANDARD_SIRO_SEEDS,
) -> Dict[str, AggregatedMetrics]:
    """Evaluates a policy across all standard simulation scenarios.

    Scenarios:
    1. Scenario 1 (Morning Influx Wave, 120m, 5 requests, empty lot)
    2. Scenario 2 (Steady Afternoon Turnover, 240m, 15 requests, empty lot)
    3. Scenario 3 Stochastic (Morning Burst, 40m, 5 requests, 60% pre-occupied)
    4. Scenario 3 Benchmark (Capacity-Stress Benchmark, 120m, 8 rush requests, 60% pre-occupied)
    """
    scenarios = [
        ("Scenario 1", 1, False),
        ("Scenario 2", 2, False),
        ("Scenario 3 Stochastic", 3, False),
        ("Scenario 3 Benchmark", 3, True),
    ]

    results: Dict[str, AggregatedMetrics] = {}

    for label, s_id, is_bench in scenarios:
        episodes: List[EpisodeMetrics] = []

        if is_stochastic:
            # Multi-seed evaluation for stochastic policies
            for s in seeds:
                policy_instance = policy_factory(seed=s)
                ep = evaluate_policy_episode(
                    env=env,
                    policy=policy_instance,
                    scenario_id=s_id,
                    deterministic_benchmark=is_bench,
                )
                episodes.append(ep)
        else:
            # Deterministic policy: exactly 1 run per scenario
            policy_instance = policy_factory()
            ep = evaluate_policy_episode(
                env=env,
                policy=policy_instance,
                scenario_id=s_id,
                deterministic_benchmark=is_bench,
            )
            episodes.append(ep)

        results[label] = aggregate_episodes(policy_name, episodes)

    return results


def run_full_benchmark_suite(
    env: Optional[CampusParkingSimEnv] = None,
    siro_seeds: Sequence[int] = STANDARD_SIRO_SEEDS,
) -> Dict[str, Dict[str, AggregatedMetrics]]:
    """Runs all 4 baseline policies across all 4 scenarios.

    Returns:
        Dict[policy_name, Dict[scenario_label, AggregatedMetrics]]
    """
    simulation_env = env if env is not None else CampusParkingSimEnv()

    policies = [
        ("Fixed-Priority Fill", lambda: FixedPriorityFillPolicy(), False),
        ("SIRO-Zone", lambda seed=None: SIROZonePolicy(seed=seed), True),
        ("SIRO-Stall", lambda seed=None: SIROStallPolicy(seed=seed), True),
        ("Nearest-Available", lambda: CongestionAwareNearestZonePolicy(), False),
    ]

    benchmark_results: Dict[str, Dict[str, AggregatedMetrics]] = {}

    for pol_name, factory, is_stoch in policies:
        benchmark_results[pol_name] = evaluate_policy_across_scenarios(
            env=simulation_env,
            policy_factory=factory,
            policy_name=pol_name,
            is_stochastic=is_stoch,
            seeds=siro_seeds,
        )

    return benchmark_results


# ============================================================================
# REPORTING FORMATTER
# ============================================================================

def format_metric_value(
    mean_val: Optional[float],
    std_val: Optional[float] = None,
    is_integer: bool = False,
    is_percent: bool = False
) -> str:
    """Formats a metric value for benchmark tables, strictly mapping None to 'N/A'."""
    if mean_val is None:
        return "N/A"
    if is_percent:
        if std_val is not None and std_val > 1e-4:
            return f"{mean_val:.2f}% ± {std_val:.2f}%"
        return f"{mean_val:.2f}%"
    if is_integer:
        if std_val is not None and std_val > 1e-4:
            return f"{mean_val:.1f} ± {std_val:.1f}"
        return f"{int(round(mean_val))}"
    if std_val is not None and std_val > 1e-4:
        return f"{mean_val:.2f} ± {std_val:.2f}"
    return f"{mean_val:.2f}"


def generate_benchmark_markdown_table(
    suite_results: Dict[str, Dict[str, AggregatedMetrics]],
    scenario_label: str
) -> str:
    """Generates a standardized Markdown comparison table for a given scenario."""
    lines = [
        f"### Performance Comparison: {scenario_label}",
        "",
        "| Policy | Service Vol (SV) | Occupancy Rate | Allocation Rate | Mean Phys Cruise (s) | Mean Phys Walk (s) | Overflow | Conflicts | Cum. Reward |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for pol_name, sc_dict in suite_results.items():
        if scenario_label not in sc_dict:
            continue
        m = sc_dict[scenario_label]

        sv_str = format_metric_value(m.service_volume_mean, m.service_volume_std, is_integer=True)
        or_str = format_metric_value(m.occupancy_rate_mean, m.occupancy_rate_std, is_percent=True)
        ar_str = format_metric_value(m.allocation_rate_mean, m.allocation_rate_std, is_percent=True)
        c_str = format_metric_value(m.mean_physical_cruising_time_mean, m.mean_physical_cruising_time_std)
        w_str = format_metric_value(m.mean_physical_walking_time_mean, m.mean_physical_walking_time_std)
        of_str = format_metric_value(m.overflow_count_mean, m.overflow_count_std, is_integer=True)
        cf_str = format_metric_value(m.conflict_count_mean, m.conflict_count_std, is_integer=True)
        r_str = format_metric_value(m.cumulative_reward_mean, m.cumulative_reward_std)

        lines.append(f"| **{pol_name}** | {sv_str} | {or_str} | {ar_str} | {c_str} | {w_str} | {of_str} | {cf_str} | {r_str} |")

    return "\n".join(lines)

