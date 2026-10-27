"""POST /reports: store the report, apply rule 1, create or update incidents, auto-assign."""
from sqlmodel import Session, select

from app import config
from app.db import next_id, now
from app.engine import llm
from app.engine.assign import assign
from app.engine.audit import record, transition
from app.engine.dedup import classify
from app.engine.verify import reopen
from app.models import Incident, Link, Report
from app.timeutil import add_hours


def severity_for(category: str, text: str) -> int:
    base = config.CATEGORIES[category]["severity"]
    if any(w in text.lower() for w in config.URGENT_WORDS):
        base += 1
    return min(base, 5)


def _title(category: str, text: str) -> str:
    t = " ".join(text.split())
    return t if len(t) <= 60 else t[:57].rstrip() + "..."


def _new_incident(session: Session, report: Report) -> Incident:
    cat = config.CATEGORIES[report.category]
    inc = Incident(
        id=next_id(session, "inc"),
        title=_title(report.category, report.text),
        category=report.category,
        department=cat["department"],
        lat=report.lat,
        lng=report.lng,
        severity=severity_for(report.category, report.text),
        status="open",
        created_at=report.created_at,
        deadline=add_hours(report.created_at, cat["sla_hours"]),
        report_ids=[report.id],
    )
    session.add(inc)
    session.flush()
    record(session, inc.id, "created", f"New {report.category} incident from {report.id}; "
           f"SLA {cat['sla_hours']} h, deadline {inc.deadline}", actor="citizen", to_status="open")
    assign(session, inc)
    return inc


def submit_report(session: Session, text: str, category: str, lat: float, lng: float, reporter: str):
    at = now(session)
    report = Report(id=next_id(session, "rep"), text=text, category=category, lat=lat, lng=lng,
                    reporter=reporter, created_at=at)
    session.add(report)
    session.flush()

    match = classify(category, lat, lng, at, session.exec(select(Incident)).all())
    link = None
    if match and match.kind == "duplicate":
        inc = match.incident
        report.incident_id = inc.id
        inc.report_ids = [*inc.report_ids, report.id]
        inc.severity = max(inc.severity, severity_for(category, text))
        session.add(inc)
        reason = llm.explain_link("duplicate", text, inc.title, match.reason, match.reason)
        link = Link(id=next_id(session, "lnk"), report_id=report.id, incident_id=inc.id,
                    kind="duplicate", reason=reason, confidence=match.confidence)
        session.add(link)
        record(session, inc.id, "duplicate_linked", f"{report.id}: {match.reason}",
               actor="llm" if reason != match.reason else "system")
        if inc.status == "pending_verification" or (inc.status == "escalated" and inc.completed_at):
            reopen(session, inc, "false_closure_detected",
                   f"New duplicate report {report.id} after work was marked complete", actor="citizen")
        elif inc.status == "verified_closed":
            inc.completed_at = None
            transition(session, inc, "reopened", "reopened",
                       f"New duplicate report {report.id} after verified closure", actor="citizen")
            assign(session, inc)
    else:
        inc = _new_incident(session, report)
        report.incident_id = inc.id
        if match:  # related
            other = match.incident
            reason = llm.explain_link("related", text, other.title, match.reason, match.reason)
            link = Link(id=next_id(session, "lnk"), report_id=report.id, incident_id=other.id,
                        kind="related", reason=reason, confidence=match.confidence)
            session.add(link)
            inc.related_incident_ids = [*inc.related_incident_ids, other.id]
            other.related_incident_ids = [*other.related_incident_ids, inc.id]
            session.add(other)
            for a, b in ((inc, other), (other, inc)):
                record(session, a.id, "related_linked", f"Related to {b.id}: {match.reason}")
    session.add(report)
    session.flush()
    return report, inc, link
