"use client";

import { useEffect } from "react";

/**
 * One shared IntersectionObserver for every `.ld-reveal` element on the landing page.
 * Reveals are only "armed" (hidden until seen) once this runs, so the page is fully
 * readable without JavaScript. Elements already on screen are shown immediately, which
 * avoids a flash when the page loads mid-scroll.
 */
export function RevealObserver({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".ld-reveal"));
    const vh = window.innerHeight;

    const pending: HTMLElement[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.classList.add("ld-in", "ld-now");
      else pending.push(el);
    }
    root.classList.add("ld-armed");

    if (!("IntersectionObserver" in window)) {
      pending.forEach((el) => el.classList.add("ld-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("ld-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    pending.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootId]);

  return null;
}
