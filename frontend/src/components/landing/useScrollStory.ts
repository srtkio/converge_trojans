"use client";

import { useEffect, useRef, useState } from "react";

// Scroll-driven story, ported from RAGSeal's landing: a tall section with a sticky stage. The
// chapter position eases toward the scroll position (instead of jumping with it), so a trackpad
// flick doesn't make the scene snap. SMOOTH_MS is the easing time constant; MAX_CHAPTERS_PER_S
// caps how fast the story can play however hard the user scrolls.
const SMOOTH_MS = 200;
const MAX_CHAPTERS_PER_S = 3;

/** Returns a ref for the tall section and the current chapter position (0 → chapters) as a float. */
export function useScrollStory(chapters: number) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    let ease = 0;
    let goal = 0;
    let shown = 0;
    let last = 0;
    let first = true;

    const tick = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      const diff = goal - shown;
      if (Math.abs(diff) < 0.002) {
        shown = goal;
        setChapter(shown);
        ease = 0;
        last = 0;
        return;
      }
      const maxStep = (MAX_CHAPTERS_PER_S * dt) / 1000;
      const step = diff * (1 - Math.exp(-dt / SMOOTH_MS));
      shown += Math.max(-maxStep, Math.min(maxStep, step));
      setChapter(shown);
      ease = requestAnimationFrame(tick);
    };

    const measure = () => {
      const vh = window.innerHeight;
      const top = section.getBoundingClientRect().top;
      const travel = section.offsetHeight - vh;
      const p = travel > 0 ? Math.min(1, Math.max(0, -top / travel)) : 0;
      goal = p * chapters;
      // First paint lands directly; reduced motion never animates.
      if (first || reduced) {
        first = false;
        shown = goal;
        setChapter(shown);
        return;
      }
      if (!ease) ease = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(section);
    return () => {
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (ease) cancelAnimationFrame(ease);
    };
  }, [chapters]);

  return { sectionRef, chapter };
}

/** 0 before `start`, 1 after `end`, linear in between. */
export const seg = (c: number, start: number, end: number) => Math.min(1, Math.max(0, (c - start) / (end - start)));
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
