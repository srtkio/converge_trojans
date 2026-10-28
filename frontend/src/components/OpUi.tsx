"use client";

// Shared building blocks for the operator console: cards, buttons, badges, modal, popover,
// skeletons. Dark theme only; colours come from the tokens in globals.css.

import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { CATEGORY_GLYPH, CATEGORY_TONE } from "@/lib/opTheme";
import type { Category } from "@/lib/types";

export const CARD = "rounded-xl border border-line bg-surface shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_12px_32px_-20px_rgba(0,0,0,0.8)]";

export function Card({ className = "", children, ...rest }: React.HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section className={`${CARD} ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  icon: Icon,
  subtitle,
  right,
  id,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  subtitle?: ReactNode;
  right?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted ring-1 ring-line">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && <p className="truncate text-[11px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2 text-xs text-muted">{right}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "violet";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-accent text-white hover:bg-[#6f9bff] shadow-[0_8px_20px_-10px_rgba(91,140,255,0.9)]",
  secondary: "bg-surface-2 text-foreground ring-1 ring-line-strong hover:bg-[#1a2238]",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "bg-bad/90 text-white hover:bg-bad shadow-[0_8px_20px_-10px_rgba(248,113,113,0.9)]",
  success: "bg-emerald-500 text-emerald-950 hover:bg-emerald-400",
  violet: "bg-violet-500 text-white hover:bg-violet-400 shadow-[0_8px_20px_-10px_rgba(139,92,246,0.9)]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:pointer-events-none disabled:opacity-35 disabled:saturate-[.3] motion-safe:active:scale-[0.98] ${
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm"
      } ${BTN[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Pill({ className = "", children, title }: { className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${className}`}>
      {children}
    </span>
  );
}

export function CategoryGlyph({ category, size = "md" }: { category: Category; size?: "sm" | "md" | "lg" }) {
  const Icon = CATEGORY_GLYPH[category];
  const box = size === "lg" ? "h-11 w-11 rounded-xl" : size === "sm" ? "h-7 w-7 rounded-md" : "h-9 w-9 rounded-lg";
  const ic = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span className={`flex shrink-0 items-center justify-center ring-1 ${box} ${CATEGORY_TONE[category]}`}>
      <Icon className={ic} aria-hidden />
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-2 px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`op-shimmer rounded-md bg-surface-2 ${className}`} aria-hidden />;
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-muted ring-1 ring-line">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Keeps a component mounted for `ms` after `open` turns false, so it can animate out. */
export function usePresence(open: boolean, ms = 180) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open || !mounted) return;
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, mounted, ms]);
  return { mounted: mounted || open, closing: mounted && !open };
}

/** Close on Escape and on a click outside `ref` while `open`. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  useEffect(() => {
    cb.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cb.current();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref]);
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keep Tab inside `ref` and restore focus to the opener on close. */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const first = root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !root) return;
      const els = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const a = els[0];
      const z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [active, ref]);
}

/**
 * Centered dialog rendered into <body> (so transformed parents like the drawer don't clip it).
 * Escape or a click on the backdrop closes it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  tone = "accent",
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: "accent" | "danger" | "ok" | "violet";
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { mounted, closing } = usePresence(open);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);
  if (!mounted) return null;
  const toneCls = {
    accent: "bg-accent/15 text-accent ring-accent/30",
    danger: "bg-bad/15 text-bad ring-bad/30",
    ok: "bg-ok/15 text-ok ring-ok/30",
    violet: "bg-violet-400/15 text-violet-300 ring-violet-400/30",
  }[tone];
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className={`absolute inset-0 bg-[#02040a]/70 backdrop-blur-sm ${closing ? "op-fade-out" : "op-fade-in"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} rounded-t-2xl border border-line-strong bg-surface shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] outline-none sm:rounded-2xl ${
          closing ? "op-pop-out" : "op-pop-in"
        }`}
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-5">
          {Icon && (
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneCls}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm leading-relaxed text-muted">{description}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="px-5 py-3">{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-[#0a0f1b] px-5 py-3 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export const FIELD =
  "w-full rounded-lg border border-line-strong bg-[#0a0f1b] px-3 text-sm text-foreground placeholder:text-slate-500 outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/25";
