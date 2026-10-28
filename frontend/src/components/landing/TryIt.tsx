"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, MapPin, Search } from "lucide-react";

import { sharedIncidents, useLive } from "./live-data";

const CARD =
  "ld-card group flex h-full flex-col rounded-2xl border border-line bg-surface/80 p-5 transition hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** "For judges": three direct ways in. The case link uses the first real incident from the API. */
export function TryIt() {
  const live = useLive(sharedIncidents);
  const first = live.state === "ok" ? live.data.find((i) => i.status !== "rejected") ?? live.data[0] : undefined;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li>
        <Link href="/citizen" className={CARD}>
          <MapPin aria-hidden="true" className="h-5 w-5 text-accent" />
          <span className="mt-3 text-lg font-semibold text-foreground">Open the citizen app</span>
          <span className="mt-1 text-sm text-muted">Report a problem with a photo and GPS, then follow it to a verified fix.</span>
          <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-accent-2">
            /citizen <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
          </span>
        </Link>
      </li>
      <li>
        <Link href="/operator" className={CARD}>
          <LayoutDashboard aria-hidden="true" className="h-5 w-5 text-accent" />
          <span className="mt-3 text-lg font-semibold text-foreground">Open the operator console</span>
          <span className="mt-1 text-sm text-muted">Sign in with the demo badge:</span>
          <span className="mt-2 flex flex-wrap gap-1.5 text-sm">
            <code className="whitespace-nowrap rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-foreground/90">CMD-01</code>
            <code className="whitespace-nowrap rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-foreground/90">command-demo-2026</code>
          </span>
          <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-accent-2">
            /operator <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
          </span>
        </Link>
      </li>
      {live.state === "loading" && (
        <li aria-hidden="true" className="h-full min-h-[11rem] rounded-2xl border border-line bg-surface/50 motion-safe:animate-pulse sm:col-span-2 lg:col-span-1" />
      )}
      {first && (
        <li className="sm:col-span-2 lg:col-span-1">
          <Link href={`/track/${first.id}`} className={CARD}>
            <Search aria-hidden="true" className="h-5 w-5 text-accent" />
            <span className="mt-3 text-lg font-semibold text-foreground">Follow a live case</span>
            <span className="mt-1 line-clamp-2 text-sm text-muted">{first.title}</span>
            <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1 pt-4 font-mono text-sm font-medium text-accent-2">
              /track/{first.id} <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
            </span>
          </Link>
        </li>
      )}
    </ul>
  );
}
