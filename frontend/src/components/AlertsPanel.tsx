import { AlertTriangle, BellRing, CircleAlert, Clock, Siren, UserX } from "lucide-react";

import { eventTitle, formatTime, prettyText } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

import { CARD, CardHeader, EmptyState, Pill } from "./OpUi";

/** Audit events an operator should act on. */
export const ALERT_EVENTS = new Set([
  "escalated",
  "sla_breach",
  "sla_at_risk",
  "false_closure_detected",
  "no_resource",
  "plan_invalidated",
]);

export const ALERT_STYLE: Record<string, { icon: typeof Siren; cls: string }> = {
  escalated: { icon: Siren, cls: "bg-bad/10 text-bad ring-bad/25" },
  sla_breach: { icon: Clock, cls: "bg-bad/10 text-bad ring-bad/25" },
  sla_at_risk: { icon: Clock, cls: "bg-warn/10 text-warn ring-warn/25" },
  false_closure_detected: { icon: CircleAlert, cls: "bg-bad/10 text-bad ring-bad/25" },
  no_resource: { icon: UserX, cls: "bg-bad/10 text-bad ring-bad/25" },
  plan_invalidated: { icon: AlertTriangle, cls: "bg-warn/10 text-warn ring-warn/25" },
};

export function AlertRow({ a, onOpen, compact }: { a: AuditEvent; onOpen: (incidentId: string) => void; compact?: boolean }) {
  const s = ALERT_STYLE[a.event_type] ?? ALERT_STYLE.escalated;
  const Icon = s.icon;
  return (
    <button
      type="button"
      disabled={!a.incident_id}
      onClick={() => a.incident_id && onOpen(a.incident_id)}
      className="flex w-full gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ${s.cls}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-foreground">
            {eventTitle(a.event_type)}
            {a.incident_id && <span className="font-mono text-[11px] font-normal text-muted"> · {a.incident_id}</span>}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted">{formatTime(a.timestamp)}</span>
        </span>
        {a.detail && <span className={`mt-0.5 block text-xs leading-relaxed text-[#aab2c5] ${compact ? "line-clamp-2" : ""}`}>{prettyText(a.detail)}</span>}
      </span>
    </button>
  );
}

export function AlertsPanel({
  alerts,
  onOpen,
  title,
  limit,
  columns,
}: {
  alerts: AuditEvent[];
  onOpen: (incidentId: string) => void;
  title: string;
  limit?: number;
  /** Lay alerts out in two columns on wide screens (overview strip). */
  columns?: boolean;
}) {
  const shown = [...alerts].reverse().slice(0, limit ?? alerts.length);
  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader icon={BellRing} title={title} subtitle="Escalations, breaches, false closures" right={<Pill className="bg-surface-2 text-foreground ring-line-strong">{alerts.length} total</Pill>} />
      {shown.length === 0 ? (
        <EmptyState icon={BellRing} title="No alerts" text="Escalations, missed deadlines and false closures show up here." />
      ) : (
        <ul className={`op-scroll grid max-h-[26rem] gap-0.5 overflow-y-auto p-2 ${columns ? "lg:grid-cols-2 lg:gap-x-4" : ""}`}>
          {shown.map((a) => (
            <li key={a.id}>
              <AlertRow a={a} onOpen={onOpen} compact={!!limit} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
