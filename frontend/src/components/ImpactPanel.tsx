import type { Impact } from "@/lib/types";

const KIND_ICON: Record<Impact["services"][number]["kind"], string> = {
  transport: "🚌",
  school: "🏫",
  health: "🏥",
};

/** v2: city services near an incident that it could disrupt. Seeded data, labelled as simulated. */
export function ImpactPanel({ impact }: { impact: Impact }) {
  if (impact.services.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affected city services</h3>
        {impact.simulated && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">simulated</span>}
      </div>
      <ul className="space-y-1.5">
        {impact.services.map((s) => (
          <li key={s.id} className="rounded-md bg-orange-50 px-3 py-1.5 text-xs text-orange-900 ring-1 ring-orange-200">
            <span className="font-medium">
              {KIND_ICON[s.kind] ?? "📍"} {s.name}
            </span>
            <span className="text-orange-700">
              {" "}
              · {Math.round(s.distance_m)} m{s.via_incident_id !== impact.incident_id && ` via ${s.via_incident_id}`}
            </span>
            {s.impact && <p className="text-orange-800">{s.impact}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
