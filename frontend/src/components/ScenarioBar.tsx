"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import type { Incident } from "@/lib/types";

import type { Act } from "./Dashboard";

// Mirrors backend/app/sim.py GOLDEN so the stepper can preview the next step.
const STEPS = [
  "Reset; seed crews (2 roads, 1 water, 1 electrical)",
  "Report A: water leak at MG Road → new incident, assigned to water crew",
  "Report B: same leak 60 m away → linked as duplicate",
  "Report C: pothole 250 m away → new incident, related to the leak",
  "Water crew unavailable → plan invalidated; no other crew → escalated",
  "Crew back → reassigned, started, marked complete → awaiting proof",
  "Citizen: “still leaking” contradicts closure → reopened",
  "Repaired again; inspector photo supports → verified closed",
  "Clock +49 h with pothole untouched → SLA breach → escalated",
  "Metrics: baseline vs CONVERGE",
];

export function ScenarioBar({
  busy,
  act,
  onSelect,
  incidents,
}: {
  busy: boolean;
  act: Act;
  onSelect: (id: string | null) => void;
  incidents: Incident[];
}) {
  const [step, setStep] = useState(0);

  const runTo = (target: number) =>
    act(async () => {
      const r = await api.golden(target);
      setStep(r.step);
      // Keep the leak incident in focus during the story; show the pothole when it breaches.
      if (target >= 2) onSelect(target === 9 ? "inc_002" : "inc_001");
    });

  const reset = () =>
    act(async () => {
      await api.reset();
      setStep(0);
      onSelect(null);
    });

  const next = Math.min(step + 1, STEPS.length);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Demo scenario</span>
        <div className="flex flex-wrap gap-1">
          {STEPS.map((desc, i) => {
            const n = i + 1;
            const done = n <= step;
            return (
              <button
                key={n}
                title={desc}
                disabled={busy}
                onClick={() => runTo(n)}
                className={`h-7 w-7 rounded-full text-xs font-medium ring-1 transition disabled:opacity-50 ${
                  n === step
                    ? "bg-slate-900 text-white ring-slate-900"
                    : done
                      ? "bg-slate-200 text-slate-700 ring-slate-300"
                      : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-100"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
        <button
          disabled={busy || step >= STEPS.length}
          onClick={() => runTo(next)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Next step →
        </button>
        <button
          disabled={busy}
          onClick={() => runTo(STEPS.length)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-40"
        >
          Run all
        </button>
        <button
          disabled={busy}
          onClick={reset}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-40"
        >
          Reset
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clock</span>
        {[1, 12, 48].map((h) => (
          <button
            key={h}
            disabled={busy}
            onClick={() => act(() => api.tick(h * 60))}
            className="rounded-md px-2 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-40"
          >
            +{h}h
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {step > 0 ? (
          <>
            <span className="font-medium text-slate-900">Step {step}:</span> {STEPS[step - 1]}
            {step < STEPS.length && <span className="text-slate-400"> · next: {STEPS[step]}</span>}
          </>
        ) : incidents.length ? (
          "Live mode: file reports and act on incidents directly, or press Reset to start the demo."
        ) : (
          <>
            <span className="text-slate-400">Press </span>Next step
            <span className="text-slate-400"> to walk through the demo, or file a report yourself.</span>
          </>
        )}
      </p>
    </section>
  );
}
