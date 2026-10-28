"use client";

import { useEffect, useRef, useState } from "react";

import { PinIcon } from "@/components/CitizenIcons";
import { PhotoPicker, usePhotoField } from "@/components/PhotoPicker";
import { PinSheet, type PinResult } from "@/components/PinSheet";
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
import { PILOT_CENTRE, PILOT_PLACE, outsidePilot, useDeviceLocation } from "@/lib/location";
import { takePin, type LatLng } from "@/lib/pinHandoff";
import { photoRejected } from "@/lib/photo";
import type { Category, Incident, Link } from "@/lib/types";

// Landmarks inside the pilot area (the Murthal–Sonipat corridor, Haryana; coordinates from
// OpenStreetMap). The first points sit close to the demo incidents on GT Road, so a matching
// report joins the existing case instead of opening a new one.
const PLACES = [
  { name: "Rishihood University gate, GT Road (NH-44)", short: "Rishihood University gate", lat: 28.9832, lng: 77.0864 },
  { name: "GT Road, 250 m south of Rishihood University", short: "GT Road, south of Rishihood", lat: 28.98095, lng: 77.0864 },
  { name: "Bahalgarh Chowk", lat: 28.9587, lng: 77.0951 },
  { name: "Murthal Chowk", lat: 29.0265, lng: 77.0737 },
  { name: "Murthal dhaba strip, GT Road", short: "Murthal dhaba strip", lat: 29.0396, lng: 77.0895 },
  { name: "Sector 15, Sonipat", lat: 29.0002, lng: 77.0395 },
  { name: "Civil Hospital, Sonipat", lat: 28.9906, lng: 77.0363 },
  { name: "Sonipat Bus Stand", lat: 28.9974, lng: 77.0234 },
  { name: "Sonipat Junction (railway station)", short: "Sonipat railway station", lat: 28.9898, lng: 77.0171 },
];

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const MAX_TEXT = 500;
// Open cases within this distance of the report's location are offered as "Me too".
const NEARBY_M = 300;
const ME_TOO_TEXT = "Me too: I see the same problem here.";
// A phone fix rougher than this gets a hint to describe the spot in words.
const ROUGH_FIX_M = 250;
// What a pinned report sends: the backend accepts "pin" as a location source.
const PINNED_LABEL = "Pinned on the map";
const MAP_FAILED = "The map isn't loading. Pick a nearby place instead.";
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
  // A spot the citizen pinned on the map. It wins over GPS and the landmark list until undone.
  const [pinned, setPinned] = useState<LatLng | null>(null);
  const [pinSheet, setPinSheet] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const adjustRef = useRef<HTMLButtonElement>(null);

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
    // "Report something here" on the Map tab hands its pin over. This also runs when the Report
    // screen is shown again, so a pin chosen meanwhile arrives too.
    const handed = takePin();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (handed) setPinned(handed);
  }, []);

  useEffect(() => {
    // Bring back a half-written report from this device (closed tab, reload, signal drop).
    const draft = readDraft();
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText((current) => current || draft);
      setRestored(true);
    }
  }, []);

  // The active location: a pinned spot, else the phone's position while it's in use, else the landmark.
  const here = PLACES[place];
  const lat = pinned ? pinned.lat : gps.state === "on" ? gps.lat : here.lat;
  const lng = pinned ? pinned.lng : gps.state === "on" ? gps.lng : here.lng;

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
  const outside = pinned ? outsidePilot(pinned.lat, pinned.lng) : gps.state === "on" && outsidePilot(gps.lat, gps.lng);
  const pinnedFrom = pinned ? distanceM(PILOT_CENTRE.lat, PILOT_CENTRE.lng, pinned.lat, pinned.lng) : 0;
  // Read out by screen readers as the location changes (the visible text is above).
  const gpsAnnouncement = pinned
    ? `${PINNED_LABEL}, ${formatMetres(pinnedFrom)} from ${PILOT_PLACE}.${outside ? ` ${OUTSIDE_PILOT}` : ""}`
    : gps.state === "locating"
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
      setPinned(null);
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
    const location: ReportLocation = pinned
      ? { source: "pin", accuracy_m: null, label: PINNED_LABEL }
      : gps.state === "on"
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
    setPinned(null);
    setMapFailed(false);
    locate();
  };

  const pickPlace = (i: number) => {
    setPlace(i);
    setPinned(null);
    setMapFailed(false);
    // Picking a place wins over a location request still running (or one that failed).
    if (locating || gps.state === "failed") stopGps();
  };

  const backToList = () => {
    stopGps();
    requestAnimationFrame(() => placeRef.current?.focus());
  };

  const openPinSheet = () => {
    setMapFailed(false);
    setPinSheet(true);
  };

  const pinDone = (r: PinResult) => {
    setPinSheet(false);
    if (r.kind === "picked") {
      setPinned(r.spot);
      if (locating) stopGps();
      requestAnimationFrame(() => adjustRef.current?.focus({ preventScroll: true }));
    } else if (r.kind === "map-failed") {
      setMapFailed(true);
      if (gps.state === "on") stopGps();
      requestAnimationFrame(() => placeRef.current?.focus());
    }
  };

  const undoPin = () => {
    setPinned(null);
    requestAnimationFrame(() => adjustRef.current?.focus({ preventScroll: true }));
  };

  const adjustButton = (
    <button
      ref={adjustRef}
      type="button"
      onClick={openPinSheet}
      disabled={busy}
      className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-60 motion-safe:active:scale-[0.98]"
    >
      <MapGlyph />
      Adjust on the map
    </button>
  );

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
        {pinned ? (
          <div className="cz-rise mt-1.5 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
            <p className="flex items-start gap-2 text-sm text-emerald-950">
              <PinIcon className="mt-0.5 h-4 w-4 text-emerald-700" />
              <span className="min-w-0">
                <span className="font-medium">{PINNED_LABEL}</span>
                <span className="block text-xs text-emerald-900">{formatMetres(pinnedFrom)} from {PILOT_PLACE}</span>
              </span>
            </p>
            <div className="mt-2 ml-6 flex flex-wrap gap-x-4 gap-y-1">
              <button
                ref={adjustRef}
                type="button"
                onClick={openPinSheet}
                disabled={busy}
                className="rounded-md text-sm font-medium text-emerald-800 underline underline-offset-4 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50"
              >
                Move the pin
              </button>
              <button
                type="button"
                onClick={undoPin}
                disabled={busy}
                className="rounded-md text-sm font-medium text-emerald-800 underline underline-offset-4 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50"
              >
                Undo pin
              </button>
            </div>
          </div>
        ) : gps.state === "on" ? (
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
            {adjustButton}
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
                className="mt-1 h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {PLACES.map((p, i) => (
                  <option key={p.name} value={i}>
                    {"short" in p ? p.short : p.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">This pilot covers the Murthal–Sonipat corridor, Haryana.</span>
            </label>
            {mapFailed ? (
              <p role="status" className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
                {MAP_FAILED}
              </p>
            ) : (
              adjustButton
            )}
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
        <section aria-labelledby="nearby-heading" className="cz-rise min-w-0 rounded-xl bg-amber-50/70 p-2.5 ring-1 ring-amber-200 sm:p-3">
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
              <li key={incident.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                <span aria-hidden="true" className="shrink-0 text-xl">
                  {CATEGORY_ICON[incident.category]}
                </span>
                <span className="min-w-0 flex-1 basis-40">
                  <span className="line-clamp-2 break-words text-sm font-medium leading-snug text-slate-900">{incident.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {CITIZEN_STATUS_LABEL[incident.status]} · {incident.report_ids.length}{" "}
                    {incident.report_ids.length === 1 ? "report" : "reports"} · {Math.max(10, Math.round(d / 10) * 10)} m away
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy || photo.preparing}
                  onClick={() => meToo(incident)}
                  aria-label={`Me too: ${incident.title}`}
                  className="ml-auto min-h-11 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-50 motion-safe:active:scale-95"
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
      {pinSheet && (
        <PinSheet
          initial={pinned ?? { lat, lng }}
          onDone={pinDone}
        />
      )}
    </form>
  );
}

function MapGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 4.5-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </svg>
  );
}
