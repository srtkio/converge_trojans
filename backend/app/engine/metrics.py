from sqlmodel import Session, func, select

from app.models import AuditEvent, Incident, Link, Report


def _count(session: Session, stmt) -> int:
    return session.exec(stmt).one() or 0


def _events(session: Session, event_type: str) -> int:
    return _count(session, select(func.count()).select_from(AuditEvent).where(AuditEvent.event_type == event_type))


def compute(session: Session) -> dict:
    reports = _count(session, select(func.count()).select_from(Report))
    incidents = _count(session, select(func.count()).select_from(Incident))
    dups = _count(session, select(func.count()).select_from(Link).where(Link.kind == "duplicate"))
    false_closures = _events(session, "false_closure_detected")
    return {
        "reports": reports,
        "incidents": incidents,
        "duplicates_linked": dups,
        "duplicate_work_orders_avoided": reports - incidents,
        "false_closures_caught": false_closures,
        "verified_closures": _events(session, "verified_closed"),
        "sla_breaches": _events(session, "sla_breach"),
        "escalations": _count(session, select(func.count()).select_from(AuditEvent)
                              .where(AuditEvent.to_status == "escalated")),
        "replans": _events(session, "replanned"),
        # Naive system: one work order per report, every "complete" accepted as resolved.
        "baseline": {"work_orders": reports, "false_closures_accepted": false_closures},
    }
