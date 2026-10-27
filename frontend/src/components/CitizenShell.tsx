"use client";

import { useEffect, useState, type ReactNode } from "react";

import { api } from "@/lib/api";

/**
 * Light, phone-first frame for every citizen page. It fixes the colours (the global theme turns
 * dark on dark-mode phones) and wakes the free backend as soon as the page opens, so the first
 * real request is quick.
 */
export function CitizenShell({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    api.health().catch(() => {
      // Asleep or offline: the page's own requests show a friendly message and retry.
    });
  }, []);

  return (
    <div className="min-h-dvh w-full bg-slate-50 bg-[radial-gradient(130%_45%_at_50%_0%,#d1fae5_0%,rgba(248,250,252,0)_70%)] font-sans text-slate-900 antialiased [color-scheme:light]">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pt-12">
        {offline && (
          <p role="status" className="cz-rise rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
            {"You're offline. Check your connection; this page updates when you're back."}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}


/** Small wordmark so every citizen page feels like the same product as /operator. */
export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-[0_6px_16px_-8px_rgba(5,150,105,0.8)]"
      >
        C
      </span>
      <span className="text-sm font-semibold tracking-[0.18em] text-slate-900">CONVERGE</span>
    </span>
  );
}
