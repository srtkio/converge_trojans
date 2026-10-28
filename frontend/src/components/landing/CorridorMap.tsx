"use client";

import type { Incident } from "@/lib/types";

import { sharedIncidents, useLive } from "./live-data";

/** Real coordinates (backend app/places.py). Roads are drawn through them as a schematic. */
const PLACES = [
  { label: "Sonipat", lat: 28.9953758, lng: 77.0233627, dx: -6, dy: -14, anchor: "start" },
  { label: "Murthal", lat: 29.0396149, lng: 77.0894535, dx: 12, dy: 5, anchor: "start" },
  { label: "Murthal Chowk", lat: 29.0265284, lng: 77.0736908, dx: -12, dy: 5, anchor: "end" },
  { label: "Rishihood University", lat: 28.9832, lng: 77.0864, dx: -12, dy: 5, anchor: "end" },
  { label: "Bahalgarh", lat: 28.9586835, lng: 77.0950598, dx: 12, dy: 5, anchor: "start" },
] as const;

type P = readonly [number, number];
const NH44: P[] = [[28.938, 77.1], [28.9586835, 77.0950598], [28.9832, 77.0864], [29.012, 77.0868], [29.0396149, 77.0894535], [29.058, 77.092]];
const MURTHAL_RD: P[] = [[28.9953758, 77.0233627], [29.000174, 77.0395075], [29.0265284, 77.0736908], [29.0396149, 77.0894535]];
const BAHALGARH_RD: P[] = [[28.9953758, 77.0233627], [28.9906486, 77.0363141], [28.9586835, 77.0950598]];

const W = 520;
const H = 440;
const MIN_LAT = 28.935;
const MAX_LAT = 29.062;
const MIN_LNG = 77.005;
const MAX_LNG = 77.118;
const KX = Math.cos((29 * Math.PI) / 180);
const SCALE = Math.min((W - 40) / ((MAX_LNG - MIN_LNG) * KX), (H - 40) / (MAX_LAT - MIN_LAT));
const OX = (W - (MAX_LNG - MIN_LNG) * KX * SCALE) / 2;
const OY = (H - (MAX_LAT - MIN_LAT) * SCALE) / 2;

const project = (lat: number, lng: number): P => [OX + (lng - MIN_LNG) * KX * SCALE, OY + (MAX_LAT - lat) * SCALE];
const inFrame = (i: Incident) => i.lat >= MIN_LAT && i.lat <= MAX_LAT && i.lng >= MIN_LNG && i.lng <= MAX_LNG;
const path = (pts: P[]) => pts.map(([la, ln], k) => `${k ? "L" : "M"}${project(la, ln).map((v) => v.toFixed(1)).join(" ")}`).join(" ");

type Tone = "open" | "proof" | "fixed";
const TONE: Record<Tone, { fill: string; label: string }> = {
  open: { fill: "#fbbf24", label: "Open" },
  proof: { fill: "#5eead4", label: "Awaiting proof" },
  fixed: { fill: "#10b981", label: "Verified fixed" },
};
const toneOf = (i: Incident): Tone | null =>
  i.status === "rejected" ? null : i.status === "verified_closed" ? "fixed" : i.status === "pending_verification" ? "proof" : "open";

/** The Murthal–Sonipat pilot corridor with live case pins from GET /incidents. */
export function CorridorMap() {
  const live = useLive(sharedIncidents);
  const pins = live.state === "ok" ? live.data.filter(inFrame).flatMap((i) => (toneOf(i) ? [{ i, tone: toneOf(i) as Tone }] : [])).slice(0, 80) : [];
  const counts = pins.reduce<Record<Tone, number>>((acc, p) => ({ ...acc, [p.tone]: acc[p.tone] + 1 }), { open: 0, proof: 0, fixed: 0 });

  return (
    <figure className="overflow-hidden rounded-[24px] border border-line-strong bg-surface">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Schematic map of the Murthal–Sonipat corridor along GT Road (NH-44), with live case pins">
        <defs>
          <pattern id="cv-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0V26" fill="none" stroke="rgba(148,163,196,0.08)" strokeWidth="1" />
          </pattern>
          <radialGradient id="cv-glow" cx="70%" cy="45%" r="60%">
            <stop offset="0%" stopColor="rgba(16,185,129,0.18)" />
            <stop offset="100%" stopColor="rgba(16,185,129,0)" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#cv-grid)" />
        <rect width={W} height={H} fill="url(#cv-glow)" />

        <g className="cv-road" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={path(MURTHAL_RD)} stroke="rgba(148,163,196,0.35)" strokeWidth="5" />
          <path d={path(BAHALGARH_RD)} stroke="rgba(148,163,196,0.35)" strokeWidth="5" />
          <path d={path(NH44)} stroke="rgba(230,233,242,0.22)" strokeWidth="12" />
          <path d={path(NH44)} stroke="rgba(16,185,129,0.55)" strokeWidth="2" strokeDasharray="10 8" />
        </g>
        {(() => {
          const [x, y] = project(29.0, 77.0868);
          return (
            <g transform={`translate(${(x + 16).toFixed(1)} ${y.toFixed(1)})`}>
              <rect x="0" y="-12" width="74" height="24" rx="6" fill="rgba(4,120,87,0.9)" />
              <text x="37" y="5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ecfdf5">NH-44</text>
            </g>
          );
        })()}

        {PLACES.map((p) => {
          const [x, y] = project(p.lat, p.lng);
          return (
            <g key={p.label}>
              <circle cx={x} cy={y} r="5" fill="#070a12" stroke="rgba(230,233,242,0.8)" strokeWidth="2" />
              <text
                x={x + p.dx}
                y={y + p.dy}
                textAnchor={p.anchor}
                fontSize="15"
                fontWeight="600"
                fill="rgba(230,233,242,0.92)"
                stroke="#0d1220"
                strokeWidth="4"
                paintOrder="stroke"
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {pins.map(({ i, tone }, k) => {
          const [x, y] = project(i.lat, i.lng);
          const fill = TONE[tone].fill;
          return (
            <g key={i.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              {tone !== "fixed" && <circle className="cv-pin-pulse" r="9" fill={fill} style={{ animationDelay: `${(k % 9) * 0.29}s` }} />}
              <circle className="cv-pin" r="5" fill={fill} stroke="#070a12" strokeWidth="1.5" style={{ animationDelay: `${Math.min(k, 30) * 25}ms` }}>
                <title>{`${i.title} (${TONE[tone].label})`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
        {live.state === "ok" && pins.length > 0 ? (
          <>
            {(Object.keys(TONE) as Tone[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: TONE[t].fill }} />
                {TONE[t].label} · <span className="tabular-nums text-foreground/90">{counts[t]}</span>
              </span>
            ))}
            <span className="w-full sm:ml-auto sm:w-auto">Live cases at their real coordinates · roads schematic</span>
          </>
        ) : (
          <span>Pilot corridor along GT Road (NH-44) · schematic</span>
        )}
      </figcaption>
    </figure>
  );
}
