// Shared class strings for the citizen pages. Plain module (no "use client") so server components
// like the start page can use them too.

/** Primary citizen buttons and links: big, thumb-friendly, clear focus ring, gentle press. */
export const BIG_BUTTON =
  "flex h-14 w-full items-center justify-center rounded-xl text-lg font-semibold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 " +
  "motion-safe:active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

/** Card surface: white, soft layered shadow, hairline ring. */
export const CARD =
  "rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-18px_rgba(15,23,42,0.25)]";
