"use client";

import { Bell, GitBranch, LayoutDashboard, LogOut, ShieldCheck, Siren, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { eventTitle, prettyText } from "@/lib/format";
import type { AuditEvent, CitizenActivity, Hypothesis, Impact, Incident, IncidentDetail, Metrics, Resource } from "@/lib/types";

import { ActivityFeed } from "./ActivityFeed";
import { AlertsPanel, ALERT_EVENTS } from "./AlertsPanel";
import { CitizenInbox } from "./CitizenInbox";
import { CityMap } from "./CityMap";
import { DemoDock } from "./DemoDock";
import { EscalationLadder } from "./EscalationLadder";
import { IncidentDetailPanel } from "./IncidentDetailPanel";
import { IncidentQueue } from "./IncidentQueue";
import { MetricsBar } from "./MetricsBar";
import { NeedsAttention } from "./NeedsAttention";
import { ReportForm } from "./ReportForm";
import { ResourcesPanel } from "./ResourcesPanel";
import { RootCausePanel } from "./RootCausePanel";
import { ScenarioBar } from "./ScenarioBar";
import { ToastStack, type Toast } from "./ToastStack";

const POLL_MS = 2000;

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, blurb: "What needs you right now" },
  { id: "incidents", label: "Incidents", icon: Siren, blurb: "Every case on the map, with its evidence and audit trail" },
  { id: "rootcause", label: "Root cause", icon: GitBranch, blurb: "Complaints that share one cause, fixed with one repair" },
  { id: "crews", label: "Crews", icon: Truck, blurb: "Who is on duty, and phone-in complaints" },
  { id: "notifications", label: "Notifications", icon: Bell, blurb: "Citizen activity, alerts and the full log" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export type Operator = { name: string; department: string; badge_id: string; role?: string };

const ROLE_LABEL: Record<string, string> = {
  officer: "Department officer",
  head: "Department head",
  command: "City command centre",
};

const ALERT_TONE: Record<string, Toast["tone"]> = {
  sla_at_risk: "warn",
  plan_invalidated: "warn",
  escalated: "danger",
  sla_breach: "danger",
  false_closure_detected: "danger",
  no_resource: "danger",
};

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
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Alerts already turned into toasts; null until the first load so old alerts don't pop up.
  const toastedAlerts = useRef<Set<string> | null>(null);

  const pushToast = useCallback((t: Toast) => setToasts((cur) => (cur.some((x) => x.id === t.id) ? cur : [...cur, t])), []);
  const dismissToast = useCallback((id: string) => setToasts((cur) => cur.filter((t) => t.id !== id)), []);

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

  // New alerts (escalations, breaches, false closures…) pop up as toasts.
  useEffect(() => {
    if (toastedAlerts.current === null) {
      if (audit.length) toastedAlerts.current = new Set(alerts.map((a) => a.id));
      return;
    }
    for (const a of alerts) {
      if (toastedAlerts.current.has(a.id)) continue;
      toastedAlerts.current.add(a.id);
      pushToast({
        id: a.id,
        tone: ALERT_TONE[a.event_type] ?? "warn",
        title: `${eventTitle(a.event_type)}${a.incident_id ? ` · ${a.incident_id}` : ""}`,
        body: prettyText(a.detail),
        incidentId: a.incident_id,
      });
    }
  }, [alerts, audit.length, pushToast]);

  const onCitizenNew = useCallback(
    (items: CitizenActivity[]) => {
      for (const item of items) {
        const who = item.citizen.replace(/^citizen:/, "") || "A citizen";
        pushToast({
          id: `cz-${item.id}`,
          tone: item.kind === "complaint" ? "info" : item.supports === false ? "danger" : "good",
          title:
            item.kind === "complaint"
              ? `New complaint from ${who}`
              : item.supports === false
                ? `${who} says it's still broken`
                : `${who} confirmed a fix`,
          body: item.text,
          incidentId: item.incident_id,
        });
      }
    },
    [pushToast],
  );

  /** Select an incident and jump to the Incidents tab (from lists, alerts, toasts and the map). */
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

  const current = TABS.find((t) => t.id === tab)!;
  const simClock = now ? new Date(now).toISOString().slice(0, 16).replace("T", " ") + " UTC" : null;
  const openCount = incidents.filter((i) => i.status !== "verified_closed" && i.status !== "rejected").length;

  const navButton = (t: (typeof TABS)[number], compact: boolean) => {
    const active = tab === t.id;
    const Icon = t.icon;
    const badge = t.id === "notifications" && unread > 0 ? unread : t.id === "incidents" && openCount > 0 ? openCount : null;
    return (
      <button
        key={t.id}
        id={compact ? undefined : `tab-${t.id}`}
        role="tab"
        aria-selected={active}
        aria-controls={`panel-${t.id}`}
        onClick={() => setTab(t.id)}
        className={
          compact
            ? `flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"
              }`
            : `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`
        }
      >
        <Icon className={`h-[18px] w-[18px] ${active ? "text-emerald-400" : ""}`} aria-hidden />
        <span className="flex-1 text-left">{t.label}</span>
        {badge !== null && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
              t.id === "notifications" ? "bg-rose-500 text-white" : "bg-white/10 text-slate-200"
            }`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-950 px-4 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-base font-bold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.9)]">
            C
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.2em] text-white">CONVERGE</span>
            <span className="block text-[11px] text-slate-500">City operations</span>
          </span>
        </div>
        <nav role="tablist" aria-label="Dashboard sections" aria-orientation="vertical" className="mt-8 flex flex-col gap-1">
          {TABS.map((t) => navButton(t, false))}
        </nav>
        <div className="mt-auto space-y-3">
          {operator && (
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300">
                  {operator.name[0]}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{operator.name}</span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {ROLE_LABEL[operator.role ?? "officer"] ?? operator.role} · {operator.badge_id}
                  </span>
                </span>
              </div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-5 sm:py-3.5 lg:px-8">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{current.label}</h1>
              <p className="text-xs text-slate-500 sm:text-sm">{current.blurb}</p>
            </div>
            <div className="flex items-center gap-2 text-sm sm:gap-2.5">
              <span
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-medium ring-1 ${
                  error ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {!error && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${error ? "bg-rose-500" : "bg-emerald-500"}`} />
                </span>
                {error ? "Offline" : "Live"}
              </span>
              {operator && (
                <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600 sm:flex lg:hidden">
                  <ShieldCheck className="h-4 w-4" aria-hidden /> {operator.badge_id}
                </span>
              )}
              <button
                type="button"
                onClick={() => setTab("notifications")}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                className="relative rounded-full p-2 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                <Bell className="h-[18px] w-[18px]" aria-hidden />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
              {onSignOut && (
                <button type="button" onClick={onSignOut} className="rounded-full px-3 py-1.5 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 lg:hidden">
                  Sign out
                </button>
              )}
            </div>
          </div>
          {/* Tabs (phones and tablets) */}
          <nav role="tablist" aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto bg-slate-950 px-3 py-2 lg:hidden">
            {TABS.map((t) => navButton(t, true))}
          </nav>
        </header>

        <main className="space-y-5 px-4 pb-28 pt-5 sm:px-5 sm:pt-6 lg:px-8">
          {error && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {error.includes("Failed to fetch")
                ? "Can't reach the backend. It may be waking up (free plan); give it a minute."
                : error}
            </div>
          )}

          <section {...panel("overview")} className="space-y-5 motion-safe:animate-[fadeUp_.35s_ease-out]">
            {metrics && <MetricsBar metrics={metrics} incidents={incidents} />}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
              <NeedsAttention incidents={incidents} now={now} onOpen={openIncident} />
              <div className="space-y-5">
                <EscalationLadder incidents={incidents} operatorRole={operator?.role} onOpen={openIncident} />
                <AlertsPanel alerts={alerts} limit={5} onOpen={openIncident} title="Latest alerts" />
              </div>
            </div>
          </section>

          <section {...panel("incidents")} className="grid grid-cols-1 gap-5 motion-safe:animate-[fadeUp_.35s_ease-out] xl:grid-cols-[360px_minmax(0,1fr)]">
            <IncidentQueue incidents={incidents} now={now} selectedId={selectedId} onSelect={setSelectedId} />
            <div className="min-w-0 space-y-5">
              <CityMap
                incidents={incidents}
                resources={resources}
                reports={detail?.reports ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              {detail ? (
                <IncidentDetailPanel
                  detail={detail}
                  impact={impact}
                  now={now}
                  busy={busy}
                  act={act}
                  incidents={incidents}
                  operator={operator}
                />
              ) : (
                <EmptyCard icon={Siren} title="Pick a case" text="Select an incident from the queue or the map to see its reports, photos, evidence and audit trail." />
              )}
            </div>
          </section>

          <section {...panel("rootcause")} className="motion-safe:animate-[fadeUp_.35s_ease-out]">
            {hypotheses.length > 0 ? (
              <RootCausePanel hypotheses={hypotheses} incidents={incidents} busy={busy} act={act} onSelect={openIncident} />
            ) : (
              <EmptyCard
                icon={GitBranch}
                title="No shared cause yet"
                text="When nearby complaints look connected (a leak and the potholes it causes), CONVERGE proposes one repair here."
              />
            )}
          </section>

          <section {...panel("crews")} className="grid grid-cols-1 gap-5 motion-safe:animate-[fadeUp_.35s_ease-out] xl:grid-cols-[minmax(0,1fr)_400px]">
            <ResourcesPanel resources={resources} busy={busy} act={act} />
            <div>
              <ReportForm busy={busy} act={act} onCreated={openIncident} />
              <p className="mt-2 px-1 text-xs text-slate-500">Log a complaint that came in by phone or at the counter.</p>
            </div>
          </section>

          {/* Kept mounted on every tab so the badge and toasts keep counting new citizen activity. */}
          <section {...panel("notifications")} className="grid grid-cols-1 gap-5 motion-safe:animate-[fadeUp_.35s_ease-out] xl:grid-cols-2">
            <CitizenInbox onUnreadChange={setCitizenUnread} onOpenIncident={openIncident} onNewItems={onCitizenNew} />
            <div className="space-y-5">
              <AlertsPanel alerts={alerts} onOpen={openIncident} title="System alerts" />
              <ActivityFeed audit={audit} onSelect={openIncident} />
            </div>
          </section>
        </main>
      </div>

      <DemoDock simClock={simClock}>
        <ScenarioBar busy={busy} act={act} onSelect={setSelectedId} incidents={incidents} />
      </DemoDock>
      <ToastStack toasts={toasts} onDismiss={dismissToast} onOpen={openIncident} />
    </div>
  );
}

function EmptyCard({ icon: Icon, title, text }: { icon: typeof Siren; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>
    </div>
  );
}

export type Act = (fn: () => Promise<unknown>) => Promise<void>;
