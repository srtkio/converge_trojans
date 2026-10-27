import { CATEGORY_ICON, formatHours, hoursLeft } from "@/lib/format";
import type { Incident } from "@/lib/types";

import { StatusBadge } from "./StatusBadge";

/** Overview list: the incidents an operator should look at first. */
export function NeedsAttention({
  incidents,
  now,
  onOpen,
}: {
  incidents: Incident[];
  now: string | null;
  onOpen: (id: string) => void;
}) {
  const reason = (i: Incident): string | null => {
    if (i.status === "escalated") return "Escalated";
    if (i.status === "reopened") return "Reopened: fix was disputed";
    if (i.at_risk) return "Deadline at risk";
    if (i.status === "pending_verification") return "Waiting for proof";
    if (i.status === "open") return "No crew assigned";
    return null;
  };
  const rank = (i: Incident) =>
    ["escalated", "reopened"].indexOf(i.status) >= 0 ? 0 : i.at_risk ? 1 : i.status === "pending_verification" ? 2 : 3;
  const items = incidents
    .map((i) => ({ i, why: reason(i) }))
    .filter((x): x is { i: Incident; why: string } => x.why !== null)
    .sort((a, b) => rank(a.i) - rank(b.i) || a.i.deadline.localeCompare(b.i.deadline));

  const open = incidents.filter((i) => i.status !== "verified_closed").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <span className="text-xs text-slate-500">
          {open} open · {incidents.length - open} verified closed
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          {incidents.length === 0 ? "No incidents yet. Run a demo scenario or wait for citizen reports." : "Nothing needs action right now."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map(({ i, why }) => {
            const left = now ? hoursLeft(i.deadline, now) : null;
            return (
              <li key={i.id}>
                <button type="button" onClick={() => onOpen(i.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="text-lg">{CATEGORY_ICON[i.category]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{i.title}</span>
                    <span className="text-xs text-slate-500">
                      {why} · {i.department}
                      {left !== null && i.status !== "verified_closed" && ` · ${formatHours(left)}`}
                    </span>
                  </span>
                  <StatusBadge status={i.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
