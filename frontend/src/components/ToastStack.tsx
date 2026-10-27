"use client";

import { AlertTriangle, Bell, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

export type Toast = {
  id: string;
  tone: "info" | "warn" | "danger" | "good";
  title: string;
  body?: string;
  incidentId?: string | null;
};

const STYLE: Record<Toast["tone"], { ring: string; icon: typeof Bell; iconColor: string }> = {
  info: { ring: "ring-sky-200", icon: Bell, iconColor: "text-sky-600" },
  warn: { ring: "ring-amber-200", icon: AlertTriangle, iconColor: "text-amber-600" },
  danger: { ring: "ring-rose-200", icon: AlertTriangle, iconColor: "text-rose-600" },
  good: { ring: "ring-emerald-200", icon: CheckCircle2, iconColor: "text-emerald-600" },
};

const LIFETIME_MS = 8000;

/** Bottom-right notifications: slide in, auto-dismiss, click to open the incident. */
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
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3">
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
    <div className={`pointer-events-auto rounded-2xl bg-white p-4 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)] ring-1 ${s.ring} motion-safe:animate-[toastIn_.35s_cubic-bezier(.2,.8,.2,1)]`}>
      <div className="flex gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.iconColor}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
          {toast.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{toast.body}</p>}
          {toast.incidentId && (
            <button
              type="button"
              onClick={() => {
                onOpen(toast.incidentId!);
                onDismiss(toast.id);
              }}
              className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Open case →
            </button>
          )}
        </div>
        <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss" className="h-6 w-6 shrink-0 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="mx-auto h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
