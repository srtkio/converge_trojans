"""CONVERGE API. Contracts: docs/CONTRACTS.md. Engine logic lives in app/engine/."""
import base64
import binascii
import os
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session, or_, select

load_dotenv()

from app import auth, sim  # noqa: E402
from app.db import engine, get_session, init_db, now  # noqa: E402
from app.engine import feedback, impact, llm, metrics, rootcause, verify  # noqa: E402
from app.engine.intake import submit_report  # noqa: E402
from app.models import AuditEvent, Evidence, Incident, Link, Report, Resource, Service  # noqa: E402

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
# Comma-separated, e.g. "http://localhost:3000,https://converge.vercel.app".
CORS_ORIGINS = [o.strip() for o in os.environ.get("CONVERGE_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

# Optional regex, e.g. r"https://.*\.vercel\.app" to allow Vercel preview deployments.
CORS_ORIGIN_REGEX = os.environ.get("CONVERGE_CORS_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
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


MAX_PHOTO_BYTES = 5 * 1024 * 1024
# Generous cap on the encoded string so oversized uploads fail fast with 413 before decoding.
MAX_PHOTO_B64 = MAX_PHOTO_BYTES * 4 // 3 + 16


class PhotoIn(BaseModel):
    data: str = Field(min_length=1)
    media_type: Literal["image/jpeg", "image/png", "image/webp", "image/gif"]


class EvidenceIn(BaseModel):
    kind: EvidenceKind
    supports_resolution: bool
    note: str = ""
    source: str = ""
    photo: PhotoIn | None = None


class DecisionIn(BaseModel):
    note: str = ""


class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field("", max_length=2000)
    role: Literal["citizen", "operator", "judge", "other"] = "other"
    page: str | None = Field(None, max_length=200)
    incident_id: str | None = None


def _validate_photo(photo: PhotoIn) -> None:
    if len(photo.data) > MAX_PHOTO_B64:
        raise HTTPException(413, f"Photo too large (max {MAX_PHOTO_BYTES // (1024 * 1024)} MB)")
    try:
        raw = base64.b64decode(photo.data, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "photo.data is not valid base64") from None
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(413, f"Photo too large (max {MAX_PHOTO_BYTES // (1024 * 1024)} MB)")


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
    if body.photo:
        _validate_photo(body.photo)
    ev = verify.add_evidence(s, inc, body.kind, body.supports_resolution, body.note, body.source)
    ai_check = None
    if body.photo:
        # Signal only: recorded after the rule-based decision above, never changes status.
        check = llm.check_photo(body.photo.data, body.photo.media_type, inc.category, inc.title)
        if check:
            ai_ev = verify.record_ai_check(s, inc, check, ev)
            ai_check = {**check, "evidence_id": ai_ev.id}
    s.commit()
    return {"incident": inc.to_api(), "evidence": ev.to_api(), "ai_check": ai_check}


@app.get("/incidents/{incident_id}/impact")
def get_impact(incident_id: str, s: Session = Depends(get_session)):
    return impact.impact(s, _incident(s, incident_id))


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


@app.get("/services")
def list_services(s: Session = Depends(get_session)):
    return [x.to_api() for x in s.exec(select(Service).order_by(Service.id)).all()]


HYP_STATUSES = {"proposed", "confirmed", "rejected"}


@app.get("/hypotheses")
def list_hypotheses(status: str | None = None, s: Session = Depends(get_session)):
    if status and status not in HYP_STATUSES:
        raise HTTPException(422, f"Unknown status {status}")
    hyps = rootcause.refresh(s)
    s.commit()
    return [h.to_api() for h in hyps if not status or h.status == status]


@app.post("/hypotheses/{hyp_id}/confirm")
def confirm_hypothesis(hyp_id: str, body: DecisionIn | None = None, s: Session = Depends(get_session)):
    hyp, parent, children = rootcause.confirm(s, hyp_id, body.note if body else "")
    s.commit()
    return {"hypothesis": hyp.to_api(), "parent": parent.to_api(), "children": [c.to_api() for c in children]}


@app.post("/hypotheses/{hyp_id}/reject")
def reject_hypothesis(hyp_id: str, body: DecisionIn | None = None, s: Session = Depends(get_session)):
    hyp = rootcause.reject(s, hyp_id, body.note if body else "")
    s.commit()
    return {"hypothesis": hyp.to_api()}


@app.post("/feedback")
def post_feedback(body: FeedbackIn, s: Session = Depends(get_session)):
    fb = feedback.submit(s, body.rating, body.comment, body.role, body.page, body.incident_id)
    s.commit()
    return fb.to_api()


@app.get("/feedback")
def list_feedback(s: Session = Depends(get_session)):
    return [f.to_api() for f in feedback.all_feedback(s)]


@app.get("/feedback/summary")
def feedback_summary(s: Session = Depends(get_session)):
    return feedback.summary(s)


class OperatorLogin(BaseModel):
    badge_id: str = Field(min_length=1, max_length=40)
    access_code: str = Field(min_length=1, max_length=200)


class CitizenLogin(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=120)


@app.post("/auth/operator")
def operator_login(body: OperatorLogin):
    profile = auth.verify_operator(body.badge_id, body.access_code)
    if profile is None:
        raise HTTPException(401, "Access not verified: check your badge ID and access code")
    return profile


@app.post("/auth/citizen")
def citizen_login(body: CitizenLogin):
    if not auth.valid_email(body.email):
        raise HTTPException(422, "Enter a valid email address")
    return {"name": body.name.strip(), "email": body.email.strip().lower()}


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


@app.get("/sim/scenario/golden")
def sim_golden_status(s: Session = Depends(get_session)):
    return sim.golden_status(s)


@app.post("/sim/scenario/golden")
def sim_golden(step: int | None = Query(None, ge=1, le=len(sim.GOLDEN)), s: Session = Depends(get_session)):
    return sim.run_golden(s, step)


@app.get("/sim/scenario/rootcause")
def sim_rootcause_status(s: Session = Depends(get_session)):
    return sim.scenario_status(s, "rootcause")


@app.post("/sim/scenario/rootcause")
def sim_rootcause(step: int | None = Query(None, ge=1, le=len(sim.ROOTCAUSE)), s: Session = Depends(get_session)):
    return sim.run_scenario(s, step, "rootcause")


@app.get("/sim/scenario/city")
def sim_city_status(s: Session = Depends(get_session)):
    return sim.scenario_status(s, "city")


@app.post("/sim/scenario/city")
def sim_city(step: int | None = Query(None, ge=1, le=len(sim.CITY_STEPS)), s: Session = Depends(get_session)):
    """Live-city dataset for user testing and the map (not the pitch metrics)."""
    return sim.run_scenario(s, step, "city")


@app.get("/audit")
def get_audit(incident_id: str | None = None, s: Session = Depends(get_session)):
    q = select(AuditEvent).order_by(AuditEvent.seq)
    if incident_id:
        q = q.where(AuditEvent.incident_id == incident_id)
    return [a.to_api() for a in s.exec(q).all()]


@app.get("/metrics")
def get_metrics(s: Session = Depends(get_session)):
    return metrics.compute(s)
