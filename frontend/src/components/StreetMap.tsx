"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

import { CATEGORY_ICON, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { Incident, Report, Resource } from "@/lib/types";

/**
 * Real street map (OpenStreetMap tiles via Leaflet; free, no key). Needs network for tiles;
 * CityMap's schematic view is the offline fallback. Loaded with ssr:false because Leaflet needs `window`.
 *
 * Steadiness: the dashboard polls every 2 s, so icons are cached (a new icon object makes Leaflet
 * replace the marker's DOM and flicker), the view only refits when the set of incidents changes,
 * and selecting an incident glides to it instead of refitting.
 */

const DUPLICATE_RADIUS_M = 150;
const DEFAULT_CENTER: [number, number] = [28.9832, 77.0864]; // Rishihood University, GT Road, Sonipat
// If tiles keep failing with none loaded, tell CityMap to fall back to the schematic map.
const TILE_FAILURES_BEFORE_FALLBACK = 6;

const iconCache = new Map<string, L.DivIcon>();

function cachedIcon(key: string, make: () => L.DivIcon): L.DivIcon {
  let icon = iconCache.get(key);
  if (!icon) {
    icon = make();
    iconCache.set(key, icon);
  }
  return icon;
}

function crewIcon(available: boolean) {
  return cachedIcon(`crew|${available}`, () =>
    L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;border-radius:3px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);background:${
        available ? "#0f172a" : "#94a3b8"
      }"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
  );
}

function incidentIcon(i: Incident, selected: boolean) {
  return cachedIcon(`inc|${i.status}|${i.category}|${selected}`, () => {
    const size = selected ? 34 : 28;
    return L.divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${STATUS_STYLE[i.status].dot};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:${
        selected ? 16 : 13
      }px">${CATEGORY_ICON[i.category]}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  });
}

/** Frame all incidents, but only when the set of incidents changes (new report, reset, new scenario). */
function FitToIncidents({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 17, { animate: true });
    else map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 17, animate: true });
    // points is derived from fitKey; refitting on every poll would fight the user's panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

/**
 * Glide to the selected incident when the selection changes. Pans at the current zoom (no new
 * tiles to fetch, so no grey flashes); only zooms in when the map is zoomed far out.
 */
function PanToSelection({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const lat = target?.[0];
  const lng = target?.[1];
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    if (map.getBounds().pad(-0.2).contains([lat, lng])) return; // already comfortably in view
    if (map.getZoom() < 14) map.flyTo([lat, lng], 15, { duration: 0.6 });
    else map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }, [lat, lng, map]);
  return null;
}

/** Leaflet measures its container once; re-measure after layout settles so tiles fill the box. */
function SizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    const obs = new ResizeObserver(() => map.invalidateSize());
    obs.observe(map.getContainer());
    return () => {
      clearTimeout(t);
      obs.disconnect();
    };
  }, [map]);
  return null;
}

export default function StreetMap({
  incidents,
  resources,
  reports,
  selectedId,
  onSelect,
  onTilesFailed,
}: {
  incidents: Incident[];
  resources: Resource[];
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTilesFailed?: () => void;
}) {
  const byId = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);
  const tiles = useRef({ loaded: 0, failed: 0, reported: false });

  const incidentPoints = incidents.map((i) => [i.lat, i.lng] as [number, number]);
  const points = incidentPoints.length
    ? incidentPoints
    : resources.map((r) => [r.location.lat, r.location.lng] as [number, number]);
  const fitKey = incidents.map((i) => i.id).join(",") || `crews:${resources.length}`;

  const relatedPairs: [Incident, Incident][] = [];
  const seen = new Set<string>();
  for (const i of incidents)
    for (const r of i.related_incident_ids) {
      const other = byId.get(r);
      const key = [i.id, r].sort().join("|");
      if (other && !seen.has(key)) {
        seen.add(key);
        relatedPairs.push([i, other]);
      }
    }

  const selected = selectedId ? byId.get(selectedId) : undefined;

  return (
    <MapContainer
      center={points[0] ?? DEFAULT_CENTER}
      zoom={16}
      scrollWheelZoom={false}
      zoomSnap={0.5}
      // OSM's land colour behind the tiles: on slow Wi-Fi, tiles still loading blend in instead of flashing grey.
      style={{ background: "#f2efe9" }}
      className="h-[340px] w-full rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        keepBuffer={6}
        updateWhenZooming={false}
        eventHandlers={{
          tileload: () => {
            tiles.current.loaded += 1;
          },
          tileerror: () => {
            const t = tiles.current;
            t.failed += 1;
            if (!t.reported && t.loaded === 0 && t.failed >= TILE_FAILURES_BEFORE_FALLBACK) {
              t.reported = true;
              onTilesFailed?.();
            }
          },
        }}
      />
      <SizeFix />
      <FitToIncidents points={points} fitKey={fitKey} />
      <PanToSelection target={selected ? [selected.lat, selected.lng] : null} />

      {selected && (
        <Circle
          center={[selected.lat, selected.lng]}
          radius={DUPLICATE_RADIUS_M}
          pathOptions={{ color: STATUS_STYLE[selected.status].dot, weight: 1.5, dashArray: "6 5", fillOpacity: 0.08 }}
        />
      )}

      {relatedPairs.map(([a, b]) => (
        <Polyline
          key={`${a.id}|${b.id}`}
          positions={[
            [a.lat, a.lng],
            [b.lat, b.lng],
          ]}
          pathOptions={{ color: "#7c3aed", weight: 3, dashArray: "8 6" }}
        />
      ))}

      {reports.map((r) => {
        const inc = r.incident_id ? byId.get(r.incident_id) : undefined;
        return (
          <Fragment key={r.id}>
            {inc && (
              <Polyline
                positions={[
                  [r.lat, r.lng],
                  [inc.lat, inc.lng],
                ]}
                pathOptions={{ color: "#64748b", weight: 1.5 }}
              />
            )}
            <CircleMarker center={[r.lat, r.lng]} radius={6} pathOptions={{ color: "#334155", weight: 2, fillColor: "#fff", fillOpacity: 1 }}>
              <Tooltip>
                {r.id}: “{r.text}”
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}

      {resources.map((r) => (
        <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={crewIcon(r.available)}>
          <Tooltip direction="right" offset={[8, 0]}>
            {r.name}
            {r.available ? "" : " (offline)"}
          </Tooltip>
        </Marker>
      ))}

      {incidents.map((i) => (
        <Marker
          key={i.id}
          position={[i.lat, i.lng]}
          icon={incidentIcon(i, i.id === selectedId)}
          eventHandlers={{ click: () => onSelect(i.id) }}
          zIndexOffset={i.id === selectedId ? 1000 : 500}
          keyboard
          title={`${i.id}: ${i.title}`}
        >
          <Tooltip direction="top" offset={[0, -16]}>
            {i.id} · {STATUS_LABEL[i.status]}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
