"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCitizen } from "@/components/CitizenApp";
import { SuccessCheck } from "@/components/CitizenMotion";
import { CitizenReportForm, type ReportOutcome } from "@/components/CitizenReportForm";
import { CitizenScreen } from "@/components/CitizenScreen";
import { BIG_BUTTON, CARD } from "@/lib/citizenStyles";
import { needsCheck, prefersReducedMotion, rememberCase } from "@/lib/citizen";
import { refreshMyCases, useMyCases } from "@/lib/myCases";
import { firstName } from "@/lib/session";

/** Report tab: the report form, then the confirmation with the "Track your case" link. */
export default function ReportPage() {
  const citizen = useCitizen();
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  const [focusForm, setFocusForm] = useState(false);
  const toCheck = useMyCases().cases.filter(needsCheck);
  const topRef = useRef<HTMLDivElement>(null);

  const onReported = (o: ReportOutcome) => {
    rememberCase(o.incident.id);
    setOutcome(o);
    void refreshMyCases();
    // The confirmation replaces the form; bring it into view on small screens.
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }),
    );
  };

  return (
    <CitizenScreen>
      {toCheck.length > 0 && !outcome && (
        <Link
          href={`/track/${toCheck[0].id}`}
          transitionTypes={["cz-forward"]}
          className="cz-rise flex items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 motion-safe:active:scale-[0.99]"
        >
          <span aria-hidden="true" className="text-2xl">
            👀
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-amber-950">
              {toCheck.length === 1 ? "1 repair needs your check" : `${toCheck.length} repairs need your check`}
            </span>
            <span className="block text-xs text-amber-900">
              {"The crew says it's fixed. Tap to confirm, or tell us it's still broken."}
            </span>
          </span>
          <span aria-hidden="true" className="text-amber-900">
            →
          </span>
        </Link>
      )}

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

      <p className="mt-auto pt-2 text-center text-xs text-slate-500">
        Only your first name ({firstName(citizen.name)}) is attached to your reports. Sharing this phone? Sign out
        when you&apos;re done.
      </p>
    </CitizenScreen>
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
        transitionTypes={["cz-forward"]}
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
