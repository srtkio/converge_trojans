"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  FileText,
  Hourglass,
  Repeat,
  Scale,
  Siren,
  Timer,
  type LucideIcon,
} from "lucide-react";

import { isOpen } from "@/lib/opTheme";
import type { Incident, Metrics } from "@/lib/types";

import { useTween } from "./CitizenMotion";
import { CARD, CardHeader } from "./OpUi";

function Count({ value }: { value: number }) {
  // Animate numbers as they change; falls back to the plain value before the first frame.
  const v = useTween(value, 600);
  return <>{Math.round(v ?? value)}</>;
}

export type KpiTarget = "open" | "risk" | "escalated" | "pending_verification" | "verified_closed";

const KPI_TONE = {
  accent: { icon: "bg-accent/12 text-accent ring-accent/25", bar: "bg-accent" },
  warn: { icon: "bg-warn/10 text-warn ring-warn/25", bar: "bg-warn" },
  bad: { icon: "bg-bad/10 text-bad ring-bad/25", bar: "bg-bad" },
  cyan: { icon: "bg-accent-2/10 text-accent-2 ring-accent-2/25", bar: "bg-accent-2" },
  ok: { icon: "bg-ok/10 text-ok ring-ok/25", bar: "bg-ok" },
} as const;

function Kpi({
  label,
  value,
  of,
  icon: Icon,
  tone,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  of: number;
  icon: LucideIcon;
  tone: keyof typeof KPI_TONE;
  hint: string;
  onClick?: () => void;
}) {
  const t = KPI_TONE[tone];
  const pct = of > 0 ? Math.min(100, (value / of) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD} group relative overflow-hidden p-4 text-left transition-[border-color,transform] duration-200 hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 motion-safe:hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${t.icon}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5 text-[28px] font-semibold leading-none tabular-nums tracking-tight text-foreground">
        <Count value={value} />
        <span className="text-xs font-medium text-muted">/ {of}</span>
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${t.bar} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span className="truncate">{hint}</span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" aria-hidden />
      </p>
    </button>
  );
}

/** Headline counts from live data. Each card opens the incident queue filtered to those cases. */
export function KpiRow({
  metrics: m,
  incidents,
  onPick,
}: {
  metrics: Metrics;
  incidents: Incident[];
  onPick?: (target: KpiTarget) => void;
}) {
  const open = incidents.filter(isOpen);
  const atRisk = open.filter((i) => i.sla_state === "at_risk" || i.sla_state === "breached" || i.at_risk).length;
  const escalated = open.filter((i) => i.status === "escalated" || i.escalation_level > 0).length;
  const awaiting = incidents.filter((i) => i.status === "pending_verification").length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Kpi label="Open cases" value={open.length} of={incidents.length} icon={Siren} tone="accent" hint={`${m.reports} citizen reports filed`} onClick={() => onPick?.("open")} />
      <Kpi label="SLA at risk" value={atRisk} of={open.length} icon={Timer} tone="warn" hint="At risk or past deadline" onClick={() => onPick?.("risk")} />
      <Kpi label="Escalated" value={escalated} of={open.length} icon={AlertTriangle} tone="bad" hint="Moved up the ladder" onClick={() => onPick?.("escalated")} />
      <Kpi label="Awaiting proof" value={awaiting} of={open.length} icon={Hourglass} tone="cyan" hint="Work done, needs evidence" onClick={() => onPick?.("pending_verification")} />
      <Kpi label="Verified closed" value={m.verified_closures} of={incidents.length} icon={CheckCircle2} tone="ok" hint="Closed with evidence only" onClick={() => onPick?.("verified_closed")} />
    </div>
  );
}

function Mini({ label, value, icon: Icon, tone = "text-muted" }: { label: string; value: number; icon: LucideIcon; tone?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-[#0a0f1b] px-3 py-2 ring-1 ring-line">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} aria-hidden />
      <span className="flex-1 truncate text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        <Count value={value} />
      </span>
    </div>
  );
}

const SAVE = "ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1";

/** The headline comparison: the same reports through naive ticketing vs CONVERGE. */
export function MetricsBar({ metrics: m }: { metrics: Metrics; incidents?: Incident[] }) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader icon={Scale} title="Same reports · naive ticketing vs CONVERGE" subtitle="Counts from the live system, not estimates" />
      <div className="overflow-x-auto px-4 pb-2 pt-1 op-scroll">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-muted">
              <th className="py-2.5 font-semibold">Measure</th>
              <th className="py-2.5 font-semibold">Naive</th>
              <th className="py-2.5 font-semibold text-accent">CONVERGE</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-t border-line">
              <td className="py-3 text-[#c3c9d8]">Work orders</td>
              <td className="font-semibold text-foreground">{m.baseline.work_orders}</td>
              <td className="font-semibold text-ok">
                {m.incidents}
                {m.duplicate_work_orders_avoided > 0 && (
                  <span className={`${SAVE} bg-ok/10 text-ok ring-ok/25`}>
                    −{m.duplicate_work_orders_avoided} duplicate{m.duplicate_work_orders_avoided > 1 ? "s" : ""}
                  </span>
                )}
              </td>
            </tr>
            {m.coordinated_vs_independent && (
              <tr className="border-t border-line">
                <td className="py-3 text-[#c3c9d8]">Crew visits</td>
                <td className="font-semibold text-foreground">{m.coordinated_vs_independent.independent_visits}</td>
                <td className="font-semibold text-ok">
                  {m.coordinated_vs_independent.coordinated_visits}
                  {!!m.crew_visits_saved && (
                    <span className={`${SAVE} bg-violet-400/10 text-violet-300 ring-violet-400/25`}>−{m.crew_visits_saved} via shared root cause</span>
                  )}
                </td>
              </tr>
            )}
            <tr className="border-t border-line">
              <td className="py-3 text-[#c3c9d8]">False closures accepted</td>
              <td className={`font-semibold ${m.baseline.false_closures_accepted ? "text-bad" : "text-foreground"}`}>
                {m.baseline.false_closures_accepted}
              </td>
              <td className="font-semibold text-ok">
                0
                {m.false_closures_caught > 0 && (
                  <span className={`${SAVE} bg-ok/10 text-ok ring-ok/25`}>{m.false_closures_caught} caught &amp; reopened</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line p-3 sm:grid-cols-3">
        <Mini label="Reports" value={m.reports} icon={FileText} />
        <Mini label="Duplicates linked" value={m.duplicates_linked} icon={Copy} tone="text-violet-300" />
        <Mini label="Replans" value={m.replans} icon={Repeat} tone="text-accent-2" />
        <Mini label="SLA breaches" value={m.sla_breaches} icon={Timer} tone="text-bad" />
        <Mini label="Escalations" value={m.escalations} icon={AlertTriangle} tone="text-warn" />
        <Mini label="Verified closed" value={m.verified_closures} icon={CheckCircle2} tone="text-ok" />
      </div>
    </section>
  );
}
