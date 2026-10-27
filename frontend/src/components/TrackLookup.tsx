"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CARD } from "@/lib/citizenStyles";

/** Accepts "inc_001", "INC-1", "#12" or "12" and returns a canonical case id, or null. */
export function normaliseCaseId(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/^#/, "");
  const m = /^(?:inc[_-]?)?(\d{1,6})$/.exec(t);
  return m ? `inc_${m[1].padStart(3, "0")}` : null;
}

export function TrackLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = normaliseCaseId(value);
    if (!id) {
      setError("Case numbers look like inc_001. You'll find yours after you report a problem.");
      return;
    }
    setError(null);
    router.push(`/track/${id}`);
  };

  return (
    <form onSubmit={submit} className={CARD}>
      <label htmlFor="case-id" className="text-lg font-semibold text-slate-900">
        Track a case
      </label>
      <p className="mt-1 text-sm text-slate-600">Have a case number? See where it is.</p>
      <div className="mt-3 flex gap-2">
        <input
          id="case-id"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. inc_001"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-describedby={error ? "case-id-error" : undefined}
          className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 font-mono text-base focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-slate-900 px-5 text-base font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 motion-safe:active:scale-95"
        >
          Track
        </button>
      </div>
      {error && (
        <p id="case-id-error" role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </form>
  );
}
