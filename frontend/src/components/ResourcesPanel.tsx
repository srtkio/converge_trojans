"use client";

import { Power, Truck } from "lucide-react";

import { api } from "@/lib/api";
import type { Resource } from "@/lib/types";

import type { Act } from "./Dashboard";
import { CARD, CardHeader, Pill } from "./OpUi";

export function ResourcesPanel({
  resources,
  busy,
  act,
  onOpen,
}: {
  resources: Resource[];
  busy: boolean;
  act: Act;
  onOpen?: (id: string) => void;
}) {
  const onDuty = resources.filter((r) => r.available).length;
  return (
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader
        icon={Truck}
        title="Field crews"
        subtitle="Take a crew offline to see automatic replanning"
        right={<Pill className="bg-ok/10 text-ok ring-ok/25">{onDuty}/{resources.length} on duty</Pill>}
      />
      <ul className="divide-y divide-line">
        {resources.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 ring-1 ring-line">
              <Truck className={`h-4 w-4 ${r.available ? "text-accent-2" : "text-muted"}`} aria-hidden />
              <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${r.available ? "bg-ok" : "bg-bad"}`} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-foreground">{r.name}</span>
                <span className="rounded bg-surface-2 px-1.5 py-px text-[10px] capitalize text-muted ring-1 ring-line">{r.department}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                {r.active_incident_ids.length ? (
                  <>
                    <span>{r.active_incident_ids.length} active:</span>
                    {r.active_incident_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpen?.(id)}
                        className="rounded bg-surface-2 px-1 font-mono text-[10px] text-[#c3c9d8] ring-1 ring-line hover:ring-accent/60"
                      >
                        {id}
                      </button>
                    ))}
                  </>
                ) : (
                  <span>{r.available ? "Idle, ready for dispatch" : "Off duty"}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => api.setAvailable(r.id, !r.available))}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 transition disabled:opacity-40 ${
                r.available ? "text-bad ring-bad/30 hover:bg-bad/10" : "text-ok ring-ok/30 hover:bg-ok/10"
              }`}
            >
              <Power className="h-3.5 w-3.5" aria-hidden />
              {r.available ? "Take offline" : "Bring back"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
