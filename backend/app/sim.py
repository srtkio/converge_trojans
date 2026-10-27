"""Simulated clock, reset/seed, and the golden demo scenario (docs/CONTRACTS.md)."""
import json
from pathlib import Path

from sqlmodel import Session, select

from app import config
from app.db import now, set_now, wipe_db
from app.engine import impact, metrics, rootcause
from app.engine.assign import assign_waiting, replan_for_unavailable
from app.engine.audit import record
from app.engine.intake import submit_report
from app.engine.sla import check_at_risk, check_breaches
from app.engine.verify import add_evidence, complete, start
from app.models import Counter, Incident, Report, Resource
from app.timeutil import add_hours, parse

SEED = Path(__file__).parent / "seed" / "resources.json"


def seed(session: Session) -> None:
    for r in json.loads(SEED.read_text()):
        session.add(Resource(**r))
    impact.seed(session)
    set_now(session, config.SIM_START)
    session.flush()


def reset(session: Session) -> None:
    session.close()
    wipe_db()
    seed(session)


def tick(session: Session, minutes: float) -> list[Incident]:
    t = add_hours(now(session), minutes / 60)
    set_now(session, t)
    escalated = check_breaches(session, t)
    check_at_risk(session, t)
    return escalated


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


# --- root-cause scenario (v2) -----------------------------------------------------------------


def _r2(s):
    submit_report(s, "Water bubbling up through the road on MG Road near the junction",
                  "water_leak", *MG_ROAD, "citizen:asha")


def _r3(s):
    tick(s, 20)
    submit_report(s, "Road surface sinking and a pothole opening near the MG Road junction",
                  "pothole", MG_ROAD[0] + 0.00108, MG_ROAD[1], "citizen:ravi")


def _r4(s):
    tick(s, 20)
    submit_report(s, "Pothole at the MG Road bus stop, buses swerving around it",
                  "pothole", MG_ROAD[0] - 0.00252, MG_ROAD[1], "citizen:meera")


def _r5(s):
    tick(s, 10)
    [hyp] = [h for h in rootcause.refresh(s) if h.status == "proposed"]
    rootcause.confirm(s, hyp.id, "Operator: one leaking main under the junction")


def _r6(s):
    tick(s, 15)
    leak = _incident_of(s, "rep_001")
    start(s, leak)
    tick(s, 150)
    complete(s, leak, "Main repaired, trench backfilled and road base re-compacted")
    tick(s, 20)
    add_evidence(s, leak, "inspector", True, "Inspector: no water, road base firm", "inspector:kumar")


def _r7(s):
    tick(s, 60)
    add_evidence(s, _incident_of(s, "rep_002"), "citizen_followup", True,
                 "Road is level again at the junction", "citizen:ravi")
    add_evidence(s, _incident_of(s, "rep_003"), "photo", True,
                 "Photo: bus stop surface patched and level", "citizen:meera")


ROOTCAUSE = [
    (_s1, "Reset; seed crews and city services"),
    (_r2, "Report A: water bubbling through MG Road -> leak incident, water crew assigned"),
    (_r3, "Report B: pothole 120 m away -> new incident, related to the leak"),
    (_r4, "Report C: pothole at the bus stop 280 m away -> related; root-cause hypothesis proposed"),
    (_r5, "Operator confirms: the leak is the root cause -> potholes wait on it, 2 crew visits saved"),
    (_r6, "One repair: leak fixed and verified -> both potholes move to pending_verification"),
    (_r7, "Citizen and photo evidence confirm both potholes resolved -> all verified_closed"),
    (_s10, "Metrics: 1 coordinated repair instead of 3 visits"),
]

# --- live city dataset (user testing + map; not pitch metrics) ---------------------------------

CITY = json.loads((Path(__file__).parent / "seed" / "city.json").read_text())["areas"]


def _at_minute(s, minute: int) -> None:
    """Advance the clock to SIM_START + minute (never backwards), running SLA checks."""
    target = add_hours(config.SIM_START, minute / 60)
    gap_min = (parse(target) - parse(now(s))).total_seconds() / 60
    if gap_min > 0:
        tick(s, gap_min)


def _city_area(index: int):
    def run(s):
        for r in CITY[index]["reports"]:
            _at_minute(s, r["t"])
            submit_report(s, r["text"], r["category"], r["lat"], r["lng"], r["reporter"])
    return run


def _c1(s):
    reset(s)
    set_unavailable(s, s.get(Resource, "res_sanit_1"))  # sanitation crew on leave today


def _c7(s):
    _at_minute(s, 110)
    leak = _incident_of(s, "rep_001")
    start(s, leak)
    lights = _incident_of(s, "rep_004")
    start(s, lights)
    _at_minute(s, 210)
    complete(s, leak, "Burst section replaced; awaiting inspection")


def _c8(s):
    _at_minute(s, 9 * 60 + 45)  # 18:45: the Koramangala sewage overflow is now at risk


CITY_STEPS = [
    (_c1, "Reset; seed crews and services; sanitation crew S1 on leave"),
    *[(_city_area(i), a["title"]) for i, a in enumerate(CITY)],
    (_c7, "Morning work: MG Road main repaired (awaiting proof); 100 Feet Road lights crew starts"),
    (_c8, "Clock to 18:45: Koramangala sewage overflow flagged at risk before its deadline"),
]

SCENARIOS = {"golden": GOLDEN, "rootcause": ROOTCAUSE, "city": CITY_STEPS}


def _progress(session: Session, name: str = "golden") -> int:
    row = session.get(Counter, "golden" if name == "golden" else f"scenario:{name}")
    return row.value if row else 0


def _set_progress(session: Session, n: int, name: str = "golden") -> None:
    key = "golden" if name == "golden" else f"scenario:{name}"
    row = session.get(Counter, key) or Counter(key=key)
    row.value = n
    session.add(row)


def state(session: Session) -> dict:
    return {
        "now": now(session),
        "incidents": [i.to_api() for i in session.exec(select(Incident).order_by(Incident.id)).all()],
        "resources": [r.to_api() for r in session.exec(select(Resource).order_by(Resource.id)).all()],
        "metrics": metrics.compute(session),
    }


def scenario_status(session: Session, name: str = "golden") -> dict:
    """Current progress without running anything, so the UI can recover after a reload."""
    steps = SCENARIOS[name]
    done = _progress(session, name)
    return {
        "step": done,
        "description": steps[done - 1][1] if done else "Not started",
        "log": [{"step": n, "description": steps[n - 1][1]} for n in range(1, done + 1)],
        "state": state(session),
    }


def run_scenario(session: Session, step: int | None, name: str = "golden") -> dict:
    """Run a scenario up to `step` (default: all). Steps already done are skipped; asking for an
    earlier step replays from a reset, so the UI can step forward or jump back freely."""
    steps = SCENARIOS[name]
    target = len(steps) if step is None else step
    done = _progress(session, name)
    if target <= done:
        done = 0
    log = []
    for n in range(done + 1, target + 1):
        fn, desc = steps[n - 1]
        fn(session)
        _set_progress(session, n, name)
        session.commit()
        log.append({"step": n, "description": desc})
    return {"step": target, "description": steps[target - 1][1], "log": log, "state": state(session)}


def golden_status(session: Session) -> dict:
    return scenario_status(session, "golden")


def run_golden(session: Session, step: int | None) -> dict:
    return run_scenario(session, step, "golden")
