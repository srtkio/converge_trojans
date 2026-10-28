"use client";

import {
  Bell,
  BellRing,
  ChevronDown,
  Command,
  GitBranch,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  Siren,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { eventTitle, prettyText } from "@/lib/format";
import { ROLE_LABEL, ROLE_TONE, initials, isOpen } from "@/lib/opTheme";
import type { AuditEvent, CitizenActivity, Hypothesis, Impact, Incident, IncidentDetail, Metrics, Resource } from "@/lib/types";

import { ActivityFeed } from "./ActivityFeed";
import { AlertRow, AlertsPanel, ALERT_EVENTS } from "./AlertsPanel";
import { CitizenInbox } from "./CitizenInbox";
import { CityMap } from "./CityMap";
import { CommandPalette } from "./CommandPalette";
import { DemoDock } from "./DemoDock";
import { EscalationLadder } from "./EscalationLadder";
import { IncidentDetailPanel, IncidentDetailSkeleton, IncidentDrawer } from "./IncidentDetailPanel";
import { IncidentQueue, NO_FILTERS, applyFilters, sortIncidents, type QueueFilters } from "./IncidentQueue";
import { KpiRow, MetricsBar, type KpiTarget } from "./MetricsBar";
import { NeedsAttention } from "./NeedsAttention";
import { CARD, EmptyState, Kbd, Skeleton, useDismiss } from "./OpUi";
import { ReportForm } from "./ReportForm";
import { ResourcesPanel } from "./ResourcesPanel";
import { RootCausePanel } from "./RootCausePanel";
import { ScenarioBar } from "./ScenarioBar";
import { SlaWatch } from "./SlaWatch";
import { ToastStack, type Toast } from "./ToastStack";

const POLL_MS = 2000;

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, blurb: "What needs you right now", group: "Command" },
  { id: "incidents", label: "Incidents", icon: Siren, blurb: "Every case on the map, with its evidence and audit trail", group: "Command" },
  { id: "rootcause", label: "Root cause", icon: GitBranch, blurb: "Complaints that share one cause, fixed with one repair", group: "Analysis" },
  { id: "crews", label: "Crews", icon: Truck, blurb: "Who is on duty, and phone-in complaints", group: "Field" },
  { id: "notifications", label: "Notifications", icon: Bell, blurb: "Citizen activity, alerts and the full log", group: "Communications" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export type Operator = { name: string; department: string; badge_id: string; role?: string };

export type Act = (fn: () => Promise<unknown>, success?: string) => Promise<void>;

const ALERT_TONE: Record<string, Toast["tone"]> = {
  sla_at_risk: "warn",
  plan_invalidated: "warn",
  escalated: "danger",
  sla_breach: "danger",
  false_closure_detected: "danger",
  no_resource: "danger",
};

function deptLabel(d: string): string {
  if (!d || d === "all") return "All departments";
  return `${d.charAt(0).toUpperCase()}${d.slice(1)} department`;
}

function useWallClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

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
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<QueueFilters>(NO_FILTERS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [citizenUnread, setCitizenUnread] = useState(0);
  // Alerts arriving after this audit id count as unread until the Notifications tab is opened.
  const [alertsSeenThrough, setAlertsSeenThrough] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Alerts already turned into toasts; null until the first load so old alerts don't pop up.
  const toastedAlerts = useRef<Set<string> | null>(null);
  const wall = useWallClock();

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
    } finally {
      setLoaded(true);
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

  // Ctrl/Cmd+K (or "/" outside a text field) opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
        const raw = item.citizen.replace(/^citizen:/, "");
        // The operator's own phone-in reports and evidence already get a success toast.
        if (raw === "dashboard") continue;
        const who = raw && raw !== "web" ? raw : "A citizen";
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

  const closeIncident = useCallback(() => setSelectedId(null), []);

  /** Wrap a mutating call: block double-clicks, surface errors, toast success, then refresh. */
  const act: Act = useCallback(
    async (fn, success) => {
      setBusy(true);
      try {
        await fn();
        setError(null);
        if (success) pushToast({ id: `ok-${Date.now()}`, tone: "good", title: success });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        pushToast({ id: `err-${Date.now()}`, tone: "danger", title: "Action failed", body: msg.replace(/^\d{3} \S+: /, "") });
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh, pushToast],
  );

  const pickKpi = (target: KpiTarget) => {
    const f: QueueFilters =
      target === "risk"
        ? { ...NO_FILTERS, status: "open", sla: "risk" }
        : target === "open"
          ? { ...NO_FILTERS, status: "open" }
          : { ...NO_FILTERS, status: target };
    setFilters(f);
    setTab("incidents");
  };

  const panel = (id: TabId) => ({
    id: `panel-${id}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${id}`,
    hidden: tab !== id,
  });

  const current = TABS.find((t) => t.id === tab)!;
  const simClock = now ? new Date(now).toISOString().slice(0, 16).replace("T", " ") + " UTC" : null;
  const openCount = incidents.filter(isOpen).length;
  const role = operator?.role ?? "officer";

  // Drawer navigation follows the queue's current order and filters.
  const queueOrder = useMemo(() => {
    const filtered = applyFilters(incidents, filters, now);
    return (selectedId && filtered.some((i) => i.id === selectedId) ? filtered : sortIncidents(incidents)).map((i) => i.id);
  }, [incidents, filters, now, selectedId]);
  const pos = selectedId ? queueOrder.indexOf(selectedId) : -1;
  const goPrev = pos > 0 ? () => setSelectedId(queueOrder[pos - 1]) : undefined;
  const goNext = pos >= 0 && pos < queueOrder.length - 1 ? () => setSelectedId(queueOrder[pos + 1]) : undefined;
  const drawerOpen = tab === "incidents" && selectedId !== null;

  const navButton = (t: (typeof TABS)[number], compact: boolean) => {
    const active = tab === t.id;
    const Icon = t.icon;
    const badge = t.id === "notifications" && unread > 0 ? unread : t.id === "incidents" && openCount > 0 ? openCount : null;
    return (
      <button
        key={t.id}
        id={compact ? undefined : `tab-${t.id}`}
        role="tab"
        type="button"
        aria-selected={active}
        aria-controls={`panel-${t.id}`}
        onClick={() => setTab(t.id)}
        className={
          compact
            ? `relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active ? "bg-accent/15 text-foreground ring-1 ring-accent/40" : "text-muted hover:text-foreground"
              }`
            : `group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                active ? "bg-accent/[0.12] text-foreground" : "text-muted hover:bg-surface-2/70 hover:text-foreground"
              }`
        }
      >
        {!compact && active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
        <Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} aria-hidden />
        <span className="flex-1 text-left">{t.label}</span>
        {badge !== null && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums ${
              t.id === "notifications" ? "bg-bad text-white" : "bg-surface-2 text-[#c3c9d8] ring-1 ring-line"
            }`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  };

  const groups = [...new Set(TABS.map((t) => t.group))];
  const ist = wall.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  const istDate = wall.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });

  const needCount = incidents.filter(
    (i) => i.status === "escalated" || i.status === "reopened" || i.at_risk || i.status === "pending_verification" || i.status === "open",
  ).length;
  const onDuty = resources.filter((r) => r.available).length;

  return (
    <div className="op-root min-h-screen w-full text-foreground lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-[#080c16]/95 lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_10px_30px_-10px_rgba(91,140,255,0.9)]">
            <Landmark className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold tracking-[0.22em] text-foreground">CONVERGE</span>
            <span className="block truncate text-[11px] text-muted">Civic Operations Command</span>
          </span>
        </div>
        <div className="mx-4 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[11px] text-muted ring-1 ring-line">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent-2" aria-hidden />
          <span className="min-w-0 truncate">
            <span className="text-foreground">Murthal–Sonipat</span> · Haryana pilot
          </span>
        </div>

        <div role="tablist" aria-label="Dashboard sections" aria-orientation="vertical" className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 op-scroll">
          {groups.map((g) => (
            <div key={g} role="presentation" className="mb-2">
              <p role="presentation" className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {g}
              </p>
              <div role="presentation" className="flex flex-col gap-0.5">
                {TABS.filter((t) => t.group === g).map((t) => navButton(t, false))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2.5 border-t border-line p-3">
          <div className="rounded-lg bg-surface px-3 py-2.5 ring-1 ring-line">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="relative flex h-2 w-2">
                  {!error && <span className="op-pulse-ring absolute inline-flex h-full w-full rounded-full bg-ok" />}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${error ? "bg-bad" : "bg-ok"}`} />
                </span>
                {error ? "Backend offline" : "All systems live"}
              </span>
              <span className="text-muted">{onDuty}/{resources.length} crews</span>
            </div>
            {simClock && <p className="mt-1 font-mono text-[10px] text-muted">sim {simClock}</p>}
          </div>
          {operator && (
            <div className="flex items-center gap-3 rounded-lg px-1.5 py-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-surface-2 to-[#1d2640] text-xs font-semibold text-foreground ring-1 ring-line-strong">
                {initials(operator.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">{operator.name}</span>
                <span className="block truncate text-[11px] text-muted">
                  {deptLabel(operator.department)} · <span className="font-mono">{operator.badge_id}</span>
                </span>
              </span>
            </div>
          )}
          {operator && (
            <span className={`mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${ROLE_TONE[role] ?? ROLE_TONE.officer}`}>
              <ShieldCheck className="h-3 w-3" aria-hidden /> {ROLE_LABEL[role] ?? role}
            </span>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-[#070a12]/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-7">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white lg:hidden">
              <Landmark className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
                <span>Command Centre</span>
                <span aria-hidden>/</span>
                <span className="text-[#c3c9d8]">{current.label}</span>
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{current.label}</h1>
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-xs text-muted transition hover:border-line-strong hover:text-foreground md:flex xl:w-80"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span className="flex-1 text-left">Search cases, jump to…</span>
              <span className="flex items-center gap-0.5">
                <Kbd>
                  <Command className="h-2.5 w-2.5" />
                </Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:text-foreground md:hidden">
              <Search className="h-4 w-4" aria-hidden />
            </button>

            <div className="hidden items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 xl:flex">
              <span className="relative flex h-2 w-2">
                {!error && <span className="op-pulse-ring absolute inline-flex h-full w-full rounded-full bg-ok" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${error ? "bg-bad" : "bg-ok"}`} />
              </span>
              <span className={`text-xs font-medium ${error ? "text-bad" : "text-ok"}`}>{error ? "Offline" : "Live"}</span>
              <span className="h-3.5 w-px bg-line-strong" aria-hidden />
              <span className="font-mono text-xs tabular-nums text-foreground" title="India Standard Time">
                {ist}
              </span>
              <span className="text-[10px] text-muted">IST · {istDate}</span>
            </div>
            <span className={`flex h-2 w-2 rounded-full xl:hidden ${error ? "bg-bad" : "bg-ok"}`} title={error ? "Offline" : "Live"} aria-label={error ? "Offline" : "Live"} />

            <NotificationsMenu
              alerts={alerts}
              unread={unread}
              unreadAlerts={tab === "notifications" ? 0 : unreadAlerts}
              citizenUnread={citizenUnread}
              onOpenIncident={openIncident}
              onViewAll={() => setTab("notifications")}
              onMarkRead={() => setAlertsSeenThrough(latestAlertId)}
            />
            {operator && <ProfileMenu operator={operator} role={role} onSignOut={onSignOut} onPalette={() => setPaletteOpen(true)} />}
          </div>
          {/* Tabs (phones and tablets) */}
          <nav role="tablist" aria-label="Dashboard sections" className="op-no-scrollbar flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
            {TABS.map((t) => navButton(t, true))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-4 px-4 pb-28 pt-5 lg:px-7">
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl bg-bad/[0.07] px-4 py-3 text-sm text-[#fca5a5] ring-1 ring-bad/25">
              <BellRing className="h-4 w-4 shrink-0" aria-hidden />
              {error.includes("Failed to fetch") ? "Can't reach the backend. It may be waking up (free plan); give it a minute." : error}
            </div>
          )}

          <section {...panel("overview")} className="op-fade-up space-y-4">
            {!loaded || !metrics ? (
              <OverviewSkeleton />
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-2">Situation report</p>
                    <p className="mt-1 text-sm text-[#c3c9d8]">
                      <span className="font-semibold text-foreground">{needCount}</span> cases need action ·{" "}
                      <span className="font-semibold text-foreground">{openCount}</span> open ·{" "}
                      <span className="font-semibold text-foreground">
                        {onDuty}/{resources.length}
                      </span>{" "}
                      crews on duty
                    </p>
                  </div>
                  <p className="text-[11px] text-muted">Updated every 2 s from the live system</p>
                </div>
                <KpiRow metrics={metrics} incidents={incidents} onPick={pickKpi} />
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="min-w-0 space-y-4 xl:col-span-8">
                    <NeedsAttention incidents={incidents} now={now} onOpen={openIncident} />
                    <MetricsBar metrics={metrics} incidents={incidents} />
                  </div>
                  <div className="min-w-0 space-y-4 xl:col-span-4">
                    <SlaWatch incidents={incidents} now={now} onOpen={openIncident} />
                    <EscalationLadder incidents={incidents} operatorRole={operator?.role} onOpen={openIncident} />
                  </div>
                  <div className="min-w-0 xl:col-span-12">
                    <AlertsPanel alerts={alerts} limit={6} onOpen={openIncident} title="Latest alerts" columns />
                  </div>
                </div>
              </>
            )}
          </section>

          <section {...panel("incidents")} className="op-fade-up grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="flex max-h-[70vh] min-h-[420px] flex-col xl:h-[calc(100dvh-7.5rem)] xl:max-h-none">
              <IncidentQueue incidents={incidents} now={now} selectedId={selectedId} onSelect={setSelectedId} filters={filters} onFilters={setFilters} />
            </div>
            <div className="min-w-0">
              {/* Mounted only while visible: Leaflet can't frame the incidents inside a hidden panel. */}
              {tab === "incidents" && (
              <CityMap
                heightClass="h-[360px] xl:h-[calc(100dvh-10.5rem)]"
                incidents={incidents}
                resources={resources}
                reports={detail?.reports ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              )}
            </div>
          </section>

          <section {...panel("rootcause")} className="op-fade-up">
            {hypotheses.some((h) => h.status !== "rejected") ? (
              <RootCausePanel hypotheses={hypotheses} incidents={incidents} busy={busy} act={act} onSelect={openIncident} />
            ) : (
              <div className={CARD}>
                <EmptyState
                  icon={GitBranch}
                  title="No shared cause yet"
                  text="When nearby complaints look connected (a leak and the potholes it causes), CONVERGE proposes one repair here."
                />
              </div>
            )}
          </section>

          <section {...panel("crews")} className="op-fade-up grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <ResourcesPanel resources={resources} busy={busy} act={act} onOpen={openIncident} />
            <ReportForm busy={busy} act={act} onCreated={openIncident} />
          </section>

          {/* Kept mounted on every tab so the badge and toasts keep counting new citizen activity. */}
          <section {...panel("notifications")} className="op-fade-up grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="op-inbox min-w-0">
              <CitizenInbox onUnreadChange={setCitizenUnread} onOpenIncident={openIncident} onNewItems={onCitizenNew} />
            </div>
            <div className="min-w-0 space-y-4">
              <AlertsPanel alerts={alerts} onOpen={openIncident} title="System alerts" />
              <ActivityFeed audit={audit} onSelect={openIncident} />
            </div>
          </section>
        </main>
      </div>

      <IncidentDrawer open={drawerOpen} onClose={closeIncident}>
        {detail && detail.incident.id === selectedId ? (
          <IncidentDetailPanel
            detail={detail}
            impact={impact}
            now={now}
            busy={busy}
            act={act}
            incidents={incidents}
            operator={operator}
            onClose={closeIncident}
            onPrev={goPrev}
            onNext={goNext}
            position={pos >= 0 ? `${pos + 1} of ${queueOrder.length}` : undefined}
            onOpen={openIncident}
          />
        ) : (
          <IncidentDetailSkeleton onClose={closeIncident} />
        )}
      </IncidentDrawer>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tabs={TABS}
        incidents={incidents}
        onTab={(id) => setTab(id as TabId)}
        onIncident={openIncident}
        onSignOut={onSignOut}
      />

      <DemoDock simClock={simClock}>
        <ScenarioBar busy={busy} act={act} onSelect={setSelectedId} incidents={incidents} />
      </DemoDock>
      <ToastStack toasts={toasts} onDismiss={dismissToast} onOpen={openIncident} />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`${CARD} space-y-3 p-4`}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-1 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${CARD} space-y-3 p-4 xl:col-span-8`}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className={`${CARD} space-y-3 p-4 xl:col-span-4`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuShell({
  open,
  className = "",
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className={`op-pop-menu absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] ${className}`}
    >
      {children}
    </div>
  );
}

function NotificationsMenu({
  alerts,
  unread,
  unreadAlerts,
  citizenUnread,
  onOpenIncident,
  onViewAll,
  onMarkRead,
}: {
  alerts: AuditEvent[];
  unread: number;
  unreadAlerts: number;
  citizenUnread: number;
  onOpenIncident: (id: string) => void;
  onViewAll: () => void;
  onMarkRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const recent = [...alerts].reverse().slice(0, 6);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Alerts${unread ? `, ${unread} unread` : ""}`}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border bg-surface text-muted transition hover:text-foreground ${open ? "border-accent/50 text-foreground" : "border-line"}`}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-bad px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <MenuShell open={open} className="w-[min(24rem,calc(100vw-1.5rem))] max-sm:fixed max-sm:inset-x-3 max-sm:top-16 max-sm:w-auto">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Alerts</p>
            <p className="text-[11px] text-muted">
              {unreadAlerts} new system alert{unreadAlerts === 1 ? "" : "s"} · {citizenUnread} new citizen update{citizenUnread === 1 ? "" : "s"}
            </p>
          </div>
          {unreadAlerts > 0 && (
            <button type="button" onClick={onMarkRead} className="text-[11px] font-medium text-accent hover:underline">
              Mark read
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted">No alerts yet.</p>
        ) : (
          <ul className="op-scroll max-h-80 overflow-y-auto p-1.5">
            {recent.map((a) => (
              <li key={a.id}>
                <AlertRow
                  a={a}
                  compact
                  onOpen={(id) => {
                    setOpen(false);
                    onOpenIncident(id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onViewAll();
          }}
          className="flex w-full items-center justify-center gap-1.5 border-t border-line bg-[#0a0f1b] py-2.5 text-xs font-medium text-accent hover:bg-surface-2"
        >
          Open notification centre
        </button>
      </MenuShell>
    </div>
  );
}

function ProfileMenu({
  operator,
  role,
  onSignOut,
  onPalette,
}: {
  operator: Operator;
  role: string;
  onSignOut?: () => void;
  onPalette: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const item = (Icon: LucideIcon, label: string, onClick: () => void, danger?: boolean, hint?: React.ReactNode) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${danger ? "text-bad hover:bg-bad/10" : "text-foreground hover:bg-surface-2"}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="flex-1">{label}</span>
      {hint}
    </button>
  );
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex h-9 items-center gap-2 rounded-lg border bg-surface pl-1 pr-2 transition hover:border-line-strong ${open ? "border-accent/50" : "border-line"}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent/80 to-accent-2/70 text-[11px] font-bold text-white">{initials(operator.name)}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <MenuShell open={open} className="w-72">
        <div className="border-b border-line p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent/80 to-accent-2/70 text-sm font-bold text-white">{initials(operator.name)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{operator.name}</p>
              <p className="truncate text-[11px] text-muted">{deptLabel(operator.department)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${ROLE_TONE[role] ?? ROLE_TONE.officer}`}>
              <ShieldCheck className="h-3 w-3" aria-hidden /> {ROLE_LABEL[role] ?? role}
            </span>
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-[#c3c9d8] ring-1 ring-line">{operator.badge_id}</span>
          </div>
        </div>
        <div className="p-1.5" role="menu">
          {item(Search, "Search & jump to…", onPalette, false, <Kbd>⌘K</Kbd>)}
          {onSignOut && item(LogOut, "Sign out", onSignOut, true)}
        </div>
      </MenuShell>
    </div>
  );
}
