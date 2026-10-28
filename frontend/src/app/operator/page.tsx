"use client";

import { ArrowLeft, Eye, EyeOff, Fingerprint, KeyRound, Landmark, Lock, MapPin, ShieldCheck, Siren, Timer, Workflow } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Dashboard } from "@/components/Dashboard";
import { api } from "@/lib/api";
import { clearSession, readSession, saveSession, type Session } from "@/lib/session";

type Operator = Extract<Session, { kind: "operator" }>;

export default function OperatorPage() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Restore a session from this tab. Reading storage needs the browser, so this runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOperator(readSession("operator") as Operator | null);
    setChecked(true);
  }, []);

  if (!checked) return <div className="min-h-dvh w-full bg-background" />;

  if (operator) {
    return (
      <Dashboard
        operator={operator}
        onSignOut={() => {
          clearSession();
          setOperator(null);
        }}
      />
    );
  }

  return <OperatorLogin onSignedIn={setOperator} />;
}

// Published demo accounts (README › Portals and demo sign-in), one per level of the ladder.
const DEMO = [
  { badge: "OPS-WTR-01", code: "water-demo-2026", role: "Officer", dept: "Water" },
  { badge: "HEAD-WTR-01", code: "water-head-2026", role: "Dept. head", dept: "Water" },
  { badge: "CMD-01", code: "command-demo-2026", role: "Command", dept: "All depts." },
];

const FIELD =
  "h-11 w-full rounded-lg border border-line-strong bg-[#0a0f1b] px-3 text-[15px] text-foreground placeholder:text-slate-500 outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/25";

function OperatorLogin({ onSignedIn }: { onSignedIn: (op: Operator) => void }) {
  const [badge, setBadge] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await api.operatorLogin({ badge_id: badge.trim().toUpperCase(), access_code: code });
      const op: Operator = { kind: "operator", ...profile };
      saveSession(op);
      onSignedIn(op);
    } catch {
      setError("Access not verified. Check your badge ID and access code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="op-root relative flex min-h-dvh w-full flex-col overflow-hidden text-foreground lg:flex-row">
      <div className="op-grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_70%)]" aria-hidden />

      {/* Brand side */}
      <section className="relative flex flex-col justify-between gap-10 px-5 pb-4 pt-6 sm:px-10 lg:w-[52%] lg:px-14 lg:py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_10px_30px_-10px_rgba(91,140,255,0.9)]">
              <Landmark className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-[13px] font-bold tracking-[0.22em]">CONVERGE</span>
              <span className="block text-[11px] text-muted">Civic Operations Command</span>
            </span>
          </div>
          <Link href="/" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted ring-1 ring-line transition hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
          </Link>
        </div>

        <div className="op-fade-up hidden max-w-xl lg:block">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-2/10 px-3 py-1 text-[11px] font-medium text-accent-2 ring-1 ring-accent-2/25">
            <MapPin className="h-3 w-3" aria-hidden /> Murthal–Sonipat pilot · Haryana
          </span>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight">
            From citizen complaint
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">to verified resolution.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            The operator console for city departments: duplicates merged, shared causes found, crews dispatched, and nothing closed without proof.
          </p>
          <ul className="mt-8 grid max-w-lg grid-cols-2 gap-3">
            {[
              { icon: Workflow, t: "Dedup & root cause", d: "One work order per real problem" },
              { icon: Timer, t: "SLA escalation", d: "Officer → head → command" },
              { icon: ShieldCheck, t: "Evidence-checked closure", d: "False closures get caught" },
              { icon: Siren, t: "Live audit trail", d: "Every action, every actor" },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="rounded-xl border border-line bg-surface/70 p-3.5 backdrop-blur">
                <Icon className="h-4 w-4 text-accent" aria-hidden />
                <p className="mt-2 text-[13px] font-medium">{t}</p>
                <p className="text-[11px] text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-[11px] text-muted lg:block">Authorised department personnel only. All actions are recorded on the audit trail.</p>
      </section>

      {/* Form side */}
      <section className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:items-center lg:border-l lg:border-line lg:bg-[#080c16]/60 lg:px-10">
        <div className="op-fade-up w-full max-w-md">
          <div className="rounded-2xl border border-line-strong bg-surface/90 p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/25">
                <Fingerprint className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Operator sign-in</h1>
                <p className="text-xs text-muted">Only verified department staff can open the console.</p>
              </div>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="op-badge" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Badge ID
                </label>
                <div className="relative mt-1.5">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    id="op-badge"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="e.g. OPS-WTR-01"
                    required
                    className={`${FIELD} pl-9 font-mono uppercase placeholder:normal-case`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="op-code" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Access code
                </label>
                <div className="relative mt-1.5">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    id="op-code"
                    type={show ? "text" : "password"}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="current-password"
                    required
                    className={`${FIELD} pl-9 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide characters" : "Show characters"}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-semibold text-white shadow-[0_12px_30px_-12px_rgba(91,140,255,0.95)] transition hover:bg-[#6f9bff] disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" aria-hidden /> Checking…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
              {error && (
                <p role="alert" className="flex items-center gap-2 rounded-lg bg-bad/10 px-3 py-2 text-sm text-[#fca5a5] ring-1 ring-bad/25">
                  <Lock className="h-4 w-4 shrink-0" aria-hidden /> {error}
                </p>
              )}
            </form>

            <div className="mt-7 border-t border-line pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Demo access · one per escalation level</p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.badge}
                    type="button"
                    onClick={() => {
                      setBadge(d.badge);
                      setCode(d.code);
                      setError(null);
                    }}
                    className={`rounded-lg px-2 py-2 text-left ring-1 transition hover:ring-accent/60 ${badge === d.badge ? "bg-accent/10 ring-accent/50" : "bg-[#0a0f1b] ring-line"}`}
                  >
                    <span className="block text-[12px] font-medium text-foreground">{d.role}</span>
                    <span className="block truncate font-mono text-[10px] text-muted">{d.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
            <Lock className="h-3 w-3" aria-hidden /> Session ends when this tab closes
          </p>
        </div>
      </section>
    </main>
  );
}
