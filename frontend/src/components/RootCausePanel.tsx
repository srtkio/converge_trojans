"use client";

import { api } from "@/lib/api";
import { CATEGORY_ICON } from "@/lib/format";
import type { Hypothesis, Incident } from "@/lib/types";

import type { Act } from "./Dashboard";
import { StatusBadge } from "./StatusBadge";

/**
 * v2: shared root-cause hypotheses. Rules propose them; an operator confirms or rejects.
 * Confirming makes the cause the parent repair; children wait on it and still need their own proof.
 */
export function RootCausePanel({
  hypotheses,
  incidents,
  busy,
  act,
  onSelect,
}: {
  hypotheses: Hypothesis[];
  incidents: Incident[];
  busy: boolean;
  act: Act;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(incidents.map((i) => [i.id, i]));
  const visible = hypotheses.filter((h) => h.status !== "rejected");
  if (visible.length === 0) return null;

  return (
    <section className="rounded-lg border border-violet-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Possible shared root cause <span className="font-normal text-slate-500">· v2</span>
        </h2>
        <span className="text-xs text-slate-500">Proposed by rules, decided by an operator</span>
      </div>
      <ul className="space-y-3">
        {visible.map((h) => {
          const cause = byId.get(h.cause_incident_id);
          const members = h.member_ids.map((id) => byId.get(id)).filter((i): i is Incident => !!i && i.id !== h.cause_incident_id);
          const pct = Math.round(h.confidence * 100);
          return (
            <li key={h.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{h.summary}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    h.status === "confirmed" ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {h.status}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <span>Confidence</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="tabular-nums">{pct}%</span>
              </div>

              {/* Parent → children: one repair instead of many visits. */}
              <div className="mt-3 text-sm">
                {cause && (
                  <button onClick={() => onSelect(cause.id)} className="flex items-center gap-2 hover:underline">
                    <span className="text-xs font-semibold uppercase text-violet-700">Cause</span>
                    {CATEGORY_ICON[cause.category]} {cause.title}
                    <StatusBadge status={cause.status} />
                  </button>
                )}
                <ul className="mt-1 space-y-1 border-l-2 border-violet-200 pl-4">
                  {members.map((m) => (
                    <li key={m.id}>
                      <button onClick={() => onSelect(m.id)} className="flex items-center gap-2 hover:underline">
                        <span className="text-slate-400">└</span>
                        {CATEGORY_ICON[m.category]} {m.title}
                        <StatusBadge status={m.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                <div>
                  <div className="font-semibold text-emerald-700">Evidence for</div>
                  <ul className="list-disc pl-4 text-slate-700">
                    {h.evidence_for.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-rose-700">Evidence against</div>
                  {h.evidence_against.length ? (
                    <ul className="list-disc pl-4 text-slate-700">
                      {h.evidence_against.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">None found yet</p>
                  )}
                </div>
              </div>

              {h.status === "proposed" && (
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.decideHypothesis(h.id, "confirm"))}
                    className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Confirm: one coordinated repair
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.decideHypothesis(h.id, "reject"))}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
