"use client";

import { Check, CornerDownRight, GitBranch, GitMerge, X } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";
import type { Hypothesis, Incident } from "@/lib/types";

import type { Act } from "./Dashboard";
import { Button, CARD, CardHeader, CategoryGlyph, Modal, Pill } from "./OpUi";
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
  const [pending, setPending] = useState<{ h: Hypothesis; decision: "confirm" | "reject" } | null>(null);
  if (visible.length === 0) return null;

  const decide = () => {
    if (!pending) return;
    const { h, decision } = pending;
    setPending(null);
    void act(() => api.decideHypothesis(h.id, decision));
  };

  const incidentLine = (i: Incident, cause?: boolean) => (
    <button
      type="button"
      onClick={() => onSelect(i.id)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ring-1 transition hover:ring-violet-400/50 ${
        cause ? "bg-violet-400/[0.07] ring-violet-400/25" : "bg-[#0a0f1b] ring-line"
      }`}
    >
      <CategoryGlyph category={i.category} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-foreground">{i.title}</span>
        <span className="font-mono text-[10px] text-muted">{i.id}</span>
      </span>
      <StatusBadge status={i.status} />
    </button>
  );

  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader icon={GitBranch} title="Shared root cause" subtitle="Proposed by rules, decided by an operator" right={<Pill className="bg-violet-400/10 text-violet-300 ring-violet-400/25">{visible.length} hypotheses</Pill>} />
      <ul className="grid gap-4 p-4 xl:grid-cols-2">
        {visible.map((h) => {
          const cause = byId.get(h.cause_incident_id);
          const members = h.member_ids.map((id) => byId.get(id)).filter((i): i is Incident => !!i && i.id !== h.cause_incident_id);
          const pct = Math.round(h.confidence * 100);
          return (
            <li key={h.id} className="rounded-xl bg-surface-2/50 p-4 ring-1 ring-line">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-mono text-[11px] text-muted">{h.id}</span>
                <Pill className={h.status === "confirmed" ? "bg-violet-500 text-white ring-violet-400" : "bg-violet-400/10 text-violet-300 ring-violet-400/25"}>
                  {h.status === "confirmed" ? "Confirmed" : "Proposed"}
                </Pill>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{h.summary}</p>

              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                <span>Confidence</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#0a0f1b]">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="font-medium tabular-nums text-foreground">{pct}%</span>
              </div>

              {/* Parent → children: one repair instead of many visits. */}
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">Cause</p>
                {cause && incidentLine(cause, true)}
                <p className="pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Waits on the cause</p>
                <ul className="space-y-1.5">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-1.5">
                      <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-violet-400/70" aria-hidden />
                      <div className="min-w-0 flex-1">
                        {incidentLine(m)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-lg bg-ok/[0.05] p-2.5 ring-1 ring-ok/15">
                  <div className="mb-1 flex items-center gap-1 font-semibold text-ok">
                    <Check className="h-3.5 w-3.5" aria-hidden /> Evidence for
                  </div>
                  <ul className="space-y-1 text-[#c3c9d8]">
                    {h.evidence_for.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-bad/[0.05] p-2.5 ring-1 ring-bad/15">
                  <div className="mb-1 flex items-center gap-1 font-semibold text-bad">
                    <X className="h-3.5 w-3.5" aria-hidden /> Evidence against
                  </div>
                  {h.evidence_against.length ? (
                    <ul className="space-y-1 text-[#c3c9d8]">
                      {h.evidence_against.map((e) => (
                        <li key={e}>• {e}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">None found yet</p>
                  )}
                </div>
              </div>

              {h.status === "proposed" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="violet" size="sm" disabled={busy} onClick={() => setPending({ h, decision: "confirm" })}>
                    <GitMerge className="h-3.5 w-3.5" aria-hidden /> Confirm: one coordinated repair
                  </Button>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => setPending({ h, decision: "reject" })}>
                    Reject hypothesis
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        icon={pending?.decision === "reject" ? X : GitMerge}
        tone={pending?.decision === "reject" ? "danger" : "violet"}
        title={pending?.decision === "reject" ? "Reject this root-cause hypothesis?" : "Confirm shared root cause?"}
        description={
          pending?.decision === "reject"
            ? "The incidents stay independent and each gets its own crew visit. This is recorded on the audit trail."
            : `${pending?.h.cause_incident_id} becomes the parent repair. The linked incidents wait on it, and each still needs its own proof before it can close.`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant={pending?.decision === "reject" ? "danger" : "violet"} onClick={decide} data-autofocus>
              {pending?.decision === "reject" ? "Reject hypothesis" : "Confirm root cause"}
            </Button>
          </>
        }
      />
    </section>
  );
}
