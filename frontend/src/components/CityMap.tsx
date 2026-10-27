import { CATEGORY_ICON, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { Incident, Report, Resource } from "@/lib/types";

/**
 * Schematic map: plots incidents, reports, and crews on a local x/y projection of lat/lng.
 * No tiles or API keys, so it works offline during the demo. Distances are to scale.
 */
const W = 800;
const H = 300;
const PAD = 40;
const M_PER_DEG_LAT = 111_320;

export function CityMap({
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
  // Frame on incidents and reports; crews only set the frame when there's nothing else.
  // Crews outside the frame are pinned to its edge so far-away depots don't shrink the action.
  const focus = [...incidents.map((i) => ({ lat: i.lat, lng: i.lng })), ...reports.map((r) => ({ lat: r.lat, lng: r.lng }))];
  const points = focus.length ? focus : resources.map((r) => r.location);

  if (points.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
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
    <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between px-1 pb-1">
        <h2 className="text-sm font-semibold">City view</h2>
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span>● incident</span>
          <span>◦ report</span>
          <span>■ crew (→ off-map)</span>
          <span className="text-violet-600">┅ related</span>
          <span>dashed ring = 150 m duplicate radius</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-md bg-slate-50" role="img" aria-label="Map of incidents and crews">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {[...relatedPairs].map((pair) => {
          const [a, b] = pair.split("|").map((id) => project(byId.get(id)!));
          return <line key={pair} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7c3aed" strokeWidth="2" strokeDasharray="6 4" />;
        })}

        {reports.map((r) => {
          const p = project(r);
          const inc = r.incident_id ? byId.get(r.incident_id) : undefined;
          const ip = inc ? project(inc) : p;
          return (
            <g key={r.id}>
              <line x1={p.x} y1={p.y} x2={ip.x} y2={ip.y} stroke="#94a3b8" strokeWidth="1" />
              <circle cx={p.x} cy={p.y} r="5" fill="white" stroke="#475569" strokeWidth="1.5" />
            </g>
          );
        })}

        {resources.map((r, idx) => {
          const raw = clampToFrame(project(r.location));
          // Crews pinned to the same edge would overlap; nudge each pinned crew down by its index.
          const p = raw.clamped ? { ...raw, y: Math.min(H - EDGE, raw.y + (idx % 4) * 16) } : raw;
          const color = r.available ? "#0f172a" : "#94a3b8";
          // Keep labels inside the frame: put them left of crews pinned to the right edge.
          const right = p.x > W - 160;
          return (
            <g key={r.id} opacity={p.clamped ? 0.7 : 1}>
              <rect x={p.x - 6} y={p.y - 6} width="12" height="12" rx="2" fill={r.available ? "#0f172a" : "#cbd5e1"} />
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
              <circle cx={p.x} cy={p.y} r={sel ? 14 : 11} fill={color} stroke="white" strokeWidth="2" />
              <text x={p.x} y={p.y + 4} fontSize="11" textAnchor="middle">
                {CATEGORY_ICON[i.category]}
              </text>
              <text x={p.x + 18} y={p.y + 4} fontSize="11" fontWeight={sel ? 700 : 500} fill="#0f172a">
                {i.id}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${W - PAD - scaleBarM * scale}, ${H - 14})`}>
          <line x1="0" y1="0" x2={scaleBarM * scale} y2="0" stroke="#475569" strokeWidth="2" />
          <text x={(scaleBarM * scale) / 2} y="-4" fontSize="10" textAnchor="middle" fill="#475569">
            {scaleBarM} m
          </text>
        </g>
      </svg>
    </section>
  );
}
