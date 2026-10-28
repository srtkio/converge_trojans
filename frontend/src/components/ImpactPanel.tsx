import { Bus, GraduationCap, HeartPulse, MapPin } from "lucide-react";

import type { Impact } from "@/lib/types";

const KIND_ICON = { transport: Bus, school: GraduationCap, health: HeartPulse } as const;

/** v2: city services near an incident that it could disrupt. Seeded data, labelled as simulated. */
export function ImpactPanel({ impact }: { impact: Impact }) {
  if (impact.services.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Affected city services</h3>
        {impact.simulated && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-line">simulated</span>}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {impact.services.map((s) => {
          const Icon = KIND_ICON[s.kind] ?? MapPin;
          return (
            <li key={s.id} className="flex gap-2.5 rounded-lg bg-orange-400/[0.06] px-3 py-2 text-xs ring-1 ring-orange-400/20">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" aria-hidden />
              <span className="min-w-0">
                <span className="font-medium text-orange-100">{s.name}</span>
                <span className="text-orange-300/80">
                  {" "}
                  · {Math.round(s.distance_m)} m{s.via_incident_id !== impact.incident_id && ` via ${s.via_incident_id}`}
                </span>
                {s.impact && <span className="mt-0.5 block text-orange-200/80">{s.impact}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
