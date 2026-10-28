"use client";

import { ArrowUpRight, GitBranch, Inbox, Link2, Search, TriangleAlert, X } from "lucide-react";

import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/format";
import { isOpen, slaState } from "@/lib/opTheme";
import type { Category, Incident, Status } from "@/lib/types";

import { CARD, CategoryGlyph, EmptyState, FIELD, Pill } from "./OpUi";
import { SlaTimer } from "./SlaTimer";
import { StatusBadge } from "./StatusBadge";

// Escalated and reopened first, closed last; within a group, nearest deadline first.
const PRIORITY: Record<Incident["status"], number> = {
  escalated: 0,
  reopened: 1,
  open: 2,
  pending_verification: 3,
  assigned: 4,
  in_progress: 5,
  verified_closed: 9,
  rejected: 10,
};

export type QueueFilters = {
  q: string;
  status: "all" | "open" | Status;
  category: "all" | Category;
  sla: "all" | "risk" | "on_track" | "at_risk" | "breached";
};

export const NO_FILTERS: QueueFilters = { q: "", status: "all", category: "all", sla: "all" };

export function sortIncidents(incidents: Incident[]): Incident[] {
  return [...incidents].sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status] || a.deadline.localeCompare(b.deadline));
}

export function applyFilters(incidents: Incident[], f: QueueFilters, now: string | null): Incident[] {
  const q = f.q.trim().toLowerCase();
  return sortIncidents(incidents).filter((i) => {
    if (q && !`${i.id} ${i.title} ${i.department} ${CATEGORY_LABEL[i.category]}`.toLowerCase().includes(q)) return false;
    if (f.status === "open" ? !isOpen(i) : f.status !== "all" && i.status !== f.status) return false;
    if (f.category !== "all" && i.category !== f.category) return false;
    if (f.sla !== "all") {
      const s = slaState(i, now);
      if (f.sla === "risk" ? s !== "at_risk" && s !== "breached" : s !== f.sla) return false;
    }
    return true;
  });
}

const SLA_CHIPS: { id: QueueFilters["sla"]; label: string; dot?: string }[] = [
  { id: "all", label: "Any SLA" },
  { id: "on_track", label: "On track", dot: "bg-ok" },
  { id: "at_risk", label: "At risk", dot: "bg-warn" },
  { id: "breached", label: "Breached", dot: "bg-bad" },
];

const SELECT = `${FIELD} h-8 cursor-pointer pr-7 text-xs`;

export function IncidentQueue({
  incidents,
  now,
  selectedId,
  onSelect,
  filters,
  onFilters,
}: {
  incidents: Incident[];
  now: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: QueueFilters;
  onFilters: (f: QueueFilters) => void;
}) {
  const shown = applyFilters(incidents, filters, now);
  const active = filters.q !== "" || filters.status !== "all" || filters.category !== "all" || filters.sla !== "all";
  const set = (patch: Partial<QueueFilters>) => onFilters({ ...filters, ...patch });

  return (
    <section className={`${CARD} flex min-h-0 flex-col overflow-hidden`} aria-label="Incident queue">
      <div className="space-y-2.5 border-b border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-foreground">Incident queue</h2>
          <span className="text-[11px] tabular-nums text-muted">
            {shown.length} of {incidents.length}
          </span>
        </div>
        <label className="relative block">
          <span className="sr-only">Search incidents</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search by ID, title, department…"
            className={`${FIELD} h-8 pl-8 text-xs`}
          />
          {filters.q && (
            <button type="button" onClick={() => set({ q: "" })} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="sr-only">Status</span>
            <select value={filters.status} onChange={(e) => set({ status: e.target.value as QueueFilters["status"] })} className={SELECT}>
              <option value="all">All statuses</option>
              <option value="open">Open (not closed)</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select value={filters.category} onChange={(e) => set({ category: e.target.value as QueueFilters["category"] })} className={SELECT}>
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="op-no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="SLA state">
          {SLA_CHIPS.map((c) => {
            const on = filters.sla === c.id || (c.id === "at_risk" && filters.sla === "risk");
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => set({ sla: c.id })}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ring-1 transition ${
                  on ? "bg-accent/15 text-foreground ring-accent/50" : "text-muted ring-line hover:text-foreground"
                }`}
              >
                {c.dot && <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />}
                {c.label}
              </button>
            );
          })}
          {active && (
            <button type="button" onClick={() => onFilters({ q: "", status: "all", category: "all", sla: "all" })} className="ml-auto shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/10">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={incidents.length ? "No cases match" : "No incidents yet"}
          text={incidents.length ? "Try a different search or clear the filters." : "Run a demo scenario or wait for citizen reports."}
        />
      ) : (
        <ul className="op-scroll min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {shown.map((inc) => {
            const closed = !isOpen(inc);
            const sel = selectedId === inc.id;
            return (
              <li key={inc.id}>
                <button
                  type="button"
                  onClick={() => onSelect(inc.id)}
                  aria-current={sel ? "true" : undefined}
                  className={`group relative w-full px-3 py-2.5 text-left transition-colors focus-visible:outline-none ${
                    sel ? "bg-accent/[0.09]" : "hover:bg-surface-2/70 focus-visible:bg-surface-2"
                  } ${closed ? "opacity-60" : ""}`}
                >
                  {sel && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden />}
                  <div className="flex items-start gap-2.5">
                    <CategoryGlyph category={inc.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-[13px] font-medium text-foreground">{inc.title}</span>
                        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden />
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        <span className="font-mono">{inc.id}</span> · {CATEGORY_LABEL[inc.category]} · <span className="capitalize">{inc.department}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <StatusBadge status={inc.status} />
                        {!closed && <SlaTimer incident={inc} now={now} />}
                        {inc.report_ids.length > 1 && (
                          <Pill className="bg-surface-2 text-[#c3c9d8] ring-line">{inc.report_ids.length} reports</Pill>
                        )}
                        {inc.related_incident_ids.length > 0 && (
                          <Pill className="bg-violet-400/10 text-violet-300 ring-violet-400/25">
                            <Link2 className="h-3 w-3" aria-hidden /> {inc.related_incident_ids.length} related
                          </Pill>
                        )}
                        {!!inc.child_incident_ids?.length && (
                          <Pill className="bg-violet-400/10 text-violet-300 ring-violet-400/25">
                            <GitBranch className="h-3 w-3" aria-hidden /> cause of {inc.child_incident_ids.length}
                          </Pill>
                        )}
                        {inc.parent_incident_id && <Pill className="bg-violet-400/10 text-violet-300 ring-violet-400/25">waits on {inc.parent_incident_id}</Pill>}
                        {inc.escalation_level > 0 && (
                          <Pill className="bg-bad/10 text-bad ring-bad/25">
                            <TriangleAlert className="h-3 w-3" aria-hidden /> L{inc.escalation_level}
                          </Pill>
                        )}
                        {inc.verification === "unverified" && !closed && <Pill className="bg-slate-400/10 text-slate-400 ring-slate-400/20">unverified</Pill>}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
