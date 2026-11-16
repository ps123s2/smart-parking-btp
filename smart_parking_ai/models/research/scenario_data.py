"""
Scenario Data and Stochastic Generation Module for Smart Parking BTP Research.

Stage 3A.3: Clean, canonical implementation of stochastic arrival/dwell processes,
random number generators, and immutable benchmark fixtures for Scenarios 1, 2, and 3.

Environment: Isolated Python 3.11.18 ML environment.
Dependencies: numpy only. Zero imports of Flask, Firebase, Expo, or production code.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union
import numpy as np


@dataclass(frozen=True)
class ParkingRequest:
    """Represents an incoming parking search request."""
    req_id: str
    arrival_time: int       # Discrete simulation minute
    dwell_time: int         # Duration of parking stay in minutes
    target_zone: Optional[int] = None  # None indicates platform decides zone allocation


@dataclass(frozen=True)
class ScenarioConfig:
    """Configuration metadata for a simulation scenario."""
    scenario_id: int
    name: str
    horizon_minutes: int
    arrival_process: str
    underlying_dwell_mean: float   # Underlying normal mean (truncated mean differs)
    underlying_dwell_std: float    # Underlying normal std
    dwell_bounds: Tuple[float, float]
    arrival_seed: int
    dwell_seed: int


# ============================================================================
# APPROVED IMMUTABLE BENCHMARK FIXTURES
# ============================================================================

# Scenario 1 Approved Fixture (Seed 42 / 1042 under PCG64)
# Horizon: 120 minutes. Underlying Normal(45, 15^2) truncated to [15, 90].
SCENARIO_1_FIXTURE_REQUESTS: Tuple[ParkingRequest, ...] = (
    ParkingRequest(req_id="Sc1-Req-01", arrival_time=17, dwell_time=75),
    ParkingRequest(req_id="Sc1-Req-02", arrival_time=27, dwell_time=29),
    ParkingRequest(req_id="Sc1-Req-03", arrival_time=28, dwell_time=63),
    ParkingRequest(req_id="Sc1-Req-04", arrival_time=36, dwell_time=36),
    ParkingRequest(req_id="Sc1-Req-05", arrival_time=51, dwell_time=58),
)

# Scenario 2 Approved Fixture (Seed 101 / 1101 under PCG64)
# Horizon: 240 minutes. Constant arrival intensity lambda = 0.08.
# Underlying Normal(45, 15^2) truncated to [15, 90].
SCENARIO_2_FIXTURE_REQUESTS: Tuple[ParkingRequest, ...] = (
    ParkingRequest(req_id="Sc2-Req-01", arrival_time=13, dwell_time=48),
    ParkingRequest(req_id="Sc2-Req-02", arrival_time=22, dwell_time=27),
    ParkingRequest(req_id="Sc2-Req-03", arrival_time=54, dwell_time=30),
    ParkingRequest(req_id="Sc2-Req-04", arrival_time=57, dwell_time=40),
    ParkingRequest(req_id="Sc2-Req-05", arrival_time=61, dwell_time=68),
    ParkingRequest(req_id="Sc2-Req-06", arrival_time=62, dwell_time=60),
    ParkingRequest(req_id="Sc2-Req-07", arrival_time=92, dwell_time=31),
    ParkingRequest(req_id="Sc2-Req-08", arrival_time=109, dwell_time=30),
    ParkingRequest(req_id="Sc2-Req-09", arrival_time=116, dwell_time=48),
    ParkingRequest(req_id="Sc2-Req-10", arrival_time=134, dwell_time=45),
    ParkingRequest(req_id="Sc2-Req-11", arrival_time=186, dwell_time=55),
    ParkingRequest(req_id="Sc2-Req-12", arrival_time=214, dwell_time=54),
    ParkingRequest(req_id="Sc2-Req-13", arrival_time=227, dwell_time=34),
    ParkingRequest(req_id="Sc2-Req-14", arrival_time=237, dwell_time=42),
    ParkingRequest(req_id="Sc2-Req-15", arrival_time=239, dwell_time=53),
)

# Scenario 3 Stochastic Fixture (Seed 202 / 1202 under PCG64)
# Horizon: 40 discrete steps (t = 0..39). Burst lambda = 0.20 req/min.
# Underlying Normal(60, 20^2) truncated to [20, 120].
SCENARIO_3_STOCHASTIC_FIXTURE_REQUESTS: Tuple[ParkingRequest, ...] = (
    ParkingRequest(req_id="Sc3-Stoch-01", arrival_time=16, dwell_time=72),
    ParkingRequest(req_id="Sc3-Stoch-02", arrival_time=20, dwell_time=40),
    ParkingRequest(req_id="Sc3-Stoch-03", arrival_time=24, dwell_time=78),
    ParkingRequest(req_id="Sc3-Stoch-04", arrival_time=32, dwell_time=95),
    ParkingRequest(req_id="Sc3-Stoch-05", arrival_time=38, dwell_time=70),
)

# Scenario 3 Deterministic Capacity-Stress Benchmark Fixture (Separate from stochastic fixture)
# Pre-occupied lot: 3 occupied (A1, A2, B1), 2 vacant (A3, B2).
# 8 incoming rush requests causing immediate lot saturation at minute 6.
SCENARIO_3_CAPACITY_STRESS_FIXTURE_REQUESTS: Tuple[ParkingRequest, ...] = (
    ParkingRequest(req_id="Sc3-Stress-01", arrival_time=2, dwell_time=45),
    ParkingRequest(req_id="Sc3-Stress-02", arrival_time=6, dwell_time=50),
    ParkingRequest(req_id="Sc3-Stress-03", arrival_time=11, dwell_time=40),
    ParkingRequest(req_id="Sc3-Stress-04", arrival_time=14, dwell_time=60),
    ParkingRequest(req_id="Sc3-Stress-05", arrival_time=21, dwell_time=35),
    ParkingRequest(req_id="Sc3-Stress-06", arrival_time=27, dwell_time=45),
    ParkingRequest(req_id="Sc3-Stress-07", arrival_time=33, dwell_time=55),
    ParkingRequest(req_id="Sc3-Stress-08", arrival_time=38, dwell_time=30),
)

# Master immutable template for Scenario 3 Initial Occupancy:
# Stalls A1, A2, and B1 pre-occupied at t=0 (60% pre-occupancy).
# Callers must receive isolated deep copies to prevent in-place mutation.
SCENARIO_3_CAPACITY_STRESS_INITIAL_OCCUPANCY: Dict[str, Dict[str, Union[str, int, None]]] = {
    "A1": {"zone": 0, "remaining_dwell": 25, "release_time": 25, "occupant": "Init-Occupant-1"},
    "A2": {"zone": 0, "remaining_dwell": 40, "release_time": 40, "occupant": "Init-Occupant-2"},
    "A3": {"zone": 0, "remaining_dwell": None, "release_time": None, "occupant": None},
    "B1": {"zone": 1, "remaining_dwell": 30, "release_time": 30, "occupant": "Init-Occupant-3"},
    "B2": {"zone": 1, "remaining_dwell": None, "release_time": None, "occupant": None},
}


def _get_isolated_initial_occupancy(
    scenario_id: int
) -> Dict[str, Dict[str, Union[str, int, None]]]:
    """Returns a completely isolated, deep-copied initial occupancy dictionary.

    - Scenario 1: Empty initial occupancy (all 5 physical stalls vacant).
    - Scenario 2: Empty initial occupancy (all 5 physical stalls vacant).
    - Scenario 3 (both stochastic & benchmark): Stalls A1, A2, and B1 pre-occupied.
    """
    if scenario_id == 3:
        return {
            sid: dict(data)
            for sid, data in SCENARIO_3_CAPACITY_STRESS_INITIAL_OCCUPANCY.items()
        }
    return {
        "A1": {"zone": 0, "remaining_dwell": None, "release_time": None, "occupant": None},
        "A2": {"zone": 0, "remaining_dwell": None, "release_time": None, "occupant": None},
        "A3": {"zone": 0, "remaining_dwell": None, "release_time": None, "occupant": None},
        "B1": {"zone": 1, "remaining_dwell": None, "release_time": None, "occupant": None},
        "B2": {"zone": 1, "remaining_dwell": None, "release_time": None, "occupant": None},
    }


# ============================================================================
# MATHEMATICAL INTENSITY FUNCTIONS
# ============================================================================

def lambda_scenario_1(t: float) -> float:
    """Non-homogeneous Poisson intensity function for Scenario 1.

    Base rate 0.02 req/min with a Gaussian peak centered at t = 30.0 min (sigma = 15.0).
    Continuous integral over [0, 120] is 7.912 requests.
    Discrete Bernoulli expectation over 120 steps is 7.507 requests.
    """
    return 0.02 + 0.15 * float(np.exp(-((t - 30.0) ** 2) / (2.0 * (15.0 ** 2))))


def lambda_scenario_2(t: float) -> float:
    """Constant Poisson arrival intensity for Scenario 2.

    lambda = 0.08 requests/min over [0, 240] min.
    Continuous expectation: 19.2 requests.
    Discrete Bernoulli expectation: 18.452 requests.
    """
    return 0.08


def lambda_scenario_3(t: float) -> float:
    """Piecewise burst arrival intensity for Scenario 3.

    lambda = 0.20 req/min for t in [0, 40) (40-step burst window).
    lambda = 0.00 req/min for t >= 40.
    Continuous expectation over [0, 40): 8.000 requests.
    Discrete Bernoulli expectation over [0, 39]: 7.251 requests.
    """
    return 0.20 if (0.0 <= t < 40.0) else 0.0


def step_arrival_probability(lambda_rate: float) -> float:
    """Computes discrete 1-minute step arrival probability p = 1 - exp(-lambda)."""
    return 1.0 - float(np.exp(-lambda_rate))


# ============================================================================
# STOCHASTIC SAMPLING GENERATORS (PCG64)
# ============================================================================

def sample_truncated_normal(
    rng: np.random.Generator,
    mu: float,
    sigma: float,
    lower: float,
    upper: float
) -> int:
    """Samples from a normal distribution truncated to [lower, upper] via rejection sampling.

    Note: mu and sigma represent the underlying Normal parameters.
    Due to truncation, the effective sample mean differs slightly from mu.
    """
    while True:
        draw = rng.normal(mu, sigma)
        if lower <= draw <= upper:
            return int(round(draw))


def generate_scenario_requests(
    scenario_id: int,
    arrival_seed: Optional[int] = None,
    dwell_seed: Optional[int] = None
) -> List[ParkingRequest]:
    """Generates a dynamic list of parking requests for a scenario.

    Uses decoupled PCG64 random streams:
    - arrival_rng for arrival occurrence draws.
    - dwell_rng for stay duration draws.

    When called with default scenario seeds, outputs bit-for-bit match the approved fixtures.
    """
    if scenario_id == 1:
        a_seed = 42 if arrival_seed is None else arrival_seed
        d_seed = 1042 if dwell_seed is None else dwell_seed
        horizon = 120
        intensity_fn = lambda_scenario_1
        mu_dwell, sigma_dwell = 45.0, 15.0
        bounds = (15.0, 90.0)
        prefix = "Sc1-Dyn"
    elif scenario_id == 2:
        a_seed = 101 if arrival_seed is None else arrival_seed
        d_seed = 1101 if dwell_seed is None else dwell_seed
        horizon = 240
        intensity_fn = lambda_scenario_2
        mu_dwell, sigma_dwell = 45.0, 15.0
        bounds = (15.0, 90.0)
        prefix = "Sc2-Dyn"
    elif scenario_id == 3:
        a_seed = 202 if arrival_seed is None else arrival_seed
        d_seed = 1202 if dwell_seed is None else dwell_seed
        horizon = 40  # 40 discrete steps: t in [0, 39]
        intensity_fn = lambda_scenario_3
        mu_dwell, sigma_dwell = 60.0, 20.0
        bounds = (20.0, 120.0)  # Preserved Scenario 3 specific commuter stay bounds
        prefix = "Sc3-Dyn"
    else:
        raise ValueError(f"Unknown scenario_id: {scenario_id}. Choose 1, 2, or 3.")

    arrival_rng = np.random.default_rng(a_seed)
    dwell_rng = np.random.default_rng(d_seed)

    requests: List[ParkingRequest] = []
    counter = 1

    for t in range(horizon):
        lam = intensity_fn(t)
        if lam <= 0.0:
            continue
        p = step_arrival_probability(lam)
        if arrival_rng.random() < p:
            dwell = sample_truncated_normal(
                dwell_rng, mu_dwell, sigma_dwell, bounds[0], bounds[1]
            )
            req = ParkingRequest(
                req_id=f"{prefix}-{counter:02d}",
                arrival_time=t,
                dwell_time=dwell
            )
            requests.append(req)
            counter += 1

    return requests


def get_scenario(
    scenario_id: int,
    deterministic_benchmark: bool = False
) -> Tuple[ScenarioConfig, List[ParkingRequest], Dict[str, Dict[str, Union[str, int, None]]]]:
    """Loads scenario configuration, request schedule, and initial occupancy state.

    Args:
        scenario_id: 1, 2, or 3.
        deterministic_benchmark: For Scenario 3, selects the 8-arrival capacity
                                 stress benchmark fixture.

    Returns:
        (config, requests, initial_occupancy_dict)
    """
    initial_occ = _get_isolated_initial_occupancy(scenario_id)

    if scenario_id == 1:
        config = ScenarioConfig(
            scenario_id=1,
            name="Morning Influx Wave",
            horizon_minutes=120,
            arrival_process="Non-homogeneous Poisson (peak at t=30m)",
            underlying_dwell_mean=45.0,
            underlying_dwell_std=15.0,
            dwell_bounds=(15.0, 90.0),
            arrival_seed=42,
            dwell_seed=1042,
        )
        return config, list(SCENARIO_1_FIXTURE_REQUESTS), initial_occ

    elif scenario_id == 2:
        config = ScenarioConfig(
            scenario_id=2,
            name="Steady Afternoon Turnover",
            horizon_minutes=240,
            arrival_process="Homogeneous Poisson (lambda=0.08)",
            underlying_dwell_mean=45.0,
            underlying_dwell_std=15.0,
            dwell_bounds=(15.0, 90.0),
            arrival_seed=101,
            dwell_seed=1101,
        )
        return config, list(SCENARIO_2_FIXTURE_REQUESTS), initial_occ

    elif scenario_id == 3:
        if deterministic_benchmark:
            config = ScenarioConfig(
                scenario_id=3,
                name="Morning Rush Capacity-Stress Benchmark (Deterministic 8-Arrival)",
                horizon_minutes=120,
                arrival_process="Deterministic morning peak burst (8 arrivals)",
                underlying_dwell_mean=60.0,
                underlying_dwell_std=20.0,
                dwell_bounds=(20.0, 120.0),
                arrival_seed=202,
                dwell_seed=1202,
            )
            return config, list(SCENARIO_3_CAPACITY_STRESS_FIXTURE_REQUESTS), initial_occ
        else:
            config = ScenarioConfig(
                scenario_id=3,
                name="Morning Capacity Stress (Stochastic 40-step Burst)",
                horizon_minutes=40,
                arrival_process="Piecewise Poisson burst (lambda=0.20, t in [0, 39])",
                underlying_dwell_mean=60.0,
                underlying_dwell_std=20.0,
                dwell_bounds=(20.0, 120.0),
                arrival_seed=202,
                dwell_seed=1202,
            )
            return config, list(SCENARIO_3_STOCHASTIC_FIXTURE_REQUESTS), initial_occ

    else:
        raise ValueError(f"Unknown scenario_id: {scenario_id}. Choose 1, 2, or 3.")
