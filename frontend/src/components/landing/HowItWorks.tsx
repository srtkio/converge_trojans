import type { CSSProperties } from "react";
import { BadgeCheck, Camera, GitMerge, Network, Wrench } from "lucide-react";

import { CorridorMap } from "./CorridorMap";

const STEPS = [
  { icon: Camera, tag: "Report", title: "A citizen reports it in about 20 seconds.", body: "A photo, a GPS pin or landmark, one sentence. They get a case number they can track." },
  { icon: GitMerge, tag: "Merge duplicates", title: "Neighbours' reports become one case.", body: "Reports within 150 m and 72 h of each other merge, so one crew goes out once." },
  { icon: Network, tag: "Find the root cause", title: "Linked problems share one repair.", body: "A burst main under a pothole is linked as the likely cause, and departments coordinate one fix." },
  { icon: Wrench, tag: "Fix", title: "The nearest free crew goes, on a deadline.", body: "Every case carries an SLA. Missed deadlines climb the escalation ladder instead of stalling." },
  { icon: BadgeCheck, tag: "Verify with evidence", title: "Closed only with proof.", body: "Photo, sensor or inspector evidence is checked. If the citizen says it is not fixed, the case reopens." },
];

/** Compact "how one complaint gets fixed": five step cards beside the live corridor map. */
export function HowItWorks() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      <ol className="relative space-y-3">
        <span aria-hidden="true" className="absolute bottom-6 left-[1.6rem] top-6 w-px bg-gradient-to-b from-accent/60 via-line-strong to-ok/60" />
        {STEPS.map(({ icon: Icon, tag, title, body }, n) => (
          <li key={tag} className="ld-card ld-reveal relative flex gap-4 rounded-2xl p-4 sm:p-5" style={{ "--d": n } as CSSProperties}>
            <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#047857] text-white shadow-[0_8px_24px_-10px_rgba(16,185,129,0.9)] sm:h-10 sm:w-10">
              <Icon aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent-2">
                {String(n + 1).padStart(2, "0")} · {tag}
              </p>
              <h3 className="mt-1.5 text-base font-semibold leading-snug text-foreground sm:text-lg">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="ld-reveal lg:sticky lg:top-24 lg:self-start" style={{ "--d": 2 } as CSSProperties}>
        <CorridorMap />
        <p className="mt-3 text-sm text-muted">
          The pilot runs along GT Road (NH-44) between Sonipat, Rishihood University and Murthal. Each pin is a real case in the system right now.
        </p>
      </div>
    </div>
  );
}
