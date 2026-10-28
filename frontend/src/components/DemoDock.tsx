"use client";

import { PlayCircle, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const KEY = "converge.demoDock.open";

/**
 * Demo controls live in a floating dock at the bottom of the screen, out of the operator's way.
 * Open/closed is remembered per browser (a convenience only).
 */
export function DemoDock({ children, simClock }: { children: ReactNode; simClock: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // Restoring a per-browser preference needs storage, so it runs after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(KEY) === "1") setOpen(true);
    } catch {
      // Storage blocked: start closed.
    }
  }, []);

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the dock still works for this visit.
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-end px-4 sm:justify-center">
      {open ? (
        <div className="pointer-events-auto max-h-[75vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.5)] ring-1 ring-slate-900/10 backdrop-blur motion-safe:animate-[dockIn_.3s_cubic-bezier(.2,.8,.2,1)]">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <PlayCircle className="h-4 w-4 text-emerald-600" aria-hidden /> Demo controls
              {simClock && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] normal-case tracking-normal text-slate-600">sim clock {simClock}</span>}
            </span>
            <button type="button" onClick={() => toggle(false)} aria-label="Hide demo controls" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-slate-900 text-sm font-medium text-white shadow-lg transition hover:bg-slate-800 motion-safe:hover:-translate-y-0.5 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5"
        >
          <PlayCircle className="h-5 w-5 text-emerald-400 sm:h-4 sm:w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Demo controls</span>
        </button>
      )}
    </div>
  );
}
