"use client";

import { AlertTriangle, ArrowRight, Bell, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

export type Toast = {
  id: string;
  tone: "info" | "warn" | "danger" | "good";
  title: string;
  body?: string;
  incidentId?: string | null;
};

const STYLE: Record<Toast["tone"], { icon: typeof Bell; chip: string; bar: string }> = {
  info: { icon: Bell, chip: "bg-accent/15 text-accent ring-accent/30", bar: "bg-accent" },
  warn: { icon: AlertTriangle, chip: "bg-warn/15 text-warn ring-warn/30", bar: "bg-warn" },
  danger: { icon: AlertTriangle, chip: "bg-bad/15 text-bad ring-bad/30", bar: "bg-bad" },
  good: { icon: CheckCircle2, chip: "bg-ok/15 text-ok ring-ok/30", bar: "bg-ok" },
};

const LIFETIME_MS = 8000;

/** Top-right notifications: slide in, auto-dismiss with a countdown bar, click to open the incident. */
export function ToastStack({
  toasts,
  onDismiss,
  onOpen,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onOpen: (incidentId: string) => void;
}) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-3 top-[4.5rem] z-[80] flex w-[23rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2.5">
      {toasts.slice(-4).map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss, onOpen }: { toast: Toast; onDismiss: (id: string) => void; onOpen: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), LIFETIME_MS);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);
  const s = STYLE[toast.tone];
  const Icon = s.icon;
  return (
    <div
      role="status"
      className="op-toast-in pointer-events-auto relative overflow-hidden rounded-xl border border-line-strong bg-surface-2/95 p-3.5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85)] backdrop-blur"
    >
      <div className="flex gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${s.chip}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">{toast.title}</p>
          {toast.body && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#aab2c5]">{toast.body}</p>}
          {toast.incidentId && (
            <button
              type="button"
              onClick={() => {
                onOpen(toast.incidentId!);
                onDismiss(toast.id);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-[#8fb0ff]"
            >
              Open case <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>
        <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss" className="h-6 w-6 shrink-0 rounded-md text-muted hover:bg-surface hover:text-foreground">
          <X className="mx-auto h-3.5 w-3.5" />
        </button>
      </div>
      <span className={`op-toast-bar absolute bottom-0 left-0 h-0.5 w-full opacity-60 ${s.bar}`} style={{ animationDuration: `${LIFETIME_MS}ms` }} aria-hidden />
    </div>
  );
}
