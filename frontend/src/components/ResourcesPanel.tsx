"use client";

import { api } from "@/lib/api";
import type { Resource } from "@/lib/types";

import type { Act } from "./Dashboard";

export function ResourcesPanel({ resources, busy, act }: { resources: Resource[]; busy: boolean; act: Act }) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold">Crews</h2>
        <p className="text-xs text-slate-500">Take a crew offline to see automatic replanning.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {resources.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.available ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="truncate font-medium">{r.name}</span>
              </div>
              <div className="text-xs text-slate-500">
                {r.department} · {r.active_incident_ids.length ? r.active_incident_ids.join(", ") : "idle"}
              </div>
            </div>
            <button
              disabled={busy}
              onClick={() => act(() => api.setAvailable(r.id, !r.available))}
              className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ring-1 disabled:opacity-40 ${
                r.available ? "text-red-700 ring-red-200 hover:bg-red-50" : "text-emerald-700 ring-emerald-200 hover:bg-emerald-50"
              }`}
            >
              {r.available ? "Take offline" : "Bring back"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
