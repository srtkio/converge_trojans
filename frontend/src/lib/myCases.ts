// "My cases": the cases this device reported, with their live status from the backend.
// A module-level store read with useSyncExternalStore, so every screen of the citizen app
// (Report banner, My cases tab, the nav badge) shares one poll and one answer.
//
// Rules:
// - No ids on this device: no requests at all.
// - One GET /incidents per tick; ids missing from that list are confirmed with GET /incidents/{id}
//   and forgotten only on a 404 (after a demo reset). Network errors keep the last known status.
// - Polls every 15 s while the page is visible; refreshes at once when the page becomes visible,
//   the connection returns, another tab changes the list, or refresh() is called after an action.
// - Plain polling (no SSE or websockets), so the page still reaches network idle.
import { useSyncExternalStore } from "react";

import { api } from "./api";
import { forgetCase, needsCheck, readMyCases } from "./citizen";
import type { Incident } from "./types";

export const MY_CASES_POLL_MS = 15_000;
const CASES_KEY = "converge.myCases";

export type MyCasesState = {
  cases: Incident[];
  /** False until the first answer (or the first "no cases here" check). */
  loaded: boolean;
  /** The last refresh failed; `cases` is the last known list. */
  error: boolean;
  /** Ids whose status changed in the latest refresh, with the status they had before. */
  changed: Record<string, string>;
  /** Bumped on every refresh that changed something, so rows can re-key their flash. */
  version: number;
};

const EMPTY: MyCasesState = { cases: [], loaded: false, error: false, changed: {}, version: 0 };

let state: MyCasesState = EMPTY;
const listeners = new Set<() => void>();

function publish(next: MyCasesState) {
  state = next;
  for (const l of listeners) l();
}

const is404 = (e: unknown) => e instanceof Error && e.message.startsWith("404");

/** Needs-your-check first, then the order this device reported them in (newest first). */
function order(cases: Incident[]): Incident[] {
  return cases
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Number(needsCheck(b.c)) - Number(needsCheck(a.c)) || a.i - b.i)
    .map(({ c }) => c);
}

let inflight: Promise<void> | null = null;
let again = false;

async function loadOnce(): Promise<void> {
  const ids = readMyCases();
  if (ids.length === 0) {
    if (!state.loaded || state.cases.length) publish({ ...EMPTY, loaded: true, version: state.version + 1 });
    return;
  }
  let all: Incident[];
  try {
    all = await api.incidents();
  } catch {
    if (!state.error || !state.loaded) publish({ ...state, loaded: true, error: true, changed: {} });
    return;
  }
  const byId = new Map(all.map((i) => [i.id, i]));
  const prevById = new Map(state.cases.map((c) => [c.id, c]));
  const gone = new Set<string>();
  await Promise.all(
    ids
      .filter((id) => !byId.has(id))
      .map(async (id) => {
        try {
          byId.set(id, (await api.incident(id)).incident);
        } catch (e) {
          if (is404(e)) {
            forgetCase(id);
            gone.add(id);
          }
        }
      }),
  );
  const cases = ids.flatMap((id) => {
    if (gone.has(id)) return [];
    const inc = byId.get(id) ?? prevById.get(id);
    return inc ? [inc] : [];
  });
  const changed: Record<string, string> = {};
  if (state.loaded) {
    for (const c of cases) {
      const before = prevById.get(c.id);
      if (before && before.status !== c.status) changed[c.id] = before.status;
    }
  }
  const same =
    state.loaded &&
    !state.error &&
    state.cases.length === cases.length &&
    cases.every((c, i) => {
      const p = state.cases[i];
      return p.id === c.id && p.status === c.status && p.completed_at === c.completed_at && p.report_ids.length === c.report_ids.length;
    });
  if (same) return;
  publish({ cases: order(cases), loaded: true, error: false, changed, version: state.version + 1 });
}

/** Refresh now. Calls made while a refresh runs are folded into one follow-up refresh. */
export function refreshMyCases(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (inflight) {
    again = true;
    return inflight;
  }
  inflight = (async () => {
    try {
      do {
        again = false;
        await loadOnce();
      } while (again);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Sign out: drop what this device showed. */
export function resetMyCases(): void {
  publish({ ...EMPTY, version: state.version + 1 });
}

let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;

const visible = () => document.visibilityState === "visible";
const onVisibility = () => {
  if (visible()) void refreshMyCases();
};
const onOnline = () => void refreshMyCases();
const onStorage = (e: StorageEvent) => {
  if (e.key === null || e.key === CASES_KEY) void refreshMyCases();
};

/** Start polling (ref-counted: the app shell calls this once per mounted layout). */
export function startMyCases(): () => void {
  users += 1;
  if (users === 1) {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("storage", onStorage);
    timer = setInterval(() => {
      if (visible()) void refreshMyCases();
    }, MY_CASES_POLL_MS);
    void refreshMyCases();
  }
  return () => {
    users -= 1;
    if (users === 0) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
    }
  };
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useMyCases(): MyCasesState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}
