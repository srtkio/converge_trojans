"""SQLModel tables. Shapes follow docs/CONTRACTS.md; `to_api` methods produce the JSON contract."""
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Report(SQLModel, table=True):
    id: str = Field(primary_key=True)
    text: str
    category: str
    lat: float
    lng: float
    reporter: str
    created_at: str
    incident_id: str | None = None

    def to_api(self) -> dict:
        return self.model_dump()


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

    def to_api(self) -> dict:
        d = self.model_dump()
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

    def to_api(self) -> dict:
        return self.model_dump()


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
