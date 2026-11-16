"""
Discrete-Event Simulation Environment for Smart Parking BTP Research.

Stage 3A.3: Clean, canonical discrete-event simulation environment modeling:
- A single campus parking lot with 5 physical stalls (Zone A: 3 stalls, Zone B: 2 stalls).
- Abstract external platform fallback (Overflow, Action 2).
- Reciprocal occupancy-based delay approximation with 0.95 saturation cap.
- Approved campus reward specification (evaluated strictly in seconds).
- Strict intra-step event ordering (departures processed before arrivals at equal timestamps).
- Unconditional action validation at the beginning of step().
- Capacity-aware action masking.
- Validation preventing duplicate arrival timestamps to eliminate silent request drops.
- Comprehensive custom initial occupancy validation.

Dependencies: numpy only. Zero dependencies on Flask, Firebase, Expo, or production code.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any, Union
import numpy as np

from .scenario_data import ParkingRequest, ScenarioConfig, get_scenario


# ============================================================================
# PHYSICAL & SIMULATION PARAMETERS (SIMULATION ASSUMPTIONS)
# ============================================================================

# Physical stall inventory (Single campus lot, 5 physical stalls)
ZONE_A_STALLS: Tuple[str, ...] = ("A1", "A2", "A3")
ZONE_B_STALLS: Tuple[str, ...] = ("B1", "B2")
ALL_PHYSICAL_STALLS: Tuple[str, ...] = ZONE_A_STALLS + ZONE_B_STALLS

ZONE_CAPACITIES: Dict[int, int] = {
    0: 3,  # Zone A (Row A): Capacity 3
    1: 2,  # Zone B (Row B): Capacity 2
}

# Free-flow cruising times from single entrance to zone centroid (seconds)
# Base assumptions: Zone A = 1.50 min (90s), Zone B = 2.00 min (120s)
BASE_CRUISING_SECONDS: Dict[int, float] = {
    0: 90.0,   # Zone A: 1.50 min * 60 s/min
    1: 120.0,  # Zone B: 2.00 min * 60 s/min
}

# Pedestrian walking times from zone centroid to destination (seconds)
# Base assumptions: Zone A = 1.00 min (60s), Zone B = 1.50 min (90s)
WALKING_SECONDS: Dict[int, float] = {
    0: 60.0,   # Zone A: 1.00 min * 60 s/min
    1: 90.0,   # Zone B: 1.50 min * 60 s/min
}

# Abstract External Fallback (Overflow, Action 2) Parameters:
# Clearly identified as simulation modeling assumptions, NOT measured campus facts:
# Overflow represents off-platform street curb or external unmanaged parking.
# Capacity is infinite (C = inf); does not occupy physical campus stalls.
OVERFLOW_CRUISING_SECONDS: float = 480.0  # 8.00 min * 60 s/min
OVERFLOW_WALKING_SECONDS: float = 336.0   # 5.60 min * 60 s/min (450m at 1.34 m/s)

# Approved Campus Reward Constants
REWARD_BASE: float = 10.0
REWARD_LAMBDA_CRUISE: float = 0.02   # s^-1 (Applied to cruising time in seconds)
REWARD_MU_WALK: float = 0.01         # s^-1 (Applied to walking time in seconds)
REWARD_MIN_SUCCESS: float = 1.0      # Guaranteed lower-bound floor for successful allocation
REWARD_OVERFLOW: float = 0.0         # Neutral reward for routing to abstract fallback
REWARD_CONFLICT: float = -20.0       # Penalty for attempting physical allocation to full zone

# Theoretical Reward Specification Constant:
# In the discrete single-decision step model of Stage 3A, every incoming arrival is resolved
# immediately as Physical Success (+1.0..+10.0), Overflow Fallback (0.0), or Full-Zone Conflict (-20.0).
# The -5.0 penalty is defined in the research specification (Stage 2.3) for multi-step search queue
# timeout expiration; it is not invoked in this single-decision step environment.
REWARD_TIMEOUT_THEORETICAL: float = -5.0

# Numerical Safety Cap for Reciprocal Delay Approximation
OCCUPANCY_RATIO_CAP: float = 0.95


@dataclass
class StallState:
    """Represents the real-time physical state of a parking stall."""
    stall_id: str
    zone_id: int
    is_occupied: bool = False
    occupant_id: Optional[str] = None
    departure_time: Optional[int] = None  # Discrete simulation minute


@dataclass(frozen=True)
class StepResult:
    """Return tuple from a simulation step."""
    observation: np.ndarray
    reward: float
    terminated: bool
    truncated: bool
    info: Dict[str, Any]


class CampusParkingSimEnv:
    """Offline Discrete-Event Simulation Environment for Campus Parking Search Navigation.

    Action Space:
        0: Allocate to Zone A (Row A: A1, A2, A3)
        1: Allocate to Zone B (Row B: B1, B2)
        2: Route to Abstract Overflow Fallback (External, C = inf)

    Observation Space (Standardized Vector of 18 floats):
        [0..4]: Stall occupancy flags (A1, A2, A3, B1, B2) in {0.0, 1.0} (5 elements)
        [5..9]: Stall remaining dwell times in minutes normalized by 120.0 (5 elements)
        [10..11]: Zone occupancy ratios: Zone A / 3.0, Zone B / 2.0 (2 elements)
        [12]: Current simulation progress: current_step / horizon (1 element)
        [13]: Has pending arrival at current step in {0.0, 1.0} (1 element)
        [14]: Pending arrival dwell time in minutes normalized by 120.0 (1 element)
        [15..17]: Action mask [M_0, M_1, M_2] in {0.0, 1.0} (3 elements)
        Total vector dimension: 5 + 5 + 2 + 1 + 1 + 1 + 3 = 18 elements.
    """

    def __init__(self) -> None:
        self.stalls: Dict[str, StallState] = {
            sid: StallState(stall_id=sid, zone_id=0 if sid.startswith("A") else 1)
            for sid in ALL_PHYSICAL_STALLS
        }
        self.current_step: int = 0
        self.horizon_minutes: int = 120
        self.requests_by_time: Dict[int, ParkingRequest] = {}
        self.active_request: Optional[ParkingRequest] = None
        self.active_scenario_config: Optional[ScenarioConfig] = None
        self.total_arrivals_handled: int = 0
        self.total_physical_allocations: int = 0
        self.total_overflow_allocations: int = 0
        self.total_conflicts: int = 0

    # ------------------------------------------------------------------------
    # State Inspection & Masking
    # ------------------------------------------------------------------------

    def get_zone_occupancy(self, zone_id: int) -> int:
        """Returns the number of physically occupied stalls in the specified zone."""
        prefix = "A" if zone_id == 0 else "B"
        return sum(1 for sid, s in self.stalls.items() if sid.startswith(prefix) and s.is_occupied)

    def get_total_occupancy(self) -> int:
        """Returns the total number of occupied stalls across the entire campus lot (0..5)."""
        return sum(1 for s in self.stalls.values() if s.is_occupied)

    def get_action_mask(self) -> np.ndarray:
        """Constructs the valid action mask [M_0, M_1, M_2].

        Zone A (0) is masked out (0) if all 3 stalls are occupied.
        Zone B (1) is masked out (0) if all 2 stalls are occupied.
        Overflow (2) is ALWAYS unmasked (1), even when all physical stalls are full.
        """
        occ_a = self.get_zone_occupancy(0)
        occ_b = self.get_zone_occupancy(1)
        mask = np.zeros(3, dtype=np.int8)
        mask[0] = 1 if (occ_a < ZONE_CAPACITIES[0]) else 0
        mask[1] = 1 if (occ_b < ZONE_CAPACITIES[1]) else 0
        mask[2] = 1  # Abstract overflow is always unmasked
        return mask

    # ------------------------------------------------------------------------
    # Delay & Reward Calculations
    # ------------------------------------------------------------------------

    def calculate_reciprocal_delay_seconds(self, zone_id: int) -> float:
        """Calculates cruising time using the reciprocal occupancy-based delay approximation.

        Formula:
            eta_p = e_p * (1.0 - min(delta_p / sigma_p, 0.95))^(-1)

        The occupancy ratio is capped at 0.95 to avoid division by zero while
        preserving finite numerical scaling at full capacity.
        """
        base_e = BASE_CRUISING_SECONDS[zone_id]
        capacity = float(ZONE_CAPACITIES[zone_id])
        occ = float(self.get_zone_occupancy(zone_id))
        ratio = occ / capacity
        capped_ratio = min(ratio, OCCUPANCY_RATIO_CAP)
        cruising_seconds = base_e / (1.0 - capped_ratio)
        return float(cruising_seconds)

    @staticmethod
    def compute_campus_reward(cruise_seconds: float, walk_seconds: float) -> float:
        """Computes the approved campus step reward for a successful physical allocation.

        Formula:
            reward = max(10.0 - 0.02 * cruise_seconds - 0.01 * walk_seconds, 1.0)
        All time inputs must be in seconds.
        """
        penalty_cruise = REWARD_LAMBDA_CRUISE * cruise_seconds
        penalty_walk = REWARD_MU_WALK * walk_seconds
        raw_reward = REWARD_BASE - penalty_cruise - penalty_walk
        return float(max(raw_reward, REWARD_MIN_SUCCESS))

    # ------------------------------------------------------------------------
    # Environment Lifecycle (Reset & Step)
    # ------------------------------------------------------------------------

    def _validate_and_apply_initial_occupancy(
        self,
        occ_source: Dict[str, Dict[str, Union[str, int, None]]]
    ) -> None:
        """Validates and applies initial occupancy state to physical stalls.

        Raises:
            ValueError: If stall ID is invalid, zone mismatch occurs, release time
                        is negative, remaining dwell is missing/negative/invalid/mismatched,
                        or contradictory occupancy data is provided.
        """
        for sid in occ_source:
            if sid not in ALL_PHYSICAL_STALLS:
                raise ValueError(
                    f"Invalid stall ID '{sid}' in initial occupancy. Must be one of {ALL_PHYSICAL_STALLS}."
                )

        for sid in ALL_PHYSICAL_STALLS:
            if sid not in occ_source:
                self.stalls[sid].is_occupied = False
                self.stalls[sid].occupant_id = None
                self.stalls[sid].departure_time = None
                continue

            state = occ_source[sid]
            expected_zone = 0 if sid.startswith("A") else 1
            zone_val = state.get("zone")
            if zone_val is not None and zone_val != expected_zone:
                raise ValueError(
                    f"Zone ID mismatch for stall {sid}: expected {expected_zone}, got {zone_val}."
                )

            release_time = state.get("release_time")
            occupant = state.get("occupant")
            remaining_dwell = state.get("remaining_dwell")

            has_release = (release_time is not None)
            has_occupant = (occupant is not None)

            if has_release != has_occupant:
                raise ValueError(
                    f"Contradictory occupancy data for stall {sid}: release_time is {release_time!r} "
                    f"while occupant is {occupant!r}. Occupied stalls must specify both an occupant "
                    f"identifier and release time, while vacant stalls must specify neither."
                )

            if has_release:
                if not isinstance(release_time, (int, np.integer)) or isinstance(release_time, bool):
                    raise ValueError(
                        f"Release time for stall {sid} must be an integer, got {type(release_time).__name__}: {release_time!r}."
                    )
                if int(release_time) < 0:
                    raise ValueError(
                        f"Release time for stall {sid} cannot be negative: got {release_time}."
                    )
                if not isinstance(occupant, str) or not occupant.strip():
                    raise ValueError(
                        f"Occupant identifier for occupied stall {sid} must be a non-empty string, got {occupant!r}."
                    )
                if remaining_dwell is None:
                    raise ValueError(
                        f"Missing remaining_dwell for occupied stall {sid}. "
                        f"Occupied stalls must specify remaining_dwell."
                    )
                if not isinstance(remaining_dwell, (int, np.integer)) or isinstance(remaining_dwell, bool):
                    raise ValueError(
                        f"Remaining dwell for occupied stall {sid} must be an integer, got {type(remaining_dwell).__name__}: {remaining_dwell!r}."
                    )
                if int(remaining_dwell) < 0:
                    raise ValueError(
                        f"Remaining dwell for occupied stall {sid} cannot be negative: got {remaining_dwell}."
                    )
                if int(remaining_dwell) != int(release_time):
                    raise ValueError(
                        f"Contradictory dwell timing for occupied stall {sid}: remaining_dwell ({remaining_dwell}) "
                        f"must equal release_time ({release_time}) at initial simulation time t=0."
                    )

                self.stalls[sid].is_occupied = True
                self.stalls[sid].occupant_id = str(occupant)
                self.stalls[sid].departure_time = int(release_time)
            else:
                if remaining_dwell is not None:
                    raise ValueError(
                        f"Contradictory occupancy for vacant stall {sid}: remaining_dwell is {remaining_dwell!r} "
                        f"but stall has no occupant."
                    )
                self.stalls[sid].is_occupied = False
                self.stalls[sid].occupant_id = None
                self.stalls[sid].departure_time = None

    def reset(
        self,
        scenario_id: int = 1,
        deterministic_benchmark: bool = False,
        custom_requests: Optional[List[ParkingRequest]] = None,
        custom_initial_occupancy: Optional[Dict[str, Dict[str, Union[str, int, None]]]] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Resets the environment to the beginning of a specified scenario.

        Args:
            scenario_id: 1, 2, or 3.
            deterministic_benchmark: For Scenario 3, selects the 8-arrival stress benchmark.
            custom_requests: Optional custom list of requests (for unit testing).
            custom_initial_occupancy: Optional custom pre-occupancy dictionary.

        Returns:
            (initial_observation, info_dict)
        """
        config, reqs, initial_occ = get_scenario(
            scenario_id, deterministic_benchmark=deterministic_benchmark
        )
        self.active_scenario_config = config
        self.horizon_minutes = config.horizon_minutes
        self.current_step = 0
        self.total_arrivals_handled = 0
        self.total_physical_allocations = 0
        self.total_overflow_allocations = 0
        self.total_conflicts = 0

        # Apply and validate initial occupancy
        occ_source = custom_initial_occupancy if custom_initial_occupancy is not None else initial_occ
        self._validate_and_apply_initial_occupancy(occ_source)

        # Index requests by arrival minute and strictly validate uniqueness BEFORE insertion
        req_list = custom_requests if custom_requests is not None else reqs
        self.requests_by_time = {}
        for req in req_list:
            t = int(req.arrival_time)
            if t in self.requests_by_time:
                existing_req = self.requests_by_time[t]
                raise ValueError(
                    f"Duplicate arrival timestamp t={t} detected between request "
                    f"'{existing_req.req_id}' and '{req.req_id}'. "
                    f"In this discrete 1-minute step simulation, at most one arrival "
                    f"is permitted per simulation minute. Duplicate timestamps are not permitted."
                )
            self.requests_by_time[t] = req

        # Process any initial departures at minute 0 (departures before arrivals)
        self._process_departures(self.current_step)
        self._load_active_request()

        obs = self.get_observation()
        info = {
            "scenario": config.name,
            "horizon": self.horizon_minutes,
            "initial_occupancy": self.get_total_occupancy(),
            "action_mask": self.get_action_mask().tolist(),
        }
        return obs, info

    def _process_departures(self, current_minute: int) -> List[str]:
        """Clears all stalls whose departure time equals or has passed the current minute.

        Guarantees that departures are processed BEFORE new arrivals at the same minute.
        Returns a list of stall IDs that were vacated.
        """
        vacated: List[str] = []
        # Deterministic ordering by stall ID: A1, A2, A3, B1, B2
        for sid in ALL_PHYSICAL_STALLS:
            stall = self.stalls[sid]
            if stall.is_occupied and stall.departure_time is not None:
                if stall.departure_time <= current_minute:
                    stall.is_occupied = False
                    stall.occupant_id = None
                    stall.departure_time = None
                    vacated.append(sid)
        return vacated

    def _load_active_request(self) -> None:
        """Loads pending arrival for the current simulation minute, if any."""
        self.active_request = self.requests_by_time.get(self.current_step, None)

    def step(self, action: int) -> StepResult:
        """Advances the simulation by processing the chosen action for the active request.

        Actions are validated unconditionally: only integers 0, 1, or 2 are accepted,
        regardless of whether a request is pending.

        Args:
            action: 0 (Zone A), 1 (Zone B), or 2 (Abstract Overflow Fallback).

        Returns:
            StepResult: (observation, reward, terminated, truncated, info)
        """
        # Unconditional Action Validation
        if not isinstance(action, (int, np.integer)) or isinstance(action, bool):
            raise ValueError(
                f"Action must be an integer (0, 1, or 2), got {type(action).__name__}: {action!r}"
            )
        action = int(action)
        if action not in (0, 1, 2):
            raise ValueError(f"Invalid action {action}. Must be 0, 1, or 2.")

        reward = 0.0
        info: Dict[str, Any] = {
            "step": self.current_step,
            "has_arrival": (self.active_request is not None),
            "allocated_stall": None,
            "action_taken": action,
            "conflict": False,
        }

        # --------------------------------------------------------------------
        # Action Execution on Active Arrival
        # --------------------------------------------------------------------
        if self.active_request is not None:
            req = self.active_request
            self.total_arrivals_handled += 1
            info["request_id"] = req.req_id

            mask = self.get_action_mask()

            if action == 2:
                # Abstract External Overflow Fallback
                self.total_overflow_allocations += 1
                reward = REWARD_OVERFLOW  # Neutral reward = 0.0
                info["allocated_stall"] = "OVERFLOW"
                info["cruising_seconds"] = OVERFLOW_CRUISING_SECONDS
                info["walking_seconds"] = OVERFLOW_WALKING_SECONDS

            elif action in (0, 1):
                # Physical Zone Allocation
                zone_id = action
                if mask[zone_id] == 1:
                    # Valid allocation: select lowest alphanumeric vacant stall
                    prefix = "A" if zone_id == 0 else "B"
                    candidate_stalls = [
                        sid for sid in ALL_PHYSICAL_STALLS
                        if sid.startswith(prefix) and (not self.stalls[sid].is_occupied)
                    ]
                    assert len(candidate_stalls) > 0, (
                        f"Mask reported Zone {zone_id} unmasked, but no vacant stalls found!"
                    )
                    selected_stall = sorted(candidate_stalls)[0]

                    # Cruising delay is computed based on zone congestion prior to allocation
                    cruise_sec = self.calculate_reciprocal_delay_seconds(zone_id)
                    walk_sec = WALKING_SECONDS[zone_id]

                    # Occupy stall
                    self.stalls[selected_stall].is_occupied = True
                    self.stalls[selected_stall].occupant_id = req.req_id
                    self.stalls[selected_stall].departure_time = self.current_step + req.dwell_time

                    self.total_physical_allocations += 1
                    reward = self.compute_campus_reward(cruise_sec, walk_sec)
                    info["allocated_stall"] = selected_stall
                    info["cruising_seconds"] = cruise_sec
                    info["walking_seconds"] = walk_sec
                    info["departure_time"] = self.stalls[selected_stall].departure_time
                else:
                    # Allocation Conflict / Illegal assignment to full zone
                    self.total_conflicts += 1
                    reward = REWARD_CONFLICT  # Severe penalty = -20.0
                    info["conflict"] = True
                    info["allocated_stall"] = None

        # --------------------------------------------------------------------
        # Clock Advancement & Next-Step Event Processing
        # --------------------------------------------------------------------
        self.current_step += 1
        terminated = (self.current_step >= self.horizon_minutes)
        truncated = False

        # Process departures at the new minute BEFORE arrivals at the new minute
        if not terminated:
            self._process_departures(self.current_step)
            self._load_active_request()
        else:
            self.active_request = None

        obs = self.get_observation()
        info["action_mask"] = self.get_action_mask().tolist()
        info["total_occupancy"] = self.get_total_occupancy()

        return StepResult(
            observation=obs,
            reward=reward,
            terminated=terminated,
            truncated=truncated,
            info=info
        )

    # ------------------------------------------------------------------------
    # State Vector Observation
    # ------------------------------------------------------------------------

    def get_observation(self) -> np.ndarray:
        """Constructs a standardized 18-element float32 observation vector."""
        obs = np.zeros(18, dtype=np.float32)

        # [0..4]: Stall occupancy flags (A1, A2, A3, B1, B2)
        for i, sid in enumerate(ALL_PHYSICAL_STALLS):
            obs[i] = 1.0 if self.stalls[sid].is_occupied else 0.0

        # [5..9]: Stall remaining dwell times (normalized by 120.0 minutes)
        for i, sid in enumerate(ALL_PHYSICAL_STALLS):
            s = self.stalls[sid]
            if s.is_occupied and s.departure_time is not None:
                rem = max(0, s.departure_time - self.current_step)
                obs[5 + i] = float(rem) / 120.0
            else:
                obs[5 + i] = 0.0

        # [10..11]: Zone occupancy counts (normalized by capacity)
        obs[10] = float(self.get_zone_occupancy(0)) / float(ZONE_CAPACITIES[0])
        obs[11] = float(self.get_zone_occupancy(1)) / float(ZONE_CAPACITIES[1])

        # [12]: Current simulation progress
        obs[12] = float(self.current_step) / float(max(1, self.horizon_minutes))

        # [13..14]: Pending arrival flag and dwell duration
        if self.active_request is not None:
            obs[13] = 1.0
            obs[14] = float(self.active_request.dwell_time) / 120.0
        else:
            obs[13] = 0.0
            obs[14] = 0.0

        # [15..17]: Action mask [M_0, M_1, M_2]
        mask = self.get_action_mask()
        obs[15] = float(mask[0])
        obs[16] = float(mask[1])
        obs[17] = float(mask[2])

        return obs
