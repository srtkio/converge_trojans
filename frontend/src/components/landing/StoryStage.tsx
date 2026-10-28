import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * The scroll-story illustration: one city block on GT Road. `step` (-1 … 5) selects what is
 * shown; every change glides with CSS transitions on transform/opacity, so the parent only
 * has to flip a number when a new step scrolls into view.
 *
 *  0 report · 1 merge + link · 2 assign · 3 deadline · 4 evidence (reopen) · 5 verified close
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

const SITE = { x: 300, y: 252 };
const POTHOLE = { x: 470, y: 160 };
const DEPOT = { x: 70, y: 300 };
const ROAD_Y = 300;

const STATUS = [
  { text: "New report", color: "#fbbf24" },
  { text: "1 case · 3 reports", color: "#5b8cff" },
  { text: "Crew assigned", color: "#22d3ee" },
  { text: "Deadline running", color: "#fbbf24" },
  { text: "Reopened by citizen", color: "#f87171" },
  { text: "Verified closed", color: "#34d399" },
];

function show(on: boolean, extra?: CSSProperties): CSSProperties {
  return { opacity: on ? 1 : 0, ...extra };
}

function Pin({ fill, children }: { fill: string; children?: ReactNode }) {
  return (
    <>
      <path d="M0 0 C -15 -18 -15 -40 0 -44 C 15 -40 15 -18 0 0 Z" fill={fill} stroke="#070a12" strokeWidth="2.5" />
      {children ?? <circle cx="0" cy="-26" r="5.5" fill="#070a12" />}
    </>
  );
}

function Chip({ x, y, w, text, tone, on, dy = 10 }: { x: number; y: number; w: number; text: string; tone: string; on: boolean; dy?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="ld-t" style={show(on, { transform: on ? "none" : `translateY(${dy}px)` })}>
        <rect width={w} height="30" rx="15" fill="rgba(13,18,32,0.95)" stroke={tone} strokeOpacity="0.7" />
        <circle cx="16" cy="15" r="4" fill={tone} />
        <text x="28" y="20" fontSize="14" fontWeight="600" fill="#e6e9f2">
          {text}
        </text>
      </g>
    </g>
  );
}

export function StoryStage({ step, label }: { step: number; label: string }) {
  const merged = step >= 1;
  const crewOnSite = step >= 2;
  const closed = step >= 5;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gridId = `ld-st-grid-${uid}`;
  const glowId = `ld-st-glow-${uid}`;
  const clipId = `ld-st-clip-${uid}`;
  const pinColor = closed ? "#34d399" : step === 4 ? "#f87171" : merged ? "#5b8cff" : "#fbbf24";

  return (
    <svg viewBox="0 0 600 420" role="img" aria-label={label} className="block h-auto w-full" fontFamily="var(--font-geist-sans), system-ui, sans-serif">
      <defs>
        <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="rgba(148,163,196,0.07)" />
        </pattern>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={pinColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={pinColor} stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          <rect width="600" height="420" rx="24" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect width="600" height="420" fill="#0a0f1c" />
        <rect width="600" height="420" fill={`url(#${gridId})`} />

        {/* Blocks */}
        <g fill="rgba(148,163,196,0.05)" stroke="rgba(148,163,196,0.09)">
          <rect x="30" y="90" width="150" height="150" rx="14" />
          <rect x="200" y="90" width="190" height="120" rx="14" />
          <rect x="30" y="330" width="210" height="80" rx="14" />
          <rect x="270" y="330" width="130" height="80" rx="14" />
          <rect x="470" y="330" width="120" height="80" rx="14" />
          <rect x="490" y="200" width="100" height="80" rx="14" />
        </g>

        {/* Roads */}
        <path d={`M-10 ${ROAD_Y} H610`} stroke="#253049" strokeWidth="34" />
        <path d={`M-10 ${ROAD_Y} H505`} stroke="rgba(230,233,242,0.18)" strokeWidth="1.5" strokeDasharray="12 12" />
        <path d="M440 -10 V610" stroke="#1f2940" strokeWidth="24" />
        <text x="586" y={ROAD_Y + 5} textAnchor="end" fontSize="11" fontFamily="var(--font-geist-mono), ui-monospace, monospace" fill="#5f6880" letterSpacing="1.5">
          GT ROAD
        </text>

        {/* Status pill (top-left) */}
        <g transform="translate(22 22)">
          <rect width="236" height="40" rx="12" fill="rgba(19,26,43,0.95)" stroke="rgba(148,163,196,0.22)" />
          <text x="14" y="25.5" fontSize="11" fontFamily="var(--font-geist-mono), ui-monospace, monospace" fill="#8b94ab" letterSpacing="1">
            CASE
          </text>
          {STATUS.map((s, i) => (
            <g key={s.text} className="ld-t" style={show(step === i, { transform: step === i ? "none" : "translateY(6px)" })}>
              <circle cx="60" cy="20" r="4" fill={s.color} />
              <text x="72" y="25.5" fontSize="15" fontWeight="600" fill="#e6e9f2">
                {s.text}
              </text>
            </g>
          ))}
          <text x="72" y="25" fontSize="14" fill="#5f6880" className="ld-t" style={show(step < 0)}>
            Waiting for a report…
          </text>
        </g>

        {/* 1 · Dedup radius + root-cause link to the pothole */}
        <g transform={`translate(${SITE.x} ${SITE.y - 20})`}>
          <circle r="74" fill="rgba(34,211,238,0.05)" stroke="#22d3ee" strokeOpacity="0.55" strokeDasharray="5 6" className="ld-t ld-fc" style={show(step === 1, { transform: step === 1 ? "none" : "scale(0.7)" })} />
        </g>
        <text x={SITE.x} y={SITE.y + 78} textAnchor="middle" fontSize="11" fill="#22d3ee" fontFamily="var(--font-geist-mono), ui-monospace, monospace" className="ld-t" style={show(step === 1)}>
          150 m · 72 h
        </text>
        <path
          d={`M${SITE.x + 14} ${SITE.y - 30} Q ${(SITE.x + POTHOLE.x) / 2 + 10} ${POTHOLE.y - 70} ${POTHOLE.x - 8} ${POTHOLE.y - 30}`}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2"
          strokeDasharray="5 6"
          className="ld-t"
          style={show(step === 1)}
        />
        <g transform={`translate(${POTHOLE.x} ${POTHOLE.y})`}>
          <g className="ld-t ld-fb" style={show(step >= 1 && step < 3, { transform: step >= 1 ? "none" : "translateY(-20px) scale(0.6)" })}>
            <Pin fill="#a78bfa" />
          </g>
        </g>
        <Chip x={340} y={66} w={222} text="Shared cause · 1 repair" tone="#a78bfa" on={step === 1} />

        {/* 2 · Crew route + truck */}
        <path
          d={`M${DEPOT.x} ${ROAD_Y} H${SITE.x}`}
          stroke="#22d3ee"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          className="ld-t"
          style={{ strokeDashoffset: crewOnSite ? 0 : 100, opacity: step >= 2 && step < 5 ? 0.9 : 0 }}
        />
        <g transform={`translate(${DEPOT.x - 18} ${ROAD_Y + 26})`}>
          <rect width="36" height="20" rx="6" fill="#131a2b" stroke="rgba(148,163,196,0.3)" />
          <text x="18" y="14" textAnchor="middle" fontSize="9.5" fill="#8b94ab" fontFamily="var(--font-geist-mono), ui-monospace, monospace">
            DEPOT
          </text>
        </g>
        <g transform={`translate(${DEPOT.x} ${ROAD_Y})`}>
          <g
            className="ld-t"
            style={{
              transform: `translateX(${crewOnSite ? SITE.x - DEPOT.x - 30 : 0}px)`,
              transitionDuration: "600ms, 1400ms, 1200ms",
              opacity: step >= 2 ? 1 : 0.55,
            }}
          >
            <rect x="-20" y="-12" width="40" height="24" rx="7" fill="#22d3ee" />
            <rect x="6" y="-8" width="10" height="9" rx="2" fill="#0a0f1c" opacity="0.7" />
            <circle cx="-10" cy="12" r="4" fill="#070a12" stroke="#22d3ee" strokeWidth="2" />
            <circle cx="10" cy="12" r="4" fill="#070a12" stroke="#22d3ee" strokeWidth="2" />
          </g>
        </g>
        <Chip x={84} y={226} w={172} text="Nearest free crew" tone="#22d3ee" on={step === 2} />

        {/* 3 · Deadline + escalation ladder */}
        <g transform="translate(372 64)">
        <g className="ld-t" style={show(step === 3, { transform: step === 3 ? "none" : "translateY(10px)" })}>
          <rect width="206" height="136" rx="16" fill="rgba(19,26,43,0.96)" stroke="rgba(251,191,36,0.45)" />
          <text x="16" y="26" fontSize="11" fill="#8b94ab" fontFamily="var(--font-geist-mono), ui-monospace, monospace" letterSpacing="1">
            IF THE DEADLINE SLIPS
          </text>
          {["Officer", "Department head", "City command"].map((t, i) => (
            <g key={t} transform={`translate(16 ${44 + i * 30})`}>
              <rect width="174" height="24" rx="8" fill={i === 0 ? "rgba(251,191,36,0.16)" : "rgba(148,163,196,0.06)"} stroke={i === 0 ? "rgba(251,191,36,0.6)" : "rgba(148,163,196,0.16)"} />
              <text x="12" y="16.5" fontSize="12.5" fontWeight="600" fill={i === 0 ? "#fde68a" : "#8b94ab"}>
                {i + 1}. {t}
              </text>
            </g>
          ))}
        </g>
        </g>
        <g transform={`translate(${SITE.x} ${SITE.y - 22})`}>
          <circle r="40" fill="none" stroke="rgba(251,191,36,0.15)" strokeWidth="5" className="ld-t" style={show(step === 3)} />
          <circle
            r="40"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            transform="rotate(-90)"
            className="ld-t"
            style={{ opacity: step === 3 ? 1 : 0, strokeDashoffset: step === 3 ? 38 : 0 }}
          />
        </g>

        {/* 4 · "Done" vs "still broken" */}
        <Chip x={SITE.x - 160} y={SITE.y + 82} w={140} text="Crew: done" tone="#8b94ab" on={step === 4} />
        <g transform={`translate(${SITE.x + 50} ${SITE.y - 120})`}>
          <g className="ld-t" style={show(step === 4, { transform: step === 4 ? "none" : "translateX(16px)" })}>
            <rect width="168" height="52" rx="14" fill="rgba(248,113,113,0.12)" stroke="rgba(248,113,113,0.6)" />
            <text x="14" y="21" fontSize="11" fill="#fca5a5" fontFamily="var(--font-geist-mono), ui-monospace, monospace" letterSpacing="1">
              CITIZEN
            </text>
            <text x="14" y="40" fontSize="14" fontWeight="600" fill="#fee2e2">
              “Still broken.”
            </text>
          </g>
        </g>

        {/* 5 · Photo evidence */}
        <g transform={`translate(${SITE.x + 54} ${SITE.y - 128})`}>
          <g className="ld-t" style={show(step === 5, { transform: step === 5 ? "none" : "translateY(12px)" })}>
            <rect width="170" height="94" rx="14" fill="rgba(19,26,43,0.96)" stroke="rgba(52,211,153,0.55)" />
            <rect x="10" y="10" width="64" height="74" rx="9" fill="#12352b" />
            <path d="M14 76 L34 52 L46 64 L56 54 L70 76 Z" fill="#1f6b52" />
            <circle cx="58" cy="26" r="7" fill="#34d399" opacity="0.6" />
            <text x="84" y="34" fontSize="11" fill="#6ee7b7" fontFamily="var(--font-geist-mono), ui-monospace, monospace" letterSpacing="1">
              EVIDENCE
            </text>
            <text x="84" y="54" fontSize="13" fontWeight="600" fill="#e6e9f2">
              Site photo
            </text>
            <text x="84" y="72" fontSize="12" fill="#8b94ab">
              after repair
            </text>
          </g>
        </g>

        {/* The case pin: duplicates merge into it, colour follows the case state */}
        <g transform={`translate(${SITE.x} ${SITE.y})`}>
          <circle cy="-22" r="64" fill={`url(#${glowId})`} className="ld-t" style={show(step >= 0)} />
          {merged && (
            <>
              <g className="ld-merge ld-fb" style={{ "--dx": "64px", "--dy": "-34px" } as Vars}>
                <Pin fill="#fbbf24" />
              </g>
              <g className="ld-merge ld-fb" style={{ "--dx": "-58px", "--dy": "-12px", animationDelay: "180ms" } as Vars}>
                <Pin fill="#fbbf24" />
              </g>
            </>
          )}
          {step === 0 && <circle cy="-22" r="22" fill="none" stroke="#fbbf24" strokeWidth="2" className="ld-pulse-once ld-fc" />}
          <g className="ld-t ld-fb" style={show(step >= 0, { transform: step >= 0 ? "none" : "translateY(-30px) scale(0.6)" })}>
            <Pin fill={pinColor}>
              {closed ? (
                <path d="M-7 -26 L-2 -21 L7 -31" fill="none" stroke="#04281c" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              ) : merged ? (
                <text x="0" y="-21" textAnchor="middle" fontSize="15" fontWeight="700" fill="#070a12">
                  3
                </text>
              ) : undefined}
            </Pin>
          </g>
        </g>

        {/* 0 · The citizen's report */}
        <g transform={`translate(${SITE.x - 236} ${SITE.y - 150})`}>
          <g className="ld-t" style={show(step === 0, { transform: step === 0 ? "none" : "translateX(-16px)" })}>
            <rect width="196" height="64" rx="14" fill="rgba(19,26,43,0.96)" stroke="rgba(251,191,36,0.5)" />
            <text x="14" y="23" fontSize="11" fill="#fcd34d" fontFamily="var(--font-geist-mono), ui-monospace, monospace" letterSpacing="1">
              CITIZEN REPORT
            </text>
            <text x="14" y="45" fontSize="14" fontWeight="600" fill="#e6e9f2">
              Burst pipe · photo + GPS
            </text>
          </g>
        </g>
      </g>
      <rect x="0.5" y="0.5" width="599" height="419" rx="23.5" fill="none" stroke="rgba(148,163,196,0.16)" />
    </svg>
  );
}
