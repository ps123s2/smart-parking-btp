"""
MARL (Multi-Agent Reinforcement Learning) slot selection.

Combines three signals to compute the optimal slot recommendation:
1. GNN — Graph-based shortest path distance from entry to each slot
2. GRU — Predicted future availability (will it stay free?)
3. MARL reward — Immediate occupancy state reward

Final score = MARL_reward + GRU_bonus - GNN_distance_penalty

This ensures:
- Nearer free slots rank higher (B2 > A1 when both free)
- Slots predicted to stay free get a bonus
- Occupied slots get heavy negative reward
"""

from smart_parking_ai.models.gnn import get_all_slot_distances
from smart_parking_ai.models.gru import get_availability_scores


def slot_name(slot_index: int) -> str:
    return f"slot{slot_index}"


def compute_scores(states: list, distance_weight: float = 0.15, gru_weight: float = 3.0):
    """
    Compute a composite score for each parking slot using MARL + GNN + GRU.

    Score formula:
        score = marl_reward + (gru_availability × gru_weight) - (gnn_distance × distance_weight)

    Args:
        states: List of 0/1 occupancy states
        distance_weight: How much to penalize distance (higher = prefer closer)
        gru_weight: How much to reward predicted availability
    """
    # GNN: Get shortest-path distances from entry
    gnn_distances = get_all_slot_distances()

    # GRU: Get predicted availability scores
    gru_scores = get_availability_scores(states)

    ranked_slots = []

    for slot_index, slot_state in enumerate(states, start=1):
        name = slot_name(slot_index)

        # ── MARL reward: immediate occupancy signal ──
        marl_reward = 10.0 if slot_state == 0 else -20.0

        # ── GNN distance penalty: shorter path = better ──
        gnn_dist = gnn_distances.get(name, 100)
        distance_penalty = gnn_dist * distance_weight

        # ── GRU future availability bonus ──
        avail_score, confidence = gru_scores.get(name, (0.5, 0.0))
        gru_bonus = avail_score * confidence * gru_weight

        # ── Composite score ──
        score = marl_reward + gru_bonus - distance_penalty

        ranked_slots.append((slot_index, round(score, 2), {
            "marl_reward": marl_reward,
            "gnn_distance": gnn_dist,
            "gru_avail": avail_score,
            "gru_conf": confidence,
            "final_score": round(score, 2),
        }))

    # Sort by score descending (highest = best)
    ranked_slots.sort(key=lambda item: item[1], reverse=True)
    return ranked_slots


def select_best_slots(states: list, top_n: int = 3):
    """
    Select the best slot and top N slots using combined MARL+GNN+GRU scoring.

    When all slots are occupied, returns None as best_slot and uses GRU
    predictions to identify which slot is most likely to free up soonest.

    Returns:
        (ranked_slots_named, best_slot, top3)
    """
    ranked_slots = compute_scores(states)

    ranked_slots_named = [
        (slot_name(slot_idx), score) for slot_idx, score, _details in ranked_slots
    ]

    # Check if ANY slot is actually free
    any_free = any(s == 0 for s in states)

    if any_free:
        best_slot = ranked_slots_named[0][0] if ranked_slots_named else None
        top3 = [slot for slot, _score in ranked_slots_named[:top_n]]
    else:
        # All occupied — no valid recommendation
        best_slot = None
        top3 = []

    # Debug output
    print("\n  📊 MARL+GNN+GRU Scoring:", flush=True)
    if not any_free:
        print("    ⚠️  ALL SLOTS OCCUPIED — no recommendation", flush=True)
        # Show which slot GRU predicts will free up soonest
        gru_scores = get_availability_scores(states)
        likely_free = sorted(
            gru_scores.items(), key=lambda x: x[1][0], reverse=True
        )
        if likely_free:
            top_candidate, (avail, conf) = likely_free[0]
            print(
                f"    🔮 GRU suggests waiting near {top_candidate}"
                f" (predicted free: {avail:.0%}, conf: {conf:.0%})",
                flush=True,
            )
    for slot_idx, score, details in ranked_slots:
        status = "🟢" if details["marl_reward"] > 0 else "🔴"
        print(
            f"    {status} slot{slot_idx}: score={score:+.1f}"
            f"  (reward={details['marl_reward']:+.0f}"
            f"  dist={details['gnn_distance']:.0f}m"
            f"  gru={details['gru_avail']:.0%}±{details['gru_conf']:.0%})",
            flush=True,
        )

    return ranked_slots_named, best_slot, top3
