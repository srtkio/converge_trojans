import { Suspense } from "react";

import { TrackView } from "./TrackView";

// The case id comes from the URL, so this page is rendered per request and the data loads in the browser.
export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-6 text-slate-600">
          Loading your case…
        </main>
      }
    >
      <TrackView params={params} />
    </Suspense>
  );
}
