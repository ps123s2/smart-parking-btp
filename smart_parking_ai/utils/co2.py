"""CO2 calculation utilities."""

CO2_GRAMS_PER_KM = 120.0


def calculate_co2(distance_m, factor=CO2_GRAMS_PER_KM):
    """Calculate CO2 saved in grams by the distance saved."""
    distance_km = max(distance_m, 0.0) / 1000.0
    saved = distance_km * factor
    return float(round(max(saved, 0.0), 2))
