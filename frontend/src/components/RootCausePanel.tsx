"use client";

import { useEffect, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import { CATEGORY_ICON, STATUS_LABEL } from "@/lib/format";
import type { Hypothesis, Impact, Incident, Status } from "@/lib/types";

import type { Act } from "./Dashboard";
import { StatusBadge } from "./StatusBadge";

/**
 * v2: shared root-cause hypotheses. Rules propose them; an operator confirms or rejects.
 * Confirming makes the cause the parent repair; children wait on it and still need their own proof.
 * Each hypothesis is drawn as a schematic: the cause node, the cases it explains, and the real
 * distance between them (haversine on the incidents' coordinates).
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
  const confirmed = hypotheses.filter((h) => h.status === "confirmed");
  const proposed = hypotheses.filter((h) => h.status === "proposed");
  const rejected = hypotheses.filter((h) => h.status === "rejected");

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Shared root causes</h2>
            <p className="mt-0.5 text-sm text-slate-500">Proposed by rules from nearby complaints. An operator confirms or rejects each one.</p>
          </div>
          <dl className="flex flex-wrap gap-2 text-xs">
            <Count label="Confirmed" n={confirmed.length} cls="bg-emerald-50 text-emerald-700 ring-emerald-200" />
            <Count label="Proposed" n={proposed.length} cls="bg-violet-50 text-violet-700 ring-violet-200" />
            <Count label="Rejected" n={rejected.length} cls="bg-slate-100 text-slate-600 ring-slate-200" />
          </dl>
        </div>
        <Legend />
      </section>

      {confirmed.length + proposed.length === 0 && (
        <p className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500 ring-1 ring-slate-900/5">
          No active shared cause. Rejected proposals are listed below.
        </p>
      )}

      {confirmed.length > 0 && (
        <Group title="Confirmed: one coordinated repair" tone="text-emerald-700">
          {confirmed.map((h) => (
            <HypothesisCard key={h.id} h={h} byId={byId} busy={busy} act={act} onSelect={onSelect} />
          ))}
        </Group>
      )}

      {proposed.length > 0 && (
        <Group title="Proposed: waiting for an operator decision" tone="text-violet-700">
          {proposed.map((h) => (
            <HypothesisCard key={h.id} h={h} byId={byId} busy={busy} act={act} onSelect={onSelect} />
          ))}
        </Group>
      )}

      {rejected.length > 0 && (
        <details className="group rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-600">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">›</span>
            Rejected proposals ({rejected.length}): handled as separate repairs
          </summary>
          <ul className="mt-3 space-y-2">
            {rejected.map((h) => (
              <li key={h.id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                <p className="font-medium text-slate-700">{h.summary}</p>
                <p className="mt-1 text-xs text-slate-500">Confidence was {Math.round(h.confidence * 100)}%</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Count({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${cls}`}>
      <dt>{label}</dt>
      <dd className="font-semibold tabular-nums">{n}</dd>
    </div>
  );
}

function Group({ title, tone, children }: { title: string; tone: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className={`px-1 text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</h3>
      <ul className="space-y-4">{children}</ul>
    </section>
  );
}

const NODE_COLOR: Record<Status, string> = {
  open: "#64748b",
  assigned: "#0284c7",
  in_progress: "#0284c7",
  pending_verification: "#d97706",
  verified_closed: "#059669",
  reopened: "#e11d48",
  escalated: "#e11d48",
  rejected: "#94a3b8",
};

function Legend() {
  const items: [string, string][] = [
    ["Open", NODE_COLOR.open],
    ["Crew working", NODE_COLOR.in_progress],
    ["Waiting for proof", NODE_COLOR.pending_verification],
    ["Verified closed", NODE_COLOR.verified_closed],
    ["Escalated / reopened", NODE_COLOR.escalated],
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500" aria-label="Node colours">
      {items.map(([label, color]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#fff", boxShadow: `inset 0 0 0 2px ${color}` }} />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Great-circle distance in metres between two incidents. */
function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distLabel(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function short(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function HypothesisCard({
  h,
  byId,
  busy,
  act,
  onSelect,
}: {
  h: Hypothesis;
  byId: Map<string, Incident>;
  busy: boolean;
  act: Act;
  onSelect: (id: string) => void;
}) {
  const cause = byId.get(h.cause_incident_id);
  const childIds = [...new Set(h.member_ids.filter((id) => id !== h.cause_incident_id))];
  const children = childIds.map((id) => byId.get(id)).filter((i): i is Incident => !!i);
  const pct = Math.round(h.confidence * 100);
  const saved = childIds.length;
  const isConfirmed = h.status === "confirmed";

  return (
    <li
      className={`rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 sm:p-5 ${
        isConfirmed ? "ring-emerald-200" : "ring-violet-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{h.summary}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isConfirmed ? "bg-emerald-600 text-white" : "bg-violet-100 text-violet-700"
          }`}
        >
          {isConfirmed ? "Confirmed" : "Proposed"}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <span>Confidence</span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 sm:w-40">
          <div className={`h-full rounded-full ${isConfirmed ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-medium tabular-nums">{pct}%</span>
      </div>

      {cause && <Schematic cause={cause} kids={children} confidence={h.confidence} confirmed={isConfirmed} />}

      {saved > 0 && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${
            isConfirmed ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-violet-50 text-violet-800 ring-1 ring-violet-200"
          }`}
        >
          {isConfirmed ? "" : "If confirmed: "}
          {isConfirmed ? "One" : "one"} coordinated repair saves {saved} crew visit{saved === 1 ? "" : "s"}.
        </p>
      )}

      {/* Linked cases: open any of them in the Incidents tab. */}
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked cases</p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {[cause, ...children]
            .filter((i): i is Incident => !!i)
            .map((i) => (
              <li key={i.id} className="max-w-full">
                <button
                  type="button"
                  onClick={() => onSelect(i.id)}
                  className="flex max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                >
                  <span aria-hidden>{CATEGORY_ICON[i.category]}</span>
                  {i.id === h.cause_incident_id && <span className="font-semibold uppercase text-violet-700">Cause</span>}
                  <span className="min-w-0 truncate">{i.title}</span>
                  <StatusBadge status={i.status} />
                </button>
              </li>
            ))}
        </ul>
      </div>

      <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
        <div>
          <p className="font-semibold text-emerald-700">Evidence for</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {h.evidence_for.map((e) => (
              <li key={e} className="max-w-full break-words rounded-lg bg-emerald-50 px-2 py-1 text-emerald-900 ring-1 ring-emerald-200">
                ✓ {e}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-rose-700">Evidence against</p>
          {h.evidence_against.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {h.evidence_against.map((e) => (
                <li key={e} className="max-w-full break-words rounded-lg bg-rose-50 px-2 py-1 text-rose-900 ring-1 ring-rose-200">
                  ✕ {e}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-slate-500">None found yet</p>
          )}
        </div>
      </div>

      <CauseImpact incidentId={h.cause_incident_id} />

      {h.status === "proposed" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => api.decideHypothesis(h.id, "confirm"))}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
          >
            Confirm: one coordinated repair
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => api.decideHypothesis(h.id, "reject"))}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );
}

/** Cause on the left, the cases it explains on the right, real distances on the edges. */
function Schematic({
  cause,
  kids,
  confidence,
  confirmed,
}: {
  cause: Incident;
  kids: Incident[];
  confidence: number;
  confirmed: boolean;
}) {
  const W = 380;
  const rowH = 54;
  const H = Math.max(176, kids.length * rowH + 24);
  const cx = 66;
  const cy = H / 2;
  const childX = 230;
  const top = (H - kids.length * rowH) / 2;
  const ringR = 33;
  const circ = 2 * Math.PI * ringR;
  const edge = confirmed ? "#059669" : "#7c3aed";

  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Schematic: ${cause.title} is the likely cause of ${kids.length} nearby case${kids.length === 1 ? "" : "s"}`}
      >
        {kids.map((c, i) => {
          const y = top + rowH * (i + 0.5);
          const x1 = cx + 28;
          const x2 = childX - 20;
          const mx = (x1 + x2) / 2;
          const label = distLabel(metres(cause, c));
          const lw = label.length * 6.4 + 12;
          return (
            <g key={c.id}>
              <path
                d={`M ${x1} ${cy} C ${mx} ${cy}, ${mx} ${y}, ${x2} ${y}`}
                fill="none"
                stroke={edge}
                strokeWidth={2}
                strokeDasharray={confirmed ? undefined : "5 4"}
                opacity={0.7}
              />
              <rect x={mx - lw / 2} y={(cy + y) / 2 - 9} width={lw} height={18} rx={9} fill="#fff" stroke="#e2e8f0" />
              <text x={mx} y={(cy + y) / 2} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fill="#334155" fontWeight={600}>
                {label}
              </text>
            </g>
          );
        })}

        {/* Cause node with a confidence ring */}
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        <circle
          cx={cx}
          cy={cy}
          r={ringR}
          fill="none"
          stroke={edge}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${circ * Math.max(0, Math.min(1, confidence))} ${circ}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <circle cx={cx} cy={cy} r={26} fill="#fff" stroke={NODE_COLOR[cause.status]} strokeWidth={3} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={20}>
          {CATEGORY_ICON[cause.category]}
        </text>
        <text x={cx} y={cy - 44} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={edge} letterSpacing={1}>
          CAUSE
        </text>
        <text x={cx} y={cy + 50} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#0f172a">
          {short(cause.title, 18)}
        </text>
        <text x={cx} y={cy + 64} textAnchor="middle" fontSize={10} fill={NODE_COLOR[cause.status]}>
          {STATUS_LABEL[cause.status]}
        </text>

        {kids.map((c, i) => {
          const y = top + rowH * (i + 0.5);
          return (
            <g key={`n-${c.id}`}>
              <circle cx={childX} cy={y} r={19} fill="#fff" stroke={NODE_COLOR[c.status]} strokeWidth={3} />
              <text x={childX} y={y} textAnchor="middle" dominantBaseline="central" fontSize={15}>
                {CATEGORY_ICON[c.category]}
              </text>
              <text x={childX + 27} y={y - 4} fontSize={11.5} fontWeight={600} fill="#0f172a">
                {short(c.title, 19)}
              </text>
              <text x={childX + 27} y={y + 11} fontSize={10} fill={NODE_COLOR[c.status]}>
                {STATUS_LABEL[c.status]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Services near the cause, from GET /incidents/{id}/impact. Hidden when unavailable. */
function CauseImpact({ incidentId }: { incidentId: string }) {
  const [state, setState] = useState<{ id: string; data: Impact | null } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .impact(incidentId)
      .then((data) => {
        if (alive) setState({ id: incidentId, data });
      })
      .catch(() => {
        if (alive) setState({ id: incidentId, data: null });
      });
    return () => {
      alive = false;
    };
  }, [incidentId]);

  if (!state || state.id !== incidentId) {
    return <div className="mt-3 h-10 rounded-xl bg-slate-100 motion-safe:animate-pulse" aria-hidden />;
  }
  const services = state.data?.services ?? [];
  if (services.length === 0) return null;

  const icon = { transport: "🚌", school: "🏫", health: "🏥" } as const;
  return (
    <div className="mt-3 rounded-xl bg-amber-50/60 p-3 ring-1 ring-amber-200">
      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-900">
        Services affected by the cause
        {state.data?.simulated && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Simulated</span>}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
        {services.map((s) => (
          <li key={`${s.id}-${s.via_incident_id}`} className="flex items-start gap-2">
            <span aria-hidden>{icon[s.kind] ?? "📍"}</span>
            <span className="min-w-0">
              <span className="font-medium text-slate-900">{s.name}</span>
              <span className="text-slate-500"> · {distLabel(s.distance_m)}</span>
              <span className="block text-slate-600">{s.impact}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
