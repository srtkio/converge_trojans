import { Suspense } from "react";

import { CitizenScreen } from "@/components/CitizenScreen";
import { CitizenShell } from "@/components/CitizenShell";

import { TrackView } from "./TrackView";

// The case id comes from the URL, so this page is rendered per request and the data loads in the browser.
export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <CitizenScreen>
      <Suspense
        fallback={
          <CitizenShell>
            <p className="text-sm text-slate-600">Loading your case…</p>
          </CitizenShell>
        }
      >
        <TrackView params={params} />
      </Suspense>
    </CitizenScreen>
  );
}
