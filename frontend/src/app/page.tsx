import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, MapPin } from "lucide-react";

import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HeroMap } from "@/components/landing/HeroMap";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LiveProof } from "@/components/landing/LiveProof";
import { RevealObserver } from "@/components/landing/RevealObserver";
import { TrackCase } from "@/components/landing/TrackCase";
import { TryIt } from "@/components/landing/TryIt";
import "@/components/landing/landing-live.css";

const ROOT_ID = "ld-root";

const d = (n: number) => ({ "--d": n }) as CSSProperties;

function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden="true" className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-accent to-accent-2 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.9)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#070a12" strokeWidth="2.6" strokeLinecap="round">
          <path d="M4 5l8 7M20 5l-8 7M12 21v-9" />
          <circle cx="12" cy="12" r="1.6" fill="#070a12" stroke="none" />
        </svg>
      </span>
      <span className="text-sm font-semibold tracking-[0.2em] text-foreground">CONVERGE</span>
    </span>
  );
}

function PrimaryCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/citizen"
      className={`ld-btn-primary group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.98] ${className}`}
    >
      <MapPin aria-hidden="true" className="h-4 w-4" />
      I&rsquo;m a citizen
      <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
    </Link>
  );
}

function SecondaryCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/operator"
      className={`group inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-white/[0.03] px-6 text-base font-semibold text-foreground transition hover:border-accent/60 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-safe:active:scale-[0.98] ${className}`}
    >
      <LayoutDashboard aria-hidden="true" className="h-4 w-4 text-muted transition-colors group-hover:text-accent" />
      I work for a department
    </Link>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: string }) {
  return (
    <div className="ld-reveal max-w-2xl">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]">{title}</h2>
      {body && <p className="mt-5 text-lg leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <main id={ROOT_ID} className="ld-root ld-emerald relative min-h-dvh bg-background text-foreground">
      <RevealObserver rootId={ROOT_ID} />

      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
          <Link href="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Logo />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-muted md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#try" className="transition-colors hover:text-foreground">Try it</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/operator" className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:text-foreground sm:inline-flex">
              Operator console
            </Link>
            <Link href="/citizen" className="ld-btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white">
              Report a problem
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden pt-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_55%_at_50%_0%,rgba(16,185,129,0.14),transparent)]" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-10 lg:pb-24 lg:pt-10">
          <div>
            <div className="ld-rise" style={d(0)}>
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1.5 pr-3 text-xs font-medium text-foreground/90">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-2 py-0.5 text-ok">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="ld-ping absolute inline-flex h-full w-full rounded-full bg-ok" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
                  </span>
                  Live pilot
                </span>
                <span className="truncate">Murthal–Sonipat, Haryana · NH-44</span>
              </span>
            </div>

            <h1 className="ld-rise mt-7 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl xl:text-7xl" style={d(1)}>
              City complaints,
              <br />
              <span className="text-accent">closed only when they&rsquo;re really fixed.</span>
            </h1>

            <p className="ld-rise mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl" style={d(2)}>
              CONVERGE turns citizen reports into verified repairs. It merges duplicates, finds the shared cause, sends the nearest crew,
              enforces deadlines, and won&rsquo;t close a case without evidence.
            </p>

            <div className="ld-rise mt-9 flex flex-col gap-3 sm:flex-row" style={d(3)}>
              <PrimaryCta />
              <SecondaryCta />
            </div>

            <div className="ld-rise mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted" style={d(4)}>
              <span>Try the live demo:</span>
              <a href="#try" className="font-medium text-foreground/90 underline decoration-line-strong underline-offset-4 transition hover:decoration-accent">
                Judges: 30-second tour
              </a>
              <Link href="/citizen/map" className="font-medium text-foreground/90 underline decoration-line-strong underline-offset-4 transition hover:decoration-accent">
                Citizen map
              </Link>
            </div>
          </div>

          <div className="ld-rise relative mx-auto w-full max-w-[520px]" style={d(2)}>
            <div className="overflow-hidden rounded-2xl border border-line shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
              <HeroMap />
            </div>
          </div>
        </div>
      </section>

      <LiveProof />

      {/* How it works */}
      <section id="how" className="relative z-10 scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="How it works"
            title={
              <>
                How one complaint <span className="text-muted">gets fixed.</span>
              </>
            }
            body="Five steps CONVERGE runs for every case, on the real Murthal–Sonipat corridor."
          />
          <div className="mt-12 sm:mt-14">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Features"
            title={
              <>
                Built for the part ticketing <span className="text-muted">gets wrong.</span>
              </>
            }
            body="Logging complaints is easy. CONVERGE is about what happens after: fewer duplicate jobs, fewer wasted crew trips, and no case closed on a promise."
          />
          <div className="mt-14">
            <FeatureGrid />
          </div>
        </div>
      </section>

      {/* Try it */}
      <section id="try" className="relative z-10 scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="For judges"
            title={
              <>
                Try it in 30 seconds. <span className="text-muted">Three ways in.</span>
              </>
            }
            body="Everything below runs against the live backend: the same data the counters and the map above are showing."
          />
          <div className="ld-reveal mt-12">
            <TryIt />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-4 pb-24 pt-8 sm:px-6 sm:pb-32">
        <div className="ld-reveal relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-line bg-surface px-6 py-12 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:px-12 sm:py-16">
          <div className="relative grid items-end gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div>
              <h2 className="text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                See something broken?
                <br />
                <span className="text-accent">Report it. Watch it get fixed.</span>
              </h2>
              <p className="mt-5 max-w-lg text-lg text-muted">Citizens report in seconds. Operators see one clean queue with deadlines and evidence.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryCta />
                <SecondaryCta />
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-background/60 p-5">
              <TrackCase />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-muted">Citizen reports to verified resolution. Pilot: Murthal–Sonipat, Haryana.</p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted sm:items-end">
            <div className="flex gap-5">
              <Link href="/citizen" className="transition-colors hover:text-foreground">Citizen app</Link>
              <Link href="/operator" className="transition-colors hover:text-foreground">Operator console</Link>
            </div>
            <p>
              Built by <span className="font-semibold text-foreground">Team TROJANS</span>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
