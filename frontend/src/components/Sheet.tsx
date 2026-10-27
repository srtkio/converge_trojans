"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "@/lib/citizen";

/**
 * Closing state for a sheet: plays the exit animation, then unmounts. Under reduced motion no
 * animation runs (so no animationend would ever fire): it unmounts at once.
 */
export function useSheetExit(onClosed: () => void) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (prefersReducedMotion()) onClosed();
    else setClosing(true);
  };
  const onAnimationEnd = (e: React.AnimationEvent) => {
    if (closing && e.target === e.currentTarget) onClosed();
  };
  return { closing, close, onAnimationEnd };
}

/** Escape closes; the page behind doesn't scroll; focus starts on `focusRef` and returns on close. */
export function useModal(open: boolean, onEscape: () => void, focusRef: React.RefObject<HTMLElement | null>) {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    focusRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") escape.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [open, focusRef]);
}

/** Bottom sheet over the app (above the bottom nav), with a tap-to-close backdrop. */
export function BottomSheet({
  labelledBy,
  onClosed,
  children,
  closeRef,
}: {
  labelledBy: string;
  onClosed: () => void;
  children: (close: () => void) => ReactNode;
  closeRef?: React.RefObject<(() => void) | null>;
}) {
  const { closing, close, onAnimationEnd } = useSheetExit(onClosed);
  const panelRef = useRef<HTMLDivElement>(null);
  useModal(true, close, panelRef);
  useEffect(() => {
    if (closeRef) closeRef.current = close;
  });

  return (
    <div className="fixed inset-0 z-50 [color-scheme:light]">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={close}
        className={`absolute inset-0 h-full w-full cursor-default bg-slate-900/30 ${closing ? "cz-backdrop-out" : "cz-backdrop"}`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          onAnimationEnd={onAnimationEnd}
          className={`pointer-events-auto max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-18px_40px_-18px_rgba(15,23,42,0.45)] outline-none ${
            closing ? "cz-sheet-out" : "cz-sheet"
          }`}
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
          {children(close)}
        </div>
      </div>
    </div>
  );
}
