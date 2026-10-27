"""LLM refinement only rewrites Link.reason/confidence; decisions and fallbacks stay deterministic."""
import json
from types import SimpleNamespace

import pytest

from app.engine import llm

from .test_rules import report


class FakeMessages:
    def __init__(self, payload=None, exc=None, stop_reason="end_turn"):
        self.payload, self.exc, self.stop_reason, self.calls = payload, exc, stop_reason, 0

    def create(self, **kwargs):
        self.calls += 1
        assert kwargs["model"] == "claude-haiku-5-5"
        if self.exc:
            raise self.exc
        return SimpleNamespace(stop_reason=self.stop_reason,
                               content=[SimpleNamespace(type="text", text=json.dumps(self.payload))])


@pytest.fixture
def fake_llm(monkeypatch):
    def install(**kw):
        msgs = FakeMessages(**kw)
        monkeypatch.setenv("CONVERGE_LLM", "on")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        monkeypatch.setattr(llm, "_get_client", lambda: SimpleNamespace(messages=msgs))
        return msgs
    return install


def test_no_api_key_falls_back_silently(client, monkeypatch):
    monkeypatch.setenv("CONVERGE_LLM", "on")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    report(client)
    link = report(client, north=60)["link"]
    assert link["reason"].startswith("Same category (water_leak) 60 m")


def test_llm_rewrites_reason_and_clamps_confidence(client, fake_llm):
    msgs = fake_llm(payload={"reason": "Both describe the same burst pipe outside MG Road metro.", "confidence": 0.01})
    a = report(client)
    b = report(client, north=60)
    assert msgs.calls == 1  # first report had nothing to link to
    assert b["link"]["kind"] == "duplicate" and b["incident"]["id"] == a["incident"]["id"]
    assert b["link"]["reason"] == "Both describe the same burst pipe outside MG Road metro."
    rule_conf = 0.8  # 1 - 60/150 * 0.5
    assert b["link"]["confidence"] == round(rule_conf - llm.MAX_CONFIDENCE_SHIFT, 2)
    audit = client.get("/audit", params={"incident_id": a["incident"]["id"]}).json()
    assert any(e["event_type"] == "link_explained" and e["actor"] == "llm" for e in audit)


def test_llm_cannot_change_decision(client, fake_llm):
    fake_llm(payload={"reason": "These are definitely the same issue.", "confidence": 1.0})
    report(client)
    far = report(client, north=1000)
    assert far["link"] is None  # no link decided by rules, so the LLM is never asked


@pytest.mark.parametrize("kw", [
    {"exc": ValueError("boom")},
    {"payload": {"reason": ""}},
    {"payload": {"reason": "ok", "confidence": 0.5}, "stop_reason": "max_tokens"},
])
def test_llm_failures_fall_back_to_rule_text(client, fake_llm, kw):
    fake_llm(**kw)
    report(client)
    link = report(client, category="pothole", north=250, text="Pothole")["link"]
    assert link["kind"] == "related"
    assert link["reason"].startswith("pothole 250 m from water_leak")
    assert link["confidence"] == round(max(0.4, 0.9 - 250 / 400 * 0.5), 2)


def test_llm_disabled_flag_wins_over_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    monkeypatch.setenv("CONVERGE_LLM", "off")
    assert llm.refine_link("duplicate", "t", "i", "f", "rule", 0.7) == ("rule", 0.7, False)
