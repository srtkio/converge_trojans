import type { Impact } from "@/lib/types";

const KIND_ICON: Record<Impact["services"][number]["kind"], string> = {
  transit: "🚌",
  school: "🏫",
  health: "🏥",
  commerce: "🏪",
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
      <ul className="flex flex-wrap gap-2">
        {impact.services.map((s) => (
          <li key={s.id} className="rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-800 ring-1 ring-orange-200">
            {KIND_ICON[s.kind]} {s.name} <span className="text-orange-600">· {Math.round(s.distance_m)} m</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
