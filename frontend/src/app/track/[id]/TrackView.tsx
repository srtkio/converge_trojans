"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

import { Reveal, SuccessCheck, useAfterMount, useTween } from "@/components/CitizenMotion";
import { BrandMark, CitizenShell } from "@/components/CitizenShell";
import { BIG_BUTTON, CARD } from "@/lib/citizenStyles";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { api } from "@/lib/api";
import {
  CITIZEN_STATUS_LABEL,
  STAGES,
  WAKING_HINT,
  citizenTimeline,
  explainStatus,
  friendlyTimeLeft,
  rememberCase,
  stageOf,
  useSlowHint,
} from "@/lib/citizen";
import { CATEGORY_ICON, CATEGORY_LABEL, STATUS_STYLE, formatTime, hoursLeft } from "@/lib/format";
import { firstName, readSession } from "@/lib/session";
import type { Incident, IncidentDetail, Resource } from "@/lib/types";

const REFRESH_MS = 4000;

type Notice = { tone: "ok" | "error"; text: string };

export function TrackView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<IncidentDetail | null>(null);
  const [now, setNow] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<"notfound" | "network" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [note, setNote] = useState("");
  const [citizenName, setCitizenName] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Last status seen, so a change made elsewhere (the crew, an inspector) can be announced.
  const lastStatus = useRef<string | null>(null);
  const slowLoad = useSlowHint(!data && !loadError);
  const leftTarget = data && now ? hoursLeft(data.incident.deadline, now) : null;
  const left = useTween(leftTarget);

  const load = useCallback(async () => {
    try {
      const [detail, clock] = await Promise.all([api.incident(id), api.clock()]);
      const status = detail.incident.status;
      if (lastStatus.current && lastStatus.current !== status) {
        setToast(explainStatus(detail.incident));
      }
      lastStatus.current = status;
      setData(detail);
      setNow(clock.now);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error && e.message.startsWith("404") ? "notfound" : "network");
    }
  }, [id]);

  useEffect(() => {
    // Initial load and polling: data is fetched from the API, then state is set when it arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    // The signed-in citizen's first name, so the operator inbox can show who answered.
    const name = readSession("citizen")?.name;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCitizenName(name ? firstName(name) : null);
  }, []);

  const answer = async (fixed: boolean) => {
    setBusy(true);
    setNotice(null);
    const base = fixed ? "Citizen says the problem is fixed" : "Citizen says the problem is still broken";
    const extra = note.trim();
    try {
      const r = await api.evidence(id, {
        kind: "citizen_followup",
        supports_resolution: fixed,
        note: extra ? `${base}: ${extra}` : base,
        source: `citizen:${citizenName ?? "web"}`,
      });
      rememberCase(id);
      lastStatus.current = r.incident.status; // the citizen's own change: no "status changed" toast
      setNote("");
      const next =
        r.incident.status === "verified_closed"
          ? "The repair is confirmed and the case is now closed."
          : r.incident.status === "reopened"
            ? "We've sent it back to the crew."
            : fixed
              ? "Once the repair is confirmed, the case will close."
              : "The crew will see your update.";
      setNotice({ tone: "ok", text: `Thanks. Your answer is recorded and the team will review it. ${next}` });
      await load();
    } catch {
      setNotice({ tone: "error", text: "We couldn't send your answer. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <CitizenShell>
        {loadError === "notfound" ? (
          <section className={`${CARD} mt-8 text-center`}>
            <p aria-hidden="true" className="text-4xl">
              🔎
            </p>
            <h1 className="mt-3 text-xl font-semibold">{"We couldn't find this case"}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Check the case number <span className="font-mono">{id}</span>. Demo data is sometimes reset, so older
              case numbers can disappear.
            </p>
            <Link href="/citizen" className={`${BIG_BUTTON} mt-5 bg-slate-900 text-white`}>
              Report a problem
            </Link>
            <Link href="/" className="mt-3 inline-block text-sm text-slate-600 underline underline-offset-4">
              Home
            </Link>
          </section>
        ) : (
          <div aria-busy="true" className="space-y-4">
            <p role="status" className="text-sm text-slate-600">
              {loadError ? "We can't reach the service right now. Trying again…" : slowLoad ? WAKING_HINT : "Loading your case…"}
            </p>
            <div className="h-44 rounded-2xl bg-slate-200/70 motion-safe:animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 rounded-2xl bg-slate-200/70 motion-safe:animate-pulse" />
              <div className="h-24 rounded-2xl bg-slate-200/70 motion-safe:animate-pulse" />
            </div>
            <div className="h-56 rounded-2xl bg-slate-200/70 motion-safe:animate-pulse" />
          </div>
        )}
      </CitizenShell>
    );
  }

  const { incident, resource, reports } = data;
  const closed = incident.status === "verified_closed";
  const awaiting =
    !!incident.completed_at && (incident.status === "pending_verification" || incident.status === "escalated");
  const sharedRepair = !!incident.parent_incident_id && !incident.completed_at && !closed;
  const timeline = citizenTimeline(data.audit).reverse();
  // The incident title is a 60-character summary; citizens see the original description in full.
  const description = reports[0]?.text ?? incident.title;

  return (
    <CitizenShell>
      <Reveal>
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="CONVERGE home" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            <ShareButton id={incident.id} />
            <Link
              href="/citizen"
              className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              My reports
            </Link>
          </div>
        </div>
      </Reveal>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div
            key={toast}
            role="status"
            className="cz-rise pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm text-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.8)] backdrop-blur"
          >
            <span aria-hidden="true">🔔</span>
            <p className="min-w-0 flex-1">
              <span className="font-semibold">Update.</span> {toast}
            </p>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss update"
              className="-m-1 rounded-md p-1 text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {loadError === "network" && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {"Connection lost. Showing the last update, trying again…"}
        </p>
      )}

      <Reveal>
      <section className={CARD}>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-slate-500">
          <span aria-hidden="true">{CATEGORY_ICON[incident.category]}</span>
          {CATEGORY_LABEL[incident.category]} · Case <span className="font-mono">{incident.id}</span>
        </p>
        <h1 className="mt-1 break-words text-xl font-semibold leading-snug">{description}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            key={incident.status}
            className={`cz-pop inline-block rounded-full px-3 py-1 text-sm font-medium ring-1 ${STATUS_STYLE[incident.status].badge}`}
          >
            {CITIZEN_STATUS_LABEL[incident.status]}
          </span>
          {reports.length > 1 && <span className="text-xs text-slate-500">{reports.length} people reported this</span>}
        </div>
        <p className="mt-2 text-sm text-slate-700">{explainStatus(incident)}</p>
        <Progress stage={stageOf(incident)} />
      </section>
      </Reveal>

      <Reveal index={1}>
      <section className="grid grid-cols-2 gap-3">
        <div className={`${CARD} p-4`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Target</p>
          <p className="mt-1 text-lg font-semibold leading-tight">
            {closed ? "Done" : left === null ? "…" : friendlyTimeLeft(left)}
          </p>
          <p className={`mt-1 text-xs ${incident.at_risk && !closed ? "font-medium text-amber-700" : "text-slate-500"}`}>
            {closed
              ? "Repair confirmed"
              : incident.at_risk
                ? "Close to the deadline, the department is alerted"
                : `Fix by ${formatTime(incident.deadline)}`}
          </p>
        </div>
        <CrewCard incident={incident} resource={resource} closed={closed} sharedRepair={sharedRepair} />
      </section>
      </Reveal>

      <Reveal index={2}>
      <section
        aria-labelledby="fixed-heading"
        className={`rounded-2xl p-5 shadow-sm ring-1 transition-colors ${awaiting ? "bg-amber-50 ring-amber-300" : "bg-white ring-slate-200"}`}
      >
        <h2 id="fixed-heading" className="text-lg font-semibold">
          Is it fixed?
        </h2>
        {closed ? (
          <>
            <p className="mt-1 text-sm text-slate-700">
              {"Yes. The repair was checked and the case is closed. If the problem comes back, report it again and we'll reopen it."}
            </p>
            <Link href="/citizen" className={`${BIG_BUTTON} mt-4 h-12 bg-white text-base text-slate-800 ring-1 ring-slate-300`}>
              Report it again
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-700">
              {awaiting
                ? "The crew says the work is done. Please take a look and tell us if it's really fixed."
                : sharedRepair
                  ? "This should be fixed by the related repair nearby. Tell us if anything changes."
                  : "Seen a change? Tell us. Your answer helps check the repair before the case is closed."}
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-800">
              Add a note <span className="font-normal text-slate-500">(optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. Water is still running near the bus stop"
                className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => answer(true)}
                className={`${BIG_BUTTON} bg-emerald-700 text-white hover:bg-emerald-800`}
              >
                {"Yes, it's fixed"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => answer(false)}
                className={`${BIG_BUTTON} bg-rose-600 text-white`}
              >
                Still broken
              </button>
            </div>
          </>
        )}
        {notice && (
          <div
            className={`cz-rise mt-4 flex items-start gap-3 rounded-xl p-3 ring-1 ${
              notice.tone === "ok" ? "bg-emerald-50 ring-emerald-200" : "bg-rose-50 ring-rose-200"
            }`}
          >
            {notice.tone === "ok" && <SuccessCheck className="h-7 w-7" />}
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={`text-sm ${notice.tone === "ok" ? "text-emerald-900" : "text-rose-800"}`}
            >
              {notice.text}
            </p>
          </div>
        )}
      </section>
      </Reveal>

      <Reveal index={3}>
      <section aria-labelledby="timeline-heading" className={CARD}>
        <h2 id="timeline-heading" className="text-lg font-semibold">
          What happened
        </h2>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No updates yet.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {timeline.map((event, i) => (
              <li key={event.id} className="cz-rise flex gap-3" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${i === 0 ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-slate-300"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{event.text}</p>
                  <p className="text-xs text-slate-500">{formatTime(event.timestamp)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      </Reveal>

      <Reveal index={4}>
        <FeedbackWidget incidentId={incident.id} page="/track" knownRole={citizenName ? "citizen" : undefined} />
      </Reveal>

      <nav className="flex items-center justify-center gap-6 pb-2 text-sm text-slate-600">
        <Link href="/citizen" className="underline underline-offset-4">
          Report another problem
        </Link>
        <Link href="/" className="underline underline-offset-4">
          Home
        </Link>
      </nav>
    </CitizenShell>
  );
}

function Progress({ stage }: { stage: number }) {
  const shown = useAfterMount(stage, -1);
  return (
    <ol aria-label="Progress" className="mt-4 grid grid-cols-5 gap-1.5">
      {STAGES.map((label, i) => (
        <li key={label} aria-current={i === stage ? "step" : undefined} className="flex flex-col gap-1.5">
          <span className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <span
              className="block h-full origin-left rounded-full bg-emerald-500 transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${i <= shown ? 1 : 0})`, transitionDelay: `${i * 90}ms` }}
            />
          </span>
          <span
            className={`text-[11px] leading-tight ${
              i === stage ? "font-semibold text-slate-900" : i < stage ? "text-slate-600" : "text-slate-500"
            }`}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CrewCard({
  incident,
  resource,
  closed,
  sharedRepair,
}: {
  incident: Incident;
  resource: Resource | null;
  closed: boolean;
  sharedRepair: boolean;
}) {
  const [title, detail] = closed
    ? ["Job done", "The crew has finished"]
    : sharedRepair
      ? ["Shared repair", "Fixed together with a related problem"]
      : resource
        ? [resource.name, resource.available ? "Assigned to your case" : "Temporarily unavailable, finding cover"]
        : incident.status === "escalated"
          ? ["Finding a crew", "A supervisor has been alerted"]
          : ["Finding a crew", "Assigned as soon as one is free"];
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Crew</p>
      <p className="mt-1 break-words text-lg font-semibold leading-tight">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

/** Native share sheet on phones; copies the link elsewhere. */
function ShareButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `CONVERGE case ${id}`, text: "Follow this city repair", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The share sheet was closed or the clipboard is blocked: nothing to do.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      >
        {copied ? "Link copied" : "Share"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}
