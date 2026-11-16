"""Firebase service helpers for read/write operations."""

import socket
import requests

# Fast fail-safe DNS fallback for regional Firebase Realtime Database
_FIREBASE_HOST = "smartparking-87cee-default-rtdb.asia-southeast1.firebasedatabase.app"
_FIREBASE_FALLBACK_IP = "35.186.236.207"

_orig_getaddrinfo = socket.getaddrinfo

def _fast_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host == _FIREBASE_HOST:
        return _orig_getaddrinfo(_FIREBASE_FALLBACK_IP, port, family, type, proto, flags)
    return _orig_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = _fast_getaddrinfo


class FirebaseServiceError(Exception):
    pass


def get_parking_states(url, timeout=3):
    """Read parking states from Firebase."""
    response = requests.get(url, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict):
        return payload.get("states", [])
    return []


def get_booked_slots(url, timeout=3):
    """Read booked_slots from Firebase /data node.
    Returns a dict like {'slot3': {'status': 'active', ...}, ...}
    """
    response = requests.get(url, timeout=timeout)
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
