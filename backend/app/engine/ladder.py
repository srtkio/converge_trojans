"""Operator hierarchy and the escalation ladder: who is told when an incident escalates."""
from sqlmodel import Session

from app.engine.audit import record
from app.models import AuditEvent, Incident

LADDER = [
    {"role": "officer", "title": "Department officer", "notified_at_escalation_level": 0},
    {"role": "head", "title": "Department head", "notified_at_escalation_level": 1},
    {"role": "command", "title": "City command centre", "notified_at_escalation_level": 2},
]


def recipient(incident: Incident) -> tuple[str, str]:
    """(to_role, who) for the incident's current escalation level."""
    if incident.escalation_level >= 2:
        return "command", "City command centre"
    return "head", f"{incident.department.capitalize()} department head"


def notify(session: Session, incident: Incident, reason: str) -> AuditEvent:
    """Audit `notified` naming who was told. to_role lives in the detail text (no extra column)."""
    to_role, who = recipient(incident)
    return record(session, incident.id, "notified",
                  f"{who} notified (to_role: {to_role}; escalation level {incident.escalation_level}): {reason}")
