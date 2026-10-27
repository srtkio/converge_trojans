"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { AuditEvent, Hypothesis, Impact, Incident, IncidentDetail, Metrics, Resource } from "@/lib/types";

import { ActivityFeed } from "./ActivityFeed";
import { AlertsPanel, ALERT_EVENTS } from "./AlertsPanel";
import { CitizenInbox } from "./CitizenInbox";
import { CityMap } from "./CityMap";
import { IncidentDetailPanel } from "./IncidentDetailPanel";
import { IncidentQueue } from "./IncidentQueue";
import { MetricsBar } from "./MetricsBar";
import { NeedsAttention } from "./NeedsAttention";
import { ReportForm } from "./ReportForm";
import { ResourcesPanel } from "./ResourcesPanel";
import { RootCausePanel } from "./RootCausePanel";
import { ScenarioBar } from "./ScenarioBar";

const POLL_MS = 2000;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "incidents", label: "Incidents" },
  { id: "rootcause", label: "Root cause" },
  { id: "crews", label: "Crews" },
  { id: "notifications", label: "Notifications" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export type Operator = { name: string; department: string; badge_id: string };

export function Dashboard({ operator, onSignOut }: { operator?: Operator; onSignOut?: () => void }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [now, setNow] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [citizenUnread, setCitizenUnread] = useState(0);
  // Alerts arriving after this audit id count as unread until the Notifications tab is opened.
  const [alertsSeenThrough, setAlertsSeenThrough] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [inc, res, met, aud, clock, hyp] = await Promise.all([
        api.incidents(),
        api.resources(),
        api.metrics(),
        api.audit(),
        api.clock(),
        api.hypotheses(),
      ]);
      setHypotheses(hyp ?? []);
      setIncidents(inc);
      setResources(res);
      setMetrics(met);
      setAudit(aud);
      setNow(clock.now);
      setError(null);
      setSelectedId((cur) => (cur && inc.some((i) => i.id === cur) ? cur : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshDetail = useCallback(async (id: string | null) => {
    if (!id) {
      setDetail(null);
      setImpact(null);
      return;
    }
    try {
      const [d, imp] = await Promise.all([api.incident(id), api.impact(id).catch(() => null)]);
      setDetail(d);
      setImpact(imp);
    } catch {
      setDetail(null);
      setImpact(null);
    }
  }, []);

  useEffect(() => {
    // Initial load and polling: data is fetched from the API, then state is set when it arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Deep links: ?incident=inc_001 opens that incident; ?tab=notifications opens a tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("incident");
    const t = params.get("tab");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (id) {
      setSelectedId(id);
      setTab("incidents");
    }
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDetail(selectedId);
  }, [selectedId, incidents, refreshDetail]);

  const alerts = useMemo(() => audit.filter((e) => ALERT_EVENTS.has(e.event_type)), [audit]);
  const latestAlertId = alerts.length ? alerts[alerts.length - 1].id : null;
  const unreadAlerts =
    alertsSeenThrough === null ? alerts.length : alerts.filter((a) => a.id > alertsSeenThrough).length;
  const unread = citizenUnread + (tab === "notifications" ? 0 : unreadAlerts);

  // Opening Notifications marks the current alerts as seen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "notifications") setAlertsSeenThrough(latestAlertId);
  }, [tab, latestAlertId]);

  /** Select an incident and jump to the Incidents tab (from lists, alerts and the map). */
  const openIncident = useCallback((id: string) => {
    setSelectedId(id);
    setTab("incidents");
  }, []);

  /** Wrap a mutating call: block double-clicks, surface errors, then refresh everything. */
  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh],
  );

  const panel = (id: TabId) => ({
    id: `panel-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${id}`,
    hidden: tab !== id,
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              CONVERGE <span className="font-normal text-slate-400">· city operations</span>
            </h1>
            <p className="text-xs text-slate-400">Citizen reports → verified resolution</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"}`} />
              {error ? "API offline" : "Live"}
            </span>
            {now && (
              <span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs">
                Sim clock {new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC
              </span>
            )}
            {operator && (
              <span className="flex items-center gap-3 border-l border-slate-700 pl-4">
                <span className="text-slate-300">
                  {operator.name} <span className="text-slate-500">· {operator.badge_id}</span>
                </span>
                {onSignOut && (
                  <button type="button" onClick={onSignOut} className="rounded px-2 py-1 text-slate-300 ring-1 ring-slate-600 hover:bg-slate-800">
                    Sign out
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        <nav role="tablist" aria-label="Dashboard sections" className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4">
          {TABS.map((t) => {
            const active = tab === t.id;
            const badge = t.id === "notifications" && unread > 0 ? unread : null;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium transition ${
                  active ? "bg-slate-50 text-slate-900" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {t.label}
                {badge !== null && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        <ScenarioBar busy={busy} act={act} onSelect={setSelectedId} incidents={incidents} />

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.includes("Failed to fetch")
              ? "Can't reach the backend. Start it with: cd backend && uvicorn app.main:app --reload"
              : error}
          </div>
        )}

        <section {...panel("overview")} className="space-y-4">
          {metrics && <MetricsBar metrics={metrics} />}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <NeedsAttention incidents={incidents} now={now} onOpen={openIncident} />
            <AlertsPanel alerts={alerts} limit={6} onOpen={openIncident} title="Latest alerts" />
          </div>
        </section>

        <section {...panel("incidents")} className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <IncidentQueue incidents={incidents} now={now} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="min-w-0 space-y-4">
            <CityMap
              incidents={incidents}
              resources={resources}
              reports={detail?.reports ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {detail ? (
              <IncidentDetailPanel detail={detail} impact={impact} now={now} busy={busy} act={act} incidents={incidents} />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Select an incident from the queue or the map to see its reports, evidence and audit trail.
              </div>
            )}
          </div>
        </section>

        <section {...panel("rootcause")}>
          {hypotheses.some((h) => h.status !== "rejected") ? (
            <RootCausePanel hypotheses={hypotheses} incidents={incidents} busy={busy} act={act} onSelect={openIncident} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No shared root cause proposed yet. Related incidents near each other (for example a leak and nearby
              potholes) appear here. Try the “v2 · Root cause” demo.
            </div>
          )}
        </section>

        <section {...panel("crews")} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <ResourcesPanel resources={resources} busy={busy} act={act} />
          <div>
            <p className="mb-2 text-xs text-slate-500">Log a complaint that came in by phone or at the counter.</p>
            <ReportForm busy={busy} act={act} onCreated={openIncident} />
          </div>
        </section>

        {/* Kept mounted on every tab so the badge keeps counting new citizen activity. */}
        <section {...panel("notifications")} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CitizenInbox onUnreadChange={setCitizenUnread} onOpenIncident={openIncident} />
          <div className="space-y-4">
            <AlertsPanel alerts={alerts} onOpen={openIncident} title="System alerts" />
            <ActivityFeed audit={audit} onSelect={openIncident} />
          </div>
        </section>
      </main>
    </div>
  );
}

export type Act = (fn: () => Promise<unknown>) => Promise<void>;
