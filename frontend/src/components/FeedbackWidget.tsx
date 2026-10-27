"use client";

import { useState } from "react";

import { api } from "@/lib/api";

const ROLES = [
  { value: "citizen", label: "I reported a problem" },
  { value: "operator", label: "I work for a department" },
  { value: "other", label: "Other" },
];

// Shown when the backend has no /feedback route yet (it is being added in parallel).
const NOT_READY = "Feedback isn't switched on yet. Please try again later.";

export function FeedbackWidget() {
  const [rating, setRating] = useState(0);
  const [role, setRole] = useState("citizen");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!rating) {
      setMessage("Pick a star rating first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.feedback({ rating, role, comment: comment.trim() });
      setMessage("Thanks, your feedback was received.");
      setRating(0);
      setComment("");
    } catch (e) {
      const text = e instanceof Error ? e.message : "";
      setMessage(text.startsWith("404 ") ? NOT_READY : "Could not send feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="feedback-heading" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 id="feedback-heading" className="text-base font-semibold text-slate-900">
        Rate this
      </h2>

      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className={`h-12 flex-1 rounded-lg text-2xl ring-1 transition ${
              n <= rating ? "bg-amber-100 text-amber-500 ring-amber-300" : "bg-white text-slate-300 ring-slate-200"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Who are you?
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Comment <span className="font-normal text-slate-400">(optional)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-4 h-12 w-full rounded-lg bg-slate-900 text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send feedback"}
      </button>

      {message && (
        <p role="status" className="mt-3 text-sm text-slate-600">
          {message}
        </p>
      )}
    </section>
  );
}
