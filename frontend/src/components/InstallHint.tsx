"use client";

import { useEffect, useState } from "react";

const KEY = "converge.installHint";

function shouldShow(): boolean {
  try {
    if (window.localStorage.getItem(KEY)) return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return false;
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return false;
    // iPhone and iPad Safari have no install prompt: they need the Share sheet.
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios;
  } catch {
    return false;
  }
}

/** iOS "Add to Home Screen" tip on My cases. Dismissed once, it stays away on this device. */
export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Reads the browser (display mode, storage), so it runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(shouldShow());
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Not remembered; it simply shows again next time.
    }
  };

  return (
    <aside
      aria-labelledby="install-heading"
      className="cz-rise flex items-start gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-emerald-200"
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-sm font-bold text-white"
      >
        C
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="install-heading" className="font-semibold text-slate-900">
          Install CONVERGE
        </h2>
        <p className="mt-0.5 text-slate-600">
          Tap Share <ShareGlyph /> in Safari, then Add to Home Screen. Your cases open like an app.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide install tip"
        className="-m-1 shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      >
        ✕
      </button>
    </aside>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="inline h-4 w-4 -translate-y-px text-sky-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5v10h14V11h-1" />
    </svg>
  );
}
