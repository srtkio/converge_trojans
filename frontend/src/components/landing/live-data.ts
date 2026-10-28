"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Incident } from "@/lib/types";

/** Result of a live API read: still loading, failed (or asleep past the timeout), or data. */
export type Live<T> = { state: "loading" } | { state: "error" } | { state: "ok"; data: T; at: number };

const TIMEOUT_MS = 15000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

let incidentsOnce: Promise<Incident[]> | null = null;

/** One /incidents request shared by the landing widgets that only need it once. */
export function sharedIncidents(): Promise<Incident[]> {
  if (!incidentsOnce) {
    incidentsOnce = api.incidents();
    incidentsOnce.catch(() => {
      incidentsOnce = null;
    });
  }
  return incidentsOnce;
}

/** Load from the API on mount (and every `refreshMs` if given). `load` must be a stable function. */
export function useLive<T>(load: () => Promise<T>, refreshMs = 0): Live<T> {
  const [s, setS] = useState<Live<T>>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    const run = () =>
      withTimeout(load()).then(
        (data) => {
          if (alive) setS({ state: "ok", data, at: Date.now() });
        },
        () => {
          if (alive) setS((prev) => (prev.state === "ok" ? prev : { state: "error" }));
        },
      );
    void run();
    const id = refreshMs > 0 ? window.setInterval(run, refreshMs) : 0;
    return () => {
      alive = false;
      if (id) window.clearInterval(id);
    };
  }, [load, refreshMs]);
  return s;
}

export const CLOSED = new Set(["verified_closed", "rejected"]);
