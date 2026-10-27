"""v3: SLA at-risk flag, AI photo check (signal only), real feedback."""
import base64

from types import SimpleNamespace

import pytest

from app.engine import llm

from .images import jpeg
from .test_rules import detail, events, finish_work, report

PHOTO = {"data": base64.b64encode(jpeg()).decode(), "media_type": "image/jpeg"}


def test_at_risk_flag_before_breach_and_alert_once(client):
    inc = report(client, category="streetlight", text="Light out")["incident"]["id"]  # 24 h SLA, 6 h = 25%
    client.post("/sim/tick", params={"minutes": 17 * 60})
    assert detail(client, inc)["incident"]["at_risk"] is False
    client.post("/sim/tick", params={"minutes": 2 * 60})  # 5 h left
    assert detail(client, inc)["incident"]["at_risk"] is True
    client.post("/sim/tick", params={"minutes": 60})
    assert events(client, inc).count("sla_at_risk") == 1
    assert client.get("/metrics").json()["at_risk"] == 1


def test_starting_work_clears_at_risk(client):
    inc = report(client, category="streetlight", text="Light out")["incident"]["id"]
    client.post("/sim/tick", params={"minutes": 20 * 60})
    client.post(f"/incidents/{inc}/start")
    assert detail(client, inc)["incident"]["at_risk"] is False
    client.post("/sim/tick", params={"minutes": 60})
    assert detail(client, inc)["incident"]["at_risk"] is False


def test_evidence_without_photo_still_works(client):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "citizen_followup", "supports_resolution": True, "note": "fixed", "source": "citizen"}).json()
    assert r["incident"]["status"] == "verified_closed" and r["ai_check"] is None


def test_photo_without_key_skips_ai_check(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    inc = report(client)["incident"]["id"]
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "photo", "supports_resolution": True, "photo": PHOTO}).json()
    assert r["ai_check"] is None


@pytest.fixture
def fake_vision(monkeypatch):
    def install(appears_fixed, confidence=0.9):
        def create(**kw):
            content = kw["messages"][0]["content"]
            assert content[0]["type"] == "image" and content[0]["source"]["data"] == PHOTO["data"]
            text = ('{"appears_fixed": %s, "confidence": %s, "explanation": "Water still pooling."}'
                    % ("true" if appears_fixed else "false", confidence))
            return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=text)])
        monkeypatch.setenv("CONVERGE_LLM", "on")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
        monkeypatch.setattr(llm, "_get_client", lambda: SimpleNamespace(messages=SimpleNamespace(create=create)))
    return install


def test_ai_check_is_signal_only_and_cannot_reopen(client, fake_vision):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    fake_vision(appears_fixed=False)
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "photo", "supports_resolution": True, "note": "crew photo", "photo": PHOTO}).json()
    # Rule 5 decides on the submitted evidence; the AI disagreeing is recorded, not enforced.
    assert r["incident"]["status"] == "verified_closed"
    assert r["ai_check"]["appears_fixed"] is False and r["ai_check"]["evidence_id"]
    ev = {e["id"]: e for e in detail(client, inc)["evidence"]}
    ai = ev[r["ai_check"]["evidence_id"]]
    assert ai["signal_only"] is True and ai["source"] == "ai-check" and ai["kind"] == "photo"
    audit = [a for a in detail(client, inc)["audit"] if a["event_type"] == "ai_photo_check"]
    assert audit and audit[0]["actor"] == "llm" and "human review" in audit[0]["detail"]


def test_ai_check_cannot_close(client, fake_vision):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    fake_vision(appears_fixed=True)
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "citizen_followup", "supports_resolution": False, "note": "still leaking", "photo": PHOTO}).json()
    assert r["incident"]["status"] == "reopened"
    assert r["ai_check"]["appears_fixed"] is True


def test_signal_only_evidence_never_blocks_later_closure(client, fake_vision):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    fake_vision(appears_fixed=False)
    client.post(f"/incidents/{inc}/evidence", json={"kind": "sensor", "supports_resolution": True,
                                                    "photo": PHOTO})
    assert detail(client, inc)["incident"]["status"] == "verified_closed"


def test_feedback_submit_summary_and_survives_reset(client):
    before = client.get("/feedback/summary").json()["count"]
    client.post("/feedback", json={"rating": 5, "comment": "Clear status page", "role": "citizen",
                                   "page": "/track", "incident_id": "inc_001"})
    client.post("/feedback", json={"rating": 3, "role": "operator"})
    assert client.post("/feedback", json={"rating": 6, "role": "citizen"}).status_code == 422
    client.post("/sim/reset")
    s = client.get("/feedback/summary").json()
    assert s["count"] == before + 2
    assert s["distribution"]["5"] >= 1 and s["distribution"]["3"] >= 1
    assert s["by_role"]["citizen"]["count"] >= 1
    assert s["recent"][0]["comment"] == "Clear status page"
    fb = client.get("/feedback").json()
    assert fb[0]["created_at"] >= fb[-1]["created_at"]
