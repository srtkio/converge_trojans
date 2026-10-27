"use client";

import { useEffect, useRef, useState } from "react";

import { PinIcon } from "@/components/CitizenIcons";
import { PhotoPicker, usePhotoField } from "@/components/PhotoPicker";
import { api, type ReportLocation } from "@/lib/api";
import {
  CITIZEN_STATUS_LABEL,
  WAKING_HINT,
  distanceM,
  fixTimeText,
  formatMetres,
  guessCategory,
  joinable,
  readDraft,
  saveDraft,
  useSlowHint,
} from "@/lib/citizen";
import { BIG_BUTTON } from "@/lib/citizenStyles";
import { CATEGORY_ICON, CATEGORY_LABEL } from "@/lib/format";
import { outsidePilot, useDeviceLocation } from "@/lib/location";
import { photoRejected } from "@/lib/photo";
import type { Category, Incident, Link } from "@/lib/types";

// Landmarks inside the pilot area (the Murthal–Sonipat corridor, Haryana; coordinates from
// OpenStreetMap). The first points sit close to the demo incidents on GT Road, so a matching
// report joins the existing case instead of opening a new one.
const PLACES = [
  { name: "Rishihood University gate, GT Road (NH-44)", lat: 28.9832, lng: 77.0864 },
  { name: "GT Road, 250 m south of Rishihood University", lat: 28.98095, lng: 77.0864 },
  { name: "Bahalgarh Chowk", lat: 28.9587, lng: 77.0951 },
  { name: "Murthal Chowk", lat: 29.0265, lng: 77.0737 },
  { name: "Murthal dhaba strip, GT Road", lat: 29.0396, lng: 77.0895 },
  { name: "Sector 15, Sonipat", lat: 29.0002, lng: 77.0395 },
  { name: "Civil Hospital, Sonipat", lat: 28.9906, lng: 77.0363 },
  { name: "Sonipat Bus Stand", lat: 28.9974, lng: 77.0234 },
  { name: "Sonipat Junction (railway station)", lat: 28.9898, lng: 77.0171 },
];

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const MAX_TEXT = 500;
// Open cases within this distance of the report's location are offered as "Me too".
const NEARBY_M = 300;
const ME_TOO_TEXT = "Me too: I see the same problem here.";
// A phone fix rougher than this gets a hint to describe the spot in words.
const ROUGH_FIX_M = 250;
const OUTSIDE_PILOT =
  "You're outside this pilot's area (Murthal–Sonipat, Haryana). We'll still log your report at your real location.";

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
  // Open cases anywhere; the ones near the active location are offered as "Me too" below.
  const [openCases, setOpenCases] = useState<Incident[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const placeRef = useRef<HTMLSelectElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  // Whether the location button had keyboard focus when tapped (it is replaced on success).
  const refocus = useRef(false);
  const slow = useSlowHint(busy);
  const { location: gps, locate, stop: stopGps } = useDeviceLocation();
  const locating = gps.state === "locating";
  const slowGps = useSlowHint(locating, 5000);
  const photo = usePhotoField();

  useEffect(() => {
    if (focusOnMount) textRef.current?.focus();
  }, [focusOnMount]);

  useEffect(() => {
    // The location button gives way to the confirmation: keep keyboard focus in this area.
    if (gps.state === "locating") return; // still waiting for the phone
    if (gps.state === "on" && refocus.current) switchRef.current?.focus({ preventScroll: true });
    refocus.current = false;
  }, [gps.state]);

  useEffect(() => {
    // Bring back a half-written report from this device (closed tab, reload, signal drop).
    const draft = readDraft();
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText((current) => current || draft);
      setRestored(true);
    }
  }, []);

  // The active location: the phone's position while it's in use, otherwise the chosen landmark.
  const here = PLACES[place];
  const lat = gps.state === "on" ? gps.lat : here.lat;
  const lng = gps.state === "on" ? gps.lng : here.lng;

  useEffect(() => {
    // Open cases people can join instead of filing a duplicate; refreshed when the location changes.
    let cancelled = false;
    api
      .incidents()
      .then((all) => {
        if (!cancelled) setOpenCases(all.filter(joinable));
      })
      .catch(() => {
        // The list is a helper; the form works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const suggested = guessCategory(text);
  const shown = picked ?? suggested;
  // Wait for a location request in progress, so the report never goes out with the wrong spot.
  const canSubmit = text.trim().length > 0 && !busy && !photo.preparing && !locating;
  // Cases around the active location (GPS or landmark). Once the type is known, only cases of that
  // type (so "Me too" never files a streetlight under a pothole); nearest first.
  const suggestions = openCases
    .filter((incident) => !shown || incident.category === shown)
    .map((incident) => ({ incident, d: distanceM(lat, lng, incident.lat, incident.lng) }))
    .filter(({ d }) => d <= NEARBY_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  const outside = gps.state === "on" && outsidePilot(gps.lat, gps.lng);
  // Read out by screen readers as the location changes (the visible text is above).
  const gpsAnnouncement =
    gps.state === "locating"
      ? "Finding your location…"
      : gps.state === "on"
        ? `Using your current location, accurate to about ${formatMetres(gps.accuracy)}.${outside ? ` ${OUTSIDE_PILOT}` : ""}`
        : gps.state === "failed"
          ? gps.message
          : "";

  const hint = picked
    ? "Thanks. Tap another type if you change your mind."
    : suggested
      ? `We guessed "${CATEGORY_LABEL[suggested]}" from your description. Tap another if it's wrong.`
      : "Pick the closest match, or just describe it above.";

  const send = async (body: { text: string; category: Category; lat: number; lng: number; location: ReportLocation }) => {
    setBusy(true);
    setError(null);
    const upload = photo.upload;
    try {
      const r = await api.report({ ...body, reporter, photo: upload });
      setText("");
      setPicked(null);
      saveDraft("");
      photo.clear();
      onReported({ incident: r.incident, link: r.link });
    } catch (e) {
      setError(
        upload && photoRejected(e)
          ? "We couldn't send your photo. Remove it or try another one, then send again. Your text is still here."
          : "We couldn't send your report. Check your connection and try again. Your text is still here.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const location: ReportLocation =
      gps.state === "on"
        ? { source: "gps", accuracy_m: Math.round(gps.accuracy), label: "Current location" }
        : { source: "landmark", accuracy_m: null, label: here.name };
    void send({ text: text.trim(), category: shown ?? "other", lat, lng, location });
  };

  // Join an existing case: same type and spot, so the backend links it as a duplicate report.
  const meToo = (inc: Incident) =>
    void send({
      text: text.trim() || ME_TOO_TEXT,
      category: inc.category,
      lat: inc.lat,
      lng: inc.lng,
      location: { source: "landmark", accuracy_m: null, label: `Same spot as case ${inc.id}` },
    });

  const askForLocation = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (locating) return; // aria-disabled: the button keeps focus while the phone looks
    refocus.current = document.activeElement === e.currentTarget;
    locate();
  };

  const pickPlace = (i: number) => {
    setPlace(i);
    // Picking a place wins over a location request still running (or one that failed).
    if (locating || gps.state === "failed") stopGps();
  };

  const backToList = () => {
    stopGps();
    requestAnimationFrame(() => placeRef.current?.focus());
  };

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
          placeholder="e.g. Water leaking from a pipe near the university gate"
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

      <PhotoPicker field={photo} disabled={busy} />

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium text-slate-800">Where is it?</legend>
        {gps.state === "on" ? (
          <div className="cz-rise mt-1.5 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
            <p className="flex items-start gap-2 text-sm text-emerald-950">
              <PinIcon className="mt-0.5 h-4 w-4 text-emerald-700" />
              <span className="min-w-0">
                Using your current location, accurate to about {formatMetres(gps.accuracy)}
              </span>
            </p>
            {gps.accuracy > ROUGH_FIX_M && (
              <p className="mt-1 pl-6 text-xs text-emerald-900">
                {"That's a rough fix. Mention a nearby landmark in your description so the crew can find it."}
              </p>
            )}
            <button
              ref={switchRef}
              type="button"
              onClick={backToList}
              disabled={busy}
              className="mt-2 ml-6 rounded-md text-sm font-medium text-emerald-800 underline underline-offset-4 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50"
            >
              Pick a place from the list instead
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={askForLocation}
              disabled={busy}
              aria-disabled={locating || undefined}
              className="mt-1.5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-base font-medium text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-60 aria-disabled:cursor-default aria-disabled:text-slate-600 aria-disabled:hover:bg-white motion-safe:active:scale-[0.98] motion-safe:aria-disabled:active:scale-100"
            >
              <PinIcon className={`h-5 w-5 text-emerald-700 ${locating ? "motion-safe:animate-pulse" : ""}`} />
              {locating ? "Finding your location…" : "Use my current location"}
            </button>
            {locating && slowGps && (
              <p className="mt-1.5 text-center text-xs text-slate-500">
                Still looking. This can take a few seconds, especially indoors.
              </p>
            )}
            {gps.state === "failed" && (
              <p className="cz-rise mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
                {gps.message}
              </p>
            )}
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-600">
                {gps.state === "failed" ? "Nearby place" : "Or pick a nearby place"}
              </span>
              <select
                ref={placeRef}
                value={place}
                onChange={(e) => pickPlace(Number(e.target.value))}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {PLACES.map((p, i) => (
                  <option key={p.name} value={i}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">This pilot covers the Murthal–Sonipat corridor, Haryana.</span>
            </label>
          </>
        )}
        {outside && (
          <p className="cz-rise mt-2 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-950 ring-1 ring-sky-200">
            <span aria-hidden="true">ℹ️</span>
            <span className="min-w-0">{OUTSIDE_PILOT}</span>
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {gpsAnnouncement}
        </p>
      </fieldset>

      {suggestions.length > 0 && (
        <section aria-labelledby="nearby-heading" className="cz-rise rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-200">
          <h2 id="nearby-heading" className="text-sm font-semibold text-slate-900">
            Already reported nearby
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {photo.photo
              ? "Is it one of these? Tap “Me too” to add your voice (and your photo) instead of opening a new case."
              : "Is it one of these? Tap “Me too” to add your voice instead of opening a new case."}
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
                  disabled={busy || photo.preparing}
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
