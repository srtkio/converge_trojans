// "Me too" from the Map tab: adds the citizen's report to an existing case through the normal
// dedup engine (same category and spot), exactly like the button on /track and in the form.
import { api } from "./api";
import { markMeToo, rememberCase } from "./citizen";
import { refreshMyCases } from "./myCases";
import type { Incident } from "./types";

export const ME_TOO_TEXT = "Me too: I see the same problem here.";

/** Returns the case the report landed in. Normally that's `inc`; a case older than 3 days gets a fresh one. */
export async function joinCase(inc: Incident, reporter: string): Promise<{ incident: Incident; joined: boolean }> {
  const r = await api.report({
    text: ME_TOO_TEXT,
    category: inc.category,
    lat: inc.lat,
    lng: inc.lng,
    reporter,
    location: { source: "landmark", accuracy_m: null, label: `Same spot as case ${inc.id}` },
  });
  markMeToo(inc.id);
  rememberCase(r.incident.id);
  void refreshMyCases();
  return { incident: r.incident, joined: r.incident.id === inc.id };
}
