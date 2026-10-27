"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Link } from "@/lib/types";

import type { Act } from "./Dashboard";

// Preset spots around the demo area (MG Road, Bengaluru) so reports land near existing incidents.
const PLACES = [
  { name: "MG Road metro exit", lat: 12.9756, lng: 77.605 },
  { name: "MG Road, 60 m east of metro", lat: 12.9756, lng: 77.60555 },
  { name: "MG Road, 250 m south", lat: 12.97335, lng: 77.605 },
  { name: "Brigade Road junction", lat: 12.9719, lng: 77.6071 },
  { name: "Cubbon Park gate (1 km away)", lat: 12.9763, lng: 77.5929 },
];

export function ReportForm({ busy, act, onCreated }: { busy: boolean; act: Act; onCreated: (id: string) => void }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("water_leak");
  const [place, setPlace] = useState(0);
  const [result, setResult] = useState<{ incidentId: string; link: Link | null } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const p = PLACES[place];
    void act(async () => {
      const r = await api.report({ text: text.trim(), category, lat: p.lat, lng: p.lng, reporter: "citizen:dashboard" });
      setResult({ incidentId: r.incident.id, link: r.link });
      setText("");
      onCreated(r.incident.id);
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold">File a citizen report</h2>
      <form onSubmit={submit} className="mt-2 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="e.g. Water leaking from a pipe near the metro"
          className="w-full resize-none rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={place}
            onChange={(e) => setPlace(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {PLACES.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={busy || !text.trim()}
          className="w-full rounded-md bg-slate-900 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Submit report
        </button>
      </form>
      {result && (
        <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
          {result.link ? (
            <>
              Linked as <span className="font-semibold text-violet-700">{result.link.kind}</span> of {result.link.incident_id}
              : {result.link.reason}
            </>
          ) : (
            <>
              New incident <span className="font-semibold">{result.incidentId}</span> created and routed.
            </>
          )}
        </p>
      )}
    </section>
  );
}
