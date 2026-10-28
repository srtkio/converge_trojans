"use client";

import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { normaliseCaseId } from "@/components/TrackLookup";

/** Dark "track a case" field for the landing page; same id rules as the citizen TrackLookup. */
export function TrackCase() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = normaliseCaseId(value);
    if (!id) {
      setError("Case numbers look like inc_001. You get one when you report a problem.");
      return;
    }
    setError(null);
    router.push(`/track/${id}`);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <label htmlFor="ld-case-id" className="text-sm font-medium text-muted">
        Already reported something? Track it.
      </label>
      <div className="mt-2 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="ld-case-id"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. inc_001"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "ld-case-id-error" : undefined}
            className="h-12 w-full rounded-xl border border-line-strong bg-background/70 pl-10 pr-3 font-mono text-base text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-4 text-base font-semibold text-foreground transition hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-safe:active:scale-95"
        >
          Track <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p id="ld-case-id-error" role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
