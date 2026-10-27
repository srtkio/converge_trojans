import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">CONVERGE</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Who are you?</h1>
        <p className="mt-2 text-slate-600">Choose the portal that fits you.</p>
      </div>

      <Link
        href="/citizen"
        className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
      >
        <p className="text-lg font-semibold text-slate-900">I&apos;m a citizen</p>
        <p className="mt-1 text-sm text-slate-600">Report a problem and follow it until it is fixed.</p>
      </Link>

      <Link
        href="/operator"
        className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-400"
      >
        <p className="text-lg font-semibold text-slate-900">I work for a department</p>
        <p className="mt-1 text-sm text-slate-600">Operator access is verified with your badge ID and access code.</p>
      </Link>
    </main>
  );
}
