"use client";

import { useState } from "react";

import { api, photoSrc, type RejectReason } from "@/lib/api";
import { CATEGORY_ICON, CATEGORY_LABEL, eventTitle, formatTime, humanize, prettyText } from "@/lib/format";
import type { AuditEvent, EvidenceKind, Impact, Incident, IncidentDetail } from "@/lib/types";

import type { Act, Operator } from "./Dashboard";
import { ImpactPanel } from "./ImpactPanel";
import { SlaTimer } from "./SlaTimer";
import { StatusBadge } from "./StatusBadge";
import { VerificationBadge } from "./VerificationBadge";

const REJECT_REASONS: { id: RejectReason; label: string }[] = [
  { id: "fake", label: "Fake or prank report" },
  { id: "not_civic", label: "Not a city issue" },
  { id: "cannot_locate", label: "Can't find it on site" },
  { id: "duplicate_elsewhere", label: "Already handled elsewhere" },
];

// Murthal–Sonipat corridor: reports further than this from its middle are outside the pilot area.
const PILOT = { lat: 29.005, lng: 77.055, radiusKm: 15 };
function kmFromPilot(lat: number, lng: number): number {
  const dLat = ((lat - PILOT.lat) * Math.PI) / 180;
  const dLng = ((lng - PILOT.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((PILOT.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Same guards as backend/app/engine/verify.py, so buttons only show when the call will succeed.
const STARTABLE = new Set(["assigned", "reopened", "escalated"]);

const EVENT_TONE: Record<string, string> = {
  false_closure_detected: "border-rose-400 bg-rose-50",
  sla_breach: "border-red-400 bg-red-50",
  escalated: "border-red-400 bg-red-50",
  no_resource: "border-red-300 bg-red-50",
  plan_invalidated: "border-amber-400 bg-amber-50",
  replanned: "border-amber-300 bg-amber-50",
  verified_closed: "border-emerald-400 bg-emerald-50",
  work_completed: "border-blue-300 bg-blue-50",
  linked_duplicate: "border-violet-300 bg-violet-50",
  linked_related: "border-violet-300 bg-violet-50",
};

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function AuditRow({ e }: { e: AuditEvent }) {
  return (
    <li className={`rounded-md border-l-4 px-3 py-1.5 ${EVENT_TONE[e.event_type] ?? "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-800">{eventTitle(e.event_type)}</span>
        <span className="font-mono text-slate-500">{formatTime(e.timestamp)}</span>
      </div>
      {e.detail && <p className="text-sm text-slate-700">{prettyText(e.detail)}</p>}
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
        <span>by {e.actor}</span>
        {e.from_status !== e.to_status && e.to_status && (
          <span>
            {e.from_status ? humanize(e.from_status) : "—"} → <span className="font-medium">{humanize(e.to_status)}</span>
          </span>
        )}
        {e.evidence_ids.length > 0 && <span>evidence: {e.evidence_ids.join(", ")}</span>}
      </div>
    </li>
  );
}

export function IncidentDetailPanel({
  detail,
  impact,
  now,
  busy,
  act,
  incidents,
  operator,
}: {
  detail: IncidentDetail;
  impact: Impact | null;
  now: string | null;
  busy: boolean;
  act: Act;
  incidents: Incident[];
  operator?: Operator;
}) {
  const { incident: inc, reports, links, evidence, audit, resource } = detail;
  const [evKind, setEvKind] = useState<EvidenceKind>("citizen_followup");
  const [evNote, setEvNote] = useState("");

  const canStart = STARTABLE.has(inc.status) && !!inc.assigned_resource_id && !inc.completed_at;
  const canComplete = inc.status === "in_progress";
  const awaitingProof = !!inc.completed_at && (inc.status === "pending_verification" || inc.status === "escalated");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectReason>("fake");
  const [rejectNote, setRejectNote] = useState("");
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const canReject = !!operator && (operator.role === "head" || operator.role === "command") && !["verified_closed", "rejected"].includes(inc.status);
  const linkByReport = new Map(links.map((l) => [l.report_id, l]));
  const related = incidents.filter((i) => inc.related_incident_ids.includes(i.id));

  const submitEvidence = (supports: boolean) =>
    act(async () => {
      await api.evidence(inc.id, {
        kind: evKind,
        supports_resolution: supports,
        note: evNote || (supports ? "Issue confirmed fixed" : "Issue still present"),
        source: evKind === "citizen_followup" ? "citizen:dashboard" : "inspector:dashboard",
      });
      setEvNote("");
    });

  return (
    <section className="space-y-6 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {CATEGORY_ICON[inc.category]} {inc.title}
            </h2>
            <StatusBadge status={inc.status} />
            <VerificationBadge level={inc.verification} />
            {inc.escalation_level > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Escalation level {inc.escalation_level}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {inc.id} · {CATEGORY_LABEL[inc.category]} · {inc.department} department · severity {inc.severity}/5 · plan v
            {inc.plan_version}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          <SlaTimer incident={inc} now={now} size="lg" />
          <span className="text-xs text-slate-500">Deadline {formatTime(inc.deadline)} UTC</span>
          {canReject && !rejecting && (
            <button type="button" onClick={() => setRejecting(true)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">
              Reject as invalid…
            </button>
          )}
        </div>
      </div>

      {rejecting && operator && (
        <div className="rounded-xl bg-rose-50/60 p-4 ring-1 ring-rose-200">
          <p className="text-sm font-semibold text-rose-900">Reject this complaint</p>
          <p className="mt-0.5 text-xs text-rose-800">Closes the case without a repair, frees the crew, and is recorded on the audit trail under your badge.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
            <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value as RejectReason)} className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm">
              {REJECT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="What did you check? (required)" className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy || rejectNote.trim().length < 3}
              onClick={() =>
                act(async () => {
                  await api.rejectIncident(inc.id, { reason: rejectReason, note: rejectNote.trim(), by_badge: operator.badge_id });
                  setRejecting(false);
                  setRejectNote("");
                })
              }
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Reject complaint
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assignment + actions */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned crew</div>
          {resource ? (
            <div className="mt-1 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${resource.available ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="font-medium">{resource.name}</span>
              {!resource.available && <span className="text-xs text-red-700">unavailable</span>}
            </div>
          ) : inc.status === "verified_closed" ? (
            <div className="mt-1 text-slate-600">Crew released after verified closure</div>
          ) : inc.status === "rejected" ? (
            <div className="mt-1 text-slate-600">Rejected as invalid; crew released</div>
          ) : (
            <div className="mt-1 text-red-700">No crew available — escalated</div>
          )}
          {inc.status !== "verified_closed" && inc.status !== "rejected" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy || !canStart}
                onClick={() => act(() => api.start(inc.id))}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-30"
              >
                Start work
              </button>
              <button
                disabled={busy || !canComplete}
                onClick={() => act(() => api.complete(inc.id, "Marked complete from dashboard"))}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-30"
              >
                Department: mark complete
              </button>
            </div>
          )}
        </div>

        {/* Evidence input: the whole point — "complete" is not "resolved". */}
        <div className={`rounded-md p-3 text-sm ${awaitingProof ? "bg-amber-50 ring-1 ring-amber-300" : "bg-slate-50"}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {awaitingProof ? "Work reported complete — needs proof" : "Add evidence"}
          </div>
          <div className="mt-2 flex gap-2">
            <select
              value={evKind}
              onChange={(e) => setEvKind(e.target.value as EvidenceKind)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value="citizen_followup">Citizen follow-up</option>
              <option value="inspector">Inspector</option>
              <option value="photo">Photo</option>
              <option value="sensor">Sensor</option>
            </select>
            <input
              value={evNote}
              onChange={(e) => setEvNote(e.target.value)}
              placeholder="Note (optional)"
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => submitEvidence(true)}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-30"
            >
              ✓ Confirms fixed
            </button>
            <button
              disabled={busy}
              onClick={() => submitEvidence(false)}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-30"
            >
              ✗ Still broken
            </button>
          </div>
        </div>
      </div>

      {inc.parent_incident_id && (
        <div className="rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-800 ring-1 ring-violet-200">
          Waiting on root-cause repair <span className="font-semibold">{inc.parent_incident_id}</span>. When it is verified, this
          incident still needs its own proof before closing.
        </div>
      )}

      {impact && <ImpactPanel impact={impact} />}

      {/* Linked reports with reasons */}
      <Section title={`Reports (${reports.length})`}>
        <ul className="space-y-2">
          {reports.map((r) => {
            const link = linkByReport.get(r.id);
            return (
              <li key={r.id} className="rounded-md border border-slate-200 p-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">“{r.text}”</span>
                  {link ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      {link.kind} · {Math.round(link.confidence * 100)}%
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">first report</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span>
                    {r.id} · {r.reporter.replace(/^citizen:/, "")} · {formatTime(r.created_at)}
                  </span>
                  {r.location_source === "gps" && (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                      GPS{r.location_accuracy_m ? ` ±${Math.round(r.location_accuracy_m)} m` : ""}
                    </span>
                  )}
                  {r.location_label && <span className="text-slate-600">📍 {r.location_label}</span>}
                  {kmFromPilot(r.lat, r.lng) > PILOT.radiusKm && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">outside pilot area</span>
                  )}
                  {!!r.reporter_flags && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                      {r.reporter_flags} earlier report{r.reporter_flags > 1 ? "s" : ""} rejected
                    </span>
                  )}
                </div>
                {link && <p className="mt-1 text-xs text-violet-800">Why linked: {link.reason}</p>}
                {r.photo_url && (
                  <button type="button" onClick={() => setZoomPhoto(photoSrc(r.photo_url!))} className="mt-2 block overflow-hidden rounded-lg ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoSrc(r.photo_url)} alt={`Photo attached to report ${r.id}`} className="h-28 w-40 object-cover transition hover:scale-105" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {related.length > 0 && (
        <Section title="Related incidents (possible shared cause)">
          <ul className="space-y-1 text-sm">
            {related.map((r) => {
              const link = links.find((l) => l.kind === "related" && (l.incident_id === r.id || r.report_ids.includes(l.report_id)));
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {CATEGORY_ICON[r.category]} {r.title}
                  </span>
                  <StatusBadge status={r.status} />
                  {link && <span className="text-xs text-violet-800">{link.reason}</span>}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {evidence.length > 0 && (
        <Section title={`Evidence (${evidence.length})`}>
          <ul className="space-y-1 text-sm">
            {evidence.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span className={e.supports_resolution ? "text-emerald-700" : "text-rose-700"}>
                  {e.supports_resolution ? "✓ supports" : "✗ contradicts"}
                </span>
                <span className="text-slate-600">{humanize(e.kind)}</span>
                <span>“{e.note}”</span>
                <span className="text-xs text-slate-500">
                  {e.source} · {formatTime(e.created_at)}
                </span>
                {e.photo_url && (
                  <button type="button" onClick={() => setZoomPhoto(photoSrc(e.photo_url!))} className="overflow-hidden rounded-md ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoSrc(e.photo_url)} alt={`Evidence photo ${e.id}`} className="h-12 w-16 object-cover" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Audit trail (${audit.length} events)`}>
        <ol className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {audit.map((e) => (
            <AuditRow key={e.id} e={e} />
          ))}
        </ol>
      </Section>
      {zoomPhoto && (
        <div role="dialog" aria-label="Photo" onClick={() => setZoomPhoto(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm motion-safe:animate-[fadeUp_.2s_ease-out]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomPhoto} alt="Citizen photo, enlarged" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </section>
  );
}
