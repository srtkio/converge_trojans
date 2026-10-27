"""Trust, roles and SLA state: fake-complaint countermeasures, operator hierarchy, sla_state."""
import json
from pathlib import Path

import pytest

from app.engine.trust import RateLimiter

GT = (28.9831937, 77.0907966)  # GT Road (NH-44) at Rishihood University
NEW_INCIDENT_FIELDS = {"verification", "sla_state"}
BASELINE = json.loads((Path(__file__).parent / "fixtures" / "scenario_baseline.json").read_text())
RATE_MSG = "You've sent a lot of reports in a short time. Please wait a bit and try again."


def _report(client, text="Water gushing from a broken pipe", category="water_leak", at=GT, reporter="citizen:asha"):
    r = client.post("/reports", json={"text": text, "category": category, "lat": at[0], "lng": at[1],
                                      "reporter": reporter})
    assert r.status_code == 200, r.text
    return r.json()


def _reject(client, inc_id, badge, reason="fake", note=""):
    return client.post(f"/incidents/{inc_id}/reject", json={"reason": reason, "note": note, "by_badge": badge})


# --- golden / rootcause / city unchanged vs the committed baseline ------------------------------------


@pytest.mark.parametrize("name", ["golden", "rootcause", "city"])
def test_scenarios_unchanged_vs_main(client, name):
    run = client.post(f"/sim/scenario/{name}").json()
    after = {"run": run, "incidents": client.get("/incidents").json(), "metrics": client.get("/metrics").json()}
    for inc in after["incidents"]:
        assert NEW_INCIDENT_FIELDS <= inc.keys()
    # The baseline now includes the computed verification / sla_state fields (regenerated for the
    # Murthal/Sonipat move); test_relocation.py proves that move changed no decision.
    assert after == BASELINE[name]
    assert after["metrics"] == BASELINE[name]["metrics"]


# --- auth + hierarchy ----------------------------------------------------------------------


@pytest.mark.parametrize("badge,code,role,dept", [
    ("OPS-WTR-01", "water-demo-2026", "officer", "water"),
    ("OPS-RDS-01", "roads-demo-2026", "officer", "roads"),
    ("HEAD-WTR-01", "water-head-2026", "head", "water"),
    ("HEAD-RDS-01", "roads-head-2026", "head", "roads"),
    ("CMD-01", "command-demo-2026", "command", "all"),
])
def test_operator_login_returns_role(client, badge, code, role, dept):
    r = client.post("/auth/operator", json={"badge_id": badge, "access_code": code})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == role and r.json()["department"] == dept
    assert client.post("/auth/operator", json={"badge_id": badge, "access_code": "wrong"}).status_code == 401


def test_ladder_endpoint(client):
    assert client.get("/operators/ladder").json() == [
        {"role": "officer", "title": "Department officer", "notified_at_escalation_level": 0},
        {"role": "head", "title": "Department head", "notified_at_escalation_level": 1},
        {"role": "command", "title": "City command centre", "notified_at_escalation_level": 2},
    ]


def _notified(client, inc_id):
    return [a["detail"] for a in client.get("/audit", params={"incident_id": inc_id}).json()
            if a["event_type"] == "notified"]


def test_escalation_ladder_notifies_head_then_command(client):
    client.post("/resources/res_water_1/unavailable")
    inc = _report(client)["incident"]  # no water crew -> escalated, level 1
    assert inc["escalation_level"] == 1
    notes = _notified(client, inc["id"])
    assert len(notes) == 1
    assert notes[0].startswith("Water department head notified") and "to_role: head" in notes[0]

    client.post("/sim/tick", params={"minutes": 13 * 60})  # 12 h SLA missed -> level 2
    notes = _notified(client, inc["id"])
    assert len(notes) == 2
    assert notes[1].startswith("City command centre notified") and "to_role: command" in notes[1]
    # Exactly one notification per escalation (the old breach notice is extended, not duplicated).
    audit = client.get("/audit", params={"incident_id": inc["id"]}).json()
    assert len(notes) == sum(1 for a in audit if a["to_status"] == "escalated")


def test_golden_sla_breach_notifies_roads_head(client):
    client.post("/sim/scenario/golden")
    notes = _notified(client, "inc_002")
    assert len(notes) == 1 and notes[0].startswith("Roads department head notified")
    assert _notified(client, "inc_001")[0].startswith("Water department head notified")


# --- reject ---------------------------------------------------------------------------------


def test_officer_and_unknown_badge_cannot_reject(client):
    inc = _report(client)["incident"]
    r = _reject(client, inc["id"], "OPS-WTR-01")
    assert r.status_code == 403 and "department head or the city command centre" in r.json()["detail"]
    r = _reject(client, inc["id"], "NOPE-99")
    assert r.status_code == 403 and "Unknown operator badge" in r.json()["detail"]
    r = _reject(client, inc["id"], "HEAD-RDS-01")  # head of another department
    assert r.status_code == 403 and "roads" in r.json()["detail"]
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["status"] == "assigned"


def test_head_rejects_fake_complaint(client):
    inc = _report(client)["incident"]
    assert inc["assigned_resource_id"] == "res_water_1"
    r = _reject(client, inc["id"], "HEAD-WTR-01", "fake", "Photo is from another city")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["incident"]["status"] == "rejected"
    assert body["incident"]["assigned_resource_id"] is None
    assert body["incident"]["sla_state"] is None
    a = body["audit"]
    assert a["event_type"] == "rejected_invalid" and a["actor"] == "operator:HEAD-WTR-01"
    assert a["to_status"] == "rejected" and "fake" in a["detail"] and "Photo is from another city" in a["detail"]
    crew = {x["id"]: x for x in client.get("/resources").json()}["res_water_1"]
    assert inc["id"] not in crew["active_incident_ids"]
    assert [i["id"] for i in client.get("/incidents", params={"status": "rejected"}).json()] == [inc["id"]]


def test_command_rejects_any_department_and_second_reject_is_409(client):
    inc = _report(client, "Pothole on the corner", "pothole")["incident"]
    assert _reject(client, inc["id"], "CMD-01", "not_civic").status_code == 200
    r = _reject(client, inc["id"], "CMD-01", "fake")
    assert r.status_code == 409 and "rejected" in r.json()["detail"]


def test_reject_verified_closed_is_409_and_bad_reason_422(client):
    client.post("/sim/scenario/golden")
    assert _reject(client, "inc_001", "CMD-01").status_code == 409
    assert _reject(client, "inc_002", "CMD-01", reason="boring").status_code == 422
    assert _reject(client, "inc_999", "CMD-01").status_code == 404


def test_rejected_is_closed_for_sla_replan_and_dedup(client):
    inc = _report(client)["incident"]
    _reject(client, inc["id"], "CMD-01", "cannot_locate")
    tick = client.post("/sim/tick", params={"minutes": 30 * 60}).json()
    assert tick["escalated"] == []
    detail = client.get(f"/incidents/{inc['id']}").json()
    assert detail["incident"]["status"] == "rejected" and detail["incident"]["at_risk"] is False
    assert not [a for a in detail["audit"] if a["event_type"] in {"sla_breach", "sla_at_risk", "notified"}]
    # Crew changes never touch it.
    assert client.post("/resources/res_water_1/unavailable").json()["replanned"] == []
    client.post("/resources/res_water_1/available")
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["assigned_resource_id"] is None
    # A new report at the same spot opens a fresh incident instead of joining the rejected one.
    again = _report(client, reporter="citizen:ravi")
    assert again["incident"]["id"] != inc["id"] and again["link"] is None
    assert client.get("/metrics").json()["at_risk"] == 0


# --- reporter flags -------------------------------------------------------------------------


def test_reporter_flags_count_other_rejected_incidents(client):
    fake = _report(client, reporter="citizen:troll")["incident"]
    _reject(client, fake["id"], "CMD-01", "fake")
    far = (GT[0] + 0.02, GT[1])
    nxt = _report(client, "Streetlight out", "streetlight", far, "citizen:troll")["incident"]
    _report(client, "Streetlight out here too", "streetlight", far, "citizen:asha")
    reps = {r["reporter"]: r["reporter_flags"] for r in client.get(f"/incidents/{nxt['id']}").json()["reports"]}
    assert reps == {"citizen:troll": 1, "citizen:asha": 0}
    # The rejected incident itself counts only OTHER rejected incidents.
    assert client.get(f"/incidents/{fake['id']}").json()["reports"][0]["reporter_flags"] == 0


def test_anonymous_reporters_are_never_flagged(client):
    fake = _report(client, reporter="anonymous")["incident"]
    _reject(client, fake["id"], "CMD-01", "fake")
    nxt = _report(client, "Garbage pile", "garbage", (GT[0] + 0.02, GT[1]), "anonymous")["incident"]
    assert client.get(f"/incidents/{nxt['id']}").json()["reports"][0]["reporter_flags"] == 0


# --- rate limit -----------------------------------------------------------------------------


def test_sixth_report_in_an_hour_is_429(client):
    for i in range(5):
        _report(client, f"Pothole number {i}", "pothole", (GT[0] + 0.01 * i, GT[1]), "citizen:spam")
    r = client.post("/reports", json={"text": "one more", "category": "pothole", "lat": GT[0], "lng": GT[1],
                                      "reporter": "citizen:spam"})
    assert r.status_code == 429 and r.json() == {"detail": RATE_MSG}
    _report(client, reporter="citizen:asha")  # other reporters unaffected
    client.post("/sim/reset")  # demo reset starts fresh
    _report(client, reporter="citizen:spam")


def test_rate_limiter_uses_a_rolling_wall_clock_hour():
    t = [1000.0]
    lim = RateLimiter(limit=5, window_s=3600, clock=lambda: t[0])
    assert all(lim.allow("x") for _ in range(5))
    assert not lim.allow("x")
    t[0] += 3599
    assert not lim.allow("x")
    t[0] += 2
    assert lim.allow("x")


def test_scenarios_are_not_rate_limited(client):
    # The city scenario files many reports through submit_report directly; none are throttled.
    r = client.post("/sim/scenario/city").json()
    assert r["state"]["metrics"]["reports"] > 5


# --- verification ---------------------------------------------------------------------------


def test_verification_levels(client):
    inc = _report(client)["incident"]
    assert inc["verification"] == "unverified"
    _report(client, "Same leak again", reporter="citizen:asha")  # same person again: still one reporter
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["verification"] == "unverified"
    _report(client, "Big leak by the university gate", at=(GT[0] + 0.0005, GT[1]), reporter="citizen:ravi")
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["verification"] == "corroborated"
    client.post(f"/incidents/{inc['id']}/evidence",
                json={"kind": "citizen_followup", "supports_resolution": False, "note": "still there"})
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["verification"] == "corroborated"
    client.post(f"/incidents/{inc['id']}/evidence",
                json={"kind": "inspector", "supports_resolution": False, "note": "Seen on site"})
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["verification"] == "confirmed_on_site"
    assert {i["id"]: i for i in client.get("/incidents").json()}[inc["id"]]["verification"] == "confirmed_on_site"


def test_photo_evidence_confirms_on_site(client):
    inc = _report(client, "Pothole", "pothole")["incident"]
    client.post(f"/incidents/{inc['id']}/evidence",
                json={"kind": "photo", "supports_resolution": False, "note": "photo of the hole"})
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["verification"] == "confirmed_on_site"


# --- sla_state ------------------------------------------------------------------------------


def test_sla_state_on_track_at_risk_breached_closed(client):
    inc = _report(client)["incident"]  # water_leak: 12 h SLA, at risk under 3 h left
    assert inc["sla_state"] == "on_track"
    client.post("/sim/tick", params={"minutes": 9.5 * 60})
    assert client.get(f"/incidents/{inc['id']}").json()["incident"]["sla_state"] == "at_risk"
    client.post("/sim/tick", params={"minutes": 3 * 60})
    got = client.get(f"/incidents/{inc['id']}").json()["incident"]
    assert got["status"] == "escalated" and got["sla_state"] == "breached"
    # Deadline was extended after the breach, but the incident stays "breached" until closed.
    assert got["deadline"] > client.get("/sim/clock").json()["now"]
    client.post(f"/incidents/{inc['id']}/start")
    client.post(f"/incidents/{inc['id']}/complete", json={"note": "fixed"})
    closed = client.post(f"/incidents/{inc['id']}/evidence",
                         json={"kind": "inspector", "supports_resolution": True, "note": "dry"}).json()
    assert closed["incident"]["status"] == "verified_closed" and closed["incident"]["sla_state"] is None


def test_golden_sla_states(client):
    incs = {i["id"]: i for i in client.post("/sim/scenario/golden").json()["state"]["incidents"]}
    assert incs["inc_001"]["sla_state"] is None  # verified_closed
    assert incs["inc_002"]["sla_state"] == "breached"
    assert incs["inc_001"]["verification"] == "confirmed_on_site"
    assert incs["inc_002"]["verification"] == "unverified"
