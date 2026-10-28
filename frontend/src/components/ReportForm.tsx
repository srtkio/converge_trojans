"use client";

import { PhoneCall } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, Link } from "@/lib/types";

import type { Act } from "./Dashboard";
import { CARD, CardHeader, FIELD } from "./OpUi";

// Preset spots around the demo area (GT Road by Rishihood University, Sonipat) so reports land near
// existing incidents: the first two are ~60 m apart (duplicate), the third ~250 m away (related).
const PLACES = [
  { name: "Rishihood University gate, GT Road", lat: 28.9832, lng: 77.0864 },
  { name: "GT Road, 60 m north of the gate", lat: 28.98374, lng: 77.0864 },
  { name: "GT Road, 250 m south of the gate", lat: 28.98095, lng: 77.0864 },
  { name: "Murthal Chowk", lat: 29.0265, lng: 77.0737 },
  { name: "Sonipat Junction (far away)", lat: 28.9898, lng: 77.0171 },
];

/** Operators log complaints that came in by phone or at the counter. */
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
    <section className={`${CARD} overflow-hidden`}>
      <CardHeader icon={PhoneCall} title="Log a phone-in complaint" subtitle="Calls and counter visits go through the same dedup and routing" />
      <form onSubmit={submit} className="space-y-3 p-4">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          What was reported
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="e.g. Water leaking from a pipe near the university gate"
            className={`${FIELD} mt-1.5 resize-none py-2 normal-case tracking-normal`}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={`${FIELD} mt-1.5 h-9 normal-case tracking-normal`}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Location
            <select value={place} onChange={(e) => setPlace(Number(e.target.value))} className={`${FIELD} mt-1.5 h-9 normal-case tracking-normal`}>
              {PLACES.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="h-10 w-full rounded-lg bg-accent text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(91,140,255,0.9)] transition hover:bg-[#6f9bff] disabled:opacity-40"
        >
          Submit report
        </button>
        {result && (
          <p className="rounded-lg bg-surface-2 p-2.5 text-xs text-[#c3c9d8] ring-1 ring-line">
            {result.link ? (
              <>
                Linked as <span className="font-semibold text-violet-300">{result.link.kind}</span> of {result.link.incident_id}: {result.link.reason}
              </>
            ) : (
              <>
                New incident <span className="font-semibold text-foreground">{result.incidentId}</span> created and routed.
              </>
            )}
          </p>
        )}
      </form>
    </section>
  );
}
