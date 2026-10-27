"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Reveal } from "@/components/CitizenMotion";
import { BrandMark } from "@/components/CitizenShell";
import { api } from "@/lib/api";
import { NAME_KEY, WAKING_HINT, useSlowHint } from "@/lib/citizen";
import { BIG_BUTTON, CARD } from "@/lib/citizenStyles";
import { firstName, saveSession, type Session } from "@/lib/session";

export type Citizen = Extract<Session, { kind: "citizen" }>;

/** Sign-in screen of the citizen app. Shown on its own: no top bar, nav or install hint around it. */
export function CitizenLogin({ onSignedIn }: { onSignedIn: (c: Citizen) => void }) {
  const [name, setName] = useState("");

  useEffect(() => {
    // Pre-fill the name from this device's last visit. The email is never stored.
    try {
      const last = window.localStorage.getItem(NAME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (last) setName((current) => current || last);
    } catch {
      // Storage blocked: the field simply starts empty.
    }
  }, []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slow = useSlowHint(busy);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await api.citizenLogin({ name, email });
      const c: Citizen = { kind: "citizen", ...profile };
      saveSession(c);
      try {
        window.localStorage.setItem(NAME_KEY, firstName(profile.name));
      } catch {
        // Not remembered next time; that's fine.
      }
      onSignedIn(c);
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      setError(
        text.startsWith("422")
          ? "That email doesn't look right. Check it and try again."
          : "We couldn't sign you in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const input =
    "mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-4">
      <Reveal>
        <div className="flex items-center justify-between">
          <BrandMark />
          <Link href="/" className="rounded-lg px-2 py-1 text-sm text-slate-600 underline-offset-4 hover:underline">
            ← Back
          </Link>
        </div>
        <h1 className="mt-6 text-2xl font-semibold leading-tight tracking-tight">Report a problem in your area</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with your name and email to report problems and follow them until they are fixed.
        </p>
      </Reveal>

      <Reveal index={1}>
      <form onSubmit={submit} className={`${CARD} space-y-4`}>
        <label className="block text-sm font-medium text-slate-800">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            enterKeyHint="next"
            required
            className={input}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            enterKeyHint="go"
            required
            className={input}
          />
        </label>
        <p className="text-xs text-slate-500">Only your first name is attached to your reports. Your email stays private.</p>
        <button
          type="submit"
          disabled={busy}
          className={`${BIG_BUTTON} bg-slate-900 text-white shadow-[0_12px_26px_-16px_rgba(15,23,42,0.9)] hover:bg-slate-800`}
        >
          {busy ? "Signing in…" : "Continue"}
        </button>
        {slow && (
          <p role="status" className="text-center text-sm text-slate-600">
            {WAKING_HINT}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
            {error}
          </p>
        )}
      </form>
      </Reveal>
    </div>
  );
}
