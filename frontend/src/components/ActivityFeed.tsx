import { ScrollText } from "lucide-react";

import { eventTitle, formatTime, prettyText } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

import { CARD, CardHeader, EmptyState, Pill } from "./OpUi";

const ALERT = new Set(["false_closure_detected", "sla_breach", "escalated", "no_resource", "plan_invalidated"]);
const GOOD = new Set(["verified_closed"]);

export function ActivityFeed({ audit, onSelect }: { audit: AuditEvent[]; onSelect: (id: string) => void }) {
  const recent = [...audit].reverse().slice(0, 40);
  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader icon={ScrollText} title="Audit log" subtitle="Every state change, with actor and time" right={<Pill className="bg-surface-2 text-foreground ring-line-strong">{audit.length} events</Pill>} />
      {recent.length === 0 && <EmptyState icon={ScrollText} title="Nothing yet" text="Audited events appear as cases move." />}
      <ol className="op-scroll max-h-[22rem] divide-y divide-line overflow-y-auto">
        {recent.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={!e.incident_id}
              onClick={() => e.incident_id && onSelect(e.incident_id)}
              className="w-full px-4 py-2 text-left text-xs transition-colors hover:bg-surface-2/60 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <div className="flex justify-between gap-2">
                <span className={`font-medium ${ALERT.has(e.event_type) ? "text-bad" : GOOD.has(e.event_type) ? "text-ok" : "text-foreground"}`}>
                  {eventTitle(e.event_type)}
                  {e.incident_id && <span className="font-mono font-normal text-muted"> · {e.incident_id}</span>}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted">{formatTime(e.timestamp)}</span>
              </div>
              {e.detail && <p className="mt-0.5 truncate text-[#aab2c5]">{prettyText(e.detail)}</p>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
