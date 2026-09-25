"""
GRU-style prediction model for slot availability.

Uses recent occupancy history to predict:
- Future availability probability (0.0 = will be occupied, 1.0 = will be free)
- Confidence level for each prediction
"""

import time
import math

# In-memory history buffer (sliding window of last N observations)
_slot_history: dict[int, list[int]] = {}
_last_update_time: float = 0
HISTORY_WINDOW = 10  # Keep last 10 observations


def _update_history(states: list):
    """Append current states to the history buffer."""
    global _last_update_time
    now = time.time()

    for slot_index, state in enumerate(states, start=1):
        if slot_index not in _slot_history:
            _slot_history[slot_index] = []
        _slot_history[slot_index].append(state)
        # Keep only the last HISTORY_WINDOW entries
        if len(_slot_history[slot_index]) > HISTORY_WINDOW:
            _slot_history[slot_index] = _slot_history[slot_index][-HISTORY_WINDOW:]

    _last_update_time = now


def _gru_predict(history: list[int]) -> tuple[float, float]:
    """
    GRU-inspired prediction using exponentially weighted moving average.

    Returns:
        (availability_score, confidence)
        - availability_score: 0.0 (occupied) to 1.0 (free)
        - confidence: 0.0 to 1.0
    """
    if not history:
        return 0.5, 0.0

    # Exponential weights (recent observations matter more — GRU gate behavior)
    n = len(history)
    decay = 0.7  # Decay factor (like GRU forget gate)
    weighted_sum = 0.0
    weight_total = 0.0

    for i, state in enumerate(history):
        # state 0 = free, state 1 = occupied
        # We want availability, so invert: free=1, occupied=0
        availability = 1 - state
        weight = decay ** (n - 1 - i)  # More recent = higher weight
        weighted_sum += availability * weight
        weight_total += weight

    availability_score = weighted_sum / weight_total if weight_total > 0 else 0.5

    # Confidence based on history length and consistency
    consistency = 1.0 - (sum(abs(history[i] - history[i - 1]) for i in range(1, n)) / max(n - 1, 1))
    data_confidence = min(n / HISTORY_WINDOW, 1.0)
    confidence = consistency * data_confidence

    return round(availability_score, 3), round(confidence, 3)


def predict_availability(states: list, history=None) -> dict:
    """
    Predict future availability for all parking slots.

    Returns dict like:
        {"slot1": "Available (Predicted Free)", ...}
    """
    _update_history(states)

    predictions = {}
    for slot_index in range(1, len(states) + 1):
        hist = _slot_history.get(slot_index, [])
        avail_score, confidence = _gru_predict(hist)

        if avail_score > 0.6:
            label = f"Available (Predicted Free, {confidence*100:.0f}% conf)"
        elif avail_score < 0.4:
            label = f"Occupied (High Confidence, {confidence*100:.0f}% conf)"
        else:
            label = f"Uncertain ({confidence*100:.0f}% conf)"

        predictions[f"slot{slot_index}"] = label

    return predictions


def get_availability_scores(states: list) -> dict:
    """
    Get raw availability scores for MARL integration.

    Returns:
        {"slot1": (availability_score, confidence), ...}
    """
    _update_history(states)

    scores = {}
    for slot_index in range(1, len(states) + 1):
        hist = _slot_history.get(slot_index, [])
        scores[f"slot{slot_index}"] = _gru_predict(hist)

    return scores


def estimate_time_to_free(states: list) -> dict:
    """
    Estimate minutes until each occupied slot becomes free.

    Uses the occupancy change rate from the history buffer.
    If a slot has been occupied for a long time, the estimate increases.
    Free slots return 0.

    Returns:
        {"slot1": {"occupied": True, "est_minutes": 15, "confidence": 0.6}, ...}
    """
    _update_history(states)

    estimates = {}
    for slot_index in range(1, len(states) + 1):
        name = f"slot{slot_index}"
        hist = _slot_history.get(slot_index, [])
        is_occupied = states[slot_index - 1] == 1

        if not is_occupied:
            estimates[name] = {
                "occupied": False,
                "est_minutes": 0,
                "confidence": 1.0,
                "label": "Available now",
            }
            continue

        # Count consecutive occupied observations from most recent
        consecutive_occupied = 0
        for obs in reversed(hist):
            if obs == 1:
                consecutive_occupied += 1
            else:
                break

        # Count total state changes in history (more changes = shorter stays)
        changes = sum(
            1 for i in range(1, len(hist)) if hist[i] != hist[i - 1]
        )

        # Base estimate: each observation ≈ 2s polling interval
        # Average parking duration ≈ 30-120 min; scale based on patterns
        if changes > 0:
            avg_stay_obs = len(hist) / changes  # avg observations per state
            remaining_obs = max(avg_stay_obs - consecutive_occupied, 1)
            # Each observation is ~2s, but real parking is longer
            # Scale: 1 observation ≈ 3 minutes of real-world time
            est_minutes = round(remaining_obs * 3)
        else:
            # No changes observed — assume medium duration
            est_minutes = 15 + (consecutive_occupied * 2)

        # Clamp to reasonable range
        est_minutes = max(5, min(est_minutes, 120))

        # Confidence based on data amount
        data_conf = min(len(hist) / HISTORY_WINDOW, 1.0)
        change_conf = min(changes / 3, 1.0) if changes > 0 else 0.3
        confidence = round((data_conf + change_conf) / 2, 2)

        if est_minutes <= 10:
            label = f"~{est_minutes} min (freeing soon)"
        elif est_minutes <= 30:
            label = f"~{est_minutes} min"
        else:
            label = f"~{est_minutes} min (long stay)"

        estimates[name] = {
            "occupied": True,
            "est_minutes": est_minutes,
            "confidence": confidence,
            "label": label,
        }

    return estimates
