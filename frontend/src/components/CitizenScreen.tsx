import { ViewTransition, type ReactNode } from "react";

// Screen changes in the citizen app, keyed by the navigation's transition type:
// - "cz-tab": bottom-nav tabs, a fade-through;
// - "cz-forward" / "cz-back": into a case and back out, a short slide.
// Untyped navigations (browser back, refreshes, Suspense reveals) swap instantly.
// The CSS lives in app/citizen/citizen-app.css; under reduced motion nothing moves.
const TYPES = { "cz-tab": "cz-tab", "cz-forward": "cz-forward", "cz-back": "cz-back", default: "none" };

/** Wraps one screen of the citizen app. Used in each page, never a layout (layouts don't enter or exit). */
export function CitizenScreen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ViewTransition enter={TYPES} exit={TYPES} default="none">
      <div className={`flex min-w-0 flex-1 flex-col gap-5 ${className}`}>{children}</div>
    </ViewTransition>
  );
}
