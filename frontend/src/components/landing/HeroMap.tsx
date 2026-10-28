import type { CSSProperties } from "react";

/**
 * Animated hero visual: a stylised map of the pilot corridor (NH-44 / GT Road between
 * Rishihood University and Murthal, with the road east to Sonipat). Three reports land
 * within 150 m, converge into one incident, the nearest crew drives in along the roads,
 * and the case closes with evidence. Pure SVG + CSS keyframes (transform/opacity only),
 * so it costs no JavaScript and sits still for reduced-motion users.
 */

const INCIDENT = { x: 350, y: 250 };
const DEPOT = { x: 183, y: 420 };
const JUNCTION = { x: 226, y: 300 };
const TURN = { x: 350, y: 284 };

const REPORTS = [
  { x: 318, y: 208, delay: "0s" },
  { x: 390, y: 232, delay: "0.45s" },
  { x: 338, y: 296, delay: "0.9s" },
];

const AMBIENT = [
  { x: 118, y: 150, d: "0s" },
  { x: 452, y: 410, d: "1.1s" },
  { x: 470, y: 110, d: "2.2s" },
  { x: 86, y: 470, d: "0.6s" },
  { x: 262, y: 470, d: "1.7s" },
  { x: 410, y: 340, d: "2.6s" },
];

type Vars = CSSProperties & Record<`--${string}`, string>;

function px(n: number) {
  return `${n}px`;
}

function PinShape({ fill }: { fill: string }) {
  return (
    <>
      <ellipse cx={0} cy={2} rx={7} ry={2.5} fill="#000" opacity={0.45} />
      <path d="M0 0 C -11 -13 -11 -29 0 -32 C 11 -29 11 -13 0 0 Z" fill={fill} stroke="#0b1020" strokeWidth={2} />
      <circle cx={0} cy={-19} r={4} fill="#0b1020" />
    </>
  );
}

export function HeroMap() {
  const crewVars: Vars = {
    "--jx": px(JUNCTION.x - DEPOT.x),
    "--jy": px(JUNCTION.y - DEPOT.y),
    "--kx": px(TURN.x - DEPOT.x),
    "--ky": px(TURN.y - DEPOT.y),
    "--cx": px(INCIDENT.x - DEPOT.x),
    "--cy": px(INCIDENT.y - DEPOT.y + 4),
  };

  return (
    <svg
      viewBox="0 0 520 520"
      role="img"
      aria-label="Stylised map of the Murthal–Sonipat pilot: three nearby reports merge into one incident, the nearest crew is routed to it, and it closes with evidence."
      className="block h-auto w-full"
    >
      <defs>
        <pattern id="ld-hm-grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M26 0H0V26" fill="none" stroke="rgba(148,163,196,0.08)" strokeWidth="1" />
        </pattern>
        <radialGradient id="ld-hm-vignette" cx="55%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#0f1730" />
          <stop offset="100%" stopColor="#070a12" />
        </radialGradient>
        <radialGradient id="ld-hm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5b8cff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ld-hm-road" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#2a3550" />
          <stop offset="100%" stopColor="#334166" />
        </linearGradient>
        <linearGradient id="ld-hm-route" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#5b8cff" />
        </linearGradient>
        <clipPath id="ld-hm-clip">
          <rect width="520" height="520" rx="28" />
        </clipPath>
      </defs>

      <g clipPath="url(#ld-hm-clip)">
        <rect width="520" height="520" fill="url(#ld-hm-vignette)" />
        <rect width="520" height="520" fill="url(#ld-hm-grid)" />

        {/* Fields / blocks */}
        <g fill="rgba(148,163,196,0.05)" stroke="rgba(148,163,196,0.08)">
          <rect x="250" y="120" width="150" height="80" rx="10" />
          <rect x="410" y="290" width="110" height="90" rx="10" />
          <rect x="250" y="330" width="130" height="90" rx="10" />
          <rect x="20" y="210" width="130" height="90" rx="10" />
        </g>
        {/* Rishihood University campus */}
        <rect x="40" y="350" width="118" height="70" rx="12" fill="rgba(91,140,255,0.08)" stroke="rgba(91,140,255,0.35)" strokeDasharray="4 4" />

        {/* Minor streets */}
        <g stroke="rgba(148,163,196,0.16)" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M-10 182 L540 150" />
          <path d="M-10 440 L540 404" />
          <path d="M420 -10 L448 540" />
          <path d="M60 -10 L104 540" />
        </g>

        {/* NH-44 / GT Road, and the road east to Sonipat */}
        <path d="M140 540 L340 -20" stroke="url(#ld-hm-road)" strokeWidth="20" strokeLinecap="round" fill="none" />
        <path d="M140 540 L340 -20" stroke="rgba(230,233,242,0.22)" strokeWidth="1.5" strokeDasharray="10 12" fill="none" />
        <path d={`M${JUNCTION.x} ${JUNCTION.y} L${TURN.x} ${TURN.y} Q 450 270 540 238`} stroke="#2c3854" strokeWidth="12" strokeLinecap="round" fill="none" />

        {/* Labels */}
        <g fontFamily="var(--font-geist-mono), ui-monospace, monospace" fontSize="13" letterSpacing="1.5">
          <text x="246" y="38" fill="#8b94ab" transform="rotate(-70.3 246 38)" textAnchor="end">
            NH-44 · GT ROAD
          </text>
          <text x="318" y="72" fill="#c9d1e4">MURTHAL</text>
          <circle cx="309" cy="68" r="4" fill="#c9d1e4" />
          <text x="508" y="226" fill="#c9d1e4" textAnchor="end">SONIPAT →</text>
          <text x="99" y="380" fill="#a9c1ff" textAnchor="middle" fontSize="11.5">RISHIHOOD</text>
          <text x="99" y="396" fill="#a9c1ff" textAnchor="middle" fontSize="11.5">UNIVERSITY</text>
          <text x="166" y="508" fill="#5f6880" fontSize="12">↓ DELHI</text>
        </g>

        {/* Other open cases across the corridor */}
        {AMBIENT.map((a) => (
          <circle key={`${a.x}-${a.y}`} cx={a.x} cy={a.y} r="4" fill="#8b94ab" className="ld-blink" style={{ animationDelay: a.d }} />
        ))}

        {/* Dedup radius: 150 m around the first report */}
        <g transform={`translate(${INCIDENT.x} ${INCIDENT.y - 4})`}>
          <circle r="66" fill="rgba(34,211,238,0.06)" stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="5 6" className="ld-hm-radius ld-fc" />
        </g>

        {/* Links between the reports while they are being matched */}
        <g className="ld-hm-link" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="3 5" opacity="0" fill="none">
          {REPORTS.map((r) => (
            <path key={`l${r.x}`} d={`M${r.x} ${r.y - 18} L${INCIDENT.x} ${INCIDENT.y - 18}`} />
          ))}
        </g>

        {/* Crew route + crew */}
        <path
          d={`M${DEPOT.x} ${DEPOT.y} L${JUNCTION.x} ${JUNCTION.y} L${TURN.x} ${TURN.y} L${INCIDENT.x} ${INCIDENT.y + 4}`}
          pathLength={220}
          stroke="url(#ld-hm-route)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="ld-hm-route"
        />
        <g transform={`translate(${DEPOT.x} ${DEPOT.y})`}>
          <rect x="-12" y="-12" width="24" height="24" rx="7" fill="#0d1220" stroke="#8b94ab" strokeWidth="1.5" />
          <path d="M-5 -2 h7 v6 h-7z M2 0 h3 l2 2 v2 h-5z" fill="#8b94ab" />
        </g>
        <g transform={`translate(${DEPOT.x} ${DEPOT.y})`}>
          <g className="ld-hm-crew" style={crewVars}>
            <circle r="13" fill="rgba(34,211,238,0.2)" />
            <circle r="7.5" fill="#22d3ee" stroke="#070a12" strokeWidth="2.5" />
          </g>
        </g>

        {/* The three reports */}
        {REPORTS.map((r) => {
          const vars: Vars = {
            "--dx": px(INCIDENT.x - r.x),
            "--dy": px(INCIDENT.y - r.y),
            animationDelay: r.delay,
          };
          return (
            <g key={`r${r.x}`} transform={`translate(${r.x} ${r.y})`}>
              <circle r="10" fill="none" stroke="#fbbf24" strokeWidth="2" className="ld-hm-pin-ring ld-fc" style={{ animationDelay: r.delay }} />
              <g className="ld-hm-pin ld-fb" style={vars}>
                <PinShape fill="#fbbf24" />
              </g>
            </g>
          );
        })}

        {/* The merged incident */}
        <g transform={`translate(${INCIDENT.x} ${INCIDENT.y})`}>
          <circle r="70" fill="url(#ld-hm-glow)" className="ld-hm-incident-glow ld-fc" cy="-16" />
          <g className="ld-hm-incident ld-fb">
            <ellipse cx={0} cy={3} rx={10} ry={3.5} fill="#000" opacity={0.5} />
            <path d="M0 0 C -16 -19 -16 -42 0 -46 C 16 -42 16 -19 0 0 Z" fill="#5b8cff" stroke="#e6e9f2" strokeWidth="2.5" />
            <text x="0" y="-22" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="var(--font-geist-sans), system-ui, sans-serif">
              3
            </text>
          </g>
          <g transform="translate(17 -50)">
            <g className="ld-hm-ok ld-fc">
              <circle r="12" fill="#34d399" stroke="#070a12" strokeWidth="3" />
              <path d="M-5 0.5 L-1.5 4 L5.5 -3.5" fill="none" stroke="#04281c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
          <g className="ld-hm-label" transform="translate(-74 -96)">
            <rect width="148" height="28" rx="14" fill="rgba(13,18,32,0.92)" stroke="rgba(91,140,255,0.55)" />
            <text x="74" y="18.5" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#e6e9f2" fontFamily="var(--font-geist-sans), system-ui, sans-serif">
              1 incident · 3 reports
            </text>
          </g>
        </g>

        <text x="500" y="502" textAnchor="end" fontSize="11" fill="#5f6880" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
          STYLISED · NOT TO SCALE
        </text>
      </g>
      <rect x="0.5" y="0.5" width="519" height="519" rx="27.5" fill="none" stroke="rgba(148,163,196,0.18)" />
    </svg>
  );
}
