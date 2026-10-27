"use client";

import Link from "next/link";
import { useState } from "react";

import { SuccessCheck } from "@/components/CitizenMotion";
import { BottomSheet } from "@/components/Sheet";
import { CITIZEN_STATUS_LABEL, explainStatus, formatMetres, hasMeToo, needsCheck } from "@/lib/citizen";
import { BIG_BUTTON } from "@/lib/citizenStyles";
import { CATEGORY_ICON, CATEGORY_LABEL, STATUS_STYLE } from "@/lib/format";
import { joinCase } from "@/lib/meToo";
import type { Incident } from "@/lib/types";

type Joined = { incident: Incident; joined: boolean };

/** A nearby issue tapped on the Map tab: what it is, how far, and "Me too" or "View case". */
export function NearbySheet({
  incident,
  distanceM,
  fromYou,
  reporter,
  onJoined,
  onClosed,
}: {
  incident: Incident;
  distanceM: number;
  /** True when the distance is from the phone's position, false when from the pilot centre. */
  fromYou: boolean;
  reporter: string;
  onJoined: (r: Joined) => void;
  onClosed: () => void;
}) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [result, setResult] = useState<Joined | null>(null);
  const already = !result && hasMeToo(incident.id);
  const count = result?.joined ? result.incident.report_ids.length : incident.report_ids.length;

  const join = async () => {
    setState("busy");
    try {
      const r = await joinCase(incident, reporter);
      setResult(r);
      setState("idle");
      onJoined(r);
    } catch {
      setState("error");
    }
  };

  const badge = STATUS_STYLE[incident.status]?.badge ?? "bg-slate-100 text-slate-700 ring-slate-200";
  const caseId = result && !result.joined ? result.incident.id : incident.id;

  return (
    <BottomSheet labelledBy="nearby-sheet-title" onClosed={onClosed}>
      {(close) => (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-2xl">
              {CATEGORY_ICON[incident.category]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">
                {CATEGORY_LABEL[incident.category]} · {formatMetres(distanceM)} {fromYou ? "from you" : "from Rishihood University"}
              </p>
              <h2 id="nearby-sheet-title" className="mt-0.5 break-words text-lg font-semibold leading-snug">
                {incident.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-m-1 shrink-0 rounded-md p-1.5 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${badge}`}>
              {CITIZEN_STATUS_LABEL[incident.status] ?? "Open"}
            </span>
            <span className="text-sm text-slate-600">
              <span key={count} className="cz-pop inline-block font-semibold text-slate-900">
                {count}
              </span>{" "}
              {count === 1 ? "person reported this" : "people reported this"}
            </span>
          </div>
          <p className="text-sm text-slate-700">{explainStatus(incident)}</p>

          {needsCheck(incident) ? (
            <Link
              href={`/track/${caseId}`}
              transitionTypes={["cz-forward"]}
              onClick={onClosed}
              className={`${BIG_BUTTON} h-12 bg-amber-500 text-base font-semibold text-amber-950 ring-1 ring-amber-400 hover:bg-amber-400 shadow-sm`}
            >
              👀 Check repair &amp; answer &quot;Is it fixed?&quot;
            </Link>
          ) : result ? (
            <div role="status" className="cz-rise flex items-center gap-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
              <SuccessCheck className="h-8 w-8" />
              <p className="text-sm text-emerald-950">
                {result.joined ? (
                  <>
                    <span className="font-semibold">You + {Math.max(0, count - 1)} {count - 1 === 1 ? "neighbour" : "neighbours"} → 1 case.</span>{" "}
                    {"You've added your voice. We'll keep it in My cases."}
                  </>
                ) : (
                  <>
                    Logged as a new case, <span className="font-mono">{result.incident.id}</span>, because this one is older
                    than 3 days.
                  </>
                )}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={join}
              disabled={state === "busy" || already}
              className={`${BIG_BUTTON} h-12 bg-emerald-700 text-base text-white hover:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100`}
            >
              {already ? "You've added your voice" : state === "busy" ? "Adding…" : "🙋 Me too"}
            </button>
          )}
          {state === "error" && (
            <p role="alert" className="text-sm text-rose-700">
              {"We couldn't add your report. Check your connection and try again."}
            </p>
          )}
          <Link
            href={`/track/${caseId}`}
            transitionTypes={["cz-forward"]}
            onClick={onClosed}
            className={`${BIG_BUTTON} h-12 bg-white text-base text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50`}
          >
            View case
          </Link>
        </div>
      )}
    </BottomSheet>
  );
}
