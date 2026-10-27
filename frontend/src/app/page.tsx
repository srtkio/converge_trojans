import Link from "next/link";

import { Reveal } from "@/components/CitizenMotion";
import { BrandMark } from "@/components/CitizenShell";
import { HeroLoop, LandingStory } from "@/components/landing/LandingStory";
import { TrackLookup } from "@/components/TrackLookup";
import { CARD } from "@/lib/citizenStyles";

const PORTAL =
  "group block rounded-2xl p-6 transition duration-200 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.99]";

function PortalButtons() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/citizen" className={`${PORTAL} bg-emerald-600 shadow-[0_18px_40px_-18px_rgba(5,150,105,0.9)] hover:bg-emerald-700`}>
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-lg font-semibold text-white">I&apos;m a citizen</span>
            <span className="mt-1 block text-sm text-emerald-50">Report a problem and follow it until it&apos;s fixed.</span>
          </span>
          <span aria-hidden="true" className="text-2xl text-white transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
      </Link>
      <Link href="/operator" className={`${PORTAL} ${CARD} hover:ring-slate-300`}>
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-lg font-semibold text-slate-900">I work for a department</span>
            <span className="mt-1 block text-sm text-slate-600">Operator dashboard, verified with your badge.</span>
          </span>
          <span aria-hidden="true" className="text-2xl text-slate-400 transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-dvh bg-slate-50 bg-[radial-gradient(1200px_600px_at_20%_-10%,#d1fae5_0%,transparent_60%),radial-gradient(900px_500px_at_100%_0%,#e0f2fe_0%,transparent_55%)] text-slate-900">
      {/* Hero */}
      <section className="mx-auto grid min-h-[92dvh] max-w-6xl items-center gap-10 px-6 py-12 sm:py-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div>
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <BrandMark />
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-900 shadow-sm backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600"></span>
              </span>
              <span>Live Pilot: Murthal–Sonipat Corridor (NH-44)</span>
            </div>
          </div>
        </Reveal>
        <Reveal index={1}>
          <h1 className="mt-8 max-w-3xl text-[2.4rem] font-semibold sm:text-5xl xl:text-6xl leading-[1.04] tracking-tight">
            City complaints, <span className="text-emerald-600">closed only when they&apos;re really fixed.</span>
          </h1>
        </Reveal>
        <Reveal index={2}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            CONVERGE merges duplicate reports, finds shared causes, sends the right crew, and refuses to close a case until
            evidence proves the fix.
          </p>
        </Reveal>
        <Reveal index={3} className="mt-10 max-w-3xl">
          <PortalButtons />
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Jump straight into the live demo:</span>
            <Link
              href="/track/inc_001"
              className="rounded-lg bg-white px-2.5 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-emerald-700"
            >
              🔍 Case inc_001 (Awaiting Citizen Check)
            </Link>
            <Link
              href="/citizen/map"
              className="rounded-lg bg-white px-2.5 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-emerald-700"
            >
              📍 Citizen Map Tab
            </Link>
          </div>
        </Reveal>
        <Reveal index={4}>
          <a href="#story" className="mt-14 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
            <span className="inline-block motion-safe:animate-bounce">↓</span> Scroll to follow one complaint
          </a>
        </Reveal>
        </div>
        <Reveal index={2} className="hidden lg:block">
          <HeroLoop />
        </Reveal>
      </section>

      {/* Scroll story */}
      <div id="story">
        <LandingStory />
      </div>

      {/* Outro */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">That was one complaint. CONVERGE does this for every one.</h2>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">Pick your portal, or track a case you already reported.</p>
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <PortalButtons />
          <TrackLookup />
        </div>
      </section>
    </main>
  );
}
