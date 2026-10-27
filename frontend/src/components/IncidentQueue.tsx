import { CATEGORY_ICON, CATEGORY_LABEL } from "@/lib/format";
import type { Incident } from "@/lib/types";

import { SlaTimer } from "./SlaTimer";
import { StatusBadge } from "./StatusBadge";

// Escalated and reopened first, closed last; within a group, nearest deadline first.
const PRIORITY: Record<Incident["status"], number> = {
  escalated: 0,
  reopened: 1,
  open: 2,
  pending_verification: 3,
  assigned: 4,
  in_progress: 5,
  verified_closed: 9,
  rejected: 10,
};

export function IncidentQueue({
  incidents,
  now,
  selectedId,
  onSelect,
}: {
  incidents: Incident[];
  now: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = [...incidents].sort(
    (a, b) => PRIORITY[a.status] - PRIORITY[b.status] || a.deadline.localeCompare(b.deadline),
  );

  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold">Incident queue</h2>
        <span className="text-xs text-slate-500">{incidents.length} incidents</span>
      </div>
      {sorted.length === 0 && <p className="p-4 text-sm text-slate-500">No incidents yet.</p>}
      <ul className="divide-y divide-slate-100">
        {sorted.map((inc) => {
          const closed = inc.status === "verified_closed";
          return (
            <li key={inc.id}>
              <button
                onClick={() => onSelect(inc.id)}
                className={`w-full px-3 py-2.5 text-left transition hover:bg-slate-50 ${
                  selectedId === inc.id ? "bg-slate-100" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {CATEGORY_ICON[inc.category]} {inc.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {inc.id} · {CATEGORY_LABEL[inc.category]} · {inc.department}
                    </div>
                  </div>
                  <StatusBadge status={inc.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className="text-slate-600">
                    {inc.report_ids.length} report{inc.report_ids.length === 1 ? "" : "s"}
                  </span>
                  {inc.related_incident_ids.length > 0 && (
                    <span className="text-violet-700">↔ {inc.related_incident_ids.length} related</span>
                  )}
                  {inc.at_risk && <span className="font-medium text-amber-700">⚠ SLA at risk</span>}
                  {!!inc.child_incident_ids?.length && (
                    <span className="text-violet-700">⬢ root cause of {inc.child_incident_ids.length}</span>
                  )}
                  {inc.parent_incident_id && <span className="text-violet-700">↳ waits on {inc.parent_incident_id}</span>}
                  {inc.escalation_level > 0 && (
                    <span className="font-medium text-red-700">▲ escalation {inc.escalation_level}</span>
                  )}
                  {!closed && <SlaTimer incident={inc} now={now} />}
                  {inc.verification === "unverified" && !closed && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">unverified</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
