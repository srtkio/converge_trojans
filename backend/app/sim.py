"""Simulated clock, reset/seed, and the golden demo scenario (docs/CONTRACTS.md)."""
import json
from pathlib import Path

from sqlmodel import Session, select

from app import config
from app.db import now, set_now, wipe_db
from app.engine import metrics
from app.engine.assign import assign_waiting, replan_for_unavailable
from app.engine.audit import record
from app.engine.intake import submit_report
from app.engine.sla import check_breaches
from app.engine.verify import add_evidence, complete, start
from app.models import Counter, Incident, Report, Resource
from app.timeutil import add_hours

SEED = Path(__file__).parent / "seed" / "resources.json"


def seed(session: Session) -> None:
    for r in json.loads(SEED.read_text()):
        session.add(Resource(**r))
    set_now(session, config.SIM_START)
    session.flush()


def reset(session: Session) -> None:
    session.close()
    wipe_db()
    seed(session)


def tick(session: Session, minutes: float) -> list[Incident]:
    t = add_hours(now(session), minutes / 60)
    set_now(session, t)
    return check_breaches(session, t)


def set_unavailable(session: Session, res: Resource) -> list[Incident]:
    res.available = False
    session.add(res)
    record(session, None, "resource_unavailable", f"{res.name} marked unavailable")
    return replan_for_unavailable(session, res)


def set_available(session: Session, res: Resource) -> list[Incident]:
    res.available = True
    session.add(res)
    record(session, None, "resource_available", f"{res.name} available again")
    return assign_waiting(session, res.department)


# --- golden scenario -------------------------------------------------------------------------

MG_ROAD = (12.97560, 77.60500)


def _incident_of(session: Session, report_id: str) -> Incident:
    return session.get(Incident, session.get(Report, report_id).incident_id)


def _i1(session):
    return _incident_of(session, "rep_001")


def _i2(session):
    return _incident_of(session, "rep_003")


def _s1(s):
    reset(s)


def _s2(s):
    submit_report(s, "Water gushing from a broken pipe on MG Road near the metro exit",
                  "water_leak", *MG_ROAD, "citizen:asha")


def _s3(s):
    tick(s, 10)
    submit_report(s, "Big water leak flooding the footpath outside MG Road metro",
                  "water_leak", MG_ROAD[0] + 0.00054, MG_ROAD[1], "citizen:ravi")


def _s4(s):
    tick(s, 10)
    submit_report(s, "Deep pothole forming on MG Road, road surface sinking",
                  "pothole", MG_ROAD[0] - 0.00225, MG_ROAD[1], "citizen:meera")


def _s5(s):
    tick(s, 10)
    set_unavailable(s, s.get(Resource, "res_water_1"))


def _s6(s):
    tick(s, 30)
    set_available(s, s.get(Resource, "res_water_1"))
    tick(s, 15)
    start(s, _i1(s))
    tick(s, 120)
    complete(s, _i1(s), "Pipe joint replaced")


def _s7(s):
    tick(s, 30)
    add_evidence(s, _i1(s), "citizen_followup", False, "Still leaking at the same spot", "citizen:asha")


def _s8(s):
    tick(s, 60)
    start(s, _i1(s))
    tick(s, 120)
    complete(s, _i1(s), "Main valve and section of pipe replaced")
    tick(s, 15)
    add_evidence(s, _i1(s), "inspector", True, "Inspector photo: road dry, no seepage", "inspector:kumar")


def _s9(s):
    tick(s, 49 * 60)


def _s10(s):
    pass


GOLDEN = [
    (_s1, "Reset; seed crews (2 roads, 1 water, 1 electrical)"),
    (_s2, "Report A: water leak at MG Road -> new incident I1, assigned to water crew W1"),
    (_s3, "Report B: same leak 60 m away -> linked as duplicate of I1"),
    (_s4, "Report C: pothole 250 m away -> new incident I2, related to I1"),
    (_s5, "W1 unavailable -> I1 replanned; no other water crew -> escalated"),
    (_s6, "W1 back -> I1 reassigned, started, marked complete -> pending_verification"),
    (_s7, "Citizen follow-up 'still leaking' contradicts closure -> I1 reopened"),
    (_s8, "Repaired again; inspector photo supports -> I1 verified_closed"),
    (_s9, "Clock +49 h with I2 untouched -> I2 SLA breach -> escalated"),
    (_s10, "Metrics: baseline vs CONVERGE"),
]


def _progress(session: Session) -> int:
    row = session.get(Counter, "golden")
    return row.value if row else 0


def _set_progress(session: Session, n: int) -> None:
    row = session.get(Counter, "golden") or Counter(key="golden")
    row.value = n
    session.add(row)


def state(session: Session) -> dict:
    return {
        "now": now(session),
        "incidents": [i.to_api() for i in session.exec(select(Incident).order_by(Incident.id)).all()],
        "resources": [r.to_api() for r in session.exec(select(Resource).order_by(Resource.id)).all()],
        "metrics": metrics.compute(session),
    }


def run_golden(session: Session, step: int | None) -> dict:
    """Run the demo up to `step` (default: all). Steps already done are skipped; asking for an
    earlier step replays from a reset, so the UI can step forward or jump back freely."""
    target = len(GOLDEN) if step is None else step
    done = _progress(session)
    if target <= done:
        done = 0
    log = []
    for n in range(done + 1, target + 1):
        fn, desc = GOLDEN[n - 1]
        fn(session)
        _set_progress(session, n)
        session.commit()
        log.append({"step": n, "description": desc})
    return {"step": target, "description": GOLDEN[target - 1][1], "log": log, "state": state(session)}
