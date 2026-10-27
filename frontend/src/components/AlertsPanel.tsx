import { eventTitle, formatTime, prettyText } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

/** Audit events an operator should act on. */
export const ALERT_EVENTS = new Set([
  "escalated",
  "sla_breach",
  "sla_at_risk",
  "false_closure_detected",
  "no_resource",
  "plan_invalidated",
]);

const TONE: Record<string, string> = {
  sla_at_risk: "border-amber-400 bg-amber-50",
  plan_invalidated: "border-amber-400 bg-amber-50",
};

export function AlertsPanel({
  alerts,
  onOpen,
  title,
  limit,
}: {
  alerts: AuditEvent[];
  onOpen: (incidentId: string) => void;
  title: string;
  limit?: number;
}) {
  const shown = [...alerts].reverse().slice(0, limit ?? alerts.length);
  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-slate-500">{alerts.length} total</span>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No alerts. Escalations, missed deadlines and false closures show up here.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto p-3">
          {shown.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={!a.incident_id}
                onClick={() => a.incident_id && onOpen(a.incident_id)}
                className={`w-full rounded-md border-l-4 px-3 py-2 text-left hover:brightness-95 disabled:cursor-default ${
                  TONE[a.event_type] ?? "border-rose-400 bg-rose-50"
                }`}
              >
                <div className="flex justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">
                    {eventTitle(a.event_type)}
                    {a.incident_id && <span className="font-normal text-slate-500"> · {a.incident_id}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-slate-500">{formatTime(a.timestamp)}</span>
                </div>
                {a.detail && <p className="mt-0.5 text-sm text-slate-700">{prettyText(a.detail)}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
