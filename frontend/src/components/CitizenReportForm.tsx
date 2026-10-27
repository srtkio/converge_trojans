"use client";

import { useState } from "react";

import { api } from "@/lib/api";
import { WAKING_HINT, guessCategory, useSlowHint } from "@/lib/citizen";
import { CATEGORY_ICON, CATEGORY_LABEL } from "@/lib/format";
import type { Category, Incident, Link } from "@/lib/types";

import { BIG_BUTTON } from "@/lib/citizenStyles";

// Landmarks inside the pilot area (about 1 km around MG Road metro, Bengaluru). The points sit
// close to the demo incidents, so a matching report joins the existing case instead of opening a
// new one.
const PLACES = [
  { name: "MG Road metro exit", lat: 12.9756, lng: 77.6058 },
  { name: "MG Road at Brigade Road junction", lat: 12.9738, lng: 77.607 },
  { name: "Church Street", lat: 12.9754, lng: 77.6038 },
  { name: "Brigade Road", lat: 12.972, lng: 77.6075 },
  { name: "Residency Road", lat: 12.9698, lng: 77.6042 },
  { name: "St Marks Road", lat: 12.9728, lng: 77.601 },
  { name: "Kasturba Road, near Cubbon Park", lat: 12.9745, lng: 77.5985 },
];

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export type ReportOutcome = { incident: Incident; link: Link | null };

export function CitizenReportForm({
  reporter,
  onReported,
}: {
  reporter: string;
  onReported: (outcome: ReportOutcome) => void;
}) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Category | null>(null);
  const [place, setPlace] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slow = useSlowHint(busy);

  const suggested = guessCategory(text);
  const shown = picked ?? suggested;
  const canSubmit = text.trim().length > 0 && !busy;

  const hint = picked
    ? "Thanks. Tap another type if you change your mind."
    : suggested
      ? `We guessed "${CATEGORY_LABEL[suggested]}" from your description. Tap another if it's wrong.`
      : "Pick the closest match, or just describe it above.";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const p = PLACES[place];
    setBusy(true);
    setError(null);
    try {
      const r = await api.report({ text: text.trim(), category: shown ?? "other", lat: p.lat, lng: p.lng, reporter });
      setText("");
      setPicked(null);
      onReported({ incident: r.incident, link: r.link });
    } catch {
      setError("We couldn't send your report. Check your connection and try again. Your text is still here.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-slate-800">{"What's wrong?"}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          enterKeyHint="next"
          placeholder="e.g. Water leaking from a pipe near the metro"
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Type of problem</legend>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const on = c === shown;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(c)}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 motion-safe:active:scale-95 ${
                  on ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-400"
                }`}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {CATEGORY_ICON[c]}
                </span>
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-slate-800">Where is it?</span>
        <select
          value={place}
          onChange={(e) => setPlace(Number(e.target.value))}
          className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          {PLACES.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-500">This pilot covers the streets around MG Road, Bengaluru.</span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className={`${BIG_BUTTON} bg-slate-900 text-white shadow-[0_12px_26px_-16px_rgba(15,23,42,0.9)] hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100 disabled:shadow-none disabled:ring-1 disabled:ring-slate-200`}
      >
        {busy ? "Sending…" : "Submit report"}
      </button>

      {slow && (
        <p role="status" className="text-center text-sm text-slate-600">
          {WAKING_HINT}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
          {error}
        </p>
      )}
    </form>
  );
}
