"""Moving the demo from Bengaluru (MG Road) to Murthal/Sonipat changed places and wording only.

decisions_bengaluru.json holds the decisions of the golden and root-cause scenarios as run on
origin/main before the move (see tests/fixtures/decisions.py). Every engine decision must match.
"""
import json
from pathlib import Path

import pytest

from app.engine.geo import haversine_m, offset_m, place, relocate
from app.places import MURTHAL_CHOWK, RISHIHOOD_GT_ROAD

from .fixtures.decisions import project

OLD = json.loads((Path(__file__).parent / "fixtures" / "decisions_bengaluru.json").read_text())
MG_ROAD = (12.97560, 77.60500)


@pytest.mark.parametrize("name", ["golden", "rootcause"])
def test_decisions_unchanged_vs_bengaluru(client, name):
    new = project(client, name)
    old = OLD[name]
    assert len(new["steps"]) == len(old["steps"])
    for a, b in zip(new["steps"], old["steps"], strict=True):
        assert a == b, f"step {b['step']} changed"
    assert new["details"] == old["details"]
    assert new["hypotheses"] == old["hypotheses"]
    assert new["metrics"] == old["metrics"]


def test_scenarios_are_where_they_should_be(client):
    incs = client.post("/sim/scenario/golden").json()["state"]["incidents"]
    assert all(haversine_m(*RISHIHOOD_GT_ROAD, i["lat"], i["lng"]) < 300 for i in incs)
    st = client.post("/sim/scenario/rootcause").json()["state"]
    assert all(haversine_m(*MURTHAL_CHOWK, i["lat"], i["lng"]) < 300 for i in st["incidents"])
    # The root-cause reset seeds crews around Murthal Chowk at the same metres as around the university.
    crew = {r["id"]: r["location"] for r in st["resources"]}
    assert haversine_m(*MURTHAL_CHOWK, crew["res_water_1"]["lat"], crew["res_water_1"]["lng"]) < 1000
    client.post("/sim/reset")
    crew = {r["id"]: r["location"] for r in client.get("/resources").json()}
    assert haversine_m(*RISHIHOOD_GT_ROAD, crew["res_water_1"]["lat"], crew["res_water_1"]["lng"]) < 1000


def test_no_bengaluru_left_in_scenario_text(client):
    for name in ("golden", "rootcause", "city"):
        client.post("/sim/reset")
        r = client.post(f"/sim/scenario/{name}").json()
        blob = json.dumps(r) + json.dumps(client.get("/services").json())
        for word in ("MG Road", "Brigade", "Church Street", "Cubbon", "metro", "335E", "Bengaluru"):
            assert word not in blob, (name, word)


def test_relocate_preserves_distances():
    pts = [(12.97614, 77.60500), (12.97335, 77.60500), (12.99, 77.58), (12.972, 77.61), (12.976, 77.6056)]
    for a in pts:
        assert offset_m(*relocate(*a, MG_ROAD, RISHIHOOD_GT_ROAD), RISHIHOOD_GT_ROAD) == pytest.approx(
            offset_m(*a, MG_ROAD), abs=0.02)
        for b in pts:
            old = haversine_m(*a, *b)
            new = haversine_m(*relocate(*a, MG_ROAD, MURTHAL_CHOWK), *relocate(*b, MG_ROAD, MURTHAL_CHOWK))
            assert new == pytest.approx(old, rel=0.005, abs=0.5)
    assert place(RISHIHOOD_GT_ROAD, 0, 0) == RISHIHOOD_GT_ROAD
