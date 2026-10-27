"""Every state change goes through `transition` so it always writes an AuditEvent (rule 6)."""
from sqlmodel import Session, func, select

from app.db import next_id, now
from app.models import AuditEvent, Incident


def record(
    session: Session,
    incident_id: str | None,
    event_type: str,
    detail: str = "",
    actor: str = "system",
    from_status: str | None = None,
    to_status: str | None = None,
    evidence_ids: list[str] | None = None,
) -> AuditEvent:
    seq = (session.exec(select(func.max(AuditEvent.seq))).one() or 0) + 1
    ev = AuditEvent(
        id=next_id(session, "aud"),
        seq=seq,
        incident_id=incident_id,
        actor=actor,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        detail=detail,
        evidence_ids=evidence_ids or [],
        timestamp=now(session),
    )
    session.add(ev)
    session.flush()
    return ev


def transition(
    session: Session,
    incident: Incident,
    to_status: str,
    event_type: str,
    detail: str = "",
    actor: str = "system",
    evidence_ids: list[str] | None = None,
) -> AuditEvent:
    from_status = incident.status
    incident.status = to_status
    if to_status in {"in_progress", "pending_verification", "verified_closed", "rejected"}:
        incident.at_risk = False
    session.add(incident)
    return record(session, incident.id, event_type, detail, actor, from_status, to_status, evidence_ids)
