"use client";

import Link from "next/link";

import { CaseRow } from "@/components/CaseRow";
import { CitizenScreen } from "@/components/CitizenScreen";
import { InstallHint } from "@/components/InstallHint";
import { CITIZEN_STATUS_LABEL, needsCheck } from "@/lib/citizen";
import { BIG_BUTTON, CARD } from "@/lib/citizenStyles";
import { MY_CASES_POLL_MS, useMyCases } from "@/lib/myCases";

/** My cases tab: every case this device reported, with live status. Needs-your-check first. */
export default function MyCasesPage() {
  const { cases, loaded, error, changed, version } = useMyCases();
  const toCheck = cases.filter(needsCheck);
  const rest = cases.filter((c) => !needsCheck(c));
  const announce = Object.keys(changed)
    .map((id) => cases.find((c) => c.id === id))
    .filter((c) => !!c)
    .map((c) => `${c.title}: ${CITIZEN_STATUS_LABEL[c.status] ?? "updated"}.`)
    .join(" ");
  const flashOf = (id: string) => (changed[id] ? `${id}-${version}` : undefined);

  return (
    <CitizenScreen>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Live status</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">My cases</h1>
        <p className="mt-1 text-sm text-slate-600">
          Updates on their own about every {Math.round(MY_CASES_POLL_MS / 1000)} seconds while this screen is open.
        </p>
      </div>

      <InstallHint />

      {error && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {"Connection lost. Showing the last update, trying again…"}
        </p>
      )}

      {!loaded ? (
        <div aria-busy="true" className="space-y-2">
          <p className="sr-only" role="status">
            Loading your cases…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[74px] rounded-xl bg-slate-200/70 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <section className={`${CARD} cz-fade text-center`}>
          <p aria-hidden="true" className="text-4xl">
            📭
          </p>
          <h2 className="mt-3 text-lg font-semibold">No cases yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Problems you report from this phone show up here, so you can follow them until the repair is checked.
          </p>
          <Link href="/citizen" transitionTypes={["cz-tab"]} className={`${BIG_BUTTON} mt-5 bg-emerald-700 text-white hover:bg-emerald-800`}>
            Report a problem
          </Link>
          <Link
            href="/citizen/map"
            transitionTypes={["cz-tab"]}
            className="mt-3 inline-block text-sm text-slate-600 underline underline-offset-4"
          >
            See issues near you
          </Link>
        </section>
      ) : (
        <>
          {toCheck.length > 0 && (
            <section aria-labelledby="check-heading">
              <h2 id="check-heading" className="text-base font-semibold text-amber-950">
                {toCheck.length === 1 ? "1 needs your check" : `${toCheck.length} need your check`}
              </h2>
              <p className="text-xs text-amber-900">{"The crew says it's fixed. Tap to confirm, or tell us it's still broken."}</p>
              <ul className="mt-2 space-y-2">
                {toCheck.map((inc) => (
                  <li key={inc.id} className="cz-rise rounded-xl ring-2 ring-amber-300">
                    <CaseRow incident={inc} flash={flashOf(inc.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {rest.length > 0 && (
            <section aria-labelledby="cases-heading">
              <h2 id="cases-heading" className="text-base font-semibold">
                {toCheck.length > 0 ? "Other cases" : "Your reports"}
              </h2>
              <ul className="mt-2 space-y-2">
                {rest.map((inc) => (
                  <li key={inc.id} className="cz-rise">
                    <CaseRow incident={inc} flash={flashOf(inc.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="mt-auto pt-2 text-center text-xs text-slate-500">
        Cases are remembered on this phone only. Signing out clears the list.
      </p>
    </CitizenScreen>
  );
}
