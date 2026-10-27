"""One or more tests per rule in docs/CONTRACTS.md "Rules"."""
from app.timeutil import add_hours

BASE = (12.97560, 77.60500)
M_LAT = 1 / 111_195  # degrees of latitude per metre


def at(metres_north: float):
    return BASE[0] + metres_north * M_LAT, BASE[1]


def report(c, category="water_leak", north=0.0, text="Water leaking from pipe"):
    lat, lng = at(north)
    r = c.post("/reports", json={"text": text, "category": category, "lat": lat, "lng": lng,
                                 "reporter": "citizen:test"})
    assert r.status_code == 200, r.text
    return r.json()


def detail(c, inc_id):
    return c.get(f"/incidents/{inc_id}").json()


def events(c, inc_id):
    return [a["event_type"] for a in detail(c, inc_id)["audit"]]


def finish_work(c, inc_id, note="fixed"):
    assert c.post(f"/incidents/{inc_id}/start").status_code == 200
    r = c.post(f"/incidents/{inc_id}/complete", json={"note": note})
    assert r.status_code == 200
    return r.json()


def evidence(c, inc_id, supports, kind="inspector", note=""):
    r = c.post(f"/incidents/{inc_id}/evidence",
               json={"kind": kind, "supports_resolution": supports, "note": note, "source": "test"})
    assert r.status_code == 200, r.text
    return r.json()


# Rule 1: dedup --------------------------------------------------------------------------------

def test_duplicate_within_150m_same_category_links_to_existing(client):
    a = report(client)
    b = report(client, north=100)
    assert b["incident"]["id"] == a["incident"]["id"]
    assert b["link"]["kind"] == "duplicate"
    assert b["link"]["incident_id"] == a["incident"]["id"]
    assert 0 < b["link"]["confidence"] <= 1
    assert b["incident"]["report_ids"] == [a["report"]["id"], b["report"]["id"]]
    assert len(client.get("/incidents").json()) == 1


def test_same_category_beyond_150m_is_new_incident(client):
    a = report(client)
    b = report(client, north=200)
    assert b["incident"]["id"] != a["incident"]["id"]
    assert b["link"] is None


def test_same_spot_after_72h_is_new_incident(client):
    a = report(client)
    client.post("/sim/tick", params={"minutes": 73 * 60})
    b = report(client)
    assert b["incident"]["id"] != a["incident"]["id"]
    assert b["link"] is None


def test_related_dependent_category_within_400m(client):
    leak = report(client)
    hole = report(client, category="pothole", north=250, text="Pothole forming")
    assert hole["incident"]["id"] != leak["incident"]["id"]
    assert hole["link"]["kind"] == "related"
    assert hole["link"]["incident_id"] == leak["incident"]["id"]
    assert hole["incident"]["related_incident_ids"] == [leak["incident"]["id"]]
    assert detail(client, leak["incident"]["id"])["incident"]["related_incident_ids"] == [hole["incident"]["id"]]


def test_unrelated_category_nearby_is_not_linked(client):
    report(client)
    light = report(client, category="streetlight", north=50, text="Streetlight out")
    assert light["link"] is None


def test_related_beyond_400m_not_linked(client):
    report(client)
    hole = report(client, category="pothole", north=450, text="Pothole")
    assert hole["link"] is None


def test_new_duplicate_reopens_verified_closed_incident(client):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    assert evidence(client, inc, True)["incident"]["status"] == "verified_closed"
    b = report(client, north=20, text="Leaking again")
    assert b["incident"]["id"] == inc
    assert b["link"]["kind"] == "duplicate"
    inc_now = detail(client, inc)["incident"]
    assert inc_now["status"] == "reopened"
    assert inc_now["assigned_resource_id"] == "res_water_1"
    assert "reopened" in events(client, inc)


# Rule 2: assign -------------------------------------------------------------------------------

def test_assigns_nearest_available_crew_in_department(client):
    # res_roads_1 is ~350 m from BASE; res_roads_2 is ~3 km away.
    inc = report(client, category="pothole", text="Pothole")["incident"]
    assert inc["status"] == "assigned"
    assert inc["assigned_resource_id"] == "res_roads_1"
    res = {r["id"]: r for r in client.get("/resources").json()}
    assert inc["id"] in res["res_roads_1"]["active_incident_ids"]


def test_garbage_and_other_get_seeded_crews(client):
    assert report(client, category="garbage", text="Overflowing bins")["incident"]["assigned_resource_id"] == "res_sanit_1"
    assert report(client, category="other", north=5000, text="Fallen tree")["incident"]["assigned_resource_id"] == "res_gen_1"


def test_no_crew_in_department_escalates(client):
    client.post("/resources/res_sanit_1/unavailable")
    inc = report(client, category="garbage", text="Overflowing bins")["incident"]
    assert inc["assigned_resource_id"] is None
    assert inc["status"] == "escalated"
    assert inc["escalation_level"] == 1
    assert {"no_resource", "escalated"} <= set(events(client, inc["id"]))


# Rule 3: replan -------------------------------------------------------------------------------

def test_unavailable_crew_triggers_replan_to_next_nearest(client):
    inc = report(client, category="pothole", text="Pothole")["incident"]
    r = client.post("/resources/res_roads_1/unavailable").json()
    assert r["resource"]["available"] is False
    assert r["resource"]["active_incident_ids"] == []
    [re] = r["replanned"]
    assert re["id"] == inc["id"]
    assert re["assigned_resource_id"] == "res_roads_2"
    assert re["plan_version"] == 2
    ev = events(client, inc["id"])
    assert ev.index("plan_invalidated") < ev.index("replanned")


def test_unavailable_only_crew_escalates_and_return_reassigns(client):
    inc = report(client)["incident"]["id"]
    [re] = client.post("/resources/res_water_1/unavailable").json()["replanned"]
    assert re["status"] == "escalated" and re["assigned_resource_id"] is None
    client.post("/resources/res_water_1/available")
    back = detail(client, inc)["incident"]
    assert back["status"] == "assigned" and back["assigned_resource_id"] == "res_water_1"


# Rule 4: SLA ----------------------------------------------------------------------------------

def test_sla_breach_escalates_and_extends_deadline(client):
    inc = report(client, category="streetlight", text="Light out")["incident"]  # 24 h SLA
    r = client.post("/sim/tick", params={"minutes": 23 * 60}).json()
    assert r["escalated"] == []
    r = client.post("/sim/tick", params={"minutes": 2 * 60}).json()
    [esc] = r["escalated"]
    assert esc["id"] == inc["id"]
    assert esc["status"] == "escalated"
    assert esc["escalation_level"] == 1
    assert esc["deadline"] == add_hours(inc["deadline"], 12)
    assert "sla_breach" in events(client, inc["id"])
    # Not breached again until the extended deadline passes.
    assert client.post("/sim/tick", params={"minutes": 60}).json()["escalated"] == []
    assert len(client.post("/sim/tick", params={"minutes": 12 * 60}).json()["escalated"]) == 1


def test_sla_ignores_verified_closed(client):
    inc = report(client, category="streetlight", text="Light out")["incident"]["id"]
    finish_work(client, inc)
    evidence(client, inc, True)
    assert client.post("/sim/tick", params={"minutes": 100 * 60}).json()["escalated"] == []


def test_sla_breach_while_pending_verification_still_verifiable(client):
    inc = report(client)["incident"]["id"]  # 12 h SLA
    finish_work(client, inc)
    client.post("/sim/tick", params={"minutes": 13 * 60})
    assert detail(client, inc)["incident"]["status"] == "escalated"
    assert evidence(client, inc, True)["incident"]["status"] == "verified_closed"


# Rule 5: verify -------------------------------------------------------------------------------

def test_complete_does_not_close(client):
    inc = report(client)["incident"]["id"]
    done = finish_work(client, inc)
    assert done["status"] == "pending_verification"
    assert client.get("/metrics").json()["verified_closures"] == 0


def test_supporting_evidence_closes_and_frees_crew(client):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    r = evidence(client, inc, True, kind="photo")
    assert r["incident"]["status"] == "verified_closed"
    assert r["evidence"]["supports_resolution"] is True
    water = next(x for x in client.get("/resources").json() if x["id"] == "res_water_1")
    assert inc not in water["active_incident_ids"]


def test_contradicting_evidence_reopens_as_false_closure(client):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    r = evidence(client, inc, False, kind="citizen_followup", note="still leaking")
    assert r["incident"]["status"] == "reopened"
    assert r["incident"]["assigned_resource_id"] == "res_water_1"
    assert "false_closure_detected" in events(client, inc)
    assert client.get("/metrics").json()["false_closures_caught"] == 1
    # Work must be redone and re-verified; old contradiction does not block the new closure.
    finish_work(client, inc)
    assert evidence(client, inc, True)["incident"]["status"] == "verified_closed"


def test_evidence_before_completion_does_not_close(client):
    inc = report(client)["incident"]["id"]
    assert evidence(client, inc, True)["incident"]["status"] == "assigned"


def test_duplicate_report_after_completion_reopens(client):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    client.post("/sim/tick", params={"minutes": 30})
    report(client, north=30, text="Still leaking here")
    assert detail(client, inc)["incident"]["status"] == "reopened"
    assert client.get("/metrics").json()["false_closures_caught"] == 1


def test_invalid_transitions_rejected(client):
    inc = report(client)["incident"]["id"]
    assert client.post(f"/incidents/{inc}/complete", json={"note": ""}).status_code == 409
    client.post(f"/incidents/{inc}/start")
    assert client.post(f"/incidents/{inc}/start").status_code == 409
    assert client.post("/incidents/inc_999/start").status_code == 404


# Rule 6: audit --------------------------------------------------------------------------------

def test_every_status_change_is_audited(client):
    client.post("/sim/scenario/golden")
    for inc in client.get("/incidents").json():
        audit = detail(client, inc["id"])["audit"]
        changes = [a for a in audit if a["to_status"] is not None]
        assert changes[0]["from_status"] is None and changes[0]["to_status"] == "open"
        for prev, cur in zip(changes, changes[1:]):
            assert cur["from_status"] == prev["to_status"], (prev, cur)
        assert changes[-1]["to_status"] == inc["status"]
