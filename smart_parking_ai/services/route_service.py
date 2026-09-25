import os
from dataclasses import dataclass
from typing import Dict, Optional

import requests

GOOGLE_DIRECTIONS_API_KEY = os.getenv("GOOGLE_DIRECTIONS_API_KEY")

PARKING_ENTRY_POINT = (1.3521, 103.8198)
PARKING_SLOT_COORDINATES = {
    "slot1": (1.3528, 103.8201),
    "slot2": (1.3527, 103.8196),
    "slot3": (1.3527, 103.8192),
    "slot4": (1.3523, 103.8201),
    "slot5": (1.3523, 103.8192),
}

DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"


@dataclass
class RouteResult:
    polyline: str
    distance: int
    duration: int
    origin: str
    destination: str
    steps: Optional[Dict] = None
    is_mock: bool = False


class RouteServiceError(Exception):
    pass


def _format_coordinate(coordinate: tuple[float, float]) -> str:
    latitude, longitude = coordinate
    return f"{latitude},{longitude}"


def _generate_mock_polyline(start: tuple[float, float], end: tuple[float, float]) -> str:
    """Generate a mock polyline using simple linear interpolation for testing."""
    lat_start, lng_start = start
    lat_end, lng_end = end
    
    points = []
    steps = 10
    for i in range(steps + 1):
        t = i / steps
        lat = lat_start + (lat_end - lat_start) * t
        lng = lng_start + (lng_end - lng_start) * t
        points.append((lat, lng))
    
    return _encode_polyline_simple(points)


def _encode_polyline_simple(points):
    """Simple polyline encoder (Google Polyline Algorithm Format)."""
    def _encode_value(val):
        val = int(round(val * 1e5))
        val = ~(val << 1) if (val < 0) else (val << 1)
        chunks = []
        while val >= 0x20:
            chunks.append(str(chr((0x20 | (val & 0x1f)) + 63)))
            val >>= 5
        chunks.append(str(chr(val + 63)))
        return "".join(chunks)
    
    encoded = []
    prev_lt = 0
    prev_ln = 0
    for lat, lng in points:
        encoded.append(_encode_value(lat - prev_lt))
        encoded.append(_encode_value(lng - prev_ln))
        prev_lt = lat
        prev_ln = lng
    return "".join(encoded)


def get_directions_route(best_slot: str) -> RouteResult:
    """Fetch a real driving route from the parking entrance to the selected slot."""
    if best_slot not in PARKING_SLOT_COORDINATES:
        raise RouteServiceError(f"Unknown slot '{best_slot}'.")

    if GOOGLE_DIRECTIONS_API_KEY:
        return _get_real_directions_route(best_slot)
    else:
        return _get_mock_directions_route(best_slot)


def _get_real_directions_route(best_slot: str) -> RouteResult:
    """Fetch from Google Directions API."""
    origin = _format_coordinate(PARKING_ENTRY_POINT)
    destination = _format_coordinate(PARKING_SLOT_COORDINATES[best_slot])

    params = {
        "origin": origin,
        "destination": destination,
        "mode": "driving",
        "key": GOOGLE_DIRECTIONS_API_KEY,
        "departure_time": "now",
    }

    response = requests.get(DIRECTIONS_URL, params=params, timeout=10)
    response.raise_for_status()
    payload = response.json()

    status = payload.get("status")
    if status != "OK":
        raise RouteServiceError(
            f"Google Directions API error: {status} - {payload.get('error_message', '')}"
        )

    routes = payload.get("routes", [])
    if not routes:
        raise RouteServiceError("No route returned from Google Directions API.")

    route = routes[0]
    overview_polyline = route.get("overview_polyline", {}).get("points")
    if not overview_polyline:
        raise RouteServiceError("Directions response missing overview polyline.")

    legs = route.get("legs", [])
    if not legs:
        raise RouteServiceError("Directions response missing legs.")

    total_distance = 0
    total_duration = 0
    for leg in legs:
        total_distance += leg.get("distance", {}).get("value", 0)
        total_duration += leg.get("duration", {}).get("value", 0)

    return RouteResult(
        polyline=overview_polyline,
        distance=total_distance,
        duration=total_duration,
        origin=origin,
        destination=destination,
        steps=route.get("legs", []),
        is_mock=False,
    )


def _get_mock_directions_route(best_slot: str) -> RouteResult:
    """Generate a mock route for testing without API key."""
    origin = _format_coordinate(PARKING_ENTRY_POINT)
    destination = _format_coordinate(PARKING_SLOT_COORDINATES[best_slot])
    
    polyline = _generate_mock_polyline(PARKING_ENTRY_POINT, PARKING_SLOT_COORDINATES[best_slot])
    distance = 150
    duration = 45
    
    return RouteResult(
        polyline=polyline,
        distance=distance,
        duration=duration,
        origin=origin,
        destination=destination,
        is_mock=True,
    )
