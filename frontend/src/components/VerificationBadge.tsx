import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import type { Incident } from "@/lib/types";

const LEVEL = {
  unverified: { label: "Unverified", hint: "One person, no photo or GPS yet", cls: "bg-slate-400/10 text-slate-300 ring-slate-400/25", icon: ShieldQuestion },
  corroborated: { label: "Corroborated", hint: "Several people, or photo + GPS", cls: "bg-accent-2/10 text-accent-2 ring-accent-2/30", icon: ShieldCheck },
  confirmed_on_site: { label: "Confirmed on site", hint: "Inspector or site photo", cls: "bg-ok/10 text-ok ring-ok/30", icon: ShieldAlert },
} as const;

/** How well a complaint is backed up: the first line of defence against fake reports. */
export function VerificationBadge({ level }: { level?: Incident["verification"] }) {
  if (!level) return null;
  const l = LEVEL[level];
  const Icon = l.icon;
  return (
    <span title={l.hint} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${l.cls}`}>
      <Icon className="h-3 w-3" aria-hidden /> {l.label}
    </span>
  );
}
