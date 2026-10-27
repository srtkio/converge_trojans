import type {
  AuditEvent,
  Category,
  EvidenceKind,
  GoldenResult,
  Hypothesis,
  Impact,
  Incident,
  IncidentDetail,
  Link,
  Metrics,
  Report,
  Resource,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

async function optional<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("404 ")) return null;
    throw e;
  }
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

  /** v2 endpoints return null when the backend doesn't have them yet (404). */
  hypotheses: () => optional(call<Hypothesis[]>("/hypotheses")),
  decideHypothesis: (id: string, decision: "confirm" | "reject") => post<Hypothesis>(`/hypotheses/${id}/${decision}`),
  impact: (id: string) => optional(call<Impact>(`/incidents/${id}/impact`)),

  tick: (minutes: number) => post<{ now: string; escalated: Incident[] }>(`/sim/tick?minutes=${minutes}`),
  reset: () => post<{ ok: boolean }>("/sim/reset"),
  scenario: (name: "golden" | "rootcause", step?: number) =>
    post<GoldenResult>(`/sim/scenario/${name}${step ? `?step=${step}` : ""}`),
  golden: (step?: number) => post<GoldenResult>(`/sim/scenario/golden${step ? `?step=${step}` : ""}`),
  goldenStatus: () => call<GoldenResult>("/sim/scenario/golden"),
};
