def _report(client, text, reporter):
    return client.post("/reports", json={"text": text, "category": "water_leak",
                                         "lat": 28.9832, "lng": 77.0864, "reporter": reporter}).json()


def test_citizen_complaint_appears_with_the_citizen_name(client):
    res = _report(client, "Water gushing near the university gate", "citizen:Asha")
    items = client.get("/citizen/activity").json()
    assert items[0]["kind"] == "complaint"
    assert items[0]["citizen"] == "citizen:Asha"
    assert items[0]["text"] == "Water gushing near the university gate"
    assert items[0]["incident_id"] == res["incident"]["id"]
    assert items[0]["incident_title"] == res["incident"]["title"]


def test_citizen_evidence_appears_with_its_note_and_answer(client):
    res = _report(client, "Water gushing near the university gate", "citizen:Asha")
    inc_id = res["incident"]["id"]
    client.post(f"/incidents/{inc_id}/evidence", json={
        "kind": "citizen_followup", "supports_resolution": False,
        "note": "Still leaking at the same spot", "source": "citizen:Asha"})
    items = client.get("/citizen/activity").json()
    evidence = [i for i in items if i["kind"] == "evidence"]
    assert len(evidence) == 1
    assert evidence[0]["text"] == "Still leaking at the same spot"
    assert evidence[0]["supports"] is False
    assert evidence[0]["citizen"] == "citizen:Asha"


def test_operator_evidence_is_not_listed_as_citizen_activity(client):
    res = _report(client, "Pothole on the bus stop road", "citizen:Ravi")
    inc_id = res["incident"]["id"]
    client.post(f"/incidents/{inc_id}/evidence", json={
        "kind": "inspector", "supports_resolution": True, "note": "Inspected", "source": "inspector:kumar"})
    kinds = [i["kind"] for i in client.get("/citizen/activity").json()]
    assert "evidence" not in kinds


def test_newest_first_and_limit(client):
    for n in range(3):
        _report(client, f"Complaint {n}", f"citizen:P{n}")
    items = client.get("/citizen/activity?limit=2").json()
    assert len(items) == 2
    assert items[0]["text"] == "Complaint 2"
