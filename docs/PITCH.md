# CONVERGE pitch outline

Nine slides, in the running order from the presenter files (5 minutes plus Q&A). Every number
comes from a scenario run on the backend `/metrics` endpoint. Re-run the scenarios before the pitch
and update any figure that changed.

**Last checked on `main` at commit 47a9ed9:** both scenarios re-run, numbers unchanged.

Numbers are from these runs:
- **v1 · Golden** (10 steps): `POST /sim/scenario/golden?step=10`
- **v2 · Root cause** (8 steps): `POST /sim/scenario/rootcause?step=8`

| # | Slide | Presenter | Message | Numbers (source) |
|---|---|---|---|---|
| 1 | Hook and problem | Sarthak | When ten people report the same burst pipe, a city opens ten tickets. When a crew says "fixed", the ticket closes even if the water still flows. | None |
| 2 | Market gap | Poorvi | Existing systems collect and route complaints. Most flag or point to duplicates. None we found link a shared cause or require proof before closing. Use the wording in `team/poorvi/research.md`. | None (research table) |
| 3 | Live demo | Antriksh drives, Sarthak narrates | Live: v1 golden for the closure loop, then v2 root cause for the shared cause. See `docs/PRESENTATION_SCRIPT.md` (timing) and `docs/DEMO.md` (clicks). | Live counters on screen |
| 4 | How it works | Prachi | Rules decide every outcome. The LLM only writes wording and never changes a status. | None |
| 5 | Naive vs CONVERGE (v1) | Poorvi | Same three reports. The naive system opens three work orders and accepts one false closure. CONVERGE opens two, catches the false closure, and escalates the missed deadline. | v1 step 10: work orders 3 (baseline) vs 2; false closures accepted 1 (baseline) vs 0 (1 caught); duplicates linked 1; SLA breaches 1 |
| 6 | One repair instead of three visits (v2) | Sarthak | Three complaints share one cause. CONVERGE proposes one hypothesis, an operator confirms it, and one repair covers all three. | v2 step 8: crew visits 3 → 1 (2 saved); hypotheses confirmed 1; verified closed 3 of 3 |
| 7 | User testing | Poorvi | Six real people run the citizen page and rate it in-app. | **TBD**: count, average rating, and quotes from `/feedback/summary` after testing. Do not fill in until the testing is done. |
| 8 | Business and future | Poorvi | Sold to city corporations and command centres as a verification layer on top of their current portal. The same engine can handle water, food, and health complaints. | None |
| 9 | Team and close | Sarthak | "A department saying done is not proof. Done means awaiting evidence. Contradicting evidence reopens the case automatically." | None |

## Judge questions

- **Who pays?** Municipal corporations, Smart City SPVs, command-and-control centre vendors.
- **What is novel?** The verified loop, plus shared-cause repair (v2). Most tools stop at
  classification or dashboards.
- **Why not AI for everything?** Rules decide, so each decision is explainable and auditable. The
  LLM explains in plain language and cannot change an outcome.
- **How does a city adopt it?** It sits on top of the existing complaint portal through an API. Start
  with one ward and one category.

## Before the pitch

- Re-run both scenarios on the final backend and update slides 5 and 6 if any figure changed.
- Slide 7 stays as TBD until the six user tests are in and `/feedback/summary` shows real submissions.
