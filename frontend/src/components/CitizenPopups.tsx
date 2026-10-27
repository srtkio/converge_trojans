"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { CATEGORY_LABEL } from "@/lib/format";
import type { CitizenActivity } from "@/lib/types";

const POLL_MS = 4000;
const TOAST_MS = 10000;
const MAX_TOASTS = 3;
const SEEN_KEY = "converge.popup.seen";

// Ids already announced in this tab. Null means this is the first visit: existing items are not announced.
function readSeen(): Set<string> | null {
  try {
    const raw = window.sessionStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeSeen(ids: Set<string>): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage blocked: the operator may see a repeat popup after a reload. Not critical.
  }
}

function citizenName(raw: string): string {
  const name = raw.replace(/^citizen:/, "");
  return name && name !== "web" && name !== "dashboard" ? name : "Anonymous citizen";
}

function headline(item: CitizenActivity): string {
  if (item.kind === "complaint") {
    return `New complaint${item.category ? ` · ${CATEGORY_LABEL[item.category]}` : ""}`;
  }
  if (item.supports === true) return "Evidence: says it is fixed";
  if (item.supports === false) return "Evidence: says it is still broken";
  return "Evidence";
}

// Pop-up alerts for new citizen complaints and evidence, shown on every operator tab.
export function CitizenPopups() {
  const [toasts, setToasts] = useState<CitizenActivity[]>([]);
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const items = await api.citizenActivity(20);
        if (cancelled) return;
        if (seenRef.current === null) {
          seenRef.current = readSeen() ?? new Set(items.map((i) => i.id));
          writeSeen(seenRef.current);
          return;
        }
        const seen = seenRef.current;
        const arrived = items.filter((i) => !seen.has(i.id));
        if (arrived.length === 0) return;
        for (const i of arrived) seen.add(i.id);
        writeSeen(seen);
        setToasts((prev) => [...arrived.slice(0, MAX_TOASTS), ...prev].slice(0, MAX_TOASTS));
        for (const i of arrived.slice(0, MAX_TOASTS)) {
          window.setTimeout(() => {
            if (!cancelled) setToasts((prev) => prev.filter((t) => t.id !== i.id));
          }, TOAST_MS);
        }
      } catch {
        // Offline or backend asleep: try again on the next tick.
      }
    };

    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto rounded-xl bg-white p-3 shadow-lg ring-1 ring-amber-300"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{headline(item)}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
              className="text-slate-400 hover:text-slate-700"
            >
              ×
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-900">
            <span className="font-medium">{citizenName(item.citizen)}:</span>{" "}
            <span className="text-slate-700">{item.text || "(no note)"}</span>
          </p>
          {item.incident_id && (
            <Link href={`/operator?incident=${item.incident_id}`} className="mt-1 block text-xs text-blue-700 underline">
              {item.incident_title ?? item.incident_id}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
