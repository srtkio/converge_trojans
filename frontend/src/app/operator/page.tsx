"use client";

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

  if (!checked) return null;

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

function OperatorLogin({ onSignedIn }: { onSignedIn: (op: Operator) => void }) {
  const [badge, setBadge] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await api.operatorLogin({ badge_id: badge.trim(), access_code: code });
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-slate-500 underline">
          Back
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Operator sign-in</h1>
        <p className="mt-2 text-sm text-slate-600">Only verified department staff can open the operator dashboard.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="block text-sm font-medium text-slate-700">
          Badge ID
          <input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Access code
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Sign in"}
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
