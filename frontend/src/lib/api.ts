import type {
  AuditEvent,
  Category,
  EvidenceKind,
  GoldenResult,
  Incident,
  IncidentDetail,
  Link,
  Metrics,
  Report,
  Resource,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Shape agreed for POST /feedback (backend adds the route; the UI handles 404 until then).
export interface FeedbackInput {
  rating: number;
  role: string;
  comment: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  incidents: () => call<Incident[]>("/incidents"),
  incident: (id: string) => call<IncidentDetail>(`/incidents/${id}`),
  resources: () => call<Resource[]>("/resources"),
  metrics: () => call<Metrics>("/metrics"),
  clock: () => call<{ now: string }>("/sim/clock"),
  audit: () => call<AuditEvent[]>("/audit"),

  report: (body: { text: string; category: Category; lat: number; lng: number; reporter: string }) =>
    post<{ report: Report; incident: Incident; link: Link | null }>("/reports", body),
  start: (id: string) => post<Incident>(`/incidents/${id}/start`),
  complete: (id: string, note: string) => post<Incident>(`/incidents/${id}/complete`, { note }),
  evidence: (
    id: string,
    body: { kind: EvidenceKind; supports_resolution: boolean; note: string; source: string },
  ) => post<{ incident: Incident }>(`/incidents/${id}/evidence`, body),
  setAvailable: (id: string, available: boolean) =>
    post(`/resources/${id}/${available ? "available" : "unavailable"}`),

  tick: (minutes: number) => post<{ now: string; escalated: Incident[] }>(`/sim/tick?minutes=${minutes}`),
  reset: () => post<{ ok: boolean }>("/sim/reset"),
  golden: (step?: number) => post<GoldenResult>(`/sim/scenario/golden${step ? `?step=${step}` : ""}`),
  feedback: (body: FeedbackInput) => post<{ ok?: boolean }>("/feedback", body),
};
