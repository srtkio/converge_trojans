"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import type { CitizenMapProps } from "./CitizenMap";

function MapLoading() {
  return <div aria-hidden="true" className="h-full w-full bg-[#f2efe9] motion-safe:animate-pulse" />;
}

/** Shown if the map code itself can't load (offline on first visit): the screen falls back to its list. */
function MapUnavailable({ onTilesFailed }: CitizenMapProps) {
  useEffect(() => {
    onTilesFailed?.();
  }, [onTilesFailed]);
  return (
    <div className="grid h-full w-full place-items-center p-4 text-center text-sm text-slate-600">
      {"The map isn't loading right now."}
    </div>
  );
}

// Leaflet needs `window`: the map is only ever rendered in the browser.
const CitizenMap = dynamic<CitizenMapProps>(
  () => import("./CitizenMap").then((m) => m.default).catch(() => MapUnavailable),
  { ssr: false, loading: MapLoading },
);

/**
 * Leaflet-free wrapper for the citizen map. The box is its own stacking context (`isolate`), so
 * Leaflet's panes (z 400) and controls (z 1000) never paint over the bottom nav, sheets or toasts.
 */
export function CitizenMapView({ className = "h-80", ...props }: CitizenMapProps & { className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-2xl bg-[#f2efe9] ring-1 ring-slate-900/5 ${className}`}>
      <CitizenMap {...props} />
    </div>
  );
}
