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
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 lg:left-64">
      {open ? (
        <div className="op-pop-in pointer-events-auto w-full max-w-5xl rounded-2xl border border-line-strong bg-[#0b1120]/95 p-3 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <PlayCircle className="h-4 w-4 text-accent-2" aria-hidden /> Demo controls
              {simClock && (
                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] normal-case tracking-normal text-[#c3c9d8] ring-1 ring-line">sim clock {simClock}</span>
              )}
            </span>
            <button type="button" onClick={() => toggle(false)} aria-label="Hide demo panel" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-line-strong bg-[#0b1120]/95 px-4 py-2.5 text-sm font-medium text-foreground shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur transition hover:border-accent/50 motion-safe:hover:-translate-y-0.5"
        >
          <PlayCircle className="h-4 w-4 text-accent-2" aria-hidden /> Demo controls
        </button>
      )}
    </div>
  );
}
