import { ChevronRight, Shield, ShieldAlert, ShieldCheck, TrendingUp } from "lucide-react";

import { isOpen } from "@/lib/opTheme";
import type { Incident } from "@/lib/types";

import { CARD, CardHeader } from "./OpUi";

const LEVELS = [
  { role: "officer", title: "Department officer", note: "Owns the case and the crew", icon: ShieldCheck, tone: "text-accent bg-accent/10 ring-accent/25", rail: "bg-accent" },
  { role: "head", title: "Department head", note: "Notified on the first missed deadline", icon: Shield, tone: "text-warn bg-warn/10 ring-warn/25", rail: "bg-warn" },
  { role: "command", title: "City command centre", note: "Notified when it slips again", icon: ShieldAlert, tone: "text-bad bg-bad/10 ring-bad/25", rail: "bg-bad" },
] as const;

/**
 * The operator hierarchy as an escalation ladder: each open case sits at the level its
 * escalation count has reached (0 → officer, 1 → department head, 2+ → command centre).
 */
export function EscalationLadder({
  incidents,
  operatorRole,
  onOpen,
}: {
  incidents: Incident[];
  operatorRole?: string;
  onOpen: (id: string) => void;
}) {
  const open = incidents.filter(isOpen);
  const at = (level: number) => open.filter((i) => Math.min(i.escalation_level, 2) === level);
  const mine = operatorRole ?? "officer";

  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader icon={TrendingUp} title="Escalation ladder" subtitle="A missed deadline notifies the next level" />
      <ol className="relative space-y-2 p-3">
        {LEVELS.map((lvl, idx) => {
          const cases = at(idx);
          const Icon = lvl.icon;
          const you = lvl.role === mine;
          return (
            <li key={lvl.role} className={`relative rounded-lg p-3 ring-1 ${you ? "bg-surface-2 ring-line-strong" : "bg-[#0a0f1b] ring-line"}`}>
              <span className={`absolute inset-y-3 left-0 w-0.5 rounded-full ${lvl.rail} ${cases.length ? "opacity-90" : "opacity-25"}`} aria-hidden />
              <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${lvl.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <span className="font-mono text-[10px] text-muted">L{idx}</span>
                    <span className="truncate">{lvl.title}</span>
                    {you && <span className="rounded bg-accent px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white">You</span>}
                  </span>
                  <span className="block truncate text-[11px] text-muted">{lvl.note}</span>
                </span>
                <span className="text-xl font-semibold tabular-nums text-foreground">{cases.length}</span>
              </div>
              {cases.length > 0 && idx > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                  {cases.slice(0, 4).map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onOpen(i.id)}
                      className="flex items-center gap-0.5 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-foreground ring-1 ring-line-strong transition hover:ring-accent/60"
                    >
                      {i.id} <ChevronRight className="h-3 w-3" aria-hidden />
                    </button>
                  ))}
                  {cases.length > 4 && <span className="px-1 text-[11px] text-muted">+{cases.length - 4}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
