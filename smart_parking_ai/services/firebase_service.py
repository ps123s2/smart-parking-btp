"""Firebase service helpers for read/write operations."""

import requests


class FirebaseServiceError(Exception):
    pass


def get_parking_states(url):
    """Read parking states from Firebase."""
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict):
        return payload.get("states", [])
    return []


def get_booked_slots(url):
    """Read booked_slots from Firebase /data node.
    Returns a dict like {'slot3': {'status': 'active', ...}, ...}
    """
    response = requests.get(url, timeout=5)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict):
        return payload.get("booked_slots", {}) or {}
    return {}


def update_recommendation(
    url,
    best_slot,
    top3,
    path,
    co2_saved,
    navigation=None,
    co2_details=None,
    predictions=None,
    timings=None,
):
    """Write recommendation, route, CO2, navigation, and optional predictions to Firebase."""
    payload = {
        "recommendation": {"best_slot": best_slot, "top3": top3},
        "route": {"path": path},
        "co2": {"saved": round(co2_saved, 1), "unit": "g"},
    }

    if navigation is not None:
        payload["navigation"] = {
            "polyline": navigation.polyline,
            "distance": navigation.distance,
            "duration": navigation.duration,
        }

    if co2_details is not None:
        payload["co2"].update(co2_details)

    if predictions is not None:
        payload["predictions"] = predictions
        
    if timings is not None:
        payload["timings"] = timings

    response = requests.patch(url, json=payload, timeout=5)
    response.raise_for_status()
    return response.json()
