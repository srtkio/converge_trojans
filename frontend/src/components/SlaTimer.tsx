import { Timer } from "lucide-react";

import type { Incident } from "@/lib/types";

const CLOSED = new Set(["verified_closed", "rejected"]);

function fmt(ms: number): string {
  const m = Math.max(0, Math.round(Math.abs(ms) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

/**
 * Live SLA countdown against the simulated clock: on track (green), at risk (amber, under 4 h
 * left or flagged by the backend) or breached (red, pulsing).
 */
export function SlaTimer({ incident, now, size = "sm" }: { incident: Incident; now: string | null; size?: "sm" | "lg" }) {
  if (CLOSED.has(incident.status) || !now) return null;
  const left = new Date(incident.deadline).getTime() - new Date(now).getTime();
  const state =
    incident.sla_state ?? (left < 0 ? "breached" : incident.at_risk || left < 4 * 3600_000 ? "at_risk" : "on_track");
  const tone =
    state === "breached"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : state === "at_risk"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  const dot = state === "breached" ? "bg-rose-500" : state === "at_risk" ? "bg-amber-500" : "bg-emerald-500";
  const text = left < 0 ? `Overdue ${fmt(left)}` : `${fmt(left)} left`;
  const big = size === "lg";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums ring-1 ${tone} ${big ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
      title={`SLA deadline ${new Date(incident.deadline).toUTCString()}`}
    >
      <span className="relative flex h-2 w-2">
        {state !== "on_track" && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <Timer className={big ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      {text}
    </span>
  );
}
