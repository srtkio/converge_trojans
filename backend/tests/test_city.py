"""Live-city dataset: deterministic, realistic mix of states for user testing and the map."""
from collections import Counter


def test_city_dataset_has_required_mix(client):
    r = client.post("/sim/scenario/city").json()
    assert r["step"] == 8
    st = r["state"]
    m = st["metrics"]
    assert (m["reports"], m["incidents"], m["duplicates_linked"]) == (20, 17, 3)
    statuses = Counter(i["status"] for i in st["incidents"])
    assert statuses["escalated"] == 2
    assert statuses["pending_verification"] == 1
    assert [i["id"] for i in st["incidents"] if i["at_risk"]] == ["inc_005"]
    assert m["sla_breaches"] == 0
    hyps = client.get("/hypotheses", params={"status": "proposed"}).json()
    assert {h["cause_incident_id"] for h in hyps} == {"inc_001", "inc_005"}
    # All within Bengaluru.
    for i in st["incidents"]:
        assert 12.85 < i["lat"] < 13.05 and 77.55 < i["lng"] < 77.80


def test_city_is_deterministic_and_stepwise(client):
    full = client.post("/sim/scenario/city").json()["state"]["incidents"]
    for n in range(1, 9):
        r = client.post("/sim/scenario/city", params={"step": n}).json()
    assert r["state"]["incidents"] == full
    assert client.get("/sim/scenario/city").json()["step"] == 8
    two = client.post("/sim/scenario/city", params={"step": 2}).json()
    assert [i["id"] for i in two["state"]["incidents"]] == ["inc_001", "inc_002"]
