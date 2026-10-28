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
      ? "bg-bad/10 text-bad ring-bad/35"
      : state === "at_risk"
        ? "bg-warn/10 text-warn ring-warn/30"
        : "bg-ok/[0.07] text-ok ring-ok/25";
  const dot = state === "breached" ? "bg-bad" : state === "at_risk" ? "bg-warn" : "bg-ok";
  const text = left < 0 ? `Overdue ${fmt(left)}` : `${fmt(left)} left`;
  const big = size === "lg";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium tabular-nums ring-1 ${tone} ${big ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]"}`}
      title={`SLA deadline ${new Date(incident.deadline).toUTCString()}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {state !== "on_track" && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
      <Timer className={big ? "h-4 w-4" : "h-3 w-3"} aria-hidden />
      {text}
    </span>
  );
}
