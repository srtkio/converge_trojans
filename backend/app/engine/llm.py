"""Optional LLM wording for link reasons. Never changes a decision (rule 1).

Enabled only when ANTHROPIC_API_KEY is set and CONVERGE_LLM != "off". Any failure falls back to
the deterministic reason, so the demo works offline.
"""
import logging
import os

log = logging.getLogger(__name__)
MODEL = "claude-haiku-5-5"
_client = None


def enabled() -> bool:
    return os.environ.get("CONVERGE_LLM", "on") != "off" and bool(os.environ.get("ANTHROPIC_API_KEY"))


def _get_client():
    global _client
    if _client is None:
        import anthropic

        _client = anthropic.Anthropic(timeout=5.0, max_retries=0)
    return _client


def explain_link(kind: str, report_text: str, incident_title: str, facts: str, fallback: str) -> str:
    if not enabled():
        return fallback
    import anthropic

    prompt = (
        f"A city complaint system linked a new citizen report to an existing incident as '{kind}'. "
        f"The decision is final; explain it for a city operator in one plain sentence (max 30 words), "
        f"using only these facts.\n\nNew report: {report_text}\nExisting incident: {incident_title}\n"
        f"Facts: {facts}"
    )
    try:
        resp = _get_client().messages.create(
            model=MODEL,
            max_tokens=256,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": prompt}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), "").strip()
        return text or fallback
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        log.warning("LLM link explanation failed, using rule text: %s", e)
        return fallback
