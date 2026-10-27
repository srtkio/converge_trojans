import { eventTitle, formatTime, prettyText } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

const ALERT = new Set(["false_closure_detected", "sla_breach", "escalated", "no_resource", "plan_invalidated"]);
const GOOD = new Set(["verified_closed"]);

export function ActivityFeed({ audit, onSelect }: { audit: AuditEvent[]; onSelect: (id: string) => void }) {
  const recent = [...audit].reverse().slice(0, 25);
  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold">Live activity</h2>
        <span className="text-xs text-slate-500">{audit.length} audited events</span>
      </div>
      {recent.length === 0 && <p className="p-3 text-sm text-slate-500">Nothing yet.</p>}
      <ol className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {recent.map((e) => (
          <li key={e.id}>
            <button
              disabled={!e.incident_id}
              onClick={() => e.incident_id && onSelect(e.incident_id)}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <div className="flex justify-between gap-2">
                <span
                  className={`font-semibold ${ALERT.has(e.event_type) ? "text-red-700" : GOOD.has(e.event_type) ? "text-emerald-700" : "text-slate-800"}`}
                >
                  {eventTitle(e.event_type)}
                  {e.incident_id && <span className="font-normal text-slate-500"> · {e.incident_id}</span>}
                </span>
                <span className="shrink-0 font-mono text-slate-400">{formatTime(e.timestamp)}</span>
              </div>
              {e.detail && <p className="truncate text-slate-600">{prettyText(e.detail)}</p>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
