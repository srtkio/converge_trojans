from math import asin, cos, radians, sin, sqrt


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * 6_371_000 * asin(sqrt(a))


# --- metric placement (demo data): one helper so every relocated point keeps its distances ------

M_PER_DEG = 111_320  # metres per degree of latitude (and of longitude at the equator)


def offset_m(lat: float, lng: float, origin: tuple[float, float]) -> tuple[float, float]:
    """(north, east) metres of a point from `origin`."""
    return (lat - origin[0]) * M_PER_DEG, (lng - origin[1]) * M_PER_DEG * cos(radians(origin[0]))


def place(origin: tuple[float, float], north_m: float, east_m: float) -> tuple[float, float]:
    """The point `north_m` / `east_m` metres from `origin` (rounded to 7 decimals, about 1 cm)."""
    return (round(origin[0] + north_m / M_PER_DEG, 7),
            round(origin[1] + east_m / (M_PER_DEG * cos(radians(origin[0]))), 7))


def relocate(lat: float, lng: float, old: tuple[float, float], new: tuple[float, float]) -> tuple[float, float]:
    """Move a point from around `old` to the same metres around `new`."""
    return place(new, *offset_m(lat, lng, old))
