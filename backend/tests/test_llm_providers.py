"""Provider selection (Anthropic / Gemini), mocked Gemini path, photo upload limits."""
import base64
import json
from types import SimpleNamespace

import pytest

from app.engine import llm

from .images import jpeg
from .test_rules import finish_work, report

PHOTO = {"data": base64.b64encode(jpeg()).decode(), "media_type": "image/jpeg"}


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "CONVERGE_LLM_PROVIDER"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("CONVERGE_LLM", "on")


@pytest.mark.parametrize("env,expected", [
    ({}, None),
    ({"ANTHROPIC_API_KEY": "a"}, "anthropic"),
    ({"GEMINI_API_KEY": "g"}, "gemini"),
    ({"ANTHROPIC_API_KEY": "a", "GEMINI_API_KEY": "g"}, "anthropic"),
    ({"ANTHROPIC_API_KEY": "a", "GEMINI_API_KEY": "g", "CONVERGE_LLM_PROVIDER": "gemini"}, "gemini"),
    ({"GEMINI_API_KEY": "g", "CONVERGE_LLM_PROVIDER": "anthropic"}, None),
    ({"GEMINI_API_KEY": "g", "CONVERGE_LLM": "off"}, None),
])
def test_provider_selection(monkeypatch, env, expected):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    assert llm.provider() == expected


class FakeGemini:
    def __init__(self, payloads, exc=None):
        self.payloads, self.exc, self.calls = list(payloads), exc, []
        self.models = self

    def generate_content(self, *, model, contents, config):
        self.calls.append(SimpleNamespace(model=model, contents=contents, config=config))
        if self.exc:
            raise self.exc
        p = self.payloads.pop(0)
        return SimpleNamespace(text=p if isinstance(p, str) else json.dumps(p))


@pytest.fixture
def gemini(monkeypatch):
    def install(*payloads, exc=None):
        fake = FakeGemini(payloads, exc)
        monkeypatch.setenv("GEMINI_API_KEY", "g")
        monkeypatch.setattr(llm, "_get_gemini_client", lambda: fake)
        return fake
    return install


def test_gemini_rewrites_link_reason_with_json_schema(client, gemini):
    fake = gemini({"reason": "Same burst pipe.", "confidence": 0.99})
    report(client)
    link = report(client, north=60)["link"]
    assert link["kind"] == "duplicate" and link["reason"] == "Same burst pipe."
    assert link["confidence"] == round(0.8 + llm.MAX_CONFIDENCE_SHIFT, 2)  # clamped
    call = fake.calls[0]
    assert call.model == llm.DEFAULT_GEMINI_MODEL
    assert call.config.response_mime_type == "application/json"
    assert call.config.response_json_schema == llm.SCHEMA
    assert "<citizen_text>" in call.contents[-1]


def test_gemini_failure_falls_back(client, gemini):
    gemini(exc=RuntimeError("quota"))
    report(client)
    link = report(client, north=60)["link"]
    assert link["reason"].startswith("Same category (water_leak) 60 m")


def test_gemini_bad_json_falls_back(client, gemini):
    gemini("not json")
    report(client)
    assert report(client, north=60)["link"]["confidence"] == 0.8


def test_gemini_photo_check_is_signal_only(client, gemini):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    fake = gemini({"appears_fixed": False, "confidence": 0.7, "explanation": "Still wet."})
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "photo", "supports_resolution": True, "photo": PHOTO}).json()
    assert r["incident"]["status"] == "verified_closed"
    assert r["ai_check"]["appears_fixed"] is False
    part = fake.calls[0].contents[0]
    assert part.inline_data.data == jpeg() and part.inline_data.mime_type == "image/jpeg"


def test_photo_must_be_valid_base64(client):
    inc = report(client)["incident"]["id"]
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "photo", "supports_resolution": True, "photo": {"data": "not base64!!", "media_type": "image/png"}})
    assert r.status_code == 422


def test_photo_over_5mb_rejected_413_before_any_state_change(client):
    inc = report(client)["incident"]["id"]
    big = base64.b64encode(b"\0" * (5 * 1024 * 1024 + 1)).decode()
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "photo", "supports_resolution": True, "photo": {"data": big, "media_type": "image/png"}})
    assert r.status_code == 413
    assert client.get(f"/incidents/{inc}").json()["evidence"] == []


def test_photo_unknown_media_type_rejected(client):
    inc = report(client)["incident"]["id"]
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "photo", "supports_resolution": True, "photo": {"data": PHOTO["data"], "media_type": "image/tiff"}})
    assert r.status_code == 422
