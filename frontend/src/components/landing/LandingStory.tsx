"use client";

import { useEffect, useState } from "react";

import { easeInOut, easeOut, lerp, seg, useScrollStory } from "./useScrollStory";

/**
 * "Follow one complaint": a scroll-driven walk through the CONVERGE loop on a stylised
 * city block (GT Road by Rishihood University, Sonipat). `c` is the chapter position (0 → CHAPTERS); every visual
 * on the stage is derived from it.
 */
const CHAPTERS = 6;

const CAPTIONS = [
  { eyebrow: "1 · Report", title: "A citizen reports a burst pipe.", body: "About 20 seconds on a phone, with location and a photo." },
  { eyebrow: "2 · Merge", title: "Two neighbours report the same leak.", body: "CONVERGE merges them into one case, not three tickets." },
  { eyebrow: "3 · Root cause", title: "A pothole opens down the road.", body: "It's linked to the leak as a likely shared cause: one repair, not three visits." },
  { eyebrow: "4 · Dispatch", title: "The nearest free crew is sent.", body: "If the crew drops out, the job is re-planned. Every deadline is tracked." },
  { eyebrow: "5 · Dispute", title: "“Done” isn't proof.", body: "The crew marks it complete. A citizen says it's still leaking, so the case reopens." },
  { eyebrow: "6 · Verify", title: "Closed only when it's really fixed.", body: "A photo from the site confirms the repair. Every step is on the audit trail." },
];

const C = {
  ink: "#0f172a",
  land: "#eef3ef",
  block: "#e2eae4",
  road: "#ffffff",
  roadEdge: "#d5ded7",
  red: "#e11d48",
  amber: "#d97706",
  green: "#059669",
  violet: "#7c3aed",
  slate: "#64748b",
};

const LEAK = { x: 420, y: 250 };
const POTHOLE = { x: 590, y: 400 };
const DEPOT = { x: 110, y: 470 };

export function LandingStory() {
  const { sectionRef, chapter: c } = useScrollStory(CHAPTERS);
  const idx = Math.min(CHAPTERS - 1, Math.floor(c));

  return (
    <section ref={sectionRef} aria-label="How CONVERGE works, one complaint at a time" style={{ height: `${(CHAPTERS + 1) * 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Captions c={c} idx={idx} />
          <Stage c={c} />
        </div>
        <Progress c={c} />
      </div>
    </section>
  );
}

function Captions({ c, idx }: { c: number; idx: number }) {
  // Cross-fade between captions around each chapter boundary.
  const local = c - idx;
  const fadeIn = idx === 0 ? 1 : easeOut(seg(local, 0, 0.25));
  const fadeOut = idx === CHAPTERS - 1 ? 1 : 1 - seg(local, 0.93, 1);
  const o = Math.min(fadeIn, fadeOut);
  const cap = CAPTIONS[idx];
  return (
    <div className="relative min-h-[220px]" aria-live="polite">
      <div style={{ opacity: o, transform: `translateY(${(1 - o) * 14}px)` }}>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{cap.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">{cap.title}</h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-600">{cap.body}</p>
      </div>
    </div>
  );
}

function Progress({ c }: { c: number }) {
  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden="true">
      {CAPTIONS.map((_, i) => {
        const fill = seg(c, i, i + 1);
        return (
          <span key={i} className="h-1 w-10 overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${fill * 100}%` }} />
          </span>
        );
      })}
    </div>
  );
}

function Pin({ x, y, color, scale = 1, label, ring = 0, check = false }: { x: number; y: number; color: string; scale?: number; label?: string; ring?: number; check?: boolean }) {
  if (scale <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {ring > 0 && <circle r={18 + ring * 40} fill="none" stroke={color} strokeWidth={2} opacity={1 - ring} />}
      <ellipse cx={0} cy={4} rx={9} ry={3} fill="#000" opacity={0.12} />
      <path d="M0 0 C -14 -16 -14 -36 0 -40 C 14 -36 14 -16 0 0 Z" fill={color} stroke="#fff" strokeWidth={2.5} />
      {check ? (
        <path d="M-6 -24 L-1.5 -19.5 L6.5 -28" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <circle cx={0} cy={-24} r={5} fill="#fff" />
      )}
      {label && (
        <text x={0} y={-50} textAnchor="middle" fontSize={13} fontWeight={600} fill={C.ink}>
          {label}
        </text>
      )}
    </g>
  );
}

function Chip({ x, y, text, color, o }: { x: number; y: number; text: string; color: string; o: number }) {
  if (o <= 0.001) return null;
  const w = text.length * 7.4 + 28;
  return (
    <g transform={`translate(${x - w / 2} ${y + (1 - o) * 10})`} opacity={o}>
      <rect width={w} height={30} rx={15} fill={color} />
      <text x={w / 2} y={20} textAnchor="middle" fontSize={13} fontWeight={600} fill="#fff">
        {text}
      </text>
    </g>
  );
}

function Bubble({ x, y, text, o, from = "left" }: { x: number; y: number; text: string; o: number; from?: "left" | "right" }) {
  if (o <= 0.001) return null;
  const w = text.length * 7.2 + 36;
  const dx = (1 - o) * (from === "left" ? -24 : 24);
  return (
    <g transform={`translate(${x + dx} ${y})`} opacity={o}>
      <rect width={w} height={40} rx={14} fill="#fff" stroke={C.roadEdge} />
      <text x={18} y={25} fontSize={14} fill={C.ink}>
        {text}
      </text>
    </g>
  );
}

export function Stage({ c }: { c: number }) {
  // Chapter 1: report A drops in.
  const aDrop = easeOut(seg(c, 0.1, 0.55));
  const bubbleA = seg(c, 0.3, 0.6) * (1 - seg(c, 0.95, 1.2));
  // Chapter 2: reports B and C drop, then merge into A.
  const bDrop = easeOut(seg(c, 1.05, 1.35));
  const cDrop = easeOut(seg(c, 1.2, 1.5));
  const merge = easeInOut(seg(c, 1.55, 1.9));
  const mergedChip = seg(c, 1.8, 2.0) * (1 - seg(c, 2.45, 2.65));
  const B = { x: lerp(470, LEAK.x, merge), y: lerp(205, LEAK.y, merge) };
  const Cc = { x: lerp(365, LEAK.x, merge), y: lerp(290, LEAK.y, merge) };
  const count = 1 + (bDrop > 0.5 ? 1 : 0) + (cDrop > 0.5 ? 1 : 0);
  // Chapter 3: pothole + shared-cause link.
  const pDrop = easeOut(seg(c, 2.1, 2.45));
  const link = seg(c, 2.45, 2.85);
  const causeChip = seg(c, 2.75, 2.95) * (1 - seg(c, 3.9, 4.05));
  // Chapter 4: crew drives depot → leak along the roads.
  const drive = easeInOut(seg(c, 3.1, 3.85));
  const crew = drivePoint(drive);
  const crewShown = seg(c, 3.0, 3.1);
  // Chapter 5: "done" → "still leaking" → reopened.
  const doneChip = seg(c, 4.05, 4.25) * (1 - seg(c, 4.5, 4.6));
  const bubbleNo = seg(c, 4.35, 4.6) * (1 - seg(c, 4.95, 5.15));
  const reopenChip = seg(c, 4.55, 4.75) * (1 - seg(c, 5.1, 5.25));
  const shake = c > 4.55 && c < 4.85 ? Math.sin((c - 4.55) * 80) * 4 * (1 - seg(c, 4.55, 4.85)) : 0;
  // Chapter 6: photo → verified, everything turns green.
  const photo = seg(c, 5.1, 5.4) * (1 - seg(c, 5.85, 5.95));
  const verified = easeOut(seg(c, 5.35, 5.7));
  const ripple = seg(c, 5.4, 5.95);
  const verifiedChip = seg(c, 5.55, 5.75);

  const leakColor = verified > 0.5 ? C.green : c >= 4.55 ? C.red : c >= 4.05 ? C.amber : C.red;
  const potholeColor = verified > 0.5 ? C.green : C.amber;

  return (
    <div className="relative">
      <svg viewBox="0 0 800 560" className="h-auto w-full drop-shadow-[0_30px_60px_rgba(15,23,42,0.18)]" role="img" aria-label="Animated city map showing one complaint from report to verified fix">
        <rect width={800} height={560} rx={28} fill={C.land} />
        {/* City blocks */}
        {[
          [40, 40, 300, 150],
          [480, 40, 280, 150],
          [40, 300, 230, 120],
          [330, 300, 200, 220],
          [620, 260, 140, 260],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx={14} fill={C.block} />
        ))}
        <rect x={560} y={70} width={120} height={80} rx={10} fill="#d4eadb" />
        <text x={620} y={115} textAnchor="middle" fontSize={12} fill={C.slate}>
          Rishihood Univ.
        </text>
        {/* Roads */}
        <g stroke={C.roadEdge} strokeWidth={34} strokeLinecap="round">
          <line x1={0} y1={250} x2={800} y2={250} />
          <line x1={420} y1={0} x2={420} y2={560} />
          <line x1={110} y1={250} x2={110} y2={560} />
          <line x1={420} y1={400} x2={800} y2={400} />
        </g>
        <g stroke={C.road} strokeWidth={28} strokeLinecap="round">
          <line x1={0} y1={250} x2={800} y2={250} />
          <line x1={420} y1={0} x2={420} y2={560} />
          <line x1={110} y1={250} x2={110} y2={560} />
          <line x1={420} y1={400} x2={800} y2={400} />
        </g>
        <g fontSize={12} fill={C.slate} fontWeight={600}>
          <text x={150} y={238}>GT Road (NH-44)</text>
          <text x={432} y={40} transform="rotate(90 432 40)">Murthal Road</text>
          <text x={630} y={388}>Sector 15 Road</text>
        </g>
        {/* Depot */}
        <g transform={`translate(${DEPOT.x - 26} ${DEPOT.y + 22})`}>
          <rect width={52} height={26} rx={6} fill="#fff" stroke={C.roadEdge} />
          <text x={26} y={17} textAnchor="middle" fontSize={11} fill={C.slate}>
            Depot
          </text>
        </g>

        {/* Shared-cause link */}
        {link > 0 && (
          <line
            x1={LEAK.x}
            y1={LEAK.y - 20}
            x2={lerp(LEAK.x, POTHOLE.x, link)}
            y2={lerp(LEAK.y - 20, POTHOLE.y - 20, link)}
            stroke={C.violet}
            strokeWidth={3}
            strokeDasharray="8 7"
            opacity={verified > 0.5 ? 0.35 : 1}
          />
        )}

        {/* Reports B and C (merge into A) */}
        {merge < 0.98 && <Pin x={B.x} y={B.y} color={C.red} scale={bDrop * (1 - merge * 0.6)} />}
        {merge < 0.98 && <Pin x={Cc.x} y={Cc.y} color={C.red} scale={cDrop * (1 - merge * 0.6)} />}

        {/* Pothole */}
        <Pin x={POTHOLE.x} y={POTHOLE.y} color={potholeColor} scale={pDrop} check={verified > 0.5} />

        {/* Main case */}
        <g transform={`translate(${shake} 0)`}>
          <Pin x={LEAK.x} y={LEAK.y} color={leakColor} scale={aDrop * (1 + merge * 0.15)} ring={ripple} check={verified > 0.5} />
          {aDrop > 0.9 && (
            <g transform={`translate(${LEAK.x + 14} ${LEAK.y - 52})`} opacity={seg(c, 1.3, 1.5)}>
              <circle r={12} fill={C.ink} />
              <text y={4.5} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
                {count}
              </text>
            </g>
          )}
        </g>

        {/* Crew truck */}
        {crewShown > 0 && (
          <g transform={`translate(${crew.x} ${crew.y})`} opacity={crewShown * (1 - seg(c, 5.7, 5.9))}>
            <rect x={-16} y={-11} width={32} height={22} rx={6} fill={C.ink} />
            <text y={4.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
              W1
            </text>
          </g>
        )}

        <Bubble x={470} y={140} text="Water gushing near the university gate" o={bubbleA} from="right" />
        <Bubble x={470} y={140} text="Still leaking at the same spot" o={bubbleNo} from="right" />
        <Chip x={LEAK.x} y={LEAK.y + 30} text="3 reports → 1 case" color={C.ink} o={mergedChip} />
        <Chip x={(LEAK.x + POTHOLE.x) / 2 + 40} y={(LEAK.y + POTHOLE.y) / 2 - 40} text="Shared cause · 1 repair, not 3" color={C.violet} o={causeChip} />
        <Chip x={LEAK.x} y={LEAK.y + 30} text="Crew: “done” · awaiting proof" color={C.amber} o={doneChip} />
        <Chip x={LEAK.x} y={LEAK.y + 30} text="Reopened: contradicting evidence" color={C.red} o={reopenChip} />
        <Chip x={400} y={500} text="✓ Verified closed · audit trail complete" color={C.green} o={verifiedChip} />

        {/* Photo evidence card */}
        {photo > 0 && (
          <g transform={`translate(${520 + (1 - photo) * 30} 120)`} opacity={photo}>
            <rect width={190} height={120} rx={14} fill="#fff" stroke={C.roadEdge} />
            <rect x={12} y={12} width={166} height={72} rx={8} fill="#cfe5d6" />
            <path d="M24 74 L70 40 L104 66 L128 50 L166 74 Z" fill="#a7d3b5" />
            <circle cx={150} cy={32} r={9} fill="#f6d77a" />
            <text x={14} y={106} fontSize={12} fill={C.ink} fontWeight={600}>
              Site photo · road dry
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/** Crew route: up from the depot to GT Road, then right along GT Road to the leak. */
function drivePoint(t: number) {
  const up = Math.min(1, t * 2);
  const right = Math.max(0, t * 2 - 1);
  return { x: lerp(DEPOT.x, LEAK.x - 26, right), y: lerp(DEPOT.y, 250, up) };
}

/** Hero: the same city story playing on its own in a gentle loop (no scrolling needed). */
export function HeroLoop() {
  const [c, setC] = useState(5.8);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const SECONDS_PER_CHAPTER = 2.6;
    const HOLD = 1.2; // linger on the verified ending before restarting
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) / 1000 / SECONDS_PER_CHAPTER) % (CHAPTERS + HOLD);
      setC(Math.min(t, CHAPTERS - 0.05));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="motion-safe:animate-[float_7s_ease-in-out_infinite]">
      <Stage c={c} />
    </div>
  );
}
