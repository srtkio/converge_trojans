import { ChevronRight, ListChecks } from "lucide-react";

import type { Incident } from "@/lib/types";

import { CARD, CardHeader, CategoryGlyph, EmptyState, Pill } from "./OpUi";
import { SlaTimer } from "./SlaTimer";
import { StatusBadge } from "./StatusBadge";

const WHY_TONE: Record<string, string> = {
  Escalated: "bg-bad/10 text-[#fca5a5] ring-bad/30",
  "Reopened: fix was disputed": "bg-bad/10 text-bad ring-bad/25",
  "Deadline at risk": "bg-warn/10 text-warn ring-warn/25",
  "Waiting for proof": "bg-accent-2/10 text-accent-2 ring-accent-2/25",
  "No crew assigned": "bg-slate-400/10 text-slate-300 ring-slate-400/25",
};

/** Overview list: the incidents an operator should look at first. */
export function NeedsAttention({
  incidents,
  now,
  onOpen,
  limit = 7,
}: {
  incidents: Incident[];
  now: string | null;
  onOpen: (id: string) => void;
  limit?: number;
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

  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader
        icon={ListChecks}
        title="Needs attention"
        subtitle="Escalations, disputed fixes, deadlines at risk, proof pending"
        right={<Pill className="bg-surface-2 text-foreground ring-line-strong">{items.length} cases</Pill>}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={incidents.length === 0 ? "No incidents yet" : "All clear"}
          text={incidents.length === 0 ? "Run a demo scenario or wait for citizen reports." : "Nothing needs action right now."}
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.slice(0, limit).map(({ i, why }) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onOpen(i.id)}
                className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none"
              >
                <CategoryGlyph category={i.category} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{i.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <span className="font-mono">{i.id}</span>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{i.department}</span>
                    <Pill className={WHY_TONE[why] ?? "bg-surface-2 text-muted ring-line"}>{why}</Pill>
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-2 sm:flex">
                  <SlaTimer incident={i} now={now} />
                  {why !== "Escalated" && why !== "Waiting for proof" && <StatusBadge status={i.status} />}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
              </button>
            </li>
          ))}
          {items.length > limit && <li className="px-4 py-2 text-[11px] text-muted">+{items.length - limit} more in the incident queue</li>}
        </ul>
      )}
    </section>
  );
}
