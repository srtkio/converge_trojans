"""Rule 2 (assign) and rule 3 (replan)."""
from sqlmodel import Session, select

from app.engine.audit import record, transition
from app.engine.geo import haversine_m
from app.engine.hierarchy import waiting_on_parent
from app.models import Incident, Resource

CLOSED = "verified_closed"


def _attach(resource: Resource, incident_id: str) -> None:
    ids = list(resource.active_incident_ids or [])
    if incident_id not in ids:
        ids.append(incident_id)
    resource.active_incident_ids = ids


def release(session: Session, incident: Incident) -> None:
    """Detach the incident from its resource (on closure or replan)."""
    if not incident.assigned_resource_id:
        return
    res = session.get(Resource, incident.assigned_resource_id)
    if res:
        res.active_incident_ids = [i for i in (res.active_incident_ids or []) if i != incident.id]
        session.add(res)
    incident.assigned_resource_id = None
    session.add(incident)


def pick_resource(session: Session, incident: Incident) -> Resource | None:
    candidates = session.exec(
        select(Resource).where(Resource.department == incident.department, Resource.available == True)  # noqa: E712
    ).all()
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda r: (
            haversine_m(r.lat, r.lng, incident.lat, incident.lng),
            len(r.active_incident_ids or []),
            r.id,
        ),
    )


def escalate(session: Session, incident: Incident, event_type: str, detail: str) -> None:
    incident.escalation_level += 1
    transition(session, incident, "escalated", event_type, detail)


def assign(session: Session, incident: Incident, escalate_if_none: bool = True) -> Resource | None:
    """Assign the nearest available crew in the incident's department.

    With no crew available the incident stays unassigned, gets a `no_resource` audit and is
    escalated (unless it is already escalated, to avoid double-counting on retries).
    """
    res = pick_resource(session, incident)
    if res is None:
        record(session, incident.id, "no_resource",
               f"No available {incident.department} crew")
        if escalate_if_none and incident.status != "escalated":
            escalate(session, incident, "escalated",
                     f"No {incident.department} crew available; escalated to department head")
        return None
    incident.assigned_resource_id = res.id
    _attach(res, incident.id)
    session.add(res)
    dist = haversine_m(res.lat, res.lng, incident.lat, incident.lng)
    # A reopened incident keeps its status until work restarts; everything else becomes assigned.
    to_status = incident.status if incident.status == "reopened" else "assigned"
    transition(session, incident, to_status, "assigned", f"Assigned {res.name} ({dist:.0f} m away)")
    return res


def replan_for_unavailable(session: Session, resource: Resource) -> list[Incident]:
    """Rule 3: a crew dropped out, so every open incident it held is re-planned."""
    replanned: list[Incident] = []
    for inc_id in list(resource.active_incident_ids or []):
        inc = session.get(Incident, inc_id)
        if inc is None or inc.status == CLOSED:
            continue
        release(session, inc)
        inc.plan_version += 1
        record(session, inc.id, "plan_invalidated",
               f"{resource.name} unavailable; plan v{inc.plan_version - 1} is stale")
        new = assign(session, inc)
        record(session, inc.id, "replanned",
               f"Plan v{inc.plan_version}: " + (f"reassigned to {new.name}" if new else "no crew, escalated"))
        replanned.append(inc)
    resource.active_incident_ids = []
    session.add(resource)
    return replanned


def assign_waiting(session: Session, department: str) -> list[Incident]:
    """When a crew comes back, pick up incidents in its department that have no crew."""
    waiting = session.exec(
        select(Incident).where(
            Incident.department == department,
            Incident.status != CLOSED,
            Incident.assigned_resource_id == None,  # noqa: E711
        ).order_by(Incident.severity.desc(), Incident.created_at)
    ).all()
    done = []
    for inc in waiting:
        if waiting_on_parent(session, inc):
            continue
        if assign(session, inc, escalate_if_none=False):
            done.append(inc)
    return done
