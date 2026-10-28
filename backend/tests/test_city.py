"""Live-city dataset: 18 photo-backed complaints on the Murthal-Sonipat corridor, deterministic,
with three root-cause groups (two confirmed, one repaired and verified),
and a realistic mix of states for user testing and the map."""
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
    # Root cause: three groups; two confirmed (one visit saved each), one repaired and verified.
    assert m["hypotheses"] == {"proposed": 1, "confirmed": 2, "rejected": 0}
    assert m["crew_visits_saved"] == 2 and m["verified_closures"] == 1
    assert m["coordinated_vs_independent"] == {"independent_visits": 16, "coordinated_visits": 14}
    incs = {i["id"]: i for i in st["incidents"]}
    statuses = Counter(i["status"] for i in incs.values())
    assert m["escalations"] == 2 and statuses["escalated"] == 2  # a small, explainable minority:
    assert {i["category"] for i in incs.values() if i["status"] == "escalated"} == {"garbage"}  # S1 on leave
    # Awaiting proof: Civil Hospital main (crew repair) and the GT Road pothole (its root cause was fixed).
    assert [i for i in incs if incs[i]["status"] == "pending_verification"] == ["inc_001", "inc_007"]
    assert [i for i in incs if incs[i]["status"] == "verified_closed"] == ["inc_006"]  # GT Road service-lane leak
    assert [i for i in incs if incs[i]["at_risk"]] == ["inc_002"]  # bus stand sewage
    assert sorted(i for i in incs if len(incs[i]["report_ids"]) == 2) == ["inc_004", "inc_008"]  # duplicate pairs
    hyps = client.get("/hypotheses").json()
    assert [(h["status"], h["cause_incident_id"], h["member_ids"]) for h in hyps] == [
        ("proposed", "inc_002", ["inc_003"]),  # Sonipat bus stand: sewage overflow -> road caving in
        ("confirmed", "inc_006", ["inc_007"]),  # GT Road: service-lane leak -> potholes above it
        ("confirmed", "inc_009", ["inc_010"]),  # Murthal Chowk: choked drain -> pothole beside it
    ]
    tree = {i: (incs[i]["parent_incident_id"], incs[i]["child_incident_ids"]) for i in incs
            if incs[i]["parent_incident_id"] or incs[i]["child_incident_ids"]}
    assert tree == {"inc_006": (None, ["inc_007"]), "inc_007": ("inc_006", []),
                    "inc_009": (None, ["inc_010"]), "inc_010": ("inc_009", [])}
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
