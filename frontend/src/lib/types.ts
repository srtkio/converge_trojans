// Shapes mirror backend/app/models.py `to_api` output (docs/CONTRACTS.md).

export type Category = "pothole" | "streetlight" | "water_leak" | "garbage" | "sewage" | "other";

export type Status =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_verification"
  | "verified_closed"
  | "reopened"
  | "escalated";

export type EvidenceKind = "photo" | "sensor" | "citizen_followup" | "inspector";

export interface Report {
  id: string;
  text: string;
  category: Category;
  lat: number;
  lng: number;
  reporter: string;
  created_at: string;
  incident_id: string | null;
}

export interface Incident {
  id: string;
  title: string;
  category: Category;
  department: string;
  lat: number;
  lng: number;
  severity: number;
  status: Status;
  created_at: string;
  deadline: string;
  assigned_resource_id: string | null;
  plan_version: number;
  report_ids: string[];
  related_incident_ids: string[];
  escalation_level: number;
  completed_at: string | null;
}

export interface Link {
  id: string;
  report_id: string;
  incident_id: string;
  kind: "duplicate" | "related";
  reason: string;
  confidence: number;
}

export interface Resource {
  id: string;
  name: string;
  department: string;
  available: boolean;
  location: { lat: number; lng: number };
  active_incident_ids: string[];
}

export interface Evidence {
  id: string;
  incident_id: string;
  kind: EvidenceKind;
  supports_resolution: boolean;
  note: string;
  source: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  incident_id: string | null;
  actor: string;
  event_type: string;
  from_status: Status | null;
  to_status: Status | null;
  detail: string;
  evidence_ids: string[];
  timestamp: string;
}

export interface IncidentDetail {
  incident: Incident;
  reports: Report[];
  links: Link[];
  evidence: Evidence[];
  audit: AuditEvent[];
  resource: Resource | null;
}

export interface Metrics {
  reports: number;
  incidents: number;
  duplicates_linked: number;
  duplicate_work_orders_avoided: number;
  false_closures_caught: number;
  verified_closures: number;
  sla_breaches: number;
  escalations: number;
  replans: number;
  baseline: { work_orders: number; false_closures_accepted: number };
}

export interface GoldenResult {
  step: number;
  description: string;
  log: { step: number; description: string }[];
}
