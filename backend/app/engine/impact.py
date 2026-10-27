"""v2: which (simulated) city services an incident and its children disrupt."""
import json
from pathlib import Path

from sqlmodel import Session, select

from app.engine.geo import haversine_m
from app.models import Incident, Service

SEED = Path(__file__).parent.parent / "seed" / "services.json"

IMPACT_TEXT = {
    "transport": "Buses slow down or divert around the incident",
    "school": "Pupils' walking route passes the incident",
    "health": "Access to the health centre is affected",
}


def seed(session: Session) -> None:
    for s in json.loads(SEED.read_text()):
        session.add(Service(**s))


def impact(session: Session, inc: Incident) -> dict:
    services = session.exec(select(Service).order_by(Service.id)).all()
    sources = [inc] + [c for c in (session.get(Incident, cid) for cid in inc.child_incident_ids or []) if c]
    hits: dict[str, dict] = {}
    for src in sources:
        for svc in services:
            d = haversine_m(svc.lat, svc.lng, src.lat, src.lng)
            if d <= svc.radius_m and (svc.id not in hits or d < hits[svc.id]["distance_m"]):
                hits[svc.id] = {"id": svc.id, "name": svc.name, "kind": svc.kind,
                                "distance_m": round(d), "via_incident_id": src.id,
                                "impact": IMPACT_TEXT.get(svc.kind, "Service affected")}
    return {"incident_id": inc.id, "simulated": True,
            "services": sorted(hits.values(), key=lambda h: (h["distance_m"], h["id"]))}
