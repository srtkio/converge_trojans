"""Rule 5: work complete != resolved. Closure needs supporting evidence and no contradiction."""
from fastapi import HTTPException
from sqlmodel import Session, select

from app.db import next_id, now
from app.engine.assign import assign, release
from app.engine.audit import record, transition
from app.engine.hierarchy import waiting_on_parent
from app.models import Evidence, Incident, Report, Resource
from app.timeutil import parse

STARTABLE = {"assigned", "reopened", "escalated"}


def _awaiting_verification(inc: Incident) -> bool:
    return inc.completed_at is not None and inc.status in {"pending_verification", "escalated"}


def start(session: Session, inc: Incident) -> Incident:
    if waiting_on_parent(session, inc):
        raise HTTPException(409, f"{inc.id} waits on root-cause repair of {inc.parent_incident_id}")
    if inc.status not in STARTABLE or not inc.assigned_resource_id or inc.completed_at:
        raise HTTPException(409, f"Cannot start incident in status {inc.status}"
                                 + ("" if inc.assigned_resource_id else " without an assigned crew"))
    transition(session, inc, "in_progress", "work_started", actor=f"department:{inc.department}")
    return inc


def complete(session: Session, inc: Incident, note: str) -> Incident:
    if inc.status != "in_progress":
        raise HTTPException(409, f"Cannot complete incident in status {inc.status}")
    inc.completed_at = now(session)
    transition(session, inc, "pending_verification", "work_completed",
               f"Department reports work complete: {note}".rstrip(": "),
               actor=f"department:{inc.department}")
    return inc


def reopen(session: Session, inc: Incident, event_type: str, detail: str,
           evidence_ids: list[str] | None = None, actor: str = "system") -> None:
    inc.completed_at = None
    transition(session, inc, "reopened", event_type, detail, actor=actor, evidence_ids=evidence_ids)
    res = session.get(Resource, inc.assigned_resource_id) if inc.assigned_resource_id else None
    if res is None or not res.available:
        release(session, inc)
        assign(session, inc)


def _contradicted_since(session: Session, inc: Incident, exclude_id: str) -> bool:
    since = parse(inc.completed_at)
    ev = session.exec(select(Evidence).where(Evidence.incident_id == inc.id)).all()
    return any(e.id != exclude_id and not e.signal_only and not e.supports_resolution
               and parse(e.created_at) > since for e in ev)


def _duplicate_since(session: Session, inc: Incident) -> bool:
    since = parse(inc.completed_at)
    reps = session.exec(select(Report).where(Report.incident_id == inc.id)).all()
    return any(parse(r.created_at) > since for r in reps)


def add_evidence(session: Session, inc: Incident, kind: str, supports: bool, note: str, source: str) -> Evidence:
    ev = Evidence(id=next_id(session, "ev"), incident_id=inc.id, kind=kind,
                  supports_resolution=supports, note=note, source=source, created_at=now(session))
    session.add(ev)
    session.flush()
    actor = "citizen" if kind == "citizen_followup" else f"department:{inc.department}" if kind == "inspector" else "system"
    verdict = "supports" if supports else "contradicts"
    label = f"{kind} evidence {verdict} resolution" + (f": {note}" if note else "")

    if not supports and (_awaiting_verification(inc) or inc.status == "verified_closed"):
        reopen(session, inc, "false_closure_detected", label, [ev.id], actor)
    elif supports and _awaiting_verification(inc):
        if _contradicted_since(session, inc, ev.id) or _duplicate_since(session, inc):
            # Contradictions already reopened the incident; this only guards ordering edge cases.
            reopen(session, inc, "false_closure_detected",
                   "Supporting evidence received but newer contradicting reports exist", [ev.id], actor)
        else:
            transition(session, inc, "verified_closed", "verified_closed", label, actor, [ev.id])
            release(session, inc)
            if inc.child_incident_ids:
                from app.engine.rootcause import on_parent_closed

                on_parent_closed(session, inc)
            from app.engine.rootcause import refresh

            refresh(session)
    else:
        record(session, inc.id, "evidence_added", label + " (no verification pending)", actor,
               evidence_ids=[ev.id])
    return ev


def record_ai_check(session: Session, inc: Incident, check: dict, submitted: Evidence) -> Evidence:
    """Store an AI photo verdict as signal-only evidence. It never changes the incident's status."""
    verdict = "appears fixed" if check["appears_fixed"] else "does not appear fixed"
    ev = Evidence(id=next_id(session, "ev"), incident_id=inc.id, kind="photo",
                  supports_resolution=check["appears_fixed"], signal_only=True, source="ai-check",
                  note=f"AI photo check: {verdict} ({check['confidence']:.2f}). {check['explanation']}",
                  created_at=now(session))
    session.add(ev)
    session.flush()
    detail = ev.note
    if submitted.supports_resolution and not check["appears_fixed"]:
        detail += " Disagrees with the submitted evidence; human review advised."
    record(session, inc.id, "ai_photo_check", detail, actor="llm", evidence_ids=[submitted.id, ev.id])
    return ev
