"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "@/lib/citizen";

/** Fade-and-rise entrance; `index` staggers siblings by 70 ms (capped so pages never feel slow). */
export function Reveal({ children, index = 0, className = "" }: { children: ReactNode; index?: number; className?: string }) {
  return (
    <div className={`cz-rise ${className}`} style={{ animationDelay: `${Math.min(index, 5) * 70}ms` }}>
      {children}
    </div>
  );
}

/** Green tick that pops in and draws its stroke. Decorative: the text next to it carries the meaning. */
export function SuccessCheck({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" aria-hidden="true" className={`cz-pop shrink-0 ${className}`}>
      <circle cx="26" cy="26" r="25" className="fill-emerald-100" />
      <path
        d="M15 27l7 7 15-16"
        fill="none"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="cz-draw stroke-emerald-600"
      />
    </svg>
  );
}

/** Eases a number from its previous value to `target` (e.g. hours left when the clock jumps). */
export function useTween(target: number | null, ms = 700): number | null {
  const [value, setValue] = useState<number | null>(target);
  const current = useRef<number | null>(target);

  useEffect(() => {
    if (target === null) return;
    const from = current.current;
    const animate = from !== null && from !== target && !prefersReducedMotion();
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = animate ? Math.min(1, (t - start) / ms) : 1;
      const v = animate && from !== null ? from + (target - from) * (1 - (1 - k) ** 3) : target;
      current.current = v;
      setValue(v);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return target === null ? null : value;
}

/** Holds `value` back for one frame after mount so CSS transitions animate from the start state. */
export function useAfterMount<T>(value: T, initial: T): T {
  const [shown, setShown] = useState<T>(initial);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}
