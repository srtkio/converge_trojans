import Link from "next/link";

import { Reveal } from "@/components/CitizenMotion";
import { BrandMark, CitizenShell } from "@/components/CitizenShell";
import { CARD } from "@/lib/citizenStyles";
import { TrackLookup } from "@/components/TrackLookup";

const PORTAL =
  "block rounded-2xl p-5 transition duration-200 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.99]";

const STEPS = [
  { icon: "📝", title: "Report", text: "Tell us what and where" },
  { icon: "🛠️", title: "We fix", text: "The right crew is sent" },
  { icon: "✅", title: "You confirm", text: "Closed only when it's fixed" },
];

export default function Home() {
  return (
    <CitizenShell>
      <Reveal>
        <BrandMark />
        <h1 className="mt-6 text-[2rem] font-semibold leading-[1.1] tracking-tight text-slate-900">
          Report a city problem. Follow it until it&apos;s really fixed.
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Potholes, leaks, broken streetlights, garbage. Every case is checked before it is closed.
        </p>
      </Reveal>

      <Reveal index={1}>
        <Link
          href="/citizen"
          className={`${PORTAL} bg-emerald-600 shadow-[0_14px_30px_-16px_rgba(5,150,105,0.9)] hover:bg-emerald-700`}
        >
          <span className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-lg font-semibold text-white">I&apos;m a citizen</span>
              <span className="mt-1 block text-sm text-emerald-50">Report a problem and follow it until it is fixed.</span>
            </span>
            <span aria-hidden="true" className="text-2xl text-white">
              →
            </span>
          </span>
        </Link>
      </Reveal>

      <Reveal index={2}>
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl bg-white/70 p-3 text-center ring-1 ring-slate-900/5">
              <span aria-hidden="true" className="text-xl">
                {s.icon}
              </span>
              <span className="mt-1 block text-xs font-semibold text-slate-900">
                {i + 1}. {s.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{s.text}</span>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal index={3}>
        <TrackLookup />
      </Reveal>

      <Reveal index={4}>
        <Link href="/operator" className={`${PORTAL} ${CARD} hover:ring-slate-300`}>
          <span className="block text-lg font-semibold text-slate-900">I work for a department</span>
          <span className="mt-1 block text-sm text-slate-600">Operator access is verified with your badge ID and access code.</span>
        </Link>
      </Reveal>
    </CitizenShell>
  );
}
