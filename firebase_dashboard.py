import sys
import time

from smart_parking_ai.firebase_config import FIREBASE_URL
from smart_parking_ai.models.gru import predict_availability, estimate_time_to_free
from smart_parking_ai.models.gnn import get_route_to_slot
from smart_parking_ai.models.marl import select_best_slots
from smart_parking_ai.services.co2_service import calculate_co2
from smart_parking_ai.services.firebase_service import (
    get_parking_states,
    get_booked_slots,
    update_recommendation,
)
from smart_parking_ai.services.route_service import RouteResult, get_directions_route
from smart_parking_ai.utils.distance import get_slot_distances


def format_slot_status(states):
    
    return "  ".join(
        f"S{index + 1}: {'🔴' if slot_state == 1 else '🟢'}"
        for index, slot_state in enumerate(states)
    )


def display_dashboard(states, best_slot, top3, path, navigation, co2_saved, predictions, timings=None):
    all_occupied = all(s == 1 for s in states)

    print("\n" + "=" * 60, flush=True)
    print("🚗 Smart Parking AI Backend", flush=True)
    print("=" * 60, flush=True)
    print("Slot Status:", flush=True)
    print(format_slot_status(states), flush=True)

    if all_occupied:
        print("\n⚠️  ALL SLOTS OCCUPIED — No recommendation available", flush=True)
        print("   Waiting for a slot to free up...", flush=True)
    else:
        print(f"\n🏆 Best Slot: {best_slot}", flush=True)
        print(f"🥇 Top 3 Slots: {top3}", flush=True)
        print(f"🛣️  Route: {' → '.join(path)}", flush=True)
        if navigation:
            print(f"   • Navigation distance: {navigation.distance} m", flush=True)
            print(f"   • Estimated duration: {navigation.duration} s", flush=True)
        print(f"🌱 CO2 Saved: {co2_saved:.2f} g", flush=True)

    if predictions:
        print("\n🔮 Predictions & Timings:", flush=True)
        for slot, status in predictions.items():
            timing_info = ""
            if timings and slot in timings:
                t = timings[slot]
                if t["occupied"]:
                    timing_info = f" | {t['label']} until free"
            print(f"  {slot}: {status}{timing_info}", flush=True)
    print("=" * 60, flush=True)



def run_dashboard():
    print("📡 Starting Smart Parking AI backend...\n", flush=True)

    while True:
        try:
            states = get_parking_states(FIREBASE_URL)
            if not states:
                print("Waiting for parking state data...", flush=True)
                time.sleep(2)
                continue

            # ── Merge booked slots into sensor states ──
            # When a phone books a slot, it writes to /data/booked_slots/{slotId}.
            # We treat those as occupied so recommendations exclude them.
            booked = get_booked_slots(FIREBASE_URL)
            merged_states = list(states)  # copy so we don't mutate original
            for slot_key, info in booked.items():
                if isinstance(info, dict) and info.get("status") == "active":
                    # slot_key is like "slot3" → index 2
                    try:
                        idx = int(slot_key.replace("slot", "")) - 1
                        if 0 <= idx < len(merged_states):
                            merged_states[idx] = 1  # mark as occupied
                    except ValueError:
                        pass

            ranked_slots, best_slot, top3_slots = select_best_slots(merged_states)

            # Use GNN graph routing for optimal path
            if best_slot:
                path, route_distance = get_route_to_slot(best_slot)
            else:
                path = []
                route_distance = 0

            navigation_route: RouteResult | None = None

            if best_slot:
                try:
                    navigation_route = get_directions_route(best_slot)
                    if navigation_route.is_mock:
                        print(f"  ⚠️  Using MOCK route (set GOOGLE_DIRECTIONS_API_KEY for real routes)", flush=True)
                except Exception as exc:
                    print("Navigation route failed:", exc, flush=True)
                    navigation_route = None

            if navigation_route:
                co2_saved = calculate_co2(navigation_route.distance)
            else:
                slot_distances = get_slot_distances(len(states))
                best_slot_index = int(best_slot.replace("slot", "")) if best_slot else None
                max_distance = max(slot_distances.values()) if slot_distances else 0
                best_distance = slot_distances.get(best_slot_index, 0)
                distance_saved_m = max_distance - best_distance if best_slot_index is not None else 0
                co2_saved = calculate_co2(distance_saved_m)

            predictions = predict_availability(merged_states)
            timings = estimate_time_to_free(merged_states)

            display_dashboard(
                states,
                best_slot,
                top3_slots,
                path,
                navigation_route,
                co2_saved,
                predictions,
                timings,
            )

            update_recommendation(
                FIREBASE_URL,
                best_slot,
                top3_slots,
                path,
                co2_saved,
                navigation=navigation_route,
                co2_details={
                    "distance_m": navigation_route.distance if navigation_route else 0,
                },
                predictions=predictions,
                timings=timings,
            )

        except Exception as exc:
            print("Error while processing dashboard:", exc, flush=True)

        time.sleep(2)


if __name__ == "__main__":
    run_dashboard()
