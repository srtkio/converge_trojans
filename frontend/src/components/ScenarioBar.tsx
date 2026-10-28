"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Incident } from "@/lib/types";

import type { Act } from "./Dashboard";

// Mirrors backend/app/sim.py GOLDEN and ROOTCAUSE so the stepper can preview the next step.
const GOLDEN_STEPS = [
  "Reset; seed crews (2 roads, 1 water, 1 electrical)",
  "Report A: water leak on GT Road by Rishihood University → new incident, assigned to water crew",
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
  "Report A: water bubbling up at Murthal Chowk → leak incident, water crew assigned",
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
        <div className="mr-1 flex rounded-lg bg-surface-2 p-0.5 text-xs font-medium ring-1 ring-line">
          {(Object.keys(SCENARIOS) as ScenarioName[]).map((name) => (
            <button
              key={name}
              disabled={busy}
              onClick={() => switchTo(name)}
              className={`rounded-md px-2.5 py-1 transition ${scenario === name ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"}`}
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
                className={`h-7 w-7 rounded-md text-xs font-medium tabular-nums ring-1 transition disabled:opacity-50 ${
                  n === step
                    ? "bg-accent text-white ring-accent"
                    : done
                      ? "bg-accent/15 text-[#a9c1ff] ring-accent/30"
                      : "bg-surface text-muted ring-line hover:bg-surface-2 hover:text-foreground"
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
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(91,140,255,0.9)] hover:bg-[#6f9bff] disabled:opacity-40"
        >
          Next step →
        </button>
        <button
          disabled={busy}
          onClick={() => runTo(STEPS.length)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-line-strong hover:bg-surface-2 disabled:opacity-40"
        >
          Run all
        </button>
        <button
          disabled={busy}
          onClick={reset}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-line-strong hover:bg-surface-2 disabled:opacity-40"
        >
          Reset
        </button>

        <span className="mx-1 hidden h-6 w-px bg-line-strong sm:block" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Clock</span>
        {[1, 12, 48].map((h) => (
          <button
            key={h}
            disabled={busy}
            onClick={() => act(() => api.tick(h * 60))}
            className="rounded-lg px-2 py-1.5 font-mono text-xs text-foreground ring-1 ring-line-strong hover:bg-surface-2 disabled:opacity-40"
          >
            +{h}h
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-sm text-[#c3c9d8]">
        {step > 0 ? (
          <>
            <span className="font-medium text-foreground">Step {step}:</span> {STEPS[step - 1]}
            {step < STEPS.length && <span className="text-muted"> · next: {STEPS[step]}</span>}
          </>
        ) : incidents.length ? (
          "Live mode: file reports and act on incidents directly, or press Reset to start the demo."
        ) : (
          <>
            <span className="text-muted">Press </span>Next step
            <span className="text-muted"> to walk through the demo, or file a report yourself.</span>
          </>
        )}
      </p>
    </section>
  );
}
