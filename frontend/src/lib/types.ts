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

/** Where a report's lat/lng came from: the device's GPS, a landmark the citizen picked, or a spot
 * they pinned on the map. */
export type LocationSource = "gps" | "landmark" | "pin";

export interface Report {
  id: string;
  text: string;
  category: Category;
  lat: number;
  lng: number;
  reporter: string;
  created_at: string;
  incident_id: string | null;
  /** Citizen photo as an API path ("/photos/ph_…"); build the full URL with photoSrc() from lib/api. */
  photo_url?: string | null;
  location_source?: LocationSource | null;
  /** GPS accuracy radius in metres (null for landmarks and pins). */
  location_accuracy_m?: number | null;
  /** Landmark name, "Current location", or "Same spot as case inc_…". */
  location_label?: string | null;
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
  /** v2: set when this incident waits on a confirmed root-cause repair. */
  parent_incident_id?: string | null;
  child_incident_ids?: string[];
  /** v3: not started, not closed, under 25% of the SLA left. */
  at_risk?: boolean;
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
  /** Photo sent with this evidence, as an API path; null when none. */
  photo_url?: string | null;
  /** v3: AI photo checks are recorded as evidence but never change the status. */
  signal_only?: boolean;
}

// One row of the operator inbox: a citizen complaint or a citizen's follow-up evidence.
export interface CitizenActivity {
  id: string;
  kind: "complaint" | "evidence";
  at: string;
  citizen: string;
  text: string;
  category: Category | null;
  supports: boolean | null;
  incident_id: string | null;
  incident_title: string | null;
  incident_status: Status | null;
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
  /** v2 */
  crew_visits_saved?: number;
  coordinated_vs_independent?: { independent_visits: number; coordinated_visits: number };
  /** v3 */
  at_risk?: number;
}

// v2: shared root cause across related incidents.
export interface Hypothesis {
  id: string;
  cause_incident_id: string;
  member_ids: string[];
  summary: string;
  evidence_for: string[];
  evidence_against: string[];
  confidence: number;
  status: "proposed" | "confirmed" | "rejected";
}

export interface Impact {
  incident_id: string;
  simulated: boolean;
  services: {
    id: string;
    name: string;
    kind: "transport" | "school" | "health";
    distance_m: number;
    via_incident_id: string;
    impact: string;
  }[];
}

export interface GoldenResult {
  step: number;
  description: string;
  log: { step: number; description: string }[];
}
