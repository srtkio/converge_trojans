"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useCitizen } from "@/components/CitizenApp";
import { PinIcon } from "@/components/CitizenIcons";
import { CitizenMapView } from "@/components/CitizenMapView";
import { CitizenScreen } from "@/components/CitizenScreen";
import { NearbySheet } from "@/components/NearbySheet";
import { api } from "@/lib/api";
import { CITIZEN_STATUS_LABEL, distanceM, formatMetres } from "@/lib/citizen";
import { BIG_BUTTON } from "@/lib/citizenStyles";
import { CATEGORY_ICON } from "@/lib/format";
import { PILOT_AREA, PILOT_CENTRE, PILOT_PLACE, outsidePilot, useDeviceLocation } from "@/lib/location";
import { refreshMyCases } from "@/lib/myCases";
import { putPin, type LatLng } from "@/lib/pinHandoff";
import { firstName } from "@/lib/session";
import type { Incident } from "@/lib/types";

// "Nearby": open issues people can track or join, within this distance of the phone (or the pilot centre).
const NEARBY_M = 5000;
const REFRESH_MS = 15_000;

/** Map tab: open issues around you to join with "Me too", and a pin to report something new. */
export default function MapPage() {
  const citizen = useCitizen();
  const router = useRouter();
  const { location: gps, locate } = useDeviceLocation();
  const me = gps.state === "on" ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy } : null;
  const centre: LatLng = me ?? PILOT_CENTRE;
  // The pin follows the phone until the citizen moves it.
  const [movedPin, setMovedPin] = useState<LatLng | null>(null);
  const pin = movedPin ?? centre;
  const [recentre, setRecentre] = useState(0);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [listError, setListError] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await api.incidents();
      setIncidents(all.filter((i) => i.status !== "verified_closed" && i.status !== "rejected"));
      setListError(false);
    } catch {
      setListError(true);
    }
  }, []);

  useEffect(() => {
    // A dropped connection shouldn't hide the map for good.
    const retry = () => setTilesFailed(false);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  useEffect(() => {
    // Initial load and a gentle refresh while the screen is visible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    // Already allowed location for this site? Then start from where the phone is, without asking.
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        if (!cancelled && s.state === "granted") locate();
      })
      .catch(() => {
        // Permissions API missing: the button below asks when tapped.
      });
    return () => {
      cancelled = true;
    };
  }, [locate]);

  const nearby = incidents
    .map((incident) => ({ incident, d: distanceM(centre.lat, centre.lng, incident.lat, incident.lng) }))
    .filter(({ d }) => d <= NEARBY_M)
    .sort((a, b) => a.d - b.d);
  const shown = nearby.map((n) => n.incident);
  const current = nearby.find((n) => n.incident.id === selected) ?? null;
  const locating = gps.state === "locating";
  const viewKey = `${recentre}|${me ? `${me.lat},${me.lng}` : "pilot"}`;

  const goToMe = () => {
    setMovedPin(null);
    setRecentre((n) => n + 1);
    locate();
  };

  const reportHere = () => {
    // Only hand over a spot the citizen actually saw on a working map.
    if (!tilesFailed || movedPin) putPin(pin);
    router.push("/citizen", { transitionTypes: ["cz-tab"] });
  };

  return (
    <CitizenScreen>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Map</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Issues near you</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tap an issue to add your voice. Something new? Drag the pin or tap the map, then report it.
        </p>
      </div>

      {tilesFailed ? (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          {"The map isn't loading right now. The issues near you are listed below."}
        </p>
      ) : (
        <CitizenMapView
          className="h-[min(52dvh,440px)] min-h-64"
          label="Map of issues near you. Drag the pin or tap the map to choose a spot."
          focus={movedPin ?? centre}
          viewKey={viewKey}
          pin={pin}
          onPinChange={setMovedPin}
          me={me}
          incidents={shown}
          selectedId={selected}
          onIncidentTap={setSelected}
          onTilesFailed={() => setTilesFailed(true)}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={goToMe}
          aria-disabled={locating || undefined}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 motion-safe:active:scale-[0.98]"
        >
          <PinIcon className={`h-5 w-5 text-sky-600 ${locating ? "motion-safe:animate-pulse" : ""}`} />
          {locating ? "Finding you…" : "Use my location"}
        </button>
        <button
          type="button"
          onClick={reportHere}
          className={`${BIG_BUTTON} h-12 bg-emerald-700 px-3 text-sm text-white hover:bg-emerald-800`}
        >
          Report something here
        </button>
      </div>
      {gps.state === "failed" && (
        <p className="cz-rise rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          {`We couldn't use your location, so the map shows the area around ${PILOT_PLACE}. You can still drag the pin.`}
        </p>
      )}
      {me && outsidePilot(me.lat, me.lng) && (
        <p className="cz-rise rounded-xl bg-sky-50 p-3 text-sm text-sky-950 ring-1 ring-sky-200">
          {`You're outside this pilot's area (${PILOT_AREA}), so there may be no issues near you yet.`}
        </p>
      )}

      <section aria-labelledby="nearby-list-heading">
        <h2 id="nearby-list-heading" className="text-base font-semibold">
          {nearby.length === 0 ? "Nothing open nearby" : `${nearby.length} open ${nearby.length === 1 ? "issue" : "issues"} nearby`}
        </h2>
        <p className="text-xs text-slate-500">
          Within {formatMetres(NEARBY_M)} of {me ? "you" : PILOT_PLACE}.
          {listError ? " Can't reach the service right now, trying again…" : ""}
        </p>
        {nearby.length > 0 && (
          <ul className="mt-2 space-y-2">
            {nearby.map(({ incident, d }) => (
              <li key={incident.id}>
                <button
                  type="button"
                  onClick={() => setSelected(incident.id)}
                  className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 motion-safe:active:scale-[0.99]"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {CATEGORY_ICON[incident.category]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{incident.title}</span>
                    <span className="block text-xs text-slate-500">
                      {CITIZEN_STATUS_LABEL[incident.status] ?? "Open"} · {formatMetres(d)} away ·{" "}
                      {incident.report_ids.length} {incident.report_ids.length === 1 ? "report" : "reports"}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {current && (
        <NearbySheet
          key={current.incident.id}
          incident={current.incident}
          distanceM={current.d}
          fromYou={!!me}
          reporter={`citizen:${firstName(citizen.name)}`}
          onJoined={() => {
            void load();
            void refreshMyCases();
          }}
          onClosed={() => setSelected(null)}
        />
      )}
    </CitizenScreen>
  );
}
