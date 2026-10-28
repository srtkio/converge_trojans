import type { CSSProperties } from "react";

/**
 * Naive ticketing vs CONVERGE on the same demo scenario. These are the scenario results the
 * backend's /metrics scorecard reports; nothing else is claimed here.
 */
const ROWS = [
  { label: "Work orders", naive: 3, converge: 2, note: "Duplicate reports merged into one case" },
  { label: "Crew visits", naive: 3, converge: 1, note: "One repair for a shared root cause" },
  { label: "False closures accepted", naive: 1, converge: 0, note: "“Done” without evidence is rejected" },
];
const MAX = 3;

function Bar({ value, tone, delay }: { value: number; tone: "naive" | "converge"; delay: number }) {
  const pct = (value / MAX) * 100;
  return (
    <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
      {value > 0 && (
        <span
          className={`ld-bar absolute inset-y-0 left-0 rounded-full ${
            tone === "naive" ? "bg-gradient-to-r from-slate-600 to-slate-400" : "bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
          }`}
          style={{ width: `${pct}%`, "--bd": delay } as CSSProperties}
        />
      )}
    </div>
  );
}

export function Comparison() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {ROWS.map((r, i) => (
        <div key={r.label} className="ld-card ld-reveal rounded-2xl p-6 sm:p-7" style={{ "--d": i } as CSSProperties}>
          <p className="text-sm font-medium text-muted">{r.label}</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-5xl font-semibold tracking-tight text-foreground tabular-nums">{r.converge}</span>
            <span className="text-sm text-muted">
              vs <span className="font-semibold text-foreground/80 tabular-nums">{r.naive}</span> with naive ticketing
            </span>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-medium text-muted">Naive</span>
              <Bar value={r.naive} tone="naive" delay={0} />
              <span className="w-4 text-right font-mono text-sm text-muted tabular-nums">{r.naive}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-semibold text-accent-2">CONVERGE</span>
              <Bar value={r.converge} tone="converge" delay={1} />
              <span className="w-4 text-right font-mono text-sm font-semibold text-foreground tabular-nums">{r.converge}</span>
            </div>
          </div>
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">{r.note}</p>
        </div>
      ))}
    </div>
  );
}
