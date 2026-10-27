"""Optional LLM wording for link reasons and confidence. Never changes a decision (rule 1).

Enabled only when ANTHROPIC_API_KEY is set and CONVERGE_LLM != "off". Any failure falls back to
the deterministic reason and confidence, so the demo works offline.
"""
import json
import logging
import os

log = logging.getLogger(__name__)
MODEL = "claude-haiku-5-5"
# The LLM may nudge the rule-based confidence by at most this much, so it can't flip its meaning.
MAX_CONFIDENCE_SHIFT = 0.15
_client = None

SCHEMA = {
    "type": "object",
    "properties": {
        "reason": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["reason", "confidence"],
    "additionalProperties": False,
}


def enabled() -> bool:
    return os.environ.get("CONVERGE_LLM", "on") != "off" and bool(os.environ.get("ANTHROPIC_API_KEY"))


def _get_client():
    global _client
    if _client is None:
        import anthropic

        _client = anthropic.Anthropic(timeout=5.0, max_retries=0)
    return _client


def _clamp(value: float, base: float) -> float:
    lo, hi = max(0.05, base - MAX_CONFIDENCE_SHIFT), min(1.0, base + MAX_CONFIDENCE_SHIFT)
    return round(min(hi, max(lo, value)), 2)


def refine_link(kind: str, report_text: str, incident_title: str, facts: str,
                reason: str, confidence: float) -> tuple[str, float, bool]:
    """Return (reason, confidence, used_llm). Falls back to the inputs on any problem."""
    if not enabled():
        return reason, confidence, False
    import anthropic

    prompt = (
        f"A city complaint system has already linked a new citizen report to an existing incident as "
        f"'{kind}'. That decision is final. Write one plain sentence (max 30 words) explaining the "
        f"link to a city operator, using only the facts below, and rate from 0 to 1 how confident "
        f"you are that the two refer to the {'same problem' if kind == 'duplicate' else 'connected problems'}."
        f"\n\nNew report: {report_text}\nExisting incident: {incident_title}\nFacts: {facts}"
    )
    try:
        resp = _get_client().messages.create(
            model=MODEL,
            max_tokens=256,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
            messages=[{"role": "user", "content": prompt}],
        )
        if resp.stop_reason != "end_turn":
            raise ValueError(f"stop_reason={resp.stop_reason}")
        data = json.loads(next(b.text for b in resp.content if b.type == "text"))
        text = " ".join(str(data["reason"]).split())
        if not text:
            raise ValueError("empty reason")
        return text, _clamp(float(data["confidence"]), confidence), True
    except (anthropic.APIError, ValueError, KeyError, TypeError, StopIteration) as e:
        log.warning("LLM link refinement failed, using rule text: %s", e)
        return reason, confidence, False


def refine_summary(rule_text: str, cause_title: str, member_titles: list[str]) -> str:
    """Optional plain-language rewrite of a root-cause hypothesis summary."""
    if not enabled():
        return rule_text
    import anthropic

    prompt = (
        "A city operations system grouped incidents under one probable root cause. Rewrite this "
        "summary as one plain sentence (max 35 words) for a city operator. Do not add facts.\n\n"
        f"Summary: {rule_text}\nCause incident: {cause_title}\nOther incidents: {'; '.join(member_titles)}"
    )
    try:
        resp = _get_client().messages.create(
            model=MODEL, max_tokens=256, output_config={"effort": "low"},
            messages=[{"role": "user", "content": prompt}],
        )
        if resp.stop_reason != "end_turn":
            raise ValueError(f"stop_reason={resp.stop_reason}")
        text = " ".join(next(b.text for b in resp.content if b.type == "text").split())
        return text or rule_text
    except (anthropic.APIError, ValueError, StopIteration) as e:
        log.warning("LLM summary failed, using rule text: %s", e)
        return rule_text


PHOTO_SCHEMA = {
    "type": "object",
    "properties": {
        "appears_fixed": {"type": "boolean"},
        "confidence": {"type": "number"},
        "explanation": {"type": "string"},
    },
    "required": ["appears_fixed", "confidence", "explanation"],
    "additionalProperties": False,
}


def check_photo(data_b64: str, media_type: str, category: str, title: str) -> dict | None:
    """v3: does the photo *appear* to show the problem fixed? A signal only; never decides closure."""
    if not enabled():
        return None
    import anthropic

    prompt = (
        f"This photo was submitted as evidence that a city {category.replace('_', ' ')} problem "
        f"(\"{title}\") has been fixed. Judge only what is visible. Does it appear fixed? Give "
        "a confidence from 0 to 1 and one short sentence explaining what you see."
    )
    try:
        resp = _get_client().messages.create(
            model=MODEL,
            max_tokens=512,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": PHOTO_SCHEMA}},
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data_b64}},
                {"type": "text", "text": prompt},
            ]}],
        )
        if resp.stop_reason != "end_turn":
            raise ValueError(f"stop_reason={resp.stop_reason}")
        data = json.loads(next(b.text for b in resp.content if b.type == "text"))
        return {
            "appears_fixed": bool(data["appears_fixed"]),
            "confidence": round(min(1.0, max(0.0, float(data["confidence"]))), 2),
            "explanation": " ".join(str(data["explanation"]).split())[:300],
        }
    except (anthropic.APIError, ValueError, KeyError, TypeError, StopIteration) as e:
        log.warning("AI photo check failed, skipping: %s", e)
        return None
