"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { FeedbackWidget } from "@/components/FeedbackWidget";
import { api } from "@/lib/api";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  formatHours,
  formatTime,
  hoursLeft,
  humanize,
} from "@/lib/format";
import { readSession } from "@/lib/session";
import type { IncidentDetail } from "@/lib/types";

const REFRESH_MS = 4000;

export function TrackView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<IncidentDetail | null>(null);
  const [now, setNow] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [citizenName, setCitizenName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, clock] = await Promise.all([api.incident(id), api.clock()]);
      setData(detail);
      setNow(clock.now);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error && e.message.startsWith("404") ? "We couldn't find this case." : "Couldn't reach the service. Retrying…");
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
    // The signed-in citizen's name, so the operator inbox can show who answered. Storage is browser-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCitizenName(readSession("citizen")?.name ?? null);
  }, []);

  const answer = async (fixed: boolean) => {
    setBusy(true);
    setNotice(null);
    const base = fixed ? "Citizen says the problem is fixed" : "Citizen says the problem is still broken";
    const extra = note.trim();
    try {
      await api.evidence(id, {
        kind: "citizen_followup",
        supports_resolution: fixed,
        note: extra ? `${base}: ${extra}` : base,
        source: `citizen:${citizenName ?? "web"}`,
      });
      setNote("");
      setNotice("Thanks. Your answer is recorded and the team will review it.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not send your answer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4 py-6 text-slate-600">
        <p>{loadError ?? "Loading your case…"}</p>
        <Link href="/" className="text-sm text-slate-500 underline">
          Back to the dashboard
        </Link>
      </main>
    );
  }

  const { incident, audit, resource } = data;
  const style = STATUS_STYLE[incident.status];
  const closed = incident.status === "verified_closed";
  const left = now ? hoursLeft(incident.deadline, now) : null;
  const timeline = [...audit].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-slate-50 px-4 py-6">
      <header className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">
          <span aria-hidden="true">{CATEGORY_ICON[incident.category]}</span> {CATEGORY_LABEL[incident.category]} · case{" "}
          <span className="font-mono">{incident.id}</span>
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{incident.title}</h1>
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ring-1 ${style.badge}`}>
          {STATUS_LABEL[incident.status]}
        </span>
        <p className="mt-2 text-sm text-slate-600">Handled by the {humanize(incident.department)} department</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-500">Deadline</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {closed ? "Closed" : left === null ? "…" : formatHours(left)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatTime(incident.deadline)} UTC</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-500">Crew</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{resource ? resource.name : "Waiting"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {resource ? (resource.available ? "On duty" : "Currently unavailable") : "Assigned when a crew is free"}
          </p>
        </div>
      </section>

      <section aria-labelledby="fixed-heading" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 id="fixed-heading" className="text-lg font-semibold text-slate-900">
          Is it fixed?
        </h2>
        <p className="mt-1 text-sm text-slate-600">Your answer helps us check the repair before we close the case.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Add a note <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Water is still running near the bus stop"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
        </label>
        <div className="mt-4 grid gap-3">
          <button
            type="button"
            disabled={busy || closed}
            onClick={() => answer(true)}
            className="h-14 rounded-xl bg-emerald-600 text-lg font-semibold text-white disabled:opacity-50"
          >
            Yes, it&apos;s fixed
          </button>
          <button
            type="button"
            disabled={busy || closed}
            onClick={() => answer(false)}
            className="h-14 rounded-xl bg-rose-600 text-lg font-semibold text-white disabled:opacity-50"
          >
            Still broken
          </button>
        </div>
        {notice && (
          <p role="status" className="mt-3 text-sm text-slate-700">
            {notice}
          </p>
        )}
      </section>

      <section aria-labelledby="timeline-heading" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 id="timeline-heading" className="text-lg font-semibold text-slate-900">
          What happened
        </h2>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No updates yet.</p>
        ) : (
          <ol className="mt-3 space-y-4 border-l-2 border-slate-200 pl-4">
            {timeline.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />
                <p className="text-xs text-slate-500">{formatTime(event.timestamp)} UTC</p>
                <p className="text-sm text-slate-800">{event.detail || humanize(event.event_type)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <FeedbackWidget />

      <p className="pb-4 text-center text-xs text-slate-400">
        <Link href="/" className="underline">
          Dashboard
        </Link>
      </p>
    </main>
  );
}
