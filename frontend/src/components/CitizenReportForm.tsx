"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import {
  CITIZEN_STATUS_LABEL,
  WAKING_HINT,
  distanceM,
  fixTimeText,
  guessCategory,
  joinable,
  readDraft,
  saveDraft,
  useSlowHint,
} from "@/lib/citizen";
import { BIG_BUTTON } from "@/lib/citizenStyles";
import { CATEGORY_ICON, CATEGORY_LABEL } from "@/lib/format";
import type { Category, Incident, Link } from "@/lib/types";

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
const MAX_TEXT = 500;
// Open cases within this distance of the chosen landmark are offered as "Me too".
const NEARBY_M = 300;
const ME_TOO_TEXT = "Me too: I see the same problem here.";

export type ReportOutcome = { incident: Incident; link: Link | null };

export function CitizenReportForm({
  reporter,
  onReported,
  focusOnMount = false,
}: {
  reporter: string;
  onReported: (outcome: ReportOutcome) => void;
  focusOnMount?: boolean;
}) {
  const [text, setText] = useState("");
  const [restored, setRestored] = useState(false);
  const [picked, setPicked] = useState<Category | null>(null);
  const [place, setPlace] = useState(0);
  const [nearby, setNearby] = useState<Incident[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const slow = useSlowHint(busy);

  useEffect(() => {
    if (focusOnMount) textRef.current?.focus();
  }, [focusOnMount]);

  useEffect(() => {
    // Bring back a half-written report from this device (closed tab, reload, signal drop).
    const draft = readDraft();
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText((current) => current || draft);
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    // Open cases around the chosen landmark, so people can join one instead of filing a duplicate.
    let cancelled = false;
    const p = PLACES[place];
    api
      .incidents()
      .then((all) => {
        if (cancelled) return;
        setNearby(all.filter((i) => joinable(i) && distanceM(p.lat, p.lng, i.lat, i.lng) <= NEARBY_M));
      })
      .catch(() => {
        // The list is a helper; the form works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [place]);

  const suggested = guessCategory(text);
  const shown = picked ?? suggested;
  const canSubmit = text.trim().length > 0 && !busy;
  const here = PLACES[place];
  // Once the type is known, only offer cases of that type (so "Me too" never files a streetlight
  // under a pothole); nearest first.
  const suggestions = nearby
    .filter((incident) => !shown || incident.category === shown)
    .map((incident) => ({ incident, d: distanceM(here.lat, here.lng, incident.lat, incident.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  const hint = picked
    ? "Thanks. Tap another type if you change your mind."
    : suggested
      ? `We guessed "${CATEGORY_LABEL[suggested]}" from your description. Tap another if it's wrong.`
      : "Pick the closest match, or just describe it above.";

  const send = async (body: { text: string; category: Category; lat: number; lng: number }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.report({ ...body, reporter });
      setText("");
      setPicked(null);
      saveDraft("");
      onReported({ incident: r.incident, link: r.link });
    } catch {
      setError("We couldn't send your report. Check your connection and try again. Your text is still here.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void send({ text: text.trim(), category: shown ?? "other", lat: here.lat, lng: here.lng });
  };

  // Join an existing case: same type and spot, so the backend links it as a duplicate report.
  const meToo = (inc: Incident) =>
    void send({ text: text.trim() || ME_TOO_TEXT, category: inc.category, lat: inc.lat, lng: inc.lng });

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-slate-800">{"What's wrong?"}</span>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            saveDraft(e.target.value);
          }}
          rows={3}
          maxLength={MAX_TEXT}
          enterKeyHint="next"
          placeholder="e.g. Water leaking from a pipe near the metro"
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        {restored && text && (
          <span className="mt-1 block text-xs text-slate-500">We kept your unfinished report.</span>
        )}
        {text.length > MAX_TEXT - 100 && (
          <span className="mt-1 block text-right text-xs text-slate-500" aria-live="polite">
            {MAX_TEXT - text.length} characters left
          </span>
        )}
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
        {shown && (
          <p key={shown} className="cz-rise mt-2 text-xs font-medium text-emerald-800">
            <span aria-hidden="true">⏱ </span>
            {CATEGORY_LABEL[shown]}: {fixTimeText(shown).toLowerCase()}
          </p>
        )}
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

      {suggestions.length > 0 && (
        <section aria-labelledby="nearby-heading" className="cz-rise rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-200">
          <h2 id="nearby-heading" className="text-sm font-semibold text-slate-900">
            Already reported nearby
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {"Is it one of these? Tap “Me too” to add your voice instead of opening a new case."}
          </p>
          <ul className="mt-2 space-y-2">
            {suggestions.map(({ incident, d }) => (
              <li key={incident.id} className="flex items-center gap-3 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                <span aria-hidden="true" className="text-xl">
                  {CATEGORY_ICON[incident.category]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{incident.title}</span>
                  <span className="block text-xs text-slate-500">
                    {CITIZEN_STATUS_LABEL[incident.status]} · {incident.report_ids.length}{" "}
                    {incident.report_ids.length === 1 ? "report" : "reports"} · {Math.max(10, Math.round(d / 10) * 10)} m away
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => meToo(incident)}
                  aria-label={`Me too: ${incident.title}`}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-50 motion-safe:active:scale-95"
                >
                  Me too
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
