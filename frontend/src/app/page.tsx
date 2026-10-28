import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, GitMerge, LayoutDashboard, MapPin, Network, RotateCcw, ScrollText, Siren, Truck } from "lucide-react";

import { Comparison } from "@/components/landing/Comparison";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HeroMap } from "@/components/landing/HeroMap";
import { LoopStory } from "@/components/landing/LoopStory";
import { RevealObserver } from "@/components/landing/RevealObserver";
import { TrackCase } from "@/components/landing/TrackCase";

const ROOT_ID = "ld-root";

const d = (n: number) => ({ "--d": n }) as CSSProperties;

function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden="true" className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-accent to-accent-2 shadow-[0_8px_24px_-8px_rgba(91,140,255,0.9)]">
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
      Report a problem
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
      Operator console
    </Link>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: string }) {
  return (
    <div className="ld-reveal max-w-2xl">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2 className="mt-4 text-[2rem] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">{title}</h2>
      {body && <p className="mt-5 text-lg leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

const CAPABILITIES = [
  { icon: GitMerge, text: "Duplicate merge · 150 m / 72 h" },
  { icon: Network, text: "Shared root-cause linking" },
  { icon: Truck, text: "Nearest-crew dispatch" },
  { icon: Siren, text: "SLA escalation ladder" },
  { icon: BadgeCheck, text: "Evidence-gated closure" },
  { icon: RotateCcw, text: "Citizen “still broken” reopens" },
  { icon: ScrollText, text: "Audit trail on every case" },
];

function CapabilityStrip() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {CAPABILITIES.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface/70 px-4 py-2 text-sm text-foreground/85">
          <Icon aria-hidden="true" className="h-4 w-4 text-accent-2" />
          {text}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="ld-marquee overflow-hidden py-2">
      <div className="ld-marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main id={ROOT_ID} className="ld-root relative min-h-dvh bg-background text-foreground">
      <RevealObserver rootId={ROOT_ID} />

      {/* Ambient layers */}
      <div aria-hidden="true" className="ld-noise pointer-events-none fixed inset-0 z-0" />

      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
          <Link href="/" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Logo />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-muted md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#results" className="transition-colors hover:text-foreground">Results</a>
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
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="ld-grid-bg absolute inset-0" />
          <div className="ld-aurora-a absolute -left-[20%] -top-[30%] h-[70vh] w-[80vw] rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.32),transparent)]" />
          <div className="ld-aurora-b absolute -right-[20%] top-[10%] h-[60vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.18),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-10 lg:pb-24 lg:pt-10">
          <div>
            <div className="ld-rise" style={d(0)}>
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface/80 py-1 pl-1.5 pr-3 text-xs font-medium text-foreground/90 backdrop-blur">
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
              <span className="ld-gradient-text">closed only when they&rsquo;re really fixed.</span>
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
              <Link href="/track/inc_001" className="font-medium text-foreground/90 underline decoration-line-strong underline-offset-4 transition hover:decoration-accent">
                Track case inc_001
              </Link>
              <Link href="/citizen/map" className="font-medium text-foreground/90 underline decoration-line-strong underline-offset-4 transition hover:decoration-accent">
                Citizen map
              </Link>
            </div>
          </div>

          <div className="ld-rise relative mx-auto w-full max-w-[520px]" style={d(2)}>
            <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(91,140,255,0.28),transparent)]" />
            <div className="overflow-hidden rounded-[28px] shadow-[0_50px_120px_-40px_rgba(91,140,255,0.55)]">
              <HeroMap />
            </div>
            <div className="ld-glass ld-float absolute -left-3 top-8 hidden rounded-2xl px-4 py-3 sm:block lg:-left-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-2">Dedup</p>
              <p className="mt-1 text-sm font-semibold text-foreground">3 reports → 1 case</p>
              <p className="text-xs text-muted">within 150 m · 72 h</p>
            </div>
            <div className="ld-glass ld-float-slow absolute -right-3 bottom-10 hidden rounded-2xl px-4 py-3 sm:block lg:-right-8">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <BadgeCheck aria-hidden="true" className="h-4 w-4 text-ok" /> Closed with evidence
              </p>
              <p className="mt-0.5 text-xs text-muted">Not just because someone said “done”</p>
            </div>
          </div>
        </div>

        <div className="relative pb-10">
          <p className="ld-rise mb-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-muted" style={d(5)}>
            What the system actually does
          </p>
          <div className="ld-rise mx-auto max-w-6xl" style={d(5)}>
            <CapabilityStrip />
          </div>
        </div>
      </section>

      {/* Scroll story */}
      <section id="how" className="relative z-10 scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="How it works"
            title={
              <>
                Follow one complaint, <span className="text-muted">from report to verified repair.</span>
              </>
            }
            body="Report, dedupe, assign, deadline, evidence, verified close. Scroll through the loop CONVERGE runs for every case."
          />
          <div className="mt-16 sm:mt-20">
            <LoopStory />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px max-w-4xl bg-gradient-to-r from-transparent via-line-strong to-transparent" />
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

      {/* Results */}
      <section id="results" className="relative z-10 scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[50vh] w-[90vw] max-w-5xl -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.12),transparent)]" />
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Naive ticketing vs CONVERGE"
            title={
              <>
                Same scenario. <span className="text-muted">Fewer jobs, fewer trips, no false closures.</span>
              </>
            }
            body="We ran the demo scenario through a naive system (one work order per report, every “done” accepted) and through CONVERGE."
          />
          <div className="mt-14">
            <Comparison />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-4 pb-24 pt-8 sm:px-6 sm:pb-32">
        <div className="ld-reveal relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-line-strong bg-surface px-6 py-14 sm:px-12 sm:py-20">
          <div aria-hidden="true" className="ld-grid-bg absolute inset-0 opacity-70" />
          <div aria-hidden="true" className="ld-aurora-a absolute -left-1/4 -top-1/2 h-[140%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgba(91,140,255,0.3),transparent)]" />
          <div aria-hidden="true" className="ld-aurora-b absolute -bottom-1/2 -right-1/4 h-[140%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.18),transparent)]" />
          <div className="relative grid items-end gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div>
              <h2 className="text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                See something broken?
                <br />
                <span className="ld-gradient-text">Report it. Watch it get fixed.</span>
              </h2>
              <p className="mt-5 max-w-lg text-lg text-muted">Citizens report in seconds. Operators see one clean queue with deadlines and evidence.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryCta />
                <SecondaryCta />
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-background/50 p-5 backdrop-blur">
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
