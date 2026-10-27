"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Incident } from "@/lib/types";

import type { Act } from "./Dashboard";

// Mirrors backend/app/sim.py GOLDEN and ROOTCAUSE so the stepper can preview the next step.
const GOLDEN_STEPS = [
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

const ROOTCAUSE_STEPS = [
  "Reset; seed crews and city services",
  "Report A: water bubbling through MG Road → leak incident, water crew assigned",
  "Report B: pothole 120 m away → related to the leak",
  "Report C: pothole at the bus stop 280 m away → root-cause hypothesis proposed",
  "Operator confirms the leak as root cause → potholes wait on it, 2 crew visits saved",
  "One repair: leak fixed and verified → both potholes await their own proof",
  "Citizen and photo evidence confirm both potholes → all verified closed",
  "Metrics: 1 coordinated repair instead of 3 visits",
];

type ScenarioName = "golden" | "rootcause";

const SCENARIOS: Record<ScenarioName, { label: string; steps: string[]; focus: (step: number) => string | null }> = {
  golden: {
    label: "v1 · Verified loop",
    steps: GOLDEN_STEPS,
    // Keep the leak in focus during the story; show the pothole when it breaches.
    focus: (n) => (n < 2 ? null : n === 9 ? "inc_002" : "inc_001"),
  },
  rootcause: { label: "v2 · Root cause", steps: ROOTCAUSE_STEPS, focus: (n) => (n < 2 ? null : "inc_001") },
};

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
  const [scenario, setScenario] = useState<ScenarioName>("golden");
  const STEPS = SCENARIOS[scenario].steps;

  // Pick up where the demo left off, so a page reload doesn't show step 0 while the backend is on step 5.
  useEffect(() => {
    // Resetting wipes both progress counters, so at most one scenario has a step in progress.
    Promise.all([api.scenarioStatus("golden"), api.scenarioStatus("rootcause")])
      .then(([g, r]) => {
        if (r && r.step > 0) {
          setScenario("rootcause");
          setStep(r.step);
        } else if (g) {
          setStep(g.step);
        }
      })
      .catch(() => {
        // Backend unreachable or not started yet: keep the default step 0.
      });
  }, []);

  const runTo = (target: number) =>
    act(async () => {
      const r = await api.scenario(scenario, target);
      setStep(r.step);
      const focus = SCENARIOS[scenario].focus(target);
      if (focus) onSelect(focus);
    });

  const switchTo = (name: ScenarioName) => {
    if (name === scenario) return;
    setScenario(name);
    setStep(0);
  };

  const reset = () =>
    act(async () => {
      await api.reset();
      setStep(0);
      onSelect(null);
    });

  const next = Math.min(step + 1, STEPS.length);

  return (
    <section className="px-1">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex rounded-md bg-slate-100 p-0.5 text-xs font-medium">
          {(Object.keys(SCENARIOS) as ScenarioName[]).map((name) => (
            <button
              key={name}
              disabled={busy}
              onClick={() => switchTo(name)}
              className={`rounded px-2 py-1 ${scenario === name ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {SCENARIOS[name].label}
            </button>
          ))}
        </div>
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
