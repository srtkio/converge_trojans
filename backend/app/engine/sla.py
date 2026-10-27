"""Rule 4: SLA breach on clock tick."""
from sqlmodel import Session, select

from app import config
from app.engine import ladder
from app.engine.assign import assign
from app.engine.audit import record, transition
from app.engine.hierarchy import CLOSED_STATES, waiting_on_parent
from app.models import Incident
from app.timeutil import add_hours, parse


def check_breaches(session: Session, now: str) -> list[Incident]:
    escalated = []
    incidents = session.exec(
        select(Incident).where(Incident.status.not_in(CLOSED_STATES)).order_by(Incident.id)
    ).all()
    for inc in incidents:
        if waiting_on_parent(session, inc):
            continue  # the parent's SLA governs a coordinated repair
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
        # Escalation ladder: level 1 -> department head, level 2+ -> city command centre.
        ladder.notify(session, inc, f"SLA breach on {inc.id}, missed deadline {old_deadline}")
        escalated.append(inc)
    return escalated


STARTED = {"in_progress", "pending_verification"}


def check_at_risk(session: Session, now: str) -> list[Incident]:
    """v3: flag not-started incidents with under AT_RISK_SHARE of their SLA left; alert once per deadline."""
    flagged = []
    incidents = session.exec(
        select(Incident).where(Incident.status.not_in(CLOSED_STATES)).order_by(Incident.id)
    ).all()
    for inc in incidents:
        sla = config.CATEGORIES[inc.category]["sla_hours"]
        left_h = (parse(inc.deadline) - parse(now)).total_seconds() / 3600
        risk = (inc.status not in STARTED and inc.completed_at is None
                and not waiting_on_parent(session, inc)
                and 0 < left_h < sla * config.AT_RISK_SHARE)
        if risk and inc.at_risk_deadline != inc.deadline:
            inc.at_risk_deadline = inc.deadline
            record(session, inc.id, "sla_at_risk",
                   f"{left_h:.1f} h left of {sla} h SLA and work not started; "
                   f"{inc.department} supervisor notified before breach")
            flagged.append(inc)
        if inc.at_risk != risk:
            inc.at_risk = risk
        session.add(inc)
    return flagged
