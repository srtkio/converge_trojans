# Prachi — engine and architecture

## You own
- Backend engine: dedup, assignment, replanning, SLA escalation, verification, metrics, LLM layer.
- v2 root-cause hypotheses and coordinated repair; v3 photo check and SLA-at-risk.

## Your lines (3:30)
"Under the hood, every decision is a rule you can read and test: duplicates within 150 metres and
72 hours merge; related categories within 400 metres link. Assignment picks the nearest free crew,
and if that crew drops out we replan instantly. Each category has a deadline; miss it and it
escalates. *Complete* only means *awaiting proof*. Claude Haiku explains links in plain English
but can't change a decision. It's capped at a ±0.15 confidence nudge. 35 automated tests cover these rules."

Show `docs/ARCHITECTURE.md` diagram on the slide.

## Judge questions you take
- *How do you detect duplicates?* Same category + distance + time window; reason stored on the link.
- *What if the AI is wrong?* It can't change decisions; no API key → system works the same.
- *Scale?* SQLite for the demo; SQLModel lets us switch to Postgres/PostGIS without rewriting.
- *What stops a fake closure?* Rule 5 in `docs/CONTRACTS.md`: closing needs supporting evidence and no newer contradicting report.

## Pitch running order (5 min + Q&A)
| # | Section | Presenter | Time |
|---|---|---|---|
| 1 | Hook + problem | Sarthak | 0:00–0:45 |
| 2 | Market gap: what existing systems miss | Poorvi | 0:45–1:30 |
| 3 | Live demo (v1 golden, or v2 root cause) | Antriksh drives, Sarthak narrates | 1:30–3:30 |
| 4 | How it works: engine + architecture | Prachi | 3:30–4:15 |
| 5 | Results, user testing, business, future, close | Poorvi → Sarthak | 4:15–5:00 |

Everyone: be able to explain the one-line pitch and the core rule.
- **One line:** "CONVERGE turns citizen complaints into *verified* fixes. It merges duplicates, finds shared causes, enforces deadlines, and only closes a case when evidence proves it's fixed."
- **Core rule:** "A department saying *done* is not proof. Done means *waiting for evidence*; contradicting evidence reopens the case automatically."
