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
