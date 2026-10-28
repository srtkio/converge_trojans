"use client";

import {
  Ban,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  ClipboardCheck,
  Clock,
  FileText,
  GitBranch,
  History,
  Images,
  Link2,
  Lock,
  MapPin,
  Navigation,
  Play,
  ShieldCheck,
  Truck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { api, photoSrc, type RejectReason } from "@/lib/api";
import { CATEGORY_LABEL, eventTitle, formatTime, humanize, prettyText } from "@/lib/format";
import { ROLE_LABEL, slaUsed } from "@/lib/opTheme";
import type { AuditEvent, EvidenceKind, Impact, Incident, IncidentDetail } from "@/lib/types";

import type { Act, Operator } from "./Dashboard";
import { ImpactPanel } from "./ImpactPanel";
import { Button, CategoryGlyph, FIELD, Modal, Pill, Skeleton, useFocusTrap, usePresence } from "./OpUi";
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

const EVENT_TONE: Record<string, { dot: string; icon: LucideIcon }> = {
  false_closure_detected: { dot: "bg-bad/15 text-bad ring-bad/40", icon: CircleAlert },
  sla_breach: { dot: "bg-bad/15 text-bad ring-bad/40", icon: Clock },
  escalated: { dot: "bg-bad/15 text-bad ring-bad/40", icon: CircleAlert },
  no_resource: { dot: "bg-bad/15 text-bad ring-bad/40", icon: Truck },
  sla_at_risk: { dot: "bg-warn/15 text-warn ring-warn/40", icon: Clock },
  plan_invalidated: { dot: "bg-warn/15 text-warn ring-warn/40", icon: CircleAlert },
  replanned: { dot: "bg-warn/15 text-warn ring-warn/40", icon: Navigation },
  resource_unavailable: { dot: "bg-warn/15 text-warn ring-warn/40", icon: Truck },
  verified_closed: { dot: "bg-ok/15 text-ok ring-ok/40", icon: CheckCircle2 },
  evidence_added: { dot: "bg-ok/10 text-ok ring-ok/30", icon: ClipboardCheck },
  work_completed: { dot: "bg-accent/15 text-accent ring-accent/40", icon: Wrench },
  work_started: { dot: "bg-accent/15 text-accent ring-accent/40", icon: Play },
  assigned: { dot: "bg-accent/15 text-accent ring-accent/40", icon: Truck },
  created: { dot: "bg-accent-2/15 text-accent-2 ring-accent-2/40", icon: FileText },
  duplicate_linked: { dot: "bg-violet-400/15 text-violet-300 ring-violet-400/40", icon: Link2 },
  related_linked: { dot: "bg-violet-400/15 text-violet-300 ring-violet-400/40", icon: Link2 },
  linked_duplicate: { dot: "bg-violet-400/15 text-violet-300 ring-violet-400/40", icon: Link2 },
  linked_related: { dot: "bg-violet-400/15 text-violet-300 ring-violet-400/40", icon: Link2 },
  rejected_invalid: { dot: "bg-slate-400/15 text-slate-300 ring-slate-400/40", icon: Ban },
};
const DEFAULT_TONE = { dot: "bg-surface-2 text-muted ring-line-strong", icon: History };

type Tab = "summary" | "reports" | "timeline" | "actions";

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</h3>
      {right}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-[#0a0f1b] px-3 py-2.5 ring-1 ring-line">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

function TimelineItem({ e, last }: { e: AuditEvent; last: boolean }) {
  const t = EVENT_TONE[e.event_type] ?? DEFAULT_TONE;
  const Icon = t.icon;
  return (
    <li className="relative flex gap-3 pb-4">
      {!last && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-line-strong" aria-hidden />}
      <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${t.dot}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[13px] font-medium text-foreground">{eventTitle(e.event_type)}</span>
          <span className="font-mono text-[10px] text-muted">{formatTime(e.timestamp)} UTC</span>
        </div>
        {e.detail && <p className="mt-0.5 text-xs leading-relaxed text-[#aab2c5]">{prettyText(e.detail)}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
          <span>by {e.actor}</span>
          {e.from_status !== e.to_status && e.to_status && (
            <span>
              {e.from_status ? humanize(e.from_status) : "—"} → <span className="font-medium text-[#c3c9d8]">{humanize(e.to_status)}</span>
            </span>
          )}
          {e.evidence_ids.length > 0 && <span className="font-mono">evidence: {e.evidence_ids.join(", ")}</span>}
        </div>
      </div>
    </li>
  );
}

type Photo = { src: string; caption: string };

/** Full-screen photo viewer with previous/next and keyboard support. */
function Lightbox({ photos, index, onIndex, onClose }: { photos: Photo[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const open = index !== null;
  const { mounted, closing } = usePresence(open);
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(index ?? 0);
  if (index !== null && index !== shown) setShown(index);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
      else return;
      e.stopPropagation();
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [index, photos.length, onClose, onIndex]);
  if (!mounted || !photos[shown]) return null;
  const p = photos[shown];
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[90] flex flex-col">
      <div className={`absolute inset-0 bg-[#02040a]/90 backdrop-blur-md ${closing ? "op-fade-out" : "op-fade-in"}`} onClick={onClose} aria-hidden />
      <div className="relative flex items-center justify-between gap-3 px-4 py-3 text-sm text-foreground">
        <span className="min-w-0 truncate">
          <span className="font-mono text-xs text-muted">
            {shown + 1} / {photos.length}
          </span>{" "}
          · {p.caption}
        </span>
        <button type="button" onClick={onClose} aria-label="Close photo" className="rounded-lg p-2 text-muted ring-1 ring-line-strong hover:bg-surface-2 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center gap-3 px-3 pb-6">
        {photos.length > 1 && (
          <button type="button" onClick={() => onIndex((shown - 1 + photos.length) % photos.length)} aria-label="Previous photo" className="shrink-0 rounded-full bg-surface/80 p-2.5 text-foreground ring-1 ring-line-strong hover:bg-surface-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={p.src} src={p.src} alt={p.caption} className={`max-h-[80vh] min-w-0 max-w-full rounded-xl object-contain shadow-2xl ring-1 ring-line-strong ${closing ? "op-pop-out" : "op-pop-in"}`} />
        {photos.length > 1 && (
          <button type="button" onClick={() => onIndex((shown + 1) % photos.length)} aria-label="Next photo" className="shrink-0 rounded-full bg-surface/80 p-2.5 text-foreground ring-1 ring-line-strong hover:bg-surface-2">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

const STAGES = ["Reported", "Assigned", "In progress", "Awaiting proof", "Verified closed"];
function stageOf(i: Incident): number {
  if (i.status === "verified_closed") return 4;
  if (i.status === "pending_verification" || (i.completed_at && i.status === "escalated")) return 3;
  if (i.status === "in_progress") return 2;
  if (i.assigned_resource_id) return 1;
  return 0;
}

function Stepper({ incident }: { incident: Incident }) {
  const cur = stageOf(incident);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Case progress">
      {STAGES.map((s, idx) => {
        const done = idx < cur || (idx === cur && idx === 4);
        const now = idx === cur && idx !== 4;
        return (
          <li key={s} className="min-w-0">
            <div className={`h-1 rounded-full ${done ? "bg-ok" : now ? "bg-accent" : "bg-surface-2"}`} />
            <p className={`mt-1.5 truncate text-[10px] font-medium ${done ? "text-ok" : now ? "text-foreground" : "text-muted"}`} title={s}>
              {s}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** The slide-over shell for a case: backdrop, panel and enter/exit motion. */
export function IncidentDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const { mounted, closing } = usePresence(open, 200);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className={`absolute inset-0 bg-[#02040a]/60 backdrop-blur-[2px] ${closing ? "op-fade-out" : "op-fade-in"}`} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Incident details"
        tabIndex={-1}
        className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-line-strong bg-surface shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.8)] outline-none sm:w-[640px] ${
          closing ? "op-drawer-out" : "op-drawer-in"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function IncidentDetailSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line p-5">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <button type="button" onClick={onClose} aria-label="Close case" className="rounded-lg p-2 text-muted hover:bg-surface-2">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-5">
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
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
  onClose,
  onPrev,
  onNext,
  position,
  onOpen,
}: {
  detail: IncidentDetail;
  impact: Impact | null;
  now: string | null;
  busy: boolean;
  act: Act;
  incidents: Incident[];
  operator?: Operator;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
  onOpen: (id: string) => void;
}) {
  const { incident: inc, reports, links, evidence, audit, resource } = detail;
  const [tab, setTab] = useState<Tab>("summary");
  const [evKind, setEvKind] = useState<EvidenceKind>("citizen_followup");
  const [evNote, setEvNote] = useState("");
  const [modal, setModal] = useState<null | "reject" | "complete" | "fixed" | "broken">(null);
  const [rejectReason, setRejectReason] = useState<RejectReason>("fake");
  const [rejectNote, setRejectNote] = useState("");
  const [photoIdx, setPhotoIdx] = useState<number | null>(null);

  const canStart = STARTABLE.has(inc.status) && !!inc.assigned_resource_id && !inc.completed_at;
  const canComplete = inc.status === "in_progress";
  const awaitingProof = !!inc.completed_at && (inc.status === "pending_verification" || inc.status === "escalated");
  const closed = inc.status === "verified_closed" || inc.status === "rejected";
  const role = operator?.role ?? "officer";
  const canReject = !!operator && (role === "head" || role === "command") && !closed;
  const linkByReport = new Map(links.map((l) => [l.report_id, l]));
  const related = incidents.filter((i) => inc.related_incident_ids.includes(i.id));
  const children = incidents.filter((i) => inc.child_incident_ids?.includes(i.id));
  const used = slaUsed(inc, now);

  const photos: Photo[] = [
    ...reports.filter((r) => r.photo_url).map((r) => ({ src: photoSrc(r.photo_url!), caption: `Citizen photo · ${r.id} · “${r.text}”` })),
    ...evidence.filter((e) => e.photo_url).map((e) => ({ src: photoSrc(e.photo_url!), caption: `Evidence photo · ${e.id} · ${humanize(e.kind)}` })),
  ];
  const photoIndex = (src: string) => photos.findIndex((p) => p.src === src);

  // j / k step through the queue while the drawer is open (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j") onNext?.();
      if (e.key === "k") onPrev?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNext, onPrev]);

  const submitEvidence = (supports: boolean) =>
    act(
      async () => {
        await api.evidence(inc.id, {
          kind: evKind,
          supports_resolution: supports,
          note: evNote || (supports ? "Issue confirmed fixed" : "Issue still present"),
          source: evKind === "citizen_followup" ? "citizen:dashboard" : "inspector:dashboard",
        });
        setEvNote("");
      },
      supports ? `Evidence recorded on ${inc.id}: confirms the fix` : `Evidence recorded on ${inc.id}: still broken`,
    );

  const TABS: { id: Tab; label: string; icon: LucideIcon; count?: number }[] = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "reports", label: "Reports & photos", icon: Images, count: reports.length + evidence.length },
    { id: "timeline", label: "Timeline", icon: History, count: audit.length },
    { id: "actions", label: "Actions", icon: Wrench },
  ];

  const nextAction = closed
    ? null
    : awaitingProof
      ? { text: "Work reported complete. Closing needs independent proof.", cta: "Add evidence" }
      : canComplete
        ? { text: "Crew is on site. Mark complete when the department reports it done.", cta: "Open actions" }
        : canStart
          ? { text: "Crew assigned. Start work when they are dispatched.", cta: "Open actions" }
          : !inc.assigned_resource_id
            ? { text: "No crew available. The case is escalated until one frees up.", cta: null }
            : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="border-b border-line bg-gradient-to-b from-surface-2/60 to-surface px-5 pb-0 pt-4">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-foreground">{inc.id}</span>
            <span aria-hidden>·</span>
            <span>{CATEGORY_LABEL[inc.category]}</span>
            <span aria-hidden>·</span>
            <span className="capitalize">{inc.department} dept.</span>
          </span>
          <span className="flex items-center gap-1">
            {position && <span className="mr-1 hidden tabular-nums sm:inline">{position}</span>}
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous case (k)" title="Previous case (k)" className="rounded-md p-1.5 ring-1 ring-line hover:bg-surface-2 hover:text-foreground disabled:opacity-30">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next case (j)" title="Next case (j)" className="rounded-md p-1.5 ring-1 ring-line hover:bg-surface-2 hover:text-foreground disabled:opacity-30">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClose} aria-label="Close case" title="Close (Esc)" className="ml-1 rounded-md p-1.5 ring-1 ring-line hover:bg-surface-2 hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <CategoryGlyph category={inc.category} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug text-foreground">{inc.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={inc.status} />
              <VerificationBadge level={inc.verification} />
              {inc.escalation_level > 0 && <Pill className="bg-bad/10 text-bad ring-bad/30">Escalation L{inc.escalation_level}</Pill>}
              <SlaTimer incident={inc} now={now} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Stepper incident={inc} />
        </div>
        <nav role="tablist" aria-label="Case sections" className="op-no-scrollbar -mx-5 mt-3 flex gap-1 overflow-x-auto px-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                className={`relative flex shrink-0 items-center gap-1.5 px-2.5 pb-2.5 pt-1.5 text-xs font-medium transition-colors ${
                  on ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {t.count !== undefined && <span className="rounded bg-surface-2 px-1 text-[10px] tabular-nums text-muted ring-1 ring-line">{t.count}</span>}
                {on && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden />}
              </button>
            );
          })}
        </nav>
      </header>

      <div key={tab} className="op-scroll op-fade-in min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 pb-28">
        {tab === "summary" && (
          <>
            {nextAction && (
              <div className={`flex flex-wrap items-center gap-3 rounded-xl p-3.5 ring-1 ${awaitingProof ? "bg-warn/[0.07] ring-warn/25" : "bg-accent/[0.06] ring-accent/20"}`}>
                <CircleAlert className={`h-4 w-4 shrink-0 ${awaitingProof ? "text-warn" : "text-accent"}`} aria-hidden />
                <p className="min-w-0 flex-1 text-xs text-[#c3c9d8]">
                  <span className="font-semibold text-foreground">Next step. </span>
                  {nextAction.text}
                </p>
                {nextAction.cta && (
                  <Button size="sm" variant="primary" onClick={() => setTab("actions")}>
                    {nextAction.cta}
                  </Button>
                )}
              </div>
            )}
            {inc.status === "rejected" && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-400/[0.07] p-3.5 text-xs text-[#c3c9d8] ring-1 ring-slate-400/20">
                <Ban className="h-4 w-4 text-muted" aria-hidden /> Rejected as invalid; the crew was released. See the timeline for who decided and why.
              </div>
            )}

            <div>
              <SectionTitle right={<span className="font-mono text-[10px] text-muted">deadline {formatTime(inc.deadline)} UTC</span>}>Service level</SectionTitle>
              <div className="rounded-lg bg-[#0a0f1b] p-3 ring-1 ring-line">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Opened {formatTime(inc.created_at)} UTC</span>
                  <span className="tabular-nums">{used !== null && !closed ? `${Math.max(0, Math.round(used * 100))}% of window used` : closed ? "Closed" : ""}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${closed ? "bg-ok/70" : (used ?? 0) >= 1 ? "bg-bad" : (used ?? 0) >= 0.75 || inc.at_risk ? "bg-warn" : "bg-ok"}`}
                    style={{ width: `${closed ? 100 : Math.max(0, Math.min(100, (used ?? 0) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Fact label="Assigned crew">
                {resource ? (
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${resource.available ? "bg-ok" : "bg-bad"}`} />
                    <span className="truncate">{resource.name}</span>
                  </span>
                ) : inc.status === "verified_closed" ? (
                  <span className="text-muted">Released after closure</span>
                ) : inc.status === "rejected" ? (
                  <span className="text-muted">Released</span>
                ) : (
                  <span className="text-bad">None available</span>
                )}
              </Fact>
              <Fact label="Severity">
                <span className="flex items-center gap-2">
                  <span className="flex gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2.5 w-1.5 rounded-sm ${n <= inc.severity ? (inc.severity >= 4 ? "bg-bad" : inc.severity >= 3 ? "bg-warn" : "bg-accent") : "bg-surface-2"}`} />
                    ))}
                  </span>
                  <span className="tabular-nums">{inc.severity}/5</span>
                </span>
              </Fact>
              <Fact label="Reports">
                {reports.length} {reports.length === 1 ? "citizen" : "citizens"}
              </Fact>
              <Fact label="Department">
                <span className="capitalize">{inc.department}</span>
              </Fact>
              <Fact label="Plan version">v{inc.plan_version}</Fact>
              <Fact label="Evidence">
                <span className="text-ok">{evidence.filter((e) => e.supports_resolution).length} for</span>
                <span className="text-muted"> · </span>
                <span className="text-bad">{evidence.filter((e) => !e.supports_resolution).length} against</span>
              </Fact>
            </dl>

            {inc.parent_incident_id && (
              <button type="button" onClick={() => onOpen(inc.parent_incident_id!)} className="flex w-full items-start gap-2.5 rounded-xl bg-violet-400/[0.07] p-3.5 text-left text-xs text-violet-200 ring-1 ring-violet-400/25 hover:ring-violet-400/50">
                <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />
                <span>
                  Waiting on root-cause repair <span className="font-mono font-semibold">{inc.parent_incident_id}</span>. When it is verified, this incident still
                  needs its own proof before closing.
                </span>
              </button>
            )}

            {children.length > 0 && (
              <div>
                <SectionTitle>Root cause of</SectionTitle>
                <ul className="space-y-1.5">
                  {children.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2.5 rounded-lg bg-[#0a0f1b] px-3 py-2 text-left ring-1 ring-line hover:ring-violet-400/40">
                        <CategoryGlyph category={c.category} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{c.title}</span>
                        <StatusBadge status={c.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {impact && <ImpactPanel impact={impact} />}

            {related.length > 0 && (
              <div>
                <SectionTitle>Related incidents · possible shared cause</SectionTitle>
                <ul className="space-y-1.5">
                  {related.map((r) => {
                    const link = links.find((l) => l.kind === "related" && (l.incident_id === r.id || r.report_ids.includes(l.report_id)));
                    return (
                      <li key={r.id}>
                        <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-2.5 rounded-lg bg-[#0a0f1b] px-3 py-2 text-left ring-1 ring-line hover:ring-violet-400/40">
                          <CategoryGlyph category={r.category} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-foreground">{r.title}</span>
                            {link && <span className="block truncate text-[11px] text-violet-300">{link.reason}</span>}
                          </span>
                          <StatusBadge status={r.status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {photos.length > 0 && (
              <div>
                <SectionTitle right={<button type="button" onClick={() => setTab("reports")} className="text-[11px] font-medium text-accent hover:underline">See all</button>}>Photos</SectionTitle>
                <div className="flex gap-2 overflow-x-auto op-no-scrollbar">
                  {photos.slice(0, 4).map((p, idx) => (
                    <button key={p.src} type="button" onClick={() => setPhotoIdx(idx)} className="group relative h-20 w-28 shrink-0 overflow-hidden rounded-lg ring-1 ring-line-strong">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={p.caption} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "reports" && (
          <>
            {photos.length > 0 && (
              <div>
                <SectionTitle>Photo evidence ({photos.length})</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, idx) => (
                    <button key={p.src} type="button" onClick={() => setPhotoIdx(idx)} className="group relative aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={p.caption} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-left text-[10px] text-white/90">{p.caption.split(" · ")[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionTitle>Citizen reports ({reports.length})</SectionTitle>
              <ul className="space-y-2">
                {reports.map((r) => {
                  const link = linkByReport.get(r.id);
                  return (
                    <li key={r.id} className="rounded-lg bg-[#0a0f1b] p-3 ring-1 ring-line">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-relaxed text-foreground">“{r.text}”</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                            <span className="font-mono">{r.id}</span>
                            <span>· {r.reporter.replace(/^citizen:/, "")}</span>
                            <span>· {formatTime(r.created_at)}</span>
                            {link ? (
                              <Pill className="bg-violet-400/10 text-violet-300 ring-violet-400/25">
                                {link.kind} · {Math.round(link.confidence * 100)}%
                              </Pill>
                            ) : (
                              <Pill className="bg-surface-2 text-muted ring-line">first report</Pill>
                            )}
                            {r.location_source === "gps" && (
                              <Pill className="bg-sky-400/10 text-sky-300 ring-sky-400/25">GPS{r.location_accuracy_m ? ` ±${Math.round(r.location_accuracy_m)} m` : ""}</Pill>
                            )}
                            {r.location_source === "pin" && <Pill className="bg-ok/10 text-ok ring-ok/25">Map pin</Pill>}
                            {kmFromPilot(r.lat, r.lng) > PILOT.radiusKm && <Pill className="bg-warn/10 text-warn ring-warn/25">outside pilot area</Pill>}
                            {!!r.reporter_flags && (
                              <Pill className="bg-bad/10 text-bad ring-bad/25">
                                {r.reporter_flags} earlier report{r.reporter_flags > 1 ? "s" : ""} rejected
                              </Pill>
                            )}
                          </div>
                          {r.location_label && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-[#aab2c5]">
                              <MapPin className="h-3 w-3" aria-hidden /> {r.location_label}
                            </p>
                          )}
                          {link && <p className="mt-1.5 text-[11px] text-violet-300">Why linked: {link.reason}</p>}
                        </div>
                        {r.photo_url && (
                          <button type="button" onClick={() => setPhotoIdx(photoIndex(photoSrc(r.photo_url!)))} className="group relative h-16 w-20 shrink-0 overflow-hidden rounded-md ring-1 ring-line-strong" aria-label={`Open photo for ${r.id}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoSrc(r.photo_url)} alt={`Photo attached to report ${r.id}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                            <Camera className="absolute bottom-1 right-1 h-3 w-3 text-white drop-shadow" aria-hidden />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <SectionTitle>Closure evidence ({evidence.length})</SectionTitle>
              {evidence.length === 0 ? (
                <p className="rounded-lg bg-[#0a0f1b] p-3 text-xs text-muted ring-1 ring-line">No evidence yet. A case only closes when independent evidence supports the fix.</p>
              ) : (
                <ul className="space-y-2">
                  {evidence.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 rounded-lg bg-[#0a0f1b] p-3 ring-1 ring-line">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${e.supports_resolution ? "bg-ok/10 text-ok ring-ok/30" : "bg-bad/10 text-bad ring-bad/30"}`}>
                        {e.supports_resolution ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-foreground">“{e.note}”</p>
                        <p className="mt-1 text-[11px] text-muted">
                          <span className={e.supports_resolution ? "text-ok" : "text-bad"}>{e.supports_resolution ? "supports closure" : "contradicts closure"}</span> · {humanize(e.kind)} · {e.source} · {formatTime(e.created_at)}
                          {e.signal_only && " · signal only"}
                        </p>
                      </div>
                      {e.photo_url && (
                        <button type="button" onClick={() => setPhotoIdx(photoIndex(photoSrc(e.photo_url!)))} className="h-12 w-16 shrink-0 overflow-hidden rounded-md ring-1 ring-line-strong" aria-label={`Open evidence photo ${e.id}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoSrc(e.photo_url)} alt={`Evidence photo ${e.id}`} className="h-full w-full object-cover" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {tab === "timeline" && (
          <div>
            <SectionTitle right={<span className="text-[10px] text-muted">oldest first · append-only</span>}>Audit trail ({audit.length} events)</SectionTitle>
            <ol>
              {audit.map((e, idx) => (
                <TimelineItem key={e.id} e={e} last={idx === audit.length - 1} />
              ))}
            </ol>
          </div>
        )}

        {tab === "actions" && (
          <>
            {closed ? (
              <div className="flex items-center gap-2 rounded-xl bg-ok/[0.06] p-4 text-sm text-[#c3c9d8] ring-1 ring-ok/20">
                <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden />
                This case is {inc.status === "rejected" ? "rejected" : "verified closed"}. No further actions.
              </div>
            ) : (
              <>
                <div>
                  <SectionTitle>Work order</SectionTitle>
                  <div className="rounded-xl bg-[#0a0f1b] p-4 ring-1 ring-line">
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-accent-2" aria-hidden />
                      {resource ? (
                        <span className="text-foreground">
                          {resource.name}
                          {!resource.available && <span className="ml-2 text-xs text-bad">unavailable</span>}
                        </span>
                      ) : (
                        <span className="text-bad">No crew available, escalated</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" disabled={busy || !canStart} onClick={() => act(() => api.start(inc.id), `Work started on ${inc.id}`)}>
                        <Play className="h-3.5 w-3.5" aria-hidden /> Start work
                      </Button>
                      <Button variant="primary" size="sm" disabled={busy || !canComplete} onClick={() => setModal("complete")}>
                        <Wrench className="h-3.5 w-3.5" aria-hidden /> Department: mark complete
                      </Button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted">“Complete” is the department’s claim. The case stays open until evidence confirms the fix.</p>
                  </div>
                </div>

                {/* Evidence input: the whole point — "complete" is not "resolved". */}
                <div>
                  <SectionTitle>{awaitingProof ? "Proof needed to close" : "Add evidence"}</SectionTitle>
                  <div className={`rounded-xl p-4 ring-1 ${awaitingProof ? "bg-warn/[0.05] ring-warn/30" : "bg-[#0a0f1b] ring-line"}`}>
                    <div className="grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
                      <label>
                        <span className="sr-only">Evidence source</span>
                        <select value={evKind} onChange={(e) => setEvKind(e.target.value as EvidenceKind)} className={`${FIELD} h-9 text-xs`}>
                          <option value="citizen_followup">Citizen follow-up</option>
                          <option value="inspector">Inspector</option>
                          <option value="photo">Photo</option>
                          <option value="sensor">Sensor</option>
                        </select>
                      </label>
                      <label>
                        <span className="sr-only">Evidence note</span>
                        <input value={evNote} onChange={(e) => setEvNote(e.target.value)} placeholder="What was observed? (optional)" className={`${FIELD} h-9 text-xs`} />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="success" size="sm" disabled={busy} onClick={() => setModal("fixed")}>
                        <Check className="h-3.5 w-3.5" aria-hidden /> Confirms fixed
                      </Button>
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => setModal("broken")}>
                        <X className="h-3.5 w-3.5" aria-hidden /> Still broken
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle>Trust &amp; safety</SectionTitle>
                  {canReject ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-bad/[0.04] p-4 ring-1 ring-bad/20">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-bad" aria-hidden />
                      <p className="min-w-0 flex-1 text-xs text-[#c3c9d8]">Reject a fake or invalid complaint. Closes it without a repair and frees the crew; recorded under your badge.</p>
                      <Button variant="secondary" size="sm" className="text-bad" onClick={() => setModal("reject")}>
                        <Ban className="h-3.5 w-3.5" aria-hidden /> Reject as invalid…
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-[#0a0f1b] p-4 text-xs text-muted ring-1 ring-line">
                      <Lock className="h-4 w-4 shrink-0" aria-hidden />
                      Rejecting a complaint as invalid needs a department head or the command centre. You are signed in as {ROLE_LABEL[role] ?? role}.
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>


      <Lightbox photos={photos} index={photoIdx} onIndex={setPhotoIdx} onClose={() => setPhotoIdx(null)} />

      <Modal
        open={modal === "complete"}
        onClose={() => setModal(null)}
        icon={Wrench}
        title={`Mark ${inc.id} complete?`}
        description="This records the department's claim that the work is done. The case moves to Awaiting proof and only closes when a citizen, inspector, photo or sensor confirms the fix."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                setModal(null);
                void act(() => api.complete(inc.id, "Marked complete from dashboard"), `${inc.id} marked complete: awaiting proof`);
              }}
            >
              Mark complete
            </Button>
          </>
        }
      />

      <Modal
        open={modal === "fixed" || modal === "broken"}
        onClose={() => setModal(null)}
        icon={modal === "broken" ? X : Check}
        tone={modal === "broken" ? "danger" : "ok"}
        title={modal === "broken" ? "Record that it is still broken?" : "Record that it is fixed?"}
        description={
          modal === "broken"
            ? awaitingProof
              ? "The work is reported complete, so evidence against the fix reopens the case as a caught false closure. This is permanent on the audit trail."
              : "Recorded as evidence that the issue is still present. This is permanent on the audit trail."
            : awaitingProof
              ? "The work is reported complete, so supporting evidence closes the case as verified. This is permanent on the audit trail."
              : "Recorded as supporting evidence. The case still closes only after the department reports the work complete. This is permanent on the audit trail."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              variant={modal === "broken" ? "danger" : "success"}
              data-autofocus
              onClick={() => {
                const supports = modal === "fixed";
                setModal(null);
                void submitEvidence(supports);
              }}
            >
              {modal === "broken" ? "Record: still broken" : "Record: fixed"}
            </Button>
          </>
        }
      >
        <p className="rounded-lg bg-[#0a0f1b] p-3 text-xs text-[#c3c9d8] ring-1 ring-line">
          <span className="text-muted">Source:</span> {humanize(evKind)} · <span className="text-muted">Note:</span> {evNote || (modal === "broken" ? "Issue still present" : "Issue confirmed fixed")}
        </p>
      </Modal>

      {operator && (
        <Modal
          open={modal === "reject"}
          onClose={() => setModal(null)}
          icon={Ban}
          tone="danger"
          title={`Reject ${inc.id} as invalid?`}
          description="Closes the case without a repair, frees the crew, and is recorded on the audit trail under your badge. The reporter's record is flagged."
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={busy || rejectNote.trim().length < 3}
                onClick={() => {
                  const note = rejectNote.trim();
                  setModal(null);
                  void act(async () => {
                    await api.rejectIncident(inc.id, { reason: rejectReason, note, by_badge: operator.badge_id });
                    setRejectNote("");
                  }, `${inc.id} rejected as invalid`);
                }}
              >
                Reject complaint
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Reason
              <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value as RejectReason)} className={`${FIELD} mt-1.5 h-9 normal-case tracking-normal`} data-autofocus>
                {REJECT_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              What did you check? <span className="normal-case tracking-normal text-bad">(required)</span>
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} placeholder="e.g. Inspector visited at 14:00, no leak at the reported spot" className={`${FIELD} mt-1.5 resize-none py-2 normal-case tracking-normal`} />
            </label>
            <p className="text-[11px] text-muted">
              Signed as {operator.name} · {operator.badge_id}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
