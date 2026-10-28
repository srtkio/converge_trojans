"use client";

import { useEffect, useRef } from "react";

import { api } from "@/lib/api";
import type { CitizenActivity, Incident, Metrics } from "@/lib/types";

import { CLOSED, useLive } from "./live-data";

const loadProof = (): Promise<[Metrics, Incident[]]> => Promise.all([api.metrics(), api.incidents()]);
const loadActivity = (): Promise<CitizenActivity[]> => api.citizenActivity(12);

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/** Counts up from the last shown value once the number scrolls into view. Static under reduced motion. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      el.textContent = fmt(value);
      shown.current = value;
      return;
    }
    let raf = 0;
    const from = shown.current;
    el.textContent = fmt(from);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / 900);
          el.textContent = fmt(from + (value - from) * (1 - Math.pow(1 - t, 3)));
          if (t < 1) raf = requestAnimationFrame(step);
          else shown.current = value;
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return (
    <>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{fmt(value)}</span>
    </>
  );
}

function ago(at: string, now: number): string {
  const ms = now - new Date(at).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "just now";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** First name only: the API sends ids like "citizen:deepak". */
function firstName(raw: string): string {
  const word = (raw.split(":").pop() ?? "").trim().split(/[\s@._-]+/)[0] ?? "";
  return word ? word[0].toUpperCase() + word.slice(1) : "A citizen";
}

function describe(a: CitizenActivity): string {
  const who = firstName(a.citizen);
  const what = a.incident_title ?? (a.category ? a.category.replace(/_/g, " ") : "a problem");
  if (a.kind === "complaint") return `${who} reported: ${what}`;
  if (a.supports === true) return `${who} confirmed the fix: ${what}`;
  if (a.supports === false) return `${who} says it is not fixed: ${what}`;
  return `${who} added evidence: ${what}`;
}

function Ticker() {
  const live = useLive(loadActivity, 15000);
  if (live.state !== "ok" || live.data.length === 0) return null;
  const items = live.data.slice(0, 10);
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {items.map((a) => (
        <li key={a.id} className="flex max-w-[22rem] items-center gap-2 whitespace-nowrap rounded-full border border-line bg-background/60 px-3.5 py-1.5 text-sm text-foreground/85">
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.kind === "complaint" ? "bg-warn" : a.supports === false ? "bg-bad" : "bg-ok"}`} />
          <span className="truncate">{describe(a)}</span>
          <span className="shrink-0 font-mono text-[11px] text-muted">{ago(a.at, live.at)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Latest from citizens</p>
      <div className="ld-marquee mt-3 overflow-hidden">
        <div className="ld-marquee-track flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}

const TILE = "rounded-2xl border border-line bg-background/50 px-4 py-4 sm:px-5";

/** Live numbers from the backend. Skeleton while loading; the whole strip hides if the API is unreachable. */
export function LiveProof() {
  const live = useLive(loadProof, 30000);
  if (live.state === "error") return null;

  let tiles: { label: string; value: number; tone: string }[] = [];
  if (live.state === "ok") {
    const [m, incidents] = live.data;
    const open = incidents.filter((i) => !CLOSED.has(i.status)).length;
    tiles = [
      { label: "Reports received", value: m.reports, tone: "text-foreground" },
      { label: "Duplicates merged", value: m.duplicates_linked, tone: "text-accent-2" },
      { label: "Cases open", value: open, tone: "text-warn" },
      { label: "Verified closed", value: m.verified_closures, tone: "text-ok" },
    ];
    if (typeof m.crew_visits_saved === "number") tiles.push({ label: "Crew visits saved", value: m.crew_visits_saved, tone: "text-accent" });
  }

  return (
    <section id="live" aria-labelledby="live-heading" className="relative z-10 scroll-mt-20 px-4 pb-6 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-line-strong bg-surface/70 p-4 backdrop-blur sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="live-heading" className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.22em] text-accent">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="ld-ping absolute inline-flex h-full w-full rounded-full bg-ok" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            Live from the pilot
          </h2>
          <p className="text-xs text-muted">Straight from the CONVERGE API · refreshes on its own</p>
        </div>

        <ul className={`mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 ${tiles.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
          {live.state === "loading"
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className={`${TILE} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`} aria-hidden="true">
                  <span className="block h-8 w-16 rounded-md bg-white/[0.06] motion-safe:animate-pulse" />
                  <span className="mt-2 block h-4 w-24 max-w-full rounded bg-white/[0.04] motion-safe:animate-pulse" />
                </li>
              ))
            : tiles.map((t, i) => (
                <li key={t.label} className={`${TILE} ${i === tiles.length - 1 && tiles.length % 2 === 1 ? "col-span-2 sm:col-span-1" : ""}`}>
                  <p className={`h-8 text-[1.75rem] font-semibold leading-8 tabular-nums tracking-tight ${t.tone}`}>
                    <CountUp value={t.value} />
                  </p>
                  <p className="mt-2 h-4 text-sm leading-4 text-muted">{t.label}</p>
                </li>
              ))}
        </ul>

        <Ticker />
      </div>
    </section>
  );
}
