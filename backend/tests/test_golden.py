def test_golden_scenario_end_to_end(client):
    r = client.post("/sim/scenario/golden").json()
    assert r["step"] == 10
    incs = {i["id"]: i for i in r["state"]["incidents"]}
    i1, i2 = incs["inc_001"], incs["inc_002"]
    assert i1["status"] == "verified_closed"
    assert i1["report_ids"] == ["rep_001", "rep_002"]
    assert i1["plan_version"] == 2
    assert i2["status"] == "escalated"
    assert i2["related_incident_ids"] == ["inc_001"]
    m = r["state"]["metrics"]
    assert m["duplicate_work_orders_avoided"] == 1
    assert m["false_closures_caught"] == 1
    assert m["verified_closures"] == 1
    assert m["sla_breaches"] == 1
    assert m["replans"] == 1
    assert m["baseline"] == {"work_orders": 3, "false_closures_accepted": 1}

    ev = [a["event_type"] for a in client.get("/audit", params={"incident_id": "inc_001"}).json()]
    for e in ["duplicate_linked", "plan_invalidated", "replanned", "work_completed",
              "false_closure_detected", "verified_closed"]:
        assert e in ev


def test_golden_stepwise_matches_full_run(client):
    statuses = []
    for n in range(1, 11):
        r = client.post("/sim/scenario/golden", params={"step": n}).json()
        assert r["step"] == n
        statuses.append({i["id"]: i["status"] for i in r["state"]["incidents"]})
    assert statuses[1] == {"inc_001": "assigned"}
    assert statuses[4]["inc_001"] == "escalated"
    assert statuses[5]["inc_001"] == "pending_verification"
    assert statuses[6]["inc_001"] == "reopened"
    assert statuses[7]["inc_001"] == "verified_closed"
    assert statuses[8]["inc_002"] == "escalated"


def test_golden_jump_back_replays(client):
    client.post("/sim/scenario/golden")
    r = client.post("/sim/scenario/golden", params={"step": 3}).json()
    assert [i["id"] for i in r["state"]["incidents"]] == ["inc_001"]
    assert r["state"]["metrics"]["duplicates_linked"] == 1


def test_reset_restores_seed(client):
    client.post("/sim/scenario/golden")
    client.post("/sim/reset")
    assert client.get("/incidents").json() == []
    assert len(client.get("/resources").json()) == 4
    assert client.get("/sim/clock").json() == {"now": "2026-10-27T09:00:00Z"}
