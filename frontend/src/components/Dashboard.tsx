"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { AuditEvent, Incident, IncidentDetail, Metrics, Resource } from "@/lib/types";

import { ActivityFeed } from "./ActivityFeed";
import { CityMap } from "./CityMap";
import { IncidentDetailPanel } from "./IncidentDetailPanel";
import { IncidentQueue } from "./IncidentQueue";
import { MetricsBar } from "./MetricsBar";
import { ReportForm } from "./ReportForm";
import { ResourcesPanel } from "./ResourcesPanel";
import { ScenarioBar } from "./ScenarioBar";

const POLL_MS = 2000;

export function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [now, setNow] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [inc, res, met, aud, clock] = await Promise.all([
        api.incidents(),
        api.resources(),
        api.metrics(),
        api.audit(),
        api.clock(),
      ]);
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
      return;
    }
    try {
      setDetail(await api.incident(id));
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    // Initial load and polling: data is fetched from the API, then state is set when it arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Deep link: /?incident=inc_001 opens that incident (handy for demo links).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("incident");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setSelectedId(id);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDetail(selectedId);
  }, [selectedId, incidents, refreshDetail]);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              CONVERGE <span className="font-normal text-slate-400">· city operations</span>
            </h1>
            <p className="text-xs text-slate-400">Citizen reports → verified resolution</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"}`} />
              {error ? "API offline" : "Live"}
            </span>
            {now && (
              <span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs">
                Sim clock {new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC
              </span>
            )}
          </div>
        </div>
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

        {metrics && <MetricsBar metrics={metrics} />}

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
          <IncidentQueue incidents={incidents} now={now} selectedId={selectedId} onSelect={setSelectedId} />

          <div className="space-y-4">
            <CityMap
              incidents={incidents}
              resources={resources}
              reports={detail?.reports ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {detail ? (
              <IncidentDetailPanel detail={detail} now={now} busy={busy} act={act} incidents={incidents} />
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Select an incident to see linked reports, evidence, and its audit trail.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <ResourcesPanel resources={resources} busy={busy} act={act} />
            <ReportForm busy={busy} act={act} onCreated={setSelectedId} />
            <ActivityFeed audit={audit} onSelect={setSelectedId} />
          </div>
        </div>
      </main>
    </div>
  );
}

export type Act = (fn: () => Promise<unknown>) => Promise<void>;
