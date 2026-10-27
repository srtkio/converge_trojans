// Citizen-facing wording and small browser helpers. The operator side keeps the raw audit trail.
import { useEffect, useState } from "react";

import type { AuditEvent, Category, Incident, Status } from "./types";

export const STATUS_EXPLAINER: Record<Status, string> = {
  open: "We've logged it and are finding a crew.",
  assigned: "A crew is assigned and will start soon.",
  in_progress: "The crew is working on it now.",
  pending_verification: "The crew says it's fixed. Please check and tell us below.",
  verified_closed: "Fixed and confirmed. Thank you for reporting it.",
  reopened: "Someone said it isn't fixed yet, so it's back with the crew.",
  escalated: "It's taking longer than it should, so a supervisor is now involved.",
  rejected: "A department head reviewed this report and closed it as not valid.",
};

export function explainStatus(incident: Incident): string {
  if (incident.parent_incident_id && !incident.completed_at && incident.status !== "verified_closed") {
    return "This is being fixed together with a related problem nearby. One repair should fix both.";
  }
  return STATUS_EXPLAINER[incident.status];
}

/** Plain-language line for one audit event, or null to hide internal bookkeeping from citizens. */
export function citizenEvent(e: AuditEvent): string | null {
  switch (e.event_type) {
    case "created":
      return "Your problem was logged as a new case.";
    case "assigned": {
      const crew = /^Assigned (.+?) \(/.exec(e.detail)?.[1];
      return crew ? `${crew} was assigned.` : "A crew was assigned.";
    }
    case "duplicate_linked":
      return "Someone else reported the same problem. Their report was added to this case.";
    case "related_linked":
      return "Linked to a related problem nearby so the teams can coordinate.";
    case "escalated":
      return "No crew was free, so a supervisor was alerted.";
    case "work_started":
      return "The crew started work.";
    case "work_completed":
      return "The crew marked the work as done. Waiting for confirmation.";
    case "false_closure_detected":
      return "A check showed it wasn't fixed, so the case was reopened.";
    case "verified_closed":
      return "The repair was confirmed. Case closed.";
    case "reopened":
      return "It was reported again after closing, so the case was reopened.";
    case "sla_breach":
      return "The deadline was missed, so the case was escalated.";
    case "sla_at_risk":
      return "The case is close to its deadline. The department has been alerted.";
    case "evidence_added":
      return e.actor === "citizen" ? "A citizen sent an update." : "New evidence was added.";
    case "hypothesis_confirmed":
      return "This was found to be the root cause of other problems nearby.";
    case "linked_to_parent":
      return "This will be fixed together with a related problem nearby.";
    case "parent_resolved":
      return "The underlying problem was fixed. Please check that this one is fixed too.";
    default:
      return null; // no_resource, plan_invalidated, replanned, notified, link_explained, ai_photo_check, ...
  }
}

const crewOf = (e: AuditEvent) => /^Assigned (.+?) \(/.exec(e.detail)?.[1] ?? null;

/** Citizen timeline: friendly lines, internal events hidden, back-to-back repeats collapsed. */
export function citizenTimeline(audit: AuditEvent[]): { id: string; timestamp: string; text: string }[] {
  const out: { id: string; timestamp: string; text: string }[] = [];
  let lastCrew: string | null = null;
  let assignedBefore = false;
  for (const e of [...audit].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    let text = citizenEvent(e);
    if (e.event_type === "assigned") {
      const crew = crewOf(e);
      if (assignedBefore && crew) text = crew === lastCrew ? `${crew} was assigned again.` : `${crew} took over the case.`;
      assignedBefore = true;
      lastCrew = crew ?? lastCrew;
    }
    if (text && out.at(-1)?.text !== text) out.push({ id: e.id, timestamp: e.timestamp, text });
  }
  return out;
}

// Cases this browser reported, so a citizen can find them again. Per-device convenience only.
const CASES_KEY = "converge.myCases";

export function readMyCases(): string[] {
  try {
    const raw = window.localStorage.getItem(CASES_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function rememberCase(id: string): void {
  try {
    const ids = [id, ...readMyCases().filter((x) => x !== id)].slice(0, 10);
    window.localStorage.setItem(CASES_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked: the "Track your case" link still works for this visit.
  }
}

export function forgetCase(id: string): void {
  try {
    window.localStorage.setItem(CASES_KEY, JSON.stringify(readMyCases().filter((x) => x !== id)));
  } catch {
    // Nothing to forget.
  }
}

/** True once `busy` has lasted longer than `ms`: the free backend can take ~1 min to wake up. */
export function useSlowHint(busy: boolean, ms = 3000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [busy, ms]);
  return slow;
}

export const WAKING_HINT = "Still working… the service may be waking up. This can take up to a minute.";

export const CITIZEN_STATUS_LABEL: Record<Status, string> = {
  open: "Logged",
  assigned: "Crew assigned",
  in_progress: "Being fixed",
  pending_verification: "Please check",
  verified_closed: "Fixed",
  reopened: "Reopened",
  escalated: "Delayed",
  rejected: "Not accepted",
};

export const STAGES = ["Reported", "Crew assigned", "Being fixed", "Checking", "Fixed"] as const;

/** Which of STAGES the case is at, for the progress bar. */
export function stageOf(inc: Incident): number {
  if (inc.status === "verified_closed") return 4;
  if (inc.completed_at) return 3;
  if (inc.status === "in_progress") return 2;
  if (inc.assigned_resource_id || inc.parent_incident_id) return 1;
  return 0;
}

/** "about 5 hours left", "2 days 3 h left", "40 min overdue". */
export function friendlyTimeLeft(hours: number): string {
  const abs = Math.abs(hours);
  let text: string;
  if (abs < 1) {
    text = `${Math.max(1, Math.round(abs * 60))} min`;
  } else if (abs < 24) {
    const h = Math.round(abs);
    text = `${h} hour${h === 1 ? "" : "s"}`;
  } else {
    const d = Math.floor(abs / 24);
    const h = Math.round(abs % 24);
    text = `${d} day${d === 1 ? "" : "s"}${h ? ` ${h} h` : ""}`;
  }
  return hours < 0 ? `${text} overdue` : `${text} left`;
}

const CATEGORY_HINTS: [Category, RegExp][] = [
  ["sewage", /sewage|sewer|manhole|drain|gutter/],
  ["garbage", /garbage|trash|rubbish|litter|waste|\bbins?\b|dump/],
  ["water_leak", /water|leak|pipe|burst|flood|gush/],
  ["streetlight", /street ?light|lamp|bulb|\blights?\b|\bdark\b/],
  ["pothole", /pothole|crater|\broad\b|crack|caving|sinking/],
];

/** Best guess of the category from the citizen's own words, so most people never have to pick. */
export function guessCategory(text: string): Category | null {
  const t = text.toLowerCase();
  return CATEGORY_HINTS.find(([, re]) => re.test(t))?.[0] ?? null;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Metres between two points (haversine); good enough for "nearby" at city scale. */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// Target fix time per category, mirrored from the SLA table in docs/CONTRACTS.md.
const FIX_HOURS: Record<Category, number> = {
  pothole: 48,
  streetlight: 24,
  water_leak: 12,
  garbage: 24,
  sewage: 12,
  other: 72,
};

export function fixTimeText(c: Category): string {
  const h = FIX_HOURS[c];
  return h < 24 ? `Usually fixed within ${h} hours.` : `Usually fixed within ${h / 24} day${h === 24 ? "" : "s"}.`;
}

/** The crew says it's done and the case is waiting for someone to confirm. */
export function needsCheck(inc: Incident): boolean {
  return !!inc.completed_at && (inc.status === "pending_verification" || inc.status === "escalated");
}

/** Open cases a citizen can join with "Me too" (not closed, not already waiting for confirmation). */
export function joinable(inc: Incident): boolean {
  return inc.status !== "verified_closed" && !inc.completed_at;
}

function readList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const ME_TOO_KEY = "converge.meToo";

export function hasMeToo(id: string): boolean {
  return readList(ME_TOO_KEY).includes(id);
}

export function markMeToo(id: string): void {
  try {
    window.localStorage.setItem(ME_TOO_KEY, JSON.stringify([id, ...readList(ME_TOO_KEY).filter((x) => x !== id)].slice(0, 50)));
  } catch {
    // Not remembered on this device; the backend still links the report.
  }
}

const DRAFT_KEY = "converge.draft";

export function readDraft(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDraft(text: string): void {
  try {
    if (text.trim()) window.localStorage.setItem(DRAFT_KEY, text);
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Drafts are a convenience; ignore blocked storage.
  }
}

/** First name pre-filled on the sign-in form next time (never the email). */
export const NAME_KEY = "converge.lastName";

/** "Sign out" on a shared phone: forget this person's name, cases, "Me too" marks and draft. */
export function forgetDevice(): void {
  try {
    for (const key of [NAME_KEY, CASES_KEY, ME_TOO_KEY, DRAFT_KEY]) window.localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
}
