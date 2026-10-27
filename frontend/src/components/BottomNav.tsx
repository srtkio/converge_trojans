"use client";

import Link from "next/link";

import { prefersReducedMotion } from "@/lib/citizen";

export type Tab = "report" | "cases" | "map";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function CasesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" {...STROKE}>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" {...STROKE}>
      <path d="m9 4.5-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </svg>
  );
}

const TABS: { key: Tab; href: string; label: string; Icon: () => React.JSX.Element }[] = [
  { key: "report", href: "/citizen", label: "Report", Icon: ReportIcon },
  { key: "cases", href: "/citizen/cases", label: "My cases", Icon: CasesIcon },
  { key: "map", href: "/citizen/map", label: "Map", Icon: MapIcon },
];

/**
 * The citizen app's bottom nav: Report · My cases · Map. Fixed above the home indicator, and kept
 * still while screens change (it has its own view-transition name). `current` is false on a case
 * page, which belongs to My cases but isn't the list itself.
 */
export function BottomNav({ active, current = true, needsCheck = 0 }: { active: Tab | null; current?: boolean; needsCheck?: number }) {
  const index = TABS.findIndex((t) => t.key === active);
  return (
    <nav
      aria-label="Citizen app"
      style={{ viewTransitionName: "cz-tabbar" }}
      className="fixed inset-x-0 bottom-0 z-40 isolate border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur [color-scheme:light]"
    >
      <div className="relative mx-auto grid h-16 max-w-md grid-cols-3 px-2">
        {index >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-2 w-[calc((100%-1rem)/3)] rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 transition-transform duration-300 motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)`, transitionTimingFunction: "var(--cz-ease)" }}
          />
        )}
        {TABS.map(({ key, href, label, Icon }) => {
          const on = key === active;
          const badge = key === "cases" && needsCheck > 0;
          return (
            <Link
              key={key}
              href={href}
              transitionTypes={["cz-tab"]}
              aria-current={on ? (current ? "page" : "true") : undefined}
              onClick={(e) => {
                // Tapping the tab you're on scrolls back to the top instead of reloading it.
                if (on && current) {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
                }
              }}
              className={`relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 motion-safe:active:scale-95 ${
                on ? "text-emerald-800" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="relative">
                <span key={on ? "on" : "off"} className={on ? "cz-pop block" : "block"}>
                  <Icon />
                </span>
                {badge && (
                  <span
                    key={needsCheck}
                    aria-hidden="true"
                    className="cz-pop absolute -top-1.5 -right-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white"
                  >
                    {needsCheck}
                  </span>
                )}
              </span>
              <span>{label}</span>
              {badge && <span className="sr-only">, {needsCheck} need your check</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
