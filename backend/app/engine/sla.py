"""Rule 4: SLA breach on clock tick."""
from sqlmodel import Session, select

from app import config
from app.engine.assign import assign
from app.engine.audit import record, transition
from app.models import Incident
from app.timeutil import add_hours, parse


def check_breaches(session: Session, now: str) -> list[Incident]:
    escalated = []
    incidents = session.exec(
        select(Incident).where(Incident.status != "verified_closed").order_by(Incident.id)
    ).all()
    for inc in incidents:
        if parse(now) <= parse(inc.deadline):
            continue
        sla = config.CATEGORIES[inc.category]["sla_hours"]
        old_deadline = inc.deadline
        inc.escalation_level += 1
        inc.deadline = add_hours(inc.deadline, sla / 2)
        transition(session, inc, "escalated", "sla_breach",
                   f"Missed deadline {old_deadline}; escalation level {inc.escalation_level}, "
                   f"new deadline {inc.deadline}")
        if not inc.assigned_resource_id:
            assign(session, inc, escalate_if_none=False)
        else:
            record(session, inc.id, "notified",
                   f"{inc.department} supervisor notified of breach on {inc.id}")
        escalated.append(inc)
    return escalated
