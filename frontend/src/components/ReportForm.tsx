"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Link } from "@/lib/types";

import type { Act } from "./Dashboard";

// Preset spots around the demo area (GT Road by Rishihood University, Sonipat) so reports land near
// existing incidents: the first two are ~60 m apart (duplicate), the third ~250 m away (related).
const PLACES = [
  { name: "Rishihood University gate, GT Road", lat: 28.9832, lng: 77.0864 },
  { name: "GT Road, 60 m north of the gate", lat: 28.98374, lng: 77.0864 },
  { name: "GT Road, 250 m south of the gate", lat: 28.98095, lng: 77.0864 },
  { name: "Murthal Chowk", lat: 29.0265, lng: 77.0737 },
  { name: "Sonipat Junction (far away)", lat: 28.9898, lng: 77.0171 },
];

export function ReportForm({
  busy,
  act,
  onCreated,
  reporter = "citizen:dashboard",
}: {
  busy: boolean;
  act: Act;
  onCreated: (id: string) => void;
  reporter?: string;
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("water_leak");
  const [place, setPlace] = useState(0);
  const [result, setResult] = useState<{ incidentId: string; link: Link | null } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const p = PLACES[place];
    void act(async () => {
      const r = await api.report({ text: text.trim(), category, lat: p.lat, lng: p.lng, reporter });
      setResult({ incidentId: r.incident.id, link: r.link });
      setText("");
      onCreated(r.incident.id);
    });
  };

  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-900/5 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <h2 className="text-sm font-semibold">File a citizen report</h2>
      <form onSubmit={submit} className="mt-2 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="e.g. Water leaking from a pipe near the university gate"
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
