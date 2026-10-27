"use client";

import { AlertTriangle, CheckCircle2, Copy, FileText, Repeat, Siren, Timer, TrendingUp } from "lucide-react";

import type { Incident, Metrics } from "@/lib/types";

import { useTween } from "./CitizenMotion";

const CARD = "rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5";

function Count({ value }: { value: number }) {
  // Animate numbers as they change; falls back to the plain value before the first frame.
  const v = useTween(value, 600);
  return <>{Math.round(v ?? value)}</>;
}

function Kpi({ label, value, icon: Icon, tone, hint }: { label: string; value: number; icon: typeof Siren; tone: string; hint: string }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
        <Count value={value} />
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Mini({ label, value, icon: Icon, tone = "text-slate-500" }: { label: string; value: number; icon: typeof Siren; tone?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-slate-900/5">
      <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden />
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-slate-900">
        <Count value={value} />
      </span>
    </div>
  );
}

export function MetricsBar({ metrics: m, incidents = [] }: { metrics: Metrics; incidents?: Incident[] }) {
  const open = incidents.filter((i) => i.status !== "verified_closed" && i.status !== "rejected");
  const atRisk = open.filter((i) => i.sla_state === "at_risk" || i.sla_state === "breached" || i.at_risk).length;
  const escalated = open.filter((i) => i.status === "escalated" || i.escalation_level > 0).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Open cases" value={open.length} icon={Siren} tone="bg-sky-50 text-sky-600" hint={`${m.reports} citizen reports in total`} />
        <Kpi label="Deadline at risk" value={atRisk} icon={Timer} tone="bg-amber-50 text-amber-600" hint="At risk or past the SLA" />
        <Kpi label="Escalated" value={escalated} icon={AlertTriangle} tone="bg-rose-50 text-rose-600" hint="Moved up the ladder" />
        <Kpi label="Verified closed" value={m.verified_closures} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" hint="Closed with evidence only" />
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* The headline: same reports, naive system vs CONVERGE. */}
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
            <h2 className="text-sm font-semibold">Same reports · naive ticketing vs CONVERGE</h2>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-2 font-medium" />
                <th className="py-2 font-medium">Naive</th>
                <th className="py-2 font-medium">CONVERGE</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-t border-slate-100">
                <td className="py-2.5 text-slate-600">Work orders</td>
                <td className="font-semibold text-slate-900">{m.baseline.work_orders}</td>
                <td className="font-semibold text-emerald-700">
                  {m.incidents}
                  {m.duplicate_work_orders_avoided > 0 && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      −{m.duplicate_work_orders_avoided} duplicate{m.duplicate_work_orders_avoided > 1 ? "s" : ""}
                    </span>
                  )}
                </td>
              </tr>
              {m.coordinated_vs_independent && (
                <tr className="border-t border-slate-100">
                  <td className="py-2.5 text-slate-600">Crew visits</td>
                  <td className="font-semibold text-slate-900">{m.coordinated_vs_independent.independent_visits}</td>
                  <td className="font-semibold text-emerald-700">
                    {m.coordinated_vs_independent.coordinated_visits}
                    {!!m.crew_visits_saved && (
                      <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">−{m.crew_visits_saved} via shared root cause</span>
                    )}
                  </td>
                </tr>
              )}
              <tr className="border-t border-slate-100">
                <td className="py-2.5 text-slate-600">False closures accepted</td>
                <td className={`font-semibold ${m.baseline.false_closures_accepted ? "text-rose-700" : "text-slate-900"}`}>
                  {m.baseline.false_closures_accepted}
                </td>
                <td className="font-semibold text-emerald-700">
                  0
                  {m.false_closures_caught > 0 && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{m.false_closures_caught} caught &amp; reopened</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`${CARD} grid grid-cols-1 content-start gap-2 p-4 sm:grid-cols-2`}>
          <Mini label="Reports" value={m.reports} icon={FileText} />
          <Mini label="Duplicates linked" value={m.duplicates_linked} icon={Copy} tone="text-violet-600" />
          <Mini label="Replans" value={m.replans} icon={Repeat} tone="text-sky-600" />
          <Mini label="SLA breaches" value={m.sla_breaches} icon={Timer} tone="text-rose-600" />
          <Mini label="Escalations" value={m.escalations} icon={AlertTriangle} tone="text-rose-600" />
          <Mini label="Verified closed" value={m.verified_closures} icon={CheckCircle2} tone="text-emerald-600" />
        </div>
      </section>
    </div>
  );
}
