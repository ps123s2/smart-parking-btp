"""Distance utilities for parking slots — uses real parking lot layout geometry."""

import math

# Parking lot layout (relative positions in meters from entry)
# Layout:
#        Road
#   [S1/A1]  [S2/A2]  [S3/A3]     ← Row A (farther from entry)
#        Road
#   [S4/B1]  [S5/B2]              ← Row B (closer to entry)
#        Road
#   [Entry]

# Slot positions relative to entry point (x_meters, y_meters)
SLOT_POSITIONS = {
    1: (  -40,  80),   # A1 — far left, top row
    2: (   30,  80),   # A2 — center, top row
    3: (  100,  80),   # A3 — far right, top row
    4: (  -40,  40),   # B1 — left, bottom row
    5: (   30,  40),   # B2 — center, bottom row
}

ENTRY_POSITION = (30, 0)  # Entry at center bottom


def euclidean_distance(p1: tuple, p2: tuple) -> float:
    """Calculate Euclidean distance between two 2D points."""
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def get_slot_distances(num_slots: int) -> dict:
    """Return distance from entry to each slot (meters)."""
    return {
        slot: round(euclidean_distance(ENTRY_POSITION, SLOT_POSITIONS.get(slot, (0, 0))), 1)
        for slot in range(1, num_slots + 1)
    }


def get_slot_to_slot_distance(slot_a: int, slot_b: int) -> float:
    """Distance between two slots."""
    pos_a = SLOT_POSITIONS.get(slot_a, (0, 0))
    pos_b = SLOT_POSITIONS.get(slot_b, (0, 0))
    return euclidean_distance(pos_a, pos_b)


def get_nearest_available_slot(states: list) -> int | None:
    """Find the nearest available slot to the entry."""
    distances = get_slot_distances(len(states))
    available = [
        (slot_idx, distances[slot_idx])
        for slot_idx, state in enumerate(states, start=1)
        if state == 0
    ]
    if not available:
        return None
    available.sort(key=lambda x: x[1])
    return available[0][0]
