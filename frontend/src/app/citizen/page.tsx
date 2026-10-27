"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Reveal, SuccessCheck } from "@/components/CitizenMotion";
import { CitizenReportForm, type ReportOutcome } from "@/components/CitizenReportForm";
import { BrandMark, CitizenShell } from "@/components/CitizenShell";
import { BIG_BUTTON, CARD } from "@/lib/citizenStyles";
import { api } from "@/lib/api";
import {
  CITIZEN_STATUS_LABEL,
  WAKING_HINT,
  explainStatus,
  forgetCase,
  prefersReducedMotion,
  readMyCases,
  rememberCase,
  useSlowHint,
} from "@/lib/citizen";
import { CATEGORY_ICON, STATUS_STYLE } from "@/lib/format";
import { clearSession, firstName, readSession, saveSession, type Session } from "@/lib/session";
import type { Incident } from "@/lib/types";

type Citizen = Extract<Session, { kind: "citizen" }>;

const CASES_REFRESH_MS = 15_000;

export default function CitizenPage() {
  const [citizen, setCitizen] = useState<Citizen | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Restore a session from this tab. Reading storage needs the browser, so this runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCitizen(readSession("citizen") as Citizen | null);
    setChecked(true);
  }, []);

  return (
    <CitizenShell>
      {!checked ? null : citizen ? (
        <CitizenHome
          citizen={citizen}
          onSignOut={() => {
            clearSession();
            setCitizen(null);
          }}
        />
      ) : (
        <CitizenLogin onSignedIn={setCitizen} />
      )}
    </CitizenShell>
  );
}

function CitizenHome({ citizen, onSignOut }: { citizen: Citizen; onSignOut: () => void }) {
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  const [focusForm, setFocusForm] = useState(false);
  const [cases, setCases] = useState<Incident[]>([]);
  const topRef = useRef<HTMLDivElement>(null);

  // The cases this device reported, with their live status. Network hiccups keep the last known
  // status; only cases the service no longer knows (after a demo reset) are dropped.
  const loadCases = useCallback(async () => {
    const ids = readMyCases();
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, incident: (await api.incident(id)).incident, gone: false };
        } catch (e) {
          const gone = e instanceof Error && e.message.startsWith("404");
          if (gone) forgetCase(id);
          return { id, incident: null, gone };
        }
      }),
    );
    setCases((prev) =>
      results.flatMap(({ id, incident, gone }) => {
        if (incident) return [incident];
        const last = gone ? undefined : prev.find((p) => p.id === id);
        return last ? [last] : [];
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCases();
    const timer = setInterval(loadCases, CASES_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadCases]);

  const onReported = (o: ReportOutcome) => {
    rememberCase(o.incident.id);
    setOutcome(o);
    void loadCases();
    // The confirmation replaces the form; bring it into view on small screens.
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }),
    );
  };

  const others = cases.filter((c) => c.id !== outcome?.incident.id);

  return (
    <>
      <Reveal>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Citizen portal</p>
          <p className="truncate text-lg font-semibold">Hi, {citizen.name}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          Sign out
        </button>
      </header>
      </Reveal>

      <Reveal index={1}>
      <div ref={topRef} className="scroll-mt-4">
        {outcome ? (
          <ReportSuccess
            outcome={outcome}
            onAnother={() => {
              setFocusForm(true);
              setOutcome(null);
            }}
          />
        ) : (
          <section aria-labelledby="report-heading" className={CARD}>
            <h1 id="report-heading" className="text-xl font-semibold">
              Report a problem
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {"Tell us what's wrong and where. We'll follow it until the repair is checked."}
            </p>
            <div className="mt-5">
              <CitizenReportForm
                reporter={`citizen:${firstName(citizen.name)}`}
                onReported={onReported}
                focusOnMount={focusForm}
              />
            </div>
          </section>
        )}
      </div>
      </Reveal>

      {others.length > 0 && (
        <Reveal index={2}>
        <section aria-labelledby="my-reports-heading">
          <h2 id="my-reports-heading" className="text-base font-semibold">
            Your reports
          </h2>
          <ul className="mt-2 space-y-2">
            {others.map((inc) => (
              <li key={inc.id}>
                <CaseRow incident={inc} />
              </li>
            ))}
          </ul>
        </section>
        </Reveal>
      )}

      <p className="mt-auto pt-2 text-center text-xs text-slate-500">
        Only your first name ({firstName(citizen.name)}) is attached to your reports.
      </p>
    </>
  );
}

function ReportSuccess({ outcome, onAnother }: { outcome: ReportOutcome; onAnother: () => void }) {
  const { incident, link } = outcome;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Move focus to the confirmation so screen readers announce it and keyboard users continue from here.
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyCase = async () => {
    try {
      await navigator.clipboard.writeText(incident.id);
      setCopied(true);
    } catch {
      // Clipboard blocked: the number is on screen to copy by hand.
    }
  };
  const title = link?.kind === "duplicate" ? "Thanks! This was already reported" : "Thanks! Your report is in";
  const body =
    link?.kind === "duplicate"
      ? "We added your report to the existing case, so the crew sees everyone's reports in one place."
      : link?.kind === "related"
        ? "It looks connected to another problem nearby, so the teams will coordinate the repair."
        : incident.assigned_resource_id
          ? "A crew has been assigned. The case stays open until the repair is checked."
          : "No crew is free right now, so a supervisor has been alerted.";

  return (
    <section aria-labelledby="success-heading" className={`${CARD} cz-rise`}>
      <div className="flex items-center gap-3">
        <SuccessCheck />
        <h1 id="success-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold leading-snug outline-none">
          {title}
        </h1>
      </div>
      <p role="status" className="mt-3 text-sm text-slate-700">
        {body}
      </p>
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <span>
          Case number <span className="font-mono font-semibold text-slate-900">{incident.id}</span>
        </span>
        <button
          type="button"
          onClick={copyCase}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? "Case number copied" : ""}
        </span>
      </div>
      <Link
        href={`/track/${incident.id}`}
        className={`${BIG_BUTTON} mt-5 bg-emerald-700 text-white shadow-[0_14px_30px_-16px_rgba(5,150,105,0.9)] hover:bg-emerald-800`}
      >
        Track your case
      </Link>
      <button
        type="button"
        onClick={onAnother}
        className={`${BIG_BUTTON} mt-3 h-12 bg-white text-base text-slate-800 ring-1 ring-slate-300`}
      >
        Report another problem
      </button>
    </section>
  );
}

function CaseRow({ incident }: { incident: Incident }) {
  return (
    <Link
      href={`/track/${incident.id}`}
      className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 motion-safe:active:scale-[0.99]"
    >
      <span aria-hidden="true" className="text-2xl">
        {CATEGORY_ICON[incident.category]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{incident.title}</span>
        <span className="block truncate text-xs text-slate-500">{explainStatus(incident)}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLE[incident.status].badge}`}>
        {CITIZEN_STATUS_LABEL[incident.status]}
      </span>
    </Link>
  );
}

const NAME_KEY = "converge.lastName";

function CitizenLogin({ onSignedIn }: { onSignedIn: (c: Citizen) => void }) {
  const [name, setName] = useState("");

  useEffect(() => {
    // Pre-fill the name from this device's last visit. The email is never stored.
    try {
      const last = window.localStorage.getItem(NAME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (last) setName((current) => current || last);
    } catch {
      // Storage blocked: the field simply starts empty.
    }
  }, []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slow = useSlowHint(busy);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await api.citizenLogin({ name, email });
      const c: Citizen = { kind: "citizen", ...profile };
      saveSession(c);
      try {
        window.localStorage.setItem(NAME_KEY, profile.name);
      } catch {
        // Not remembered next time; that's fine.
      }
      onSignedIn(c);
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      setError(
        text.startsWith("422")
          ? "That email doesn't look right. Check it and try again."
          : "We couldn't sign you in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const input =
    "mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-4">
      <Reveal>
        <div className="flex items-center justify-between">
          <BrandMark />
          <Link href="/" className="rounded-lg px-2 py-1 text-sm text-slate-600 underline-offset-4 hover:underline">
            ← Back
          </Link>
        </div>
        <h1 className="mt-6 text-2xl font-semibold leading-tight tracking-tight">Report a problem in your area</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with your name and email to report problems and follow them until they are fixed.
        </p>
      </Reveal>

      <Reveal index={1}>
      <form onSubmit={submit} className={`${CARD} space-y-4`}>
        <label className="block text-sm font-medium text-slate-800">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            enterKeyHint="next"
            required
            className={input}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            enterKeyHint="go"
            required
            className={input}
          />
        </label>
        <p className="text-xs text-slate-500">Only your first name is attached to your reports. Your email stays private.</p>
        <button
          type="submit"
          disabled={busy}
          className={`${BIG_BUTTON} bg-slate-900 text-white shadow-[0_12px_26px_-16px_rgba(15,23,42,0.9)] hover:bg-slate-800`}
        >
          {busy ? "Signing in…" : "Continue"}
        </button>
        {slow && (
          <p role="status" className="text-center text-sm text-slate-600">
            {WAKING_HINT}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
            {error}
          </p>
        )}
      </form>
      </Reveal>
    </div>
  );
}
