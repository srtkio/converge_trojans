"""CONVERGE API. Contracts: docs/CONTRACTS.md. Engine logic lives in app/engine/."""
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session, or_, select

load_dotenv()

from app import sim  # noqa: E402
from app.db import engine, get_session, init_db, now  # noqa: E402
from app.engine import metrics, verify  # noqa: E402
from app.engine.intake import submit_report  # noqa: E402
from app.models import AuditEvent, Evidence, Incident, Link, Report, Resource  # noqa: E402

Category = Literal["pothole", "streetlight", "water_leak", "garbage", "sewage", "other"]
EvidenceKind = Literal["photo", "sensor", "citizen_followup", "inspector"]
STATUSES = {"open", "assigned", "in_progress", "pending_verification", "verified_closed", "reopened", "escalated"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with Session(engine) as s:
        if not s.exec(select(Resource)).first():
            sim.seed(s)
            s.commit()
    yield


app = FastAPI(title="CONVERGE", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReportIn(BaseModel):
    text: str = Field(min_length=1)
    category: Category
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    reporter: str = "anonymous"


class CompleteIn(BaseModel):
    note: str = ""


class EvidenceIn(BaseModel):
    kind: EvidenceKind
    supports_resolution: bool
    note: str = ""
    source: str = ""


def _incident(s: Session, incident_id: str) -> Incident:
    inc = s.get(Incident, incident_id)
    if inc is None:
        raise HTTPException(404, f"Incident {incident_id} not found")
    return inc


def _resource(s: Session, resource_id: str) -> Resource:
    res = s.get(Resource, resource_id)
    if res is None:
        raise HTTPException(404, f"Resource {resource_id} not found")
    return res


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/reports")
def post_report(body: ReportIn, s: Session = Depends(get_session)):
    report, inc, link = submit_report(s, body.text, body.category, body.lat, body.lng, body.reporter)
    s.commit()
    return {"report": report.to_api(), "incident": inc.to_api(), "link": link.to_api() if link else None}


@app.get("/incidents")
def list_incidents(status: str | None = None, s: Session = Depends(get_session)):
    q = select(Incident).order_by(Incident.created_at, Incident.id)
    if status:
        if status not in STATUSES:
            raise HTTPException(422, f"Unknown status {status}")
        q = q.where(Incident.status == status)
    return [i.to_api() for i in s.exec(q).all()]


@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str, s: Session = Depends(get_session)):
    inc = _incident(s, incident_id)
    reports = s.exec(select(Report).where(Report.incident_id == inc.id).order_by(Report.created_at)).all()
    report_ids = [r.id for r in reports]
    links = s.exec(select(Link).where(or_(Link.incident_id == inc.id, Link.report_id.in_(report_ids)))).all()
    evidence = s.exec(select(Evidence).where(Evidence.incident_id == inc.id).order_by(Evidence.created_at)).all()
    audit = s.exec(select(AuditEvent).where(AuditEvent.incident_id == inc.id).order_by(AuditEvent.seq)).all()
    res = s.get(Resource, inc.assigned_resource_id) if inc.assigned_resource_id else None
    return {
        "incident": inc.to_api(),
        "reports": [r.to_api() for r in reports],
        "links": [link.to_api() for link in links],
        "evidence": [e.to_api() for e in evidence],
        "audit": [a.to_api() for a in audit],
        "resource": res.to_api() if res else None,
    }


@app.post("/incidents/{incident_id}/start")
def start_incident(incident_id: str, s: Session = Depends(get_session)):
    inc = verify.start(s, _incident(s, incident_id))
    s.commit()
    return inc.to_api()


@app.post("/incidents/{incident_id}/complete")
def complete_incident(incident_id: str, body: CompleteIn | None = None, s: Session = Depends(get_session)):
    inc = verify.complete(s, _incident(s, incident_id), body.note if body else "")
    s.commit()
    return inc.to_api()


@app.post("/incidents/{incident_id}/evidence")
def post_evidence(incident_id: str, body: EvidenceIn, s: Session = Depends(get_session)):
    inc = _incident(s, incident_id)
    ev = verify.add_evidence(s, inc, body.kind, body.supports_resolution, body.note, body.source)
    s.commit()
    return {"incident": inc.to_api(), "evidence": ev.to_api()}


@app.get("/resources")
def list_resources(s: Session = Depends(get_session)):
    return [r.to_api() for r in s.exec(select(Resource).order_by(Resource.id)).all()]


@app.post("/resources/{resource_id}/unavailable")
def resource_unavailable(resource_id: str, s: Session = Depends(get_session)):
    res = _resource(s, resource_id)
    replanned = sim.set_unavailable(s, res)
    s.commit()
    return {"resource": res.to_api(), "replanned": [i.to_api() for i in replanned]}


@app.post("/resources/{resource_id}/available")
def resource_available(resource_id: str, s: Session = Depends(get_session)):
    res = _resource(s, resource_id)
    sim.set_available(s, res)
    s.commit()
    return res.to_api()


@app.get("/sim/clock")
def sim_clock(s: Session = Depends(get_session)):
    return {"now": now(s)}


@app.post("/sim/tick")
def sim_tick(minutes: float = Query(60, ge=0), s: Session = Depends(get_session)):
    escalated = sim.tick(s, minutes)
    s.commit()
    return {"now": now(s), "escalated": [i.to_api() for i in escalated]}


@app.post("/sim/reset")
def sim_reset(s: Session = Depends(get_session)):
    sim.reset(s)
    s.commit()
    return {"ok": True}


@app.post("/sim/scenario/golden")
def sim_golden(step: int | None = Query(None, ge=1, le=len(sim.GOLDEN)), s: Session = Depends(get_session)):
    return sim.run_golden(s, step)


@app.get("/audit")
def get_audit(incident_id: str | None = None, s: Session = Depends(get_session)):
    q = select(AuditEvent).order_by(AuditEvent.seq)
    if incident_id:
        q = q.where(AuditEvent.incident_id == incident_id)
    return [a.to_api() for a in s.exec(q).all()]


@app.get("/metrics")
def get_metrics(s: Session = Depends(get_session)):
    return metrics.compute(s)
