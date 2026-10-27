"""Real places on the Murthal-Sonipat corridor (Haryana) used by the demo data.

Coordinates are from OpenStreetMap Nominatim. Demo points are placed in metres from these with
app.engine.geo.place, so distances (duplicate 150 m, related 400 m, nearest crew, impact radius)
are exact and the engine makes the same decisions wherever a scenario is centred.
"""

PLACES: dict[str, dict] = {
    "rishihood": {"label": "Rishihood University, GT Road (NH-44)", "lat": 28.9831937, "lng": 77.0907966},
    "murthal": {"label": "Murthal dhabas, GT Road", "lat": 29.0396149, "lng": 77.0894535},
    "murthal_chowk": {"label": "Murthal Chowk", "lat": 29.0265284, "lng": 77.0736908},
    "bahalgarh": {"label": "Bahalgarh", "lat": 28.9586835, "lng": 77.0950598},
    "sonipat_bus_stand": {"label": "Sonipat Bus Stand", "lat": 28.9973644, "lng": 77.0233632},
    "sonipat_junction": {"label": "Sonipat Junction railway station", "lat": 28.9898429, "lng": 77.0171182},
    "civil_hospital": {"label": "Civil Hospital, Sonipat", "lat": 28.9906486, "lng": 77.0363141},
    "sector_15": {"label": "Sector 15, Sonipat", "lat": 29.000174, "lng": 77.0395075},
    "sonipat_centre": {"label": "Sonipat city centre", "lat": 28.9953758, "lng": 77.0233627},
}


def origin(key: str) -> tuple[float, float]:
    return PLACES[key]["lat"], PLACES[key]["lng"]


# Golden scenario, crew depots, city services and the default seed: GT Road by Rishihood University.
RISHIHOOD_GT_ROAD = origin("rishihood")
# Root-cause scenario: Murthal Chowk. Its reset seeds the crews at the same metres from here.
MURTHAL_CHOWK = origin("murthal_chowk")
