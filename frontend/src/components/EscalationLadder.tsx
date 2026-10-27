import { ChevronRight, Shield, ShieldAlert, ShieldCheck } from "lucide-react";

import type { Incident } from "@/lib/types";

const LEVELS = [
  { role: "officer", title: "Department officer", note: "Owns the case and the crew", icon: ShieldCheck, tone: "text-emerald-600 bg-emerald-50" },
  { role: "head", title: "Department head", note: "Notified on the first missed deadline", icon: Shield, tone: "text-amber-600 bg-amber-50" },
  { role: "command", title: "City command centre", note: "Notified when it slips again", icon: ShieldAlert, tone: "text-rose-600 bg-rose-50" },
] as const;

const OPEN = (i: Incident) => i.status !== "verified_closed" && i.status !== "rejected";

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
  const open = incidents.filter(OPEN);
  const at = (level: number) => open.filter((i) => Math.min(i.escalation_level, 2) === level);
  const mine = operatorRole ?? "officer";

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Escalation ladder</h2>
        <span className="text-xs text-slate-500">missed deadline → next level is notified</span>
      </div>
      <ol className="mt-4 space-y-2">
        {LEVELS.map((lvl, idx) => {
          const cases = at(idx);
          const Icon = lvl.icon;
          const you = lvl.role === mine;
          return (
            <li key={lvl.role} className={`rounded-xl p-3 ring-1 ${you ? "bg-slate-50 ring-slate-300" : "ring-slate-900/5"}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${lvl.tone}`}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {lvl.title}
                    {you && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">You</span>}
                  </span>
                  <span className="block text-xs text-slate-500">{lvl.note}</span>
                </span>
                <span className="text-lg font-semibold tabular-nums text-slate-900">{cases.length}</span>
              </div>
              {cases.length > 0 && idx > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                  {cases.slice(0, 4).map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onOpen(i.id)}
                      className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400"
                    >
                      {i.id} <ChevronRight className="h-3 w-3" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
