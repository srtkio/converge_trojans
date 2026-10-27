"use client";

import Link from "next/link";

import { CITIZEN_STATUS_LABEL, explainStatus } from "@/lib/citizen";
import { CATEGORY_ICON, STATUS_STYLE } from "@/lib/format";
import type { Incident } from "@/lib/types";

// Not in Status yet: a report an operator rejected (planned with the trust-roles work).
const REJECTED_TEXT = "Closed: we couldn't verify this report";

/** One case in My cases. `flash` (a fresh key per status change) rings the row and pops the pill. */
export function CaseRow({ incident, flash }: { incident: Incident; flash?: string }) {
  const status = incident.status as string;
  const label = CITIZEN_STATUS_LABEL[incident.status] ?? (status === "rejected" ? "Closed" : "Updated");
  const badge = STATUS_STYLE[incident.status]?.badge ?? "bg-slate-100 text-slate-700 ring-slate-200";
  const line = status === "rejected" ? REJECTED_TEXT : (explainStatus(incident) ?? "");
  return (
    <Link
      key={flash}
      href={`/track/${incident.id}`}
      transitionTypes={["cz-forward"]}
      className={`flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 motion-safe:active:scale-[0.99] ${
        flash ? "cz-flash" : ""
      }`}
    >
      <span aria-hidden="true" className="text-2xl">
        {CATEGORY_ICON[incident.category]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{incident.title}</span>
        <span className="block text-xs text-slate-500">{line}</span>
        <span className="mt-0.5 block font-mono text-[11px] text-slate-400">{incident.id}</span>
      </span>
      <span
        key={`${incident.status}|${flash ?? ""}`}
        data-status={incident.status}
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badge} ${flash ? "cz-pop" : ""}`}
      >
        {label}
      </span>
    </Link>
  );
}
