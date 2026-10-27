"""v2: group related incidents under one probable upstream cause; coordinate one repair.

Decisions and scoring are deterministic. The LLM may only rewrite the summary sentence.
"""
from fastapi import HTTPException
from sqlmodel import Session, select

from app import config
from app.db import next_id, now
from app.engine import llm
from app.engine.assign import release
from app.engine.audit import record, transition
from app.engine.geo import haversine_m
from app.engine.hierarchy import (
    CLOSED_STATES,
    waiting_on_parent,  # noqa: F401  (re-export)
)
from app.models import Hypothesis, Incident
from app.timeutil import parse

CLOSED = CLOSED_STATES
NOT_STARTED = {"open", "assigned", "escalated", "reopened"}


def _components(incidents: dict[str, Incident]) -> list[list[Incident]]:
    seen, groups = set(), []
    for start in sorted(incidents):
        if start in seen:
            continue
        stack, group = [start], []
        seen.add(start)
        while stack:
            inc = incidents[stack.pop()]
            group.append(inc)
            for other in inc.related_incident_ids or []:
                if other in incidents and other not in seen:
                    seen.add(other)
                    stack.append(other)
        if len(group) > 1:
            groups.append(group)
    return groups


def pick_cause(group: list[Incident]) -> Incident:
    return min(group, key=lambda i: (-config.CAUSE_RANK.get(i.category, 0), i.created_at, i.id))


def score(cause: Incident, members: list[Incident]) -> tuple[float, list[str], list[str]]:
    ev_for, ev_against = [], []
    conf = 0.35 + 0.1 * min(3, len(members))
    ev_for.append(f"{len(members)} nearby incident(s) linked to {cause.id} ({cause.category})")
    dists = []
    for m in members:
        d = haversine_m(cause.lat, cause.lng, m.lat, m.lng)
        dists.append(d)
        why = config.CAUSE_EXPLANATION.get(frozenset({cause.category, m.category}))
        if why:
            ev_for.append(f"{m.id} ({m.category}) is {d:.0f} m away; {why}")
        else:
            ev_for.append(f"{m.id} ({m.category}) is {d:.0f} m away")
        if d > 300:
            conf -= 0.1
            ev_against.append(f"{m.id} is {d:.0f} m away, at the edge of the related radius")
        if parse(m.created_at) < parse(cause.created_at):
            conf -= 0.1
            ev_against.append(f"{m.id} was reported before {cause.id}, so it may have its own cause")
    if all(parse(m.created_at) >= parse(cause.created_at) for m in members):
        conf += 0.15
        ev_for.append(f"{cause.id} was reported first; the others followed")
    if dists and sum(dists) / len(dists) < 200:
        conf += 0.1
    extra = len(cause.report_ids or []) - 1
    if extra > 0:
        conf += 0.05 * min(2, extra)
        ev_for.append(f"{cause.id} is confirmed by {extra + 1} citizen reports")
    if not ev_against:
        ev_against.append("No inspection has confirmed the shared cause yet")
    return round(min(0.95, max(0.05, conf)), 2), ev_for, ev_against


def _summary(cause: Incident, members: list[Incident]) -> str:
    cats = sorted({m.category for m in members})
    rule = (f"{len(members)} {'/'.join(cats)} incident(s) near {cause.id} are probably caused by its "
            f"{cause.category}; one repair of {cause.id} may resolve all of them.")
    return llm.refine_summary(rule, cause.title, [m.title for m in members])


def _attach_child(session: Session, hyp: Hypothesis, parent: Incident, child: Incident) -> None:
    child.parent_incident_id = parent.id
    parent.child_incident_ids = [*(parent.child_incident_ids or []), child.id]
    record(session, child.id, "linked_to_parent", f"Waits on {parent.id} ({hyp.id})")
    if child.status in NOT_STARTED and child.completed_at is None:
        crew = child.assigned_resource_id
        release(session, child)
        child.plan_version += 1
        record(session, child.id, "merged_into_parent_repair",
               f"Repair coordinated through {parent.id}"
               + (f"; crew {crew} released, one visit saved" if crew else "; no separate visit needed"))
    session.add_all([child, parent])


def refresh(session: Session) -> list[Hypothesis]:
    """Recompute groups and keep stored hypotheses in sync. Idempotent; writes only on change."""
    open_incs = {i.id: i for i in session.exec(select(Incident).where(Incident.status.not_in(CLOSED))).all()}
    hyps = {h.cause_incident_id: h for h in session.exec(select(Hypothesis)).all()}
    live_causes = set()
    for group in _components(open_incs):
        ids = {i.id for i in group}
        confirmed = next((h for h in hyps.values() if h.status == "confirmed" and h.cause_incident_id in ids), None)
        cause = open_incs[confirmed.cause_incident_id] if confirmed else pick_cause(group)
        members = sorted((i for i in group if i.id != cause.id), key=lambda i: i.id)
        member_ids = [m.id for m in members]
        live_causes.add(cause.id)
        hyp = hyps.get(cause.id)
        if hyp is None:
            conf, ev_for, ev_against = score(cause, members)
            hyp = Hypothesis(id=next_id(session, "hyp"), cause_incident_id=cause.id, member_ids=member_ids,
                             evidence_for=ev_for, evidence_against=ev_against, confidence=conf,
                             summary=_summary(cause, members), created_at=now(session))
            session.add(hyp)
            hyps[cause.id] = hyp
        elif hyp.status == "proposed" and set(hyp.member_ids) != set(member_ids):
            hyp.confidence, hyp.evidence_for, hyp.evidence_against = score(cause, members)
            hyp.member_ids, hyp.summary = member_ids, _summary(cause, members)
            session.add(hyp)
        elif hyp.status == "confirmed":
            for m in members:
                if m.id not in hyp.member_ids and m.parent_incident_id is None:
                    _attach_child(session, hyp, cause, m)
                    hyp.member_ids = [*hyp.member_ids, m.id]
            session.add(hyp)
    # A proposed hypothesis whose group dissolved or gained a further-upstream cause is stale.
    for cause_id, hyp in list(hyps.items()):
        if hyp.status == "proposed" and cause_id not in live_causes:
            session.delete(hyp)
            del hyps[cause_id]
    session.flush()
    return sorted(hyps.values(), key=lambda h: h.id)


def _get(session: Session, hyp_id: str) -> Hypothesis:
    refresh(session)
    hyp = session.get(Hypothesis, hyp_id)
    if hyp is None:
        raise HTTPException(404, f"Hypothesis {hyp_id} not found")
    if hyp.status != "proposed":
        raise HTTPException(409, f"Hypothesis {hyp_id} is already {hyp.status}")
    return hyp


def confirm(session: Session, hyp_id: str, note: str = "") -> tuple[Hypothesis, Incident, list[Incident]]:
    hyp = _get(session, hyp_id)
    parent = session.get(Incident, hyp.cause_incident_id)
    hyp.status, hyp.decided_at = "confirmed", now(session)
    record(session, parent.id, "hypothesis_confirmed",
           f"{hyp.id}: {parent.id} confirmed as root cause of {', '.join(hyp.member_ids)}"
           + (f" ({note})" if note else ""), actor="operator")
    children = []
    for cid in hyp.member_ids:
        child = session.get(Incident, cid)
        if child.parent_incident_id is None:
            _attach_child(session, hyp, parent, child)
        children.append(child)
    session.add(hyp)
    session.flush()
    return hyp, parent, children


def reject(session: Session, hyp_id: str, note: str = "") -> Hypothesis:
    hyp = _get(session, hyp_id)
    hyp.status, hyp.decided_at = "rejected", now(session)
    record(session, hyp.cause_incident_id, "hypothesis_rejected",
           f"{hyp.id} rejected; incidents handled independently" + (f" ({note})" if note else ""),
           actor="operator")
    session.add(hyp)
    session.flush()
    return hyp


def on_parent_closed(session: Session, parent: Incident) -> None:
    """Parent verified closed: each waiting child needs its own verification (never auto-closed)."""
    for cid in parent.child_incident_ids or []:
        child = session.get(Incident, cid)
        if child is None or child.status in CLOSED or child.completed_at is not None:
            continue
        if child.status == "in_progress":
            continue  # its own crew is still working; normal completion applies
        child.completed_at = now(session)
        transition(session, child, "pending_verification", "parent_resolved",
                   f"Root cause {parent.id} verified fixed; confirm this incident is resolved too")
