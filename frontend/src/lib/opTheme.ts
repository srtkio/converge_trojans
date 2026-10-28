// Operator console styling: dark-theme tones for statuses, categories and roles.
// Kept apart from lib/format.ts so the citizen pages' light badges are not affected.
import {
  Construction,
  Droplets,
  Lightbulb,
  MapPin,
  Trash2,
  Waves,
  type LucideIcon,
} from "lucide-react";

import type { Category, Incident, Status } from "./types";

/** Badge classes per status on the dark console. */
export const STATUS_TONE: Record<Status, string> = {
  open: "bg-slate-400/10 text-slate-300 ring-slate-400/25",
  assigned: "bg-accent/10 text-[#a9c1ff] ring-accent/30",
  in_progress: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/30",
  pending_verification: "bg-warn/10 text-warn ring-warn/30",
  verified_closed: "bg-ok/10 text-ok ring-ok/30",
  reopened: "bg-bad/10 text-bad ring-bad/30",
  escalated: "bg-bad/15 text-[#fca5a5] ring-bad/45",
  rejected: "bg-slate-500/10 text-slate-400 ring-slate-500/25 line-through",
};

export const CATEGORY_GLYPH: Record<Category, LucideIcon> = {
  pothole: Construction,
  streetlight: Lightbulb,
  water_leak: Droplets,
  garbage: Trash2,
  sewage: Waves,
  other: MapPin,
};

/** Icon tile colour per category (background + text). */
export const CATEGORY_TONE: Record<Category, string> = {
  pothole: "bg-orange-400/10 text-orange-300 ring-orange-400/20",
  streetlight: "bg-yellow-300/10 text-yellow-200 ring-yellow-300/20",
  water_leak: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  garbage: "bg-lime-400/10 text-lime-300 ring-lime-400/20",
  sewage: "bg-teal-400/10 text-teal-300 ring-teal-400/20",
  other: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
};

export const ROLE_LABEL: Record<string, string> = {
  officer: "Department officer",
  head: "Department head",
  command: "City command centre",
};

export const ROLE_TONE: Record<string, string> = {
  officer: "bg-accent/15 text-[#a9c1ff] ring-accent/30",
  head: "bg-warn/10 text-warn ring-warn/30",
  command: "bg-bad/10 text-[#fca5a5] ring-bad/35",
};

export const CLOSED_STATUSES = new Set<Status>(["verified_closed", "rejected"]);
export const isOpen = (i: Incident) => !CLOSED_STATUSES.has(i.status);

export type SlaState = "on_track" | "at_risk" | "breached";

/** SLA state of an open incident against the simulated clock; null once closed. */
export function slaState(i: Incident, now: string | null): SlaState | null {
  if (!isOpen(i)) return null;
  if (i.sla_state) return i.sla_state;
  if (!now) return null;
  const left = new Date(i.deadline).getTime() - new Date(now).getTime();
  return left < 0 ? "breached" : i.at_risk || left < 4 * 3600_000 ? "at_risk" : "on_track";
}

/** Share of the SLA window already used (0..1+), from creation to deadline. */
export function slaUsed(i: Incident, now: string | null): number | null {
  if (!now) return null;
  const start = new Date(i.created_at).getTime();
  const end = new Date(i.deadline).getTime();
  if (end <= start) return null;
  return (new Date(now).getTime() - start) / (end - start);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "OP";
}
