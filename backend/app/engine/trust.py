"""Fake-complaint countermeasures and SLA state.

- `verification`: how well a complaint is backed (reporters, photo+GPS, on-site evidence).
- `reject`: a department head or the command centre closes an invalid complaint.
- `reporter_flags`: how many of a reporter's other complaints were rejected.
- `RateLimiter`: per-reporter cap on POST /reports, in wall-clock time (applied in the HTTP route
  only, so the simulated scenarios are never throttled).
- `sla_state`: on_track | at_risk | breached for live countdowns (null once closed/rejected).
All rules are deterministic; nothing here uses the LLM.
"""
import threading
import time
from collections import deque

from fastapi import HTTPException
from sqlmodel import Session, select

from app.db import now
from app.engine.assign import assign, release
from app.engine.audit import record, transition
from app.engine.hierarchy import CLOSED_STATES, waiting_on_parent
from app.models import AuditEvent, Evidence, Incident, Report
from app.timeutil import parse

REJECT_REASONS = ("fake", "not_civic", "cannot_locate", "duplicate_elsewhere")
REJECT_ROLES = {"head", "command"}
ON_SITE_KINDS = {"inspector", "photo"}


# --- verification ---------------------------------------------------------------------------


def _has_photo_and_gps(report: Report) -> bool:
    # Report photo/location fields arrive with the photos backend; absent fields count as no evidence.
    return bool(getattr(report, "photo_id", None)) and getattr(report, "location_source", None) == "gps"


def verification(session: Session, inc: Incident) -> str:
    """Strongest level that applies: confirmed_on_site > corroborated > unverified."""
    evidence = session.exec(select(Evidence).where(Evidence.incident_id == inc.id)).all()
    # Someone was physically there: an inspector or a (human) photo. AI checks are signal only.
    if any(e.kind in ON_SITE_KINDS and not e.signal_only for e in evidence):
        return "confirmed_on_site"
    reports = session.exec(select(Report).where(Report.incident_id == inc.id)).all()
    if len({r.reporter for r in reports}) >= 2 or any(_has_photo_and_gps(r) for r in reports):
        return "corroborated"
    return "unverified"


# --- SLA state ------------------------------------------------------------------------------


def sla_state(session: Session, inc: Incident, _depth: int = 0) -> str | None:
    if inc.status in CLOSED_STATES:
        return None
    # A child waiting on a coordinated root-cause repair follows its parent's clock.
    if _depth < 5 and waiting_on_parent(session, inc):
        parent = session.get(Incident, inc.parent_incident_id)
        return sla_state(session, parent, _depth + 1) or "on_track"
    breached_before = session.exec(
        select(AuditEvent.id).where(AuditEvent.incident_id == inc.id, AuditEvent.event_type == "sla_breach")
    ).first()
    if breached_before or parse(now(session)) > parse(inc.deadline):
        return "breached"
    if inc.at_risk:
        return "at_risk"
    return "on_track"


# --- reporter flags -------------------------------------------------------------------------

UNIDENTIFIED = {"", "anonymous"}


def reporter_flags(session: Session, reporters: set[str], exclude_incident_id: str) -> dict[str, int]:
    """For each reporter: number of OTHER incidents, now rejected, that contain a report from them.
    Unidentified reporters ("anonymous") are never flagged: they are not one person."""
    rows = session.exec(
        select(Report.reporter, Report.incident_id)
        .join(Incident, Incident.id == Report.incident_id)
        .where(Incident.status == "rejected", Report.reporter.in_(list(reporters)),
               Incident.id != exclude_incident_id)
    ).all()
    seen: dict[str, set[str]] = {r: set() for r in reporters}
    for reporter, incident_id in rows:
        seen[reporter].add(incident_id)
    return {r: (0 if r in UNIDENTIFIED else len(ids)) for r, ids in seen.items()}


# --- reject ---------------------------------------------------------------------------------


def reject(session: Session, inc: Incident, reason: str, note: str, operator: dict | None) -> AuditEvent:
    """Close an invalid complaint. Only a department head (own department) or command may do this."""
    if operator is None:
        raise HTTPException(403, "Unknown operator badge: only a department head or the city command "
                                 "centre can reject a complaint")
    if operator["role"] not in REJECT_ROLES:
        raise HTTPException(403, f"{operator['badge_id']} is a department officer: only a department head "
                                 "or the city command centre can reject a complaint")
    if operator["role"] == "head" and operator["department"] != inc.department:
        raise HTTPException(403, f"{operator['badge_id']} heads the {operator['department']} department "
                                 f"and cannot reject a {inc.department} complaint")
    if inc.status in CLOSED_STATES:
        raise HTTPException(409, f"Incident {inc.id} is already {inc.status}")
    crew = inc.assigned_resource_id
    release(session, inc)
    inc.at_risk = False
    detail = (f"Rejected as invalid (reason: {reason}) by {operator['name']} ({operator['role']})"
              + (f"; crew {crew} released" if crew else "")
              + (f"; note: {note}" if note else ""))
    ev = transition(session, inc, "rejected", "rejected_invalid", detail,
                    actor=f"operator:{operator['badge_id']}")
    # Children that waited on this "root cause" now need their own crew.
    for cid in inc.child_incident_ids or []:
        child = session.get(Incident, cid)
        if child is None or child.status in CLOSED_STATES or child.completed_at is not None:
            continue
        record(session, child.id, "parent_rejected",
               f"Root cause {inc.id} was rejected as invalid; handled independently now")
        if not child.assigned_resource_id:
            assign(session, child, escalate_if_none=False)
    from app.engine.rootcause import refresh

    refresh(session)
    return ev


# --- rate limit -----------------------------------------------------------------------------


class RateLimiter:
    """At most `limit` reports per reporter per rolling `window_s` seconds of wall-clock time.
    In memory (single backend process); cleared by /sim/reset so demo resets start fresh."""

    def __init__(self, limit: int = 5, window_s: float = 3600, clock=time.time):
        self.limit, self.window_s, self.clock = limit, window_s, clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, reporter: str) -> bool:
        """Record a report and return True, or return False if this one would exceed the limit."""
        t = self.clock()
        with self._lock:
            q = self._hits.setdefault(reporter, deque())
            while q and q[0] <= t - self.window_s:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(t)
            return True

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


RATE_LIMIT_MESSAGE = "You've sent a lot of reports in a short time. Please wait a bit and try again."
report_limiter = RateLimiter()
