"use client";

import { useEffect, useRef, useState } from "react";

import { StoryStage } from "./StoryStage";

/**
 * "Follow one complaint": native scroll, no scroll-jacking. Each step is ordinary content;
 * an IntersectionObserver notes which step crosses the middle of the screen and the stage
 * glides to that state with CSS transitions. Desktop pins the stage with plain CSS sticky;
 * phones get a stage inside every step card instead (no sticky at all).
 */

const STEPS = [
  {
    tag: "Report",
    title: "A citizen reports a burst pipe.",
    body: "About 20 seconds on a phone: a photo, the location, a sentence. They get a case number to track.",
  },
  {
    tag: "Dedupe & link",
    title: "Two neighbours report the same leak.",
    body: "Reports within 150 m and 72 h of each other merge into one case. A pothole down the road is linked as a likely shared cause, so one repair covers both.",
  },
  {
    tag: "Assign",
    title: "The nearest free crew is sent.",
    body: "Dispatch picks the closest available crew. If that crew drops out, the job is re-planned instead of silently stalling.",
  },
  {
    tag: "Deadline",
    title: "Every case runs against a deadline.",
    body: "When the SLA slips, the case escalates up a ladder: the officer, then the department head, then city command.",
  },
  {
    tag: "Evidence",
    title: "“Done” is not proof.",
    body: "The crew marks it complete. A citizen replies “still broken”, so the case reopens: a false closure caught, not accepted.",
  },
  {
    tag: "Verified close",
    title: "Closed only when it’s really fixed.",
    body: "A photo from the site supports the repair and nothing contradicts it. Only then does the case close, with every step on the audit trail.",
  },
];

function stageLabel(i: number) {
  return `Step ${i + 1}, ${STEPS[i].tag}: ${STEPS[i].title}`;
}

export function LoopStory() {
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLOListElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);

  // Which step is crossing the middle of the viewport.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-step]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Progress rail: one rAF-throttled scroll read, written straight to a transform.
  useEffect(() => {
    const list = listRef.current;
    const rail = railRef.current;
    if (!list || !rail) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = list.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - r.top) / r.height));
      rail.style.transform = `scaleY(${p.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const desktopStep = Math.max(active, 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <ol ref={listRef} className="relative">
        {/* Rail */}
        <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-0 w-px bg-line" />
        <span
          ref={railRef}
          aria-hidden="true"
          className="absolute bottom-0 left-[15px] top-0 w-px origin-top bg-gradient-to-b from-accent-2 via-accent to-ok"
          style={{ transform: "scaleY(0)" }}
        />
        {STEPS.map((s, i) => {
          const on = active === i;
          const reached = active >= i;
          return (
            <li key={s.tag} data-step={i} className="relative pb-14 pl-12 last:pb-0 lg:flex lg:min-h-[72vh] lg:items-center lg:pb-0">
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 grid h-[31px] w-[31px] place-items-center rounded-full border font-mono text-xs font-semibold transition-colors duration-500 lg:top-1/2 lg:-translate-y-1/2 ${
                  reached ? "border-accent/70 bg-accent/15 text-white" : "border-line-strong bg-background text-muted"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className={`transition-opacity duration-500 lg:max-w-md ${on ? "lg:opacity-100" : "lg:opacity-40"}`}>
                <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent-2">{s.tag}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{s.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{s.body}</p>
                {/* Phones: each step carries its own stage, animating in as it arrives. */}
                <div className="-ml-12 mt-6 overflow-hidden rounded-3xl shadow-[0_30px_80px_-40px_rgba(91,140,255,0.6)] lg:hidden">
                  <StoryStage step={reached ? i : i - 1} label={stageLabel(i)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Desktop: one stage, pinned with plain CSS sticky while the steps scroll past. */}
      <div className="hidden lg:block">
        <div className="sticky top-[calc(50vh-210px)]">
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(91,140,255,0.22),transparent)]" />
            <div className="overflow-hidden rounded-3xl shadow-[0_40px_120px_-40px_rgba(91,140,255,0.55)]">
              <StoryStage step={desktopStep} label={stageLabel(desktopStep)} />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  key={s.tag}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === desktopStep ? "w-8 bg-accent" : i < desktopStep ? "w-3 bg-accent/50" : "w-3 bg-line-strong"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
