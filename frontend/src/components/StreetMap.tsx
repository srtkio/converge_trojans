"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

import { CATEGORY_ICON, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { Incident, Report, Resource } from "@/lib/types";

/**
 * Real street map (OpenStreetMap tiles via Leaflet; free, no key). Needs network for tiles;
 * CityMap's schematic view is the offline fallback. Loaded with ssr:false because Leaflet needs `window`.
 */

const DUPLICATE_RADIUS_M = 150;

function crewIcon(available: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:3px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);background:${
      available ? "#0f172a" : "#94a3b8"
    }"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function incidentIcon(i: Incident, selected: boolean) {
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${STATUS_STYLE[i.status].dot};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:${
      selected ? 16 : 13
    }px">${CATEGORY_ICON[i.category]}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Refit only when the set of things on the map changes, not on every poll. */
function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 17);
    else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 17 });
    // points is derived from fitKey; refitting on every new array would fight the user's panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

export default function StreetMap({
  incidents,
  resources,
  reports,
  selectedId,
  onSelect,
}: {
  incidents: Incident[];
  resources: Resource[];
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);

  const focus: [number, number][] = [
    ...incidents.map((i) => [i.lat, i.lng] as [number, number]),
    ...reports.map((r) => [r.lat, r.lng] as [number, number]),
  ];
  const points = focus.length ? focus : resources.map((r) => [r.location.lat, r.location.lng] as [number, number]);
  const fitKey = [...incidents.map((i) => i.id), ...reports.map((r) => r.id)].join(",") || "crews";

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
  const center: [number, number] = points[0] ?? [12.9756, 77.605];

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom={false} className="h-[340px] w-full rounded-md" attributionControl>
      <TileLayer
        // Standard OpenStreetMap tiles: free, no key (CARTO's lighter tiles now need a key).
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} fitKey={fitKey} />

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
          <span key={r.id}>
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
          </span>
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
        >
          <Tooltip direction="top" offset={[0, -16]} permanent={i.id === selectedId}>
            {i.id} · {STATUS_LABEL[i.status]}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
