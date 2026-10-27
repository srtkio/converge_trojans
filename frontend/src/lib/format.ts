import type { Category, Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  pending_verification: "Awaiting proof",
  verified_closed: "Verified closed",
  reopened: "Reopened",
  escalated: "Escalated",
};

// Tailwind classes per status: badge background/text and the dot colour on the map.
export const STATUS_STYLE: Record<Status, { badge: string; dot: string }> = {
  open: { badge: "bg-slate-100 text-slate-700 ring-slate-300", dot: "#64748b" },
  assigned: { badge: "bg-blue-50 text-blue-700 ring-blue-200", dot: "#2563eb" },
  in_progress: { badge: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "#4f46e5" },
  pending_verification: { badge: "bg-amber-50 text-amber-800 ring-amber-300", dot: "#d97706" },
  verified_closed: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "#059669" },
  reopened: { badge: "bg-rose-50 text-rose-700 ring-rose-300", dot: "#e11d48" },
  escalated: { badge: "bg-red-600 text-white ring-red-700", dot: "#dc2626" },
};

export const CATEGORY_LABEL: Record<Category, string> = {
  pothole: "Pothole",
  streetlight: "Streetlight",
  water_leak: "Water leak",
  garbage: "Garbage",
  sewage: "Sewage",
  other: "Other",
};

export const CATEGORY_ICON: Record<Category, string> = {
  pothole: "🕳️",
  streetlight: "💡",
  water_leak: "💧",
  garbage: "🗑️",
  sewage: "🚰",
  other: "📍",
};

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Signed hours from `now` to `deadline`, both on the simulated clock. */
export function hoursLeft(deadline: string, now: string): number {
  return (new Date(deadline).getTime() - new Date(now).getTime()) / 3_600_000;
}

export function formatHours(h: number): string {
  const abs = Math.abs(h);
  const text = abs >= 24 ? `${Math.floor(abs / 24)}d ${Math.round(abs % 24)}h` : `${abs.toFixed(abs < 10 ? 1 : 0)}h`;
  return h < 0 ? `${text} overdue` : `${text} left`;
}

export function humanize(s: string): string {
  return s.replace(/_/g, " ");
}
