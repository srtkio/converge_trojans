"use client";

import { useEffect, useRef, useState } from "react";

import { PinIcon } from "@/components/CitizenIcons";
import { CitizenMapView } from "@/components/CitizenMapView";
import { useModal, useSheetExit } from "@/components/Sheet";
import { BIG_BUTTON } from "@/lib/citizenStyles";
import { useDeviceLocation } from "@/lib/location";
import { tidyLatLng, type LatLng } from "@/lib/pinHandoff";

export type PinResult = { kind: "picked"; spot: LatLng } | { kind: "cancelled" } | { kind: "map-failed" };

/**
 * Full-screen "Adjust the spot" sheet for the report form. Full screen on purpose: a finger on a
 * Leaflet map never scrolls the page, so an inline map would trap scrolling inside the form.
 */
export function PinSheet({ initial, onDone }: { initial: LatLng; onDone: (r: PinResult) => void }) {
  const [spot, setSpot] = useState<LatLng>(initial);
  const [viewKey, setViewKey] = useState(0);
  const result = useRef<PinResult>({ kind: "cancelled" });
  const { closing, close, onAnimationEnd } = useSheetExit(() => onDone(result.current));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { location: gps, locate } = useDeviceLocation();
  const wantsMe = useRef(false);
  const locating = gps.state === "locating";

  const finish = (r: PinResult) => {
    result.current = r;
    close();
  };
  useModal(true, () => finish({ kind: "cancelled" }), headingRef);

  useEffect(() => {
    // A fix the citizen asked for moves the pin there and recentres the map.
    if (gps.state !== "on" || !wantsMe.current) return;
    wantsMe.current = false;
    setSpot(tidyLatLng(gps.lat, gps.lng));
    setViewKey((k) => k + 1);
  }, [gps]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-sheet-title"
      onAnimationEnd={onAnimationEnd}
      className={`fixed inset-0 z-[60] flex flex-col bg-white [color-scheme:light] ${closing ? "cz-sheet-out" : "cz-sheet"}`}
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="pin-sheet-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
              Adjust the spot
            </h2>
            <p className="text-sm text-slate-600">Drag the pin, or tap the map where the problem is.</p>
          </div>
          <button
            type="button"
            onClick={() => finish({ kind: "cancelled" })}
            className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            Cancel
          </button>
        </div>
        <CitizenMapView
          className="min-h-64 flex-1"
          label="Map. Drag the pin or tap the map to choose the spot."
          focus={spot}
          viewKey={viewKey}
          pin={spot}
          onPinChange={setSpot}
          me={gps.state === "on" ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy } : null}
          onTilesFailed={() => finish({ kind: "map-failed" })}
        />
        {gps.state === "failed" && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
            {"We couldn't use your location. Drag the pin or tap the map instead."}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            if (locating) return;
            wantsMe.current = true;
            locate();
          }}
          aria-disabled={locating || undefined}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-base font-medium text-slate-800 ring-1 ring-slate-300 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 motion-safe:active:scale-[0.98]"
        >
          <PinIcon className={`h-5 w-5 text-sky-600 ${locating ? "motion-safe:animate-pulse" : ""}`} />
          {locating ? "Finding you…" : "Move the pin to me"}
        </button>
        <button
          type="button"
          onClick={() => finish({ kind: "picked", spot })}
          className={`${BIG_BUTTON} bg-emerald-700 text-white hover:bg-emerald-800`}
        >
          Use this spot
        </button>
      </div>
    </div>
  );
}
