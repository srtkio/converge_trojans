import type { Metrics } from "@/lib/types";

function Stat({ label, value, sub, tone = "default" }: { label: string; value: number | string; sub?: string; tone?: "default" | "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function MetricsBar({ metrics: m }: { metrics: Metrics }) {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* The headline: same reports, naive system vs CONVERGE. */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Same reports · naive ticketing vs CONVERGE
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="font-medium" />
              <th className="font-medium">Naive</th>
              <th className="font-medium">CONVERGE</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-t border-slate-100">
              <td className="py-1.5 text-slate-600">Work orders</td>
              <td className="font-semibold text-slate-900">{m.baseline.work_orders}</td>
              <td className="font-semibold text-emerald-700">
                {m.incidents}
                {m.duplicate_work_orders_avoided > 0 && (
                  <span className="ml-1 text-xs font-normal text-emerald-600">
                    −{m.duplicate_work_orders_avoided} duplicate{m.duplicate_work_orders_avoided > 1 ? "s" : ""}
                  </span>
                )}
              </td>
            </tr>
            {m.coordinated_vs_independent && (
              <tr className="border-t border-slate-100">
                <td className="py-1.5 text-slate-600">Crew visits</td>
                <td className="font-semibold text-slate-900">{m.coordinated_vs_independent.independent_visits}</td>
                <td className="font-semibold text-emerald-700">
                  {m.coordinated_vs_independent.coordinated_visits}
                  {!!m.crew_visits_saved && (
                    <span className="ml-1 text-xs font-normal text-emerald-600">−{m.crew_visits_saved} via shared root cause</span>
                  )}
                </td>
              </tr>
            )}
            <tr className="border-t border-slate-100">
              <td className="py-1.5 text-slate-600">False closures accepted</td>
              <td className={`font-semibold ${m.baseline.false_closures_accepted ? "text-red-700" : "text-slate-900"}`}>
                {m.baseline.false_closures_accepted}
              </td>
              <td className="font-semibold text-emerald-700">
                0
                {m.false_closures_caught > 0 && (
                  <span className="ml-1 text-xs font-normal text-emerald-600">{m.false_closures_caught} caught &amp; reopened</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Reports" value={m.reports} />
        <Stat label="Duplicates linked" value={m.duplicates_linked} tone={m.duplicates_linked ? "good" : "default"} />
        <Stat label="Verified closed" value={m.verified_closures} tone={m.verified_closures ? "good" : "default"} />
        <Stat label="Replans" value={m.replans} />
        <Stat label="SLA breaches" value={m.sla_breaches} tone={m.sla_breaches ? "bad" : "default"} />
        <Stat label="Escalations" value={m.escalations} tone={m.escalations ? "bad" : "default"} />
      </div>
    </section>
  );
}
