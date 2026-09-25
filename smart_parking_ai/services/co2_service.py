"""CO2 services for route-based emission estimates."""

CO2_GRAMS_PER_KM = 120.0


def calculate_co2(distance_m: int) -> float:
    """Calculate CO2 emissions in grams for a real driving distance."""
    distance_km = max(distance_m, 0) / 1000.0
    return round(distance_km * CO2_GRAMS_PER_KM, 2)
