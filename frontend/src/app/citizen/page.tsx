"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ReportForm } from "@/components/ReportForm";
import { api } from "@/lib/api";
import { clearSession, firstName, readSession, saveSession, type Session } from "@/lib/session";

type Citizen = Extract<Session, { kind: "citizen" }>;

export default function CitizenPage() {
  const [citizen, setCitizen] = useState<Citizen | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Restore a session from this tab. Reading storage needs the browser, so this runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCitizen(readSession("citizen") as Citizen | null);
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!citizen) return <CitizenLogin onSignedIn={setCitizen} />;
  return <CitizenHome citizen={citizen} onSignOut={() => { clearSession(); setCitizen(null); }} />;
}

function CitizenHome({ citizen, onSignOut }: { citizen: Citizen; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [trackId, setTrackId] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // ReportForm shows its own message for failed submissions; nothing more to do here.
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Citizen portal</p>
          <p className="text-base font-semibold text-slate-900">Hi, {citizen.name}</p>
        </div>
        <button type="button" onClick={onSignOut} className="text-sm text-slate-500 underline">
          Sign out
        </button>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">Report a problem</h1>
        <p className="mt-1 text-sm text-slate-600">Tell us what is wrong and where. We will follow it until it is fixed.</p>
        <div className="mt-4">
          <ReportForm
            busy={busy}
            act={act}
            onCreated={(id) => setTrackId(id)}
            reporter={`citizen:${firstName(citizen.name)}`}
          />
        </div>
      </section>

      {trackId && (
        <Link
          href={`/track/${trackId}`}
          className="block rounded-2xl bg-emerald-600 p-4 text-center text-base font-semibold text-white"
        >
          Track your case
        </Link>
      )}
    </main>
  );
}

function CitizenLogin({ onSignedIn }: { onSignedIn: (c: Citizen) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await api.citizenLogin({ name, email });
      const c: Citizen = { kind: "citizen", ...profile };
      saveSession(c);
      onSignedIn(c);
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      setError(text.startsWith("422") ? "Enter a valid email address." : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-slate-500 underline">
          Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Citizen sign-in</h1>
        <p className="mt-2 text-sm text-slate-600">Enter your name and email to report a problem and follow it.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Continue"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
