"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, photoSrc } from "@/lib/api";
import { CATEGORY_LABEL, STATUS_LABEL, formatTime } from "@/lib/format";
import type { CitizenActivity } from "@/lib/types";

const POLL_MS = 4000;
const SEEN_KEY = "converge.inbox.seen";

// Ids the operator has already read in this tab. Null means this is the first visit.
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
    // Storage blocked: the inbox still works, it just forgets what was read on reload.
  }
}

function citizenName(raw: string): string {
  const name = raw.replace(/^citizen:/, "");
  return name && name !== "web" && name !== "dashboard" ? name : "Anonymous citizen";
}

function label(item: CitizenActivity): string {
  if (item.kind === "complaint") {
    return `New complaint${item.category ? ` (${CATEGORY_LABEL[item.category]})` : ""}`;
  }
  if (item.supports === true) return "Evidence: says it is fixed";
  if (item.supports === false) return "Evidence: says it is still broken";
  return "Evidence";
}

// Operator inbox: every citizen complaint and every citizen follow-up, newest first.
export function CitizenInbox({
  onUnreadChange,
  onOpenIncident,
  onNewItems,
}: {
  onUnreadChange?: (count: number) => void;
  onOpenIncident?: (id: string) => void;
  /** Items that arrived after the inbox first loaded (for live toasts). */
  onNewItems?: (items: CitizenActivity[]) => void;
} = {}) {
  const [items, setItems] = useState<CitizenActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string> | null>(null);
  // Ids already announced as toasts; null until the first load, so old items stay quiet.
  const announcedRef = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNewItems);
  useEffect(() => {
    onNewRef.current = onNewItems;
  }, [onNewItems]);

  const load = useCallback(async () => {
    try {
      const next = await api.citizenActivity();
      setItems(next);
      setError(null);
      if (announcedRef.current === null) {
        announcedRef.current = new Set(next.map((i) => i.id));
      } else {
        const announced = announcedRef.current;
        const fresh = next.filter((i) => !announced.has(i.id));
        for (const i of fresh) announced.add(i.id);
        if (fresh.length) onNewRef.current?.(fresh);
      }
      if (seenRef.current === null) {
        seenRef.current = readSeen() ?? new Set(next.map((i) => i.id));
        writeSeen(seenRef.current);
      }
      const seen = seenRef.current;
      setFresh((prev) => {
        const kept = new Set([...prev].filter((id) => next.some((i) => i.id === id)));
        for (const i of next) if (!seen.has(i.id)) kept.add(i.id);
        return kept;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    }
  }, []);

  useEffect(() => {
    // Initial load and polling: items are fetched from the API, then state is set when they arrive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    onUnreadChange?.(fresh.size);
  }, [fresh, onUnreadChange]);

  const markAllRead = () => {
    if (!items) return;
    seenRef.current = new Set(items.map((i) => i.id));
    writeSeen(seenRef.current);
    setFresh(new Set());
  };

  return (
    <section aria-labelledby="inbox-heading" className="rounded-2xl bg-white ring-1 ring-slate-900/5 px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <h2 id="inbox-heading" className="text-sm font-semibold text-slate-900">
          Citizen activity{fresh.size > 0 ? ` · ${fresh.size} new` : ""}
        </h2>
        {fresh.size > 0 && (
          <button type="button" onClick={markAllRead} className="text-xs text-slate-600 underline">
            Mark as read
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-rose-700">Could not load citizen activity: {error}</p>}

      {items === null && !error && <p className="mt-1 text-xs text-slate-500">Loading…</p>}
      {items !== null && items.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">No citizen complaints or evidence yet.</p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-2 max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className={`py-2 ${fresh.has(item.id) ? "bg-amber-50" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                {fresh.has(item.id) && (
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-900">New</span>
                )}
                <span>{formatTime(item.at)} UTC</span>
                <span>·</span>
                <span className="font-medium text-slate-700">{citizenName(item.citizen)}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-900">
                <span className="font-medium">{label(item)}:</span>{" "}
                <span className="text-slate-700">{item.text || "(no note)"}</span>
              </p>
              {(item.photo_url || item.location_label || item.location_source === "gps") && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                  {item.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoSrc(item.photo_url)} alt="Photo from the citizen" className="h-12 w-16 rounded-md object-cover ring-1 ring-slate-200" />
                  )}
                  {item.location_source === "gps" && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">GPS</span>}
                  {item.location_label && <span>📍 {item.location_label}</span>}
                </div>
              )}
              {item.incident_id && (
                <a
                  href={`/operator?incident=${item.incident_id}`}
                  onClick={(e) => {
                    if (!onOpenIncident) return;
                    e.preventDefault();
                    onOpenIncident(item.incident_id!);
                  }}
                  className="text-xs text-blue-700 underline"
                >
                  {item.incident_title ?? item.incident_id}
                  {item.incident_status ? ` · ${STATUS_LABEL[item.incident_status]}` : ""}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
