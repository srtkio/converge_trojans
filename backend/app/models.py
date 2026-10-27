"""SQLModel tables. Shapes follow docs/CONTRACTS.md; `to_api` methods produce the JSON contract."""
from sqlalchemy import JSON, Column, LargeBinary
from sqlmodel import Field, SQLModel


def photo_url(photo_id: str | None) -> str | None:
    """API-relative path of a stored photo; clients prefix it with the API base URL."""
    return f"/photos/{photo_id}" if photo_id else None


class Report(SQLModel, table=True):
    id: str = Field(primary_key=True)
    text: str
    category: str
    lat: float
    lng: float
    reporter: str
    created_at: str
    incident_id: str | None = None
    # Citizen photo and where the location came from (device GPS or a picked landmark).
    photo_id: str | None = None
    location_source: str | None = None  # gps | landmark
    location_accuracy_m: float | None = None
    location_label: str | None = None

    def to_api(self) -> dict:
        d = self.model_dump(exclude={"photo_id"})
        d["photo_url"] = photo_url(self.photo_id)
        return d


class Incident(SQLModel, table=True):
    id: str = Field(primary_key=True)
    title: str
    category: str
    department: str
    lat: float
    lng: float
    severity: int
    status: str
    created_at: str
    deadline: str
    assigned_resource_id: str | None = None
    plan_version: int = 1
    report_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    related_incident_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    escalation_level: int = 0
    # Not in the contract's required fields; set when a department marks work complete.
    completed_at: str | None = None
    # v2: root-cause coordination. Children wait on the parent's repair.
    parent_incident_id: str | None = None
    child_incident_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # v3: flagged before an SLA breach; at_risk_deadline makes the alert fire once per deadline.
    at_risk: bool = False
    at_risk_deadline: str | None = None

    def to_api(self) -> dict:
        d = self.model_dump(exclude={"at_risk_deadline"})
        d["child_incident_ids"] = list(self.child_incident_ids or [])
        d["report_ids"] = list(self.report_ids or [])
        d["related_incident_ids"] = list(self.related_incident_ids or [])
        return d


class Link(SQLModel, table=True):
    id: str = Field(primary_key=True)
    report_id: str
    incident_id: str
    kind: str  # duplicate | related
    reason: str
    confidence: float

    def to_api(self) -> dict:
        return self.model_dump()


class Resource(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    department: str
    available: bool = True
    lat: float
    lng: float
    active_incident_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    def to_api(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "department": self.department,
            "available": self.available,
            "location": {"lat": self.lat, "lng": self.lng},
            "active_incident_ids": list(self.active_incident_ids or []),
        }


class Evidence(SQLModel, table=True):
    id: str = Field(primary_key=True)
    incident_id: str
    kind: str  # photo | sensor | citizen_followup | inspector
    supports_resolution: bool
    note: str = ""
    source: str = ""
    created_at: str
    # v3: AI photo checks are recorded as evidence but never drive status changes.
    signal_only: bool = False
    # Photo attached by the person giving evidence (stored, served at /photos/{id}).
    photo_id: str | None = None

    def to_api(self) -> dict:
        d = self.model_dump(exclude={"photo_id"})
        d["photo_url"] = photo_url(self.photo_id)
        return d


class AuditEvent(SQLModel, table=True):
    id: str = Field(primary_key=True)
    seq: int = Field(index=True)
    incident_id: str | None = None
    actor: str
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    detail: str = ""
    evidence_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    timestamp: str

    def to_api(self) -> dict:
        d = self.model_dump(exclude={"seq"})
        d["evidence_ids"] = list(self.evidence_ids or [])
        return d


class Counter(SQLModel, table=True):
    """Per-prefix ID counters and the simulated clock, so IDs and times are deterministic."""
    key: str = Field(primary_key=True)
    value: int = 0
    text: str | None = None


class Hypothesis(SQLModel, table=True):
    """v2: several related incidents likely share one upstream cause."""
    id: str = Field(primary_key=True)
    cause_incident_id: str = Field(index=True)
    member_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    evidence_for: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    evidence_against: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    confidence: float
    status: str = "proposed"  # proposed | confirmed | rejected
    summary: str = ""
    created_at: str
    decided_at: str | None = None

    def to_api(self) -> dict:
        d = self.model_dump()
        for k in ("member_ids", "evidence_for", "evidence_against"):
            d[k] = list(getattr(self, k) or [])
        return d


class Service(SQLModel, table=True):
    """v2: simulated city services that an incident can disrupt."""
    id: str = Field(primary_key=True)
    name: str
    kind: str  # transport | school | health
    lat: float
    lng: float
    radius_m: float

    def to_api(self) -> dict:
        return {"id": self.id, "name": self.name, "kind": self.kind,
                "location": {"lat": self.lat, "lng": self.lng}, "radius_m": self.radius_m}


class Feedback(SQLModel, table=True):
    """v3: real tester feedback. Survives /sim/reset; timestamps are wall-clock."""
    id: str = Field(primary_key=True)
    rating: int
    comment: str = ""
    role: str
    page: str | None = None
    incident_id: str | None = None
    created_at: str

    def to_api(self) -> dict:
        return self.model_dump()


class Photo(SQLModel, table=True):
    """Citizen photo bytes (<= 5 MB). Wiped on /sim/reset together with reports and evidence."""
    id: str = Field(primary_key=True)
    media_type: str
    size_bytes: int
    data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    created_at: str
