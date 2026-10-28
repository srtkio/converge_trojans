import { Gauge } from "lucide-react";

import { formatHours, hoursLeft } from "@/lib/format";
import { isOpen, slaState, slaUsed } from "@/lib/opTheme";
import type { Incident } from "@/lib/types";

import { CARD, CardHeader, EmptyState, Pill } from "./OpUi";

/** Open cases closest to (or past) their SLA deadline, with how much of the window is used. */
export function SlaWatch({
  incidents,
  now,
  onOpen,
  limit = 6,
}: {
  incidents: Incident[];
  now: string | null;
  onOpen: (id: string) => void;
  limit?: number;
}) {
  const rows = incidents
    .filter(isOpen)
    .map((i) => ({ i, state: slaState(i, now), used: slaUsed(i, now) }))
    .sort((a, b) => a.i.deadline.localeCompare(b.i.deadline));
  const risky = rows.filter((r) => r.state === "at_risk" || r.state === "breached").length;

  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader
        icon={Gauge}
        title="SLA watch"
        subtitle="Nearest deadlines first"
        right={
          <Pill className={risky ? "bg-warn/10 text-warn ring-warn/25" : "bg-ok/10 text-ok ring-ok/25"}>
            {risky ? `${risky} at risk` : "All on track"}
          </Pill>
        }
      />
      {rows.length === 0 || !now ? (
        <EmptyState icon={Gauge} title="No open deadlines" text="Open cases and their SLA clocks show up here." />
      ) : (
        <ul className="space-y-1 p-2">
          {rows.slice(0, limit).map(({ i, state, used }) => {
            const pct = Math.max(0, Math.min(100, (used ?? 0) * 100));
            const bar = state === "breached" ? "bg-bad" : state === "at_risk" ? "bg-warn" : "bg-ok/80";
            const text = state === "breached" ? "text-bad" : state === "at_risk" ? "text-warn" : "text-muted";
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onOpen(i.id)}
                  className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-muted">{i.id}</span> <span className="text-foreground">{i.title}</span>
                    </span>
                    <span className={`shrink-0 font-medium tabular-nums ${text}`}>{formatHours(hoursLeft(i.deadline, now))}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${Math.round(pct)}% of SLA used`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full rounded-full ${bar} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
