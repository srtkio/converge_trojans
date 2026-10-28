"use client";

import dynamic from "next/dynamic";
import { Map as MapIcon } from "lucide-react";
import { useState } from "react";

import { CATEGORY_ICON, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { Incident, Report, Resource } from "@/lib/types";

// Leaflet touches `window`, so the street map only renders in the browser.
const StreetMap = dynamic(() => import("./StreetMap"), {
  ssr: false,
  loading: () => <div className="op-shimmer h-full min-h-[340px] w-full rounded-lg bg-surface-2" />,
});

type MapProps = {
  incidents: Incident[];
  resources: Resource[];
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** City view: real street map by default, schematic as the offline fallback. */
export function CityMap({ heightClass = "h-[340px]", ...props }: MapProps & { heightClass?: string }) {
  const [view, setView] = useState<"street" | "schematic">("street");
  const [tilesDown, setTilesDown] = useState(false);
  return (
    <section className="op-map flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-line">
            <MapIcon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h2 className="text-[13px] font-semibold text-foreground">City view</h2>
          <div className="flex rounded-lg bg-surface-2 p-0.5 text-[11px] font-medium ring-1 ring-line">
            {(["street", "schematic"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-2 py-0.5 transition ${view === v ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
              >
                {v === "street" ? "Street" : "Schematic"}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden flex-wrap items-center gap-3 text-[10px] text-muted md:flex">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-accent bg-surface" /> incident</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border-2 border-slate-300 bg-surface" /> report</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent-2" /> crew</span>
          <span className="flex items-center gap-1"><span className="w-3 border-t-2 border-dashed border-violet-400" /> related</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400" /> 150 m duplicate radius</span>
        </div>
      </div>
      {tilesDown && view === "schematic" && (
        <p className="mx-3 mt-2 rounded-md bg-warn/10 px-3 py-1.5 text-xs text-warn ring-1 ring-warn/25">
          Street map tiles couldn’t load (no internet?), so this is the offline schematic view.
        </p>
      )}
      <div className={`relative p-2 ${heightClass}`}>
        {view === "street" ? (
          <StreetMap
            {...props}
            className="h-full"
            onTilesFailed={() => {
              setTilesDown(true);
              setView("schematic");
            }}
          />
        ) : (
          <SchematicMap {...props} />
        )}
      </div>
    </section>
  );
}

/**
 * Schematic map: plots incidents, reports, and crews on a local x/y projection of lat/lng.
 * No tiles or API keys, so it works offline during the demo. Distances are to scale.
 */
const W = 800;
const H = 300;
const PAD = 40;
const M_PER_DEG_LAT = 111_320;

function SchematicMap({ incidents, resources, reports, selectedId, onSelect }: MapProps) {
  // Frame on incidents and reports; crews only set the frame when there's nothing else.
  // Crews outside the frame are pinned to its edge so far-away depots don't shrink the action.
  const focus = [...incidents.map((i) => ({ lat: i.lat, lng: i.lng })), ...reports.map((r) => ({ lat: r.lat, lng: r.lng }))];
  const points = focus.length ? focus : resources.map((r) => r.location);

  if (points.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg bg-[#0a0f1b] text-sm text-muted">
        Map appears when there are incidents or crews.
      </div>
    );
  }

  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lng * mPerDegLng);
  const ys = points.map((p) => p.lat * M_PER_DEG_LAT);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // One scale for both axes so circles stay round and radii are true to scale.
  const spanM = Math.max(maxX - minX, maxY - minY, 600);
  const scale = Math.min((W - 2 * PAD) / spanM, (H - 2 * PAD) / spanM);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const project = (p: { lat: number; lng: number }) => ({
    x: W / 2 + (p.lng * mPerDegLng - cx) * scale,
    y: H / 2 - (p.lat * M_PER_DEG_LAT - cy) * scale,
  });
  const EDGE = 14;
  const clampToFrame = (p: { x: number; y: number }) => {
    const x = Math.min(Math.max(p.x, EDGE), W - EDGE);
    const y = Math.min(Math.max(p.y, EDGE), H - EDGE);
    return { x, y, clamped: x !== p.x || y !== p.y };
  };

  const byId = new Map(incidents.map((i) => [i.id, i]));
  const relatedPairs = new Set<string>();
  for (const i of incidents)
    for (const r of i.related_incident_ids) if (byId.has(r)) relatedPairs.add([i.id, r].sort().join("|"));

  const scaleBarM = spanM > 1500 ? 500 : 100;

  return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full rounded-lg bg-[#0a0f1b]" role="img" aria-label="Map of incidents and crews">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,196,0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {[...relatedPairs].map((pair) => {
          const [a, b] = pair.split("|").map((id) => project(byId.get(id)!));
          return <line key={pair} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a78bfa" strokeWidth="2" strokeDasharray="6 4" />;
        })}

        {reports.map((r) => {
          const p = project(r);
          const inc = r.incident_id ? byId.get(r.incident_id) : undefined;
          const ip = inc ? project(inc) : p;
          return (
            <g key={r.id}>
              <line x1={p.x} y1={p.y} x2={ip.x} y2={ip.y} stroke="#64748b" strokeWidth="1" />
              <circle cx={p.x} cy={p.y} r="5" fill="#0d1220" stroke="#cbd5e1" strokeWidth="1.5" />
            </g>
          );
        })}

        {resources.map((r, idx) => {
          const raw = clampToFrame(project(r.location));
          // Crews pinned to the same edge would overlap; nudge each pinned crew down by its index.
          const p = raw.clamped ? { ...raw, y: Math.min(H - EDGE, raw.y + (idx % 4) * 16) } : raw;
          const color = r.available ? "#67e8f9" : "#64748b";
          // Keep labels inside the frame: put them left of crews pinned to the right edge.
          const right = p.x > W - 160;
          return (
            <g key={r.id} opacity={p.clamped ? 0.7 : 1}>
              <rect x={p.x - 6} y={p.y - 6} width="12" height="12" rx="2" fill={r.available ? "#22d3ee" : "#475569"} />
              <text x={right ? p.x - 9 : p.x + 9} y={p.y + 4} fontSize="11" fill={color} textAnchor={right ? "end" : "start"}>
                {r.name}
                {!r.available && " (off)"}
                {p.clamped && " →"}
              </text>
            </g>
          );
        })}

        {incidents.map((i) => {
          const p = project(i);
          const sel = i.id === selectedId;
          const color = STATUS_STYLE[i.status].dot;
          return (
            <g key={i.id} onClick={() => onSelect(i.id)} className="cursor-pointer">
              <title>{`${i.title} — ${STATUS_LABEL[i.status]}`}</title>
              {sel && <circle cx={p.x} cy={p.y} r={150 * scale} fill={color} fillOpacity="0.06" stroke={color} strokeDasharray="4 3" />}
              <circle cx={p.x} cy={p.y} r={sel ? 14 : 11} fill="#0d1220" stroke={color} strokeWidth="2.5" />
              <text x={p.x} y={p.y + 4} fontSize="11" textAnchor="middle">
                {CATEGORY_ICON[i.category]}
              </text>
              <text x={p.x + 18} y={p.y + 4} fontSize="11" fontWeight={sel ? 700 : 500} fill="#e6e9f2">
                {i.id}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${W - PAD - scaleBarM * scale}, ${H - 14})`}>
          <line x1="0" y1="0" x2={scaleBarM * scale} y2="0" stroke="#8b94ab" strokeWidth="2" />
          <text x={(scaleBarM * scale) / 2} y="-4" fontSize="10" textAnchor="middle" fill="#8b94ab">
            {scaleBarM} m
          </text>
        </g>
      </svg>
  );
}
