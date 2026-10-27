"""v2 root cause & coordinated repair (docs/ROADMAP.md)."""
from .test_rules import detail, evidence, events, finish_work, report


def leak_with_two_potholes(c):
    leak = report(c)["incident"]["id"]
    c.post("/sim/tick", params={"minutes": 10})
    p1 = report(c, category="pothole", north=120, text="Pothole")["incident"]["id"]
    c.post("/sim/tick", params={"minutes": 10})
    p2 = report(c, category="pothole", north=-280, text="Pothole at bus stop")["incident"]["id"]
    return leak, p1, p2


def test_related_group_proposes_one_hypothesis_with_upstream_cause(client):
    leak, p1, p2 = leak_with_two_potholes(client)
    [h] = client.get("/hypotheses").json()
    assert h["status"] == "proposed"
    assert h["cause_incident_id"] == leak
    assert h["member_ids"] == [p1, p2]
    assert 0 < h["confidence"] <= 0.95
    assert h["evidence_for"] and h["evidence_against"] and h["summary"]
    assert client.get("/hypotheses", params={"status": "confirmed"}).json() == []


def test_cause_is_upstream_even_if_reported_later(client):
    hole = report(client, category="pothole", text="Pothole")["incident"]["id"]
    client.post("/sim/tick", params={"minutes": 10})
    leak = report(client, north=100)["incident"]["id"]
    [h] = client.get("/hypotheses").json()
    assert h["cause_incident_id"] == leak and h["member_ids"] == [hole]
    assert any("reported before" in e for e in h["evidence_against"])


def test_hypothesis_confidence_is_deterministic(client):
    leak_with_two_potholes(client)
    a = client.get("/hypotheses").json()
    b = client.get("/hypotheses").json()
    assert a == b


def test_confirm_makes_parent_and_saves_crew_visits(client):
    leak, p1, p2 = leak_with_two_potholes(client)
    hid = client.get("/hypotheses").json()[0]["id"]
    r = client.post(f"/hypotheses/{hid}/confirm", json={"note": "same main"}).json()
    assert r["hypothesis"]["status"] == "confirmed" and r["hypothesis"]["decided_at"]
    assert r["parent"]["child_incident_ids"] == [p1, p2]
    for ch in r["children"]:
        assert ch["parent_incident_id"] == leak
        assert ch["assigned_resource_id"] is None
    assert "hypothesis_confirmed" in events(client, leak)
    assert {"linked_to_parent", "merged_into_parent_repair"} <= set(events(client, p1))
    m = client.get("/metrics").json()
    assert m["crew_visits_saved"] == 2
    assert m["coordinated_vs_independent"] == {"independent_visits": 3, "coordinated_visits": 1}
    assert m["hypotheses"] == {"proposed": 0, "confirmed": 1, "rejected": 0}
    roads = next(x for x in client.get("/resources").json() if x["id"] == "res_roads_1")
    assert roads["active_incident_ids"] == []


def test_waiting_child_cannot_start_and_is_not_auto_assigned(client):
    _, p1, _ = leak_with_two_potholes(client)
    client.post(f"/hypotheses/{client.get('/hypotheses').json()[0]['id']}/confirm")
    assert client.post(f"/incidents/{p1}/start").status_code == 409
    client.post("/resources/res_roads_1/unavailable")
    client.post("/resources/res_roads_1/available")
    assert detail(client, p1)["incident"]["assigned_resource_id"] is None


def test_waiting_child_sla_follows_parent(client):
    _, p1, _ = leak_with_two_potholes(client)
    client.post(f"/hypotheses/{client.get('/hypotheses').json()[0]['id']}/confirm")
    client.post("/sim/tick", params={"minutes": 60 * 60})
    assert "sla_breach" not in events(client, p1)


def test_parent_closed_moves_children_to_pending_not_closed(client):
    leak, p1, p2 = leak_with_two_potholes(client)
    client.post(f"/hypotheses/{client.get('/hypotheses').json()[0]['id']}/confirm")
    finish_work(client, leak)
    assert evidence(client, leak, True)["incident"]["status"] == "verified_closed"
    for ch in (p1, p2):
        inc = detail(client, ch)["incident"]
        assert inc["status"] == "pending_verification"
        assert "parent_resolved" in events(client, ch)
    # Closure != resolution: each child still needs its own evidence.
    assert evidence(client, p1, True, kind="citizen_followup")["incident"]["status"] == "verified_closed"
    r = evidence(client, p2, False, kind="citizen_followup", note="still a dip")
    assert r["incident"]["status"] == "reopened"
    assert r["incident"]["assigned_resource_id"] == "res_roads_1"  # now needs its own crew


def test_reject_keeps_incidents_independent(client):
    leak, p1, _ = leak_with_two_potholes(client)
    hid = client.get("/hypotheses").json()[0]["id"]
    r = client.post(f"/hypotheses/{hid}/reject", json={"note": "different streets"}).json()
    assert r["hypothesis"]["status"] == "rejected"
    assert detail(client, p1)["incident"]["parent_incident_id"] is None
    assert detail(client, p1)["incident"]["assigned_resource_id"] == "res_roads_1"
    assert "hypothesis_rejected" in events(client, leak)
    assert client.post(f"/hypotheses/{hid}/confirm").status_code == 409
    assert client.get("/metrics").json()["crew_visits_saved"] == 0


def test_new_related_incident_joins_confirmed_group(client):
    leak = report(client)["incident"]["id"]
    p1 = report(client, category="pothole", north=120, text="Pothole")["incident"]["id"]
    hid = client.get("/hypotheses").json()[0]["id"]
    client.post(f"/hypotheses/{hid}/confirm")
    p2 = report(client, category="pothole", north=-280, text="Another")["incident"]["id"]
    [h] = client.get("/hypotheses").json()
    assert h["member_ids"] == [p1, p2]
    assert detail(client, p2)["incident"]["parent_incident_id"] == leak


def test_unknown_hypothesis_404(client):
    assert client.post("/hypotheses/hyp_999/confirm").status_code == 404


def test_impact_lists_services_including_via_children(client):
    leak, _, p2 = leak_with_two_potholes(client)
    direct = {s["id"] for s in client.get(f"/incidents/{leak}/impact").json()["services"]}
    assert "svc_school_bahalgarh" in direct and "svc_bus_rishihood" not in direct
    client.post(f"/hypotheses/{client.get('/hypotheses').json()[0]['id']}/confirm")
    r = client.get(f"/incidents/{leak}/impact").json()
    assert r["simulated"] is True
    bus = next(s for s in r["services"] if s["id"] == "svc_bus_rishihood")
    assert bus["via_incident_id"] == p2 and bus["kind"] == "transport" and bus["impact"]
    assert len(client.get("/services").json()) == 6  # 3 by Rishihood University, 3 at Murthal Chowk


def test_rootcause_scenario_end_to_end(client):
    r = client.post("/sim/scenario/rootcause").json()
    assert r["step"] == 8
    assert {i["status"] for i in r["state"]["incidents"]} == {"verified_closed"}
    m = r["state"]["metrics"]
    assert m["crew_visits_saved"] == 2 and m["verified_closures"] == 3 and m["false_closures_caught"] == 0
    assert client.get("/sim/scenario/rootcause").json()["step"] == 8
    s5 = client.post("/sim/scenario/rootcause", params={"step": 5}).json()
    assert s5["state"]["metrics"]["hypotheses"]["confirmed"] == 1


def test_v1_golden_unaffected_by_v2(client):
    r = client.post("/sim/scenario/golden").json()
    m = r["state"]["metrics"]
    assert (m["duplicate_work_orders_avoided"], m["false_closures_caught"], m["verified_closures"],
            m["sla_breaches"]) == (1, 1, 1, 1)
    assert m["crew_visits_saved"] == 0


def test_decide_accepts_empty_json_body_like_the_ui(client):
    leak_with_two_potholes(client)
    hid = client.get("/hypotheses").json()[0]["id"]
    r = client.post(f"/hypotheses/{hid}/confirm", headers={"Content-Type": "application/json"}, content=b"")
    assert r.status_code == 200 and r.json()["hypothesis"]["status"] == "confirmed"
