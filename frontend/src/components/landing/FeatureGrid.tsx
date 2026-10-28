"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { BadgeCheck, GitMerge, Network, RotateCcw, Siren, Truck } from "lucide-react";

type Feature = {
  icon: ReactNode;
  title: string;
  body: string;
  tone: string;
  span?: string;
  wide?: boolean;
  visual?: ReactNode;
};

function Ladder() {
  const rungs = ["Officer", "Department head", "City command"];
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
      {rungs.map((r, i) => (
        <div key={r} className="flex items-center gap-2 sm:contents">
          <span
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              i === 0 ? "border-warn/50 bg-warn/10 text-amber-200" : i === 1 ? "border-warn/30 bg-warn/5 text-amber-100/80" : "border-bad/40 bg-bad/10 text-red-200"
            }`}
          >
            {r}
          </span>
          {i < rungs.length - 1 && (
            <span aria-hidden="true" className="hidden text-muted sm:inline">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DedupVisual() {
  return (
    <div aria-hidden="true" className="relative mt-6 h-28 overflow-hidden rounded-xl border border-line bg-background/60">
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-accent-2/60 bg-accent-2/5" />
      <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2">
        <span className="ld-ping absolute inset-0 rounded-full border border-accent-2/50" />
      </span>
      <span className="absolute left-[calc(50%-26px)] top-[calc(50%-18px)] h-2.5 w-2.5 rounded-full bg-warn" />
      <span className="absolute left-[calc(50%+16px)] top-[calc(50%-8px)] h-2.5 w-2.5 rounded-full bg-warn" />
      <span className="absolute left-[calc(50%-6px)] top-[calc(50%+14px)] h-2.5 w-2.5 rounded-full bg-warn" />
      <span className="absolute left-1/2 top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-xs font-bold text-white shadow-[0_0_24px_rgba(91,140,255,0.8)]">
        1
      </span>
      <span className="absolute bottom-2 right-3 font-mono text-[11px] text-accent-2">150 m · 72 h</span>
    </div>
  );
}

function ReopenVisual() {
  const items = [
    { t: "Crew: done", c: "border-line-strong bg-surface-2 text-muted" },
    { t: "Citizen: still broken", c: "border-bad/50 bg-bad/10 text-red-200" },
    { t: "Reopened", c: "border-warn/50 bg-warn/10 text-amber-200" },
  ];
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {items.map((it, i) => (
        <span key={it.t} className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-sm font-medium ${it.c}`}>{it.t}</span>
          {i < items.length - 1 && (
            <span aria-hidden="true" className="text-muted">
              →
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

const FEATURES: Feature[] = [
  {
    icon: <GitMerge className="h-5 w-5" />,
    title: "Duplicates merge, automatically",
    body: "Reports of the same problem within 150 m and 72 h become one case, so departments see one job instead of a pile of tickets.",
    tone: "text-accent-2",
    span: "lg:col-span-2",
    wide: true,
    visual: <DedupVisual />,
  },
  {
    icon: <Network className="h-5 w-5" />,
    title: "Shared root causes",
    body: "Related incidents are linked to the most upstream cause. An operator confirms it and one repair covers the whole group.",
    tone: "text-violet-300",
  },
  {
    icon: <Truck className="h-5 w-5" />,
    title: "Nearest crew, re-planned",
    body: "Dispatch sends the closest free crew and re-plans if that crew drops out.",
    tone: "text-accent-2",
  },
  {
    icon: <Siren className="h-5 w-5" />,
    title: "Deadlines that escalate",
    body: "Every case carries an SLA deadline. Miss it and the case climbs the ladder, visibly.",
    tone: "text-warn",
    span: "lg:col-span-2",
    wide: true,
    visual: <Ladder />,
  },
  {
    icon: <BadgeCheck className="h-5 w-5" />,
    title: "Evidence-gated closure",
    body: "“Done” means awaiting proof. A case closes only when evidence supports the fix and nothing contradicts it.",
    tone: "text-ok",
  },
  {
    icon: <RotateCcw className="h-5 w-5" />,
    title: "Citizens can reopen",
    body: "One tap on “still broken” reopens the case. False closures get caught, not counted as wins.",
    tone: "text-bad",
    span: "lg:col-span-2",
    visual: <ReopenVisual />,
  },
];

function onMove(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <article
          key={f.title}
          onPointerMove={onMove}
          className={`ld-card ld-reveal flex flex-col rounded-2xl p-6 sm:p-7 ${f.span ?? ""} ${f.wide ? "sm:col-span-2" : ""}`}
          style={{ "--d": i % 3 } as CSSProperties}
        >
          <span className={`grid h-10 w-10 place-items-center rounded-xl border border-line-strong bg-surface-2 ${f.tone}`}>{f.icon}</span>
          <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{f.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
          {f.visual}
        </article>
      ))}
    </div>
  );
}
