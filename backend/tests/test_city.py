"""Live-city dataset: 18 photo-backed complaints on the Murthal-Sonipat corridor, deterministic,
with a realistic mix of states for user testing and the map."""
import json
from collections import Counter
from pathlib import Path

from app.engine.geo import haversine_m
from app.places import PLACES
from app.sim import CITY, city_point

SEED = Path(__file__).parent.parent / "app" / "seed"
STEPS = 7


def test_city_dataset_has_required_mix(client):
    r = client.post("/sim/scenario/city").json()
    assert r["step"] == STEPS
    st = r["state"]
    m = st["metrics"]
    assert (m["reports"], m["incidents"], m["duplicates_linked"]) == (18, 16, 2)
    assert m["sla_breaches"] == 0 and m["at_risk"] == 1
    incs = {i["id"]: i for i in st["incidents"]}
    statuses = Counter(i["status"] for i in incs.values())
    assert statuses["escalated"] == 2  # sanitation crew S1 on leave: both garbage incidents
    assert {i["category"] for i in incs.values() if i["status"] == "escalated"} == {"garbage"}
    assert [i for i in incs if incs[i]["status"] == "pending_verification"] == ["inc_001"]  # Civil Hospital main
    assert [i for i in incs if incs[i]["at_risk"]] == ["inc_002"]  # bus stand sewage
    assert sorted(i for i in incs if len(incs[i]["report_ids"]) == 2) == ["inc_004", "inc_008"]  # duplicate pairs
    hyps = client.get("/hypotheses", params={"status": "proposed"}).json()
    assert [(h["cause_incident_id"], h["member_ids"]) for h in hyps] == [("inc_002", ["inc_003"])]
    assert Counter(i["category"] for i in incs.values()) == {
        "pothole": 3, "water_leak": 3, "sewage": 3, "streetlight": 2, "garbage": 2, "other": 3}


def test_city_reports_are_at_real_places_with_photos(client):
    client.post("/sim/scenario/city")
    reports = [rep for inc in client.get("/incidents").json()
               for rep in client.get(f"/incidents/{inc['id']}").json()["reports"]]
    assert len(reports) == 18
    labels = {p["label"]: (p["lat"], p["lng"]) for p in PLACES.values()}
    urls = set()
    for rep in reports:
        assert rep["location_source"] == "landmark"
        assert haversine_m(*labels[rep["location_label"]], rep["lat"], rep["lng"]) <= 300, rep["id"]
        assert rep["photo_url"] and rep["photo_url"].startswith("/photos/ph_")
        res = client.get(rep["photo_url"])
        assert res.status_code == 200 and res.headers["content-type"] == "image/jpeg"
        assert res.content[:3] == b"\xff\xd8\xff" and b"Exif" not in res.content[:4096]  # metadata stripped
        urls.add(rep["photo_url"])
    assert len(urls) == 18  # one photo per complaint
    # The whole corridor: everything within 10 km of Rishihood University.
    for rep in reports:
        assert haversine_m(PLACES["rishihood"]["lat"], PLACES["rishihood"]["lng"], rep["lat"], rep["lng"]) < 10_000


def test_city_seed_photos_are_attributed():
    used = {r["photo"] for a in CITY for r in a["reports"]}
    files = {p.name for p in (SEED / "photos").glob("*.jpg")}
    assert used == files
    attribution = (SEED / "photos" / "ATTRIBUTION.md").read_text()
    for name in used:
        assert f"| {name} |" in attribution
    for a in CITY:
        for r in a["reports"]:
            p = PLACES[r["place"]]
            assert haversine_m(p["lat"], p["lng"], *city_point(r)) <= 300


def test_city_is_deterministic_and_stepwise(client):
    full = client.post("/sim/scenario/city").json()["state"]["incidents"]
    photos = [r["photo_url"] for r in client.get("/citizen/activity").json() if r.get("photo_url")]
    for n in range(1, STEPS + 1):
        r = client.post("/sim/scenario/city", params={"step": n}).json()
    assert r["state"]["incidents"] == full
    assert [r["photo_url"] for r in client.get("/citizen/activity").json() if r.get("photo_url")] == photos
    assert client.get("/sim/scenario/city").json()["step"] == STEPS
    two = client.post("/sim/scenario/city", params={"step": 2}).json()
    assert [i["id"] for i in two["state"]["incidents"]] == ["inc_001", "inc_002", "inc_003"]


def test_city_json_is_valid():
    data = json.loads((SEED / "city.json").read_text())
    ts = [r["t"] for a in data["areas"] for r in a["reports"]]
    assert ts == sorted(ts)  # areas replay in clock order
