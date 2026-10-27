import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import type { Incident } from "@/lib/types";

const LEVEL = {
  unverified: { label: "Unverified", hint: "One person, no photo or GPS yet", cls: "bg-slate-100 text-slate-700 ring-slate-200", icon: ShieldQuestion },
  corroborated: { label: "Corroborated", hint: "Several people, or photo + GPS", cls: "bg-sky-50 text-sky-700 ring-sky-200", icon: ShieldCheck },
  confirmed_on_site: { label: "Confirmed on site", hint: "Inspector or site photo", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: ShieldAlert },
} as const;

/** How well a complaint is backed up: the first line of defence against fake reports. */
export function VerificationBadge({ level }: { level?: Incident["verification"] }) {
  if (!level) return null;
  const l = LEVEL[level];
  const Icon = l.icon;
  return (
    <span title={l.hint} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${l.cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {l.label}
    </span>
  );
}
