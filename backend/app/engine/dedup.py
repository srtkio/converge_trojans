"""Rule 1: duplicate / related detection. Pure decision function; no writes."""
from dataclasses import dataclass

from app import config
from app.engine.geo import haversine_m
from app.models import Incident
from app.timeutil import hours_between


@dataclass
class Match:
    kind: str  # duplicate | related
    incident: Incident
    distance_m: float
    reason: str
    confidence: float


def _dist(inc: Incident, lat: float, lng: float) -> float:
    return haversine_m(inc.lat, inc.lng, lat, lng)


def classify(category: str, lat: float, lng: float, at: str, incidents: list[Incident]) -> Match | None:
    """Return the link decision for a new report, or None for a brand-new incident.

    Duplicate: same category, within 150 m, incident created within the last 72 h. Closed incidents
    are eligible (a new duplicate reopens them); open ones win ties.
    Related: dependent category, within 400 m, incident not closed.
    """
    dups = []
    for inc in incidents:
        if inc.category != category:
            continue
        d = _dist(inc, lat, lng)
        age_h = hours_between(inc.created_at, at)
        if d <= config.DUPLICATE_RADIUS_M and 0 <= age_h <= config.DUPLICATE_WINDOW_H:
            dups.append((inc.status == "verified_closed", d, inc))
    if dups:
        closed, d, inc = min(dups, key=lambda t: (t[0], t[1], t[2].id))
        conf = round(max(0.5, 1 - d / config.DUPLICATE_RADIUS_M * 0.5), 2)
        reason = (f"Same category ({category}) {d:.0f} m from {inc.id}, reported within "
                  f"{config.DUPLICATE_WINDOW_H} h")
        if closed:
            reason += "; incident was closed, so this suggests the issue is back"
        return Match("duplicate", inc, d, reason, conf)

    rel = []
    for inc in incidents:
        if inc.status == "verified_closed":
            continue
        if frozenset({inc.category, category}) not in config.DEPENDENT_CATEGORIES:
            continue
        d = _dist(inc, lat, lng)
        if d <= config.RELATED_RADIUS_M:
            rel.append((d, inc))
    if rel:
        d, inc = min(rel, key=lambda t: (t[0], t[1].id))
        conf = round(max(0.4, 0.9 - d / config.RELATED_RADIUS_M * 0.5), 2)
        reason = (f"{category} {d:.0f} m from {inc.category} incident {inc.id}; "
                  f"these categories often share a cause")
        return Match("related", inc, d, reason, conf)
    return None
