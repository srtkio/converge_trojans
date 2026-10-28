# Roadmap: MVP → v2 → v3 (7 hours left)

> **Status (2026-10-28):** v1, v2 and v3 are on `main`. Current status and next steps: `TEAM_GUIDE.md` section 9.

Builders: **Sarthak + Prachi** (with their Claudes) and the coordinator Claude (`trojans-a0`).
Antriksh and Poorvi present (see `team/<name>/PRESENTER.md`), they don't build.

| Version | Theme | Status | Done when |
|---|---|---|---|
| **v1 MVP** | Verified loop: dedup → assign → replan → SLA → evidence-checked close/reopen, audit, baseline metrics | ✅ on main | 35 tests + smoke PASS |
| **v2** | **Root cause & coordinated repair** | building | golden v2 scenario passes, dashboard shows hypothesis + impact |
| **v3** | **Citizen loop & AI-assisted verification** | queued | citizen page works on a phone; feedback from 6 real testers shown |

## v2 — Root cause & coordinated repair (T+0 → T+2.5h)

Why it's innovative: other systems close tickets one by one. CONVERGE notices that several
complaints share one upstream cause, proposes **one** repair instead of many, and shows who else
is affected.

Backend (Prachi's Claude, branch `feat/v2-rootcause`):
- `engine/rootcause.py`: group incidents connected by `related` links into a **Hypothesis**
  `{id, cause_incident_id, member_ids, evidence_for, evidence_against, confidence, status: proposed|confirmed|rejected}`.
  Deterministic scoring (count, distance, time order, category dependency); LLM may only write the
  summary sentence.
- `GET /hypotheses`, `POST /hypotheses/{id}/confirm|reject` (audited).
- Confirming makes the cause incident the **parent**: children wait on it; when the parent is
  `verified_closed`, each child moves to `pending_verification` (never auto-closed: the
  closure ≠ resolution rule still holds).
- **Service impact**: seed a few city services (bus route 335E, school, clinic access) tied to a
  location radius; `GET /incidents/{id}/impact` lists affected services. Labelled *simulated*.
- Metrics: `crew_visits_saved` and `coordinated_vs_independent` (baseline = one visit per incident).
- Must pass: pytest green, plus a test per rule; v1 golden output unchanged.

Frontend (Sarthak's Claude, branch `feat/v2-ui`): hypothesis card with evidence for/against and
confidence bar, Confirm/Reject buttons, parent→child tree, "affected services" panel, new metric tiles.

## v3 — Citizen loop & AI-assisted verification (T+2.5 → T+4.5h)

Why it's innovative: the citizen who reported the problem becomes the verifier, and photos are
checked before anyone trusts a "done".

- **Citizen page** `/track/[incidentId]` (trojans-a0, branch `feat/v3-citizen`): mobile-first
  status timeline, deadline, crew, and one-tap **"Is it fixed? Yes / Still broken"** → evidence.
- **Photo check** (Prachi's Claude): evidence may carry a photo; `claude-haiku-5-5` vision says
  whether it *appears* fixed. It is a **signal only** (stored as `kind: photo`, `source: ai-check`);
  closure still needs the rule in CONTRACTS.md. No key → skipped.
- **SLA risk**: incidents with <25% of SLA left and not started are flagged `at_risk` and the
  department is notified *before* the breach.
- **Real user feedback** (trojans-a0): a small "Rate this" widget (1–5 + comment + role) → `POST
  /feedback`, `GET /feedback/summary`. The dashboard shows **only real submissions**.

## Freeze and polish (T+4.5 → T+7h)

- T+4.5h **scope freeze**: bug fixes only.
- **User testing**: 6 real people each run the citizen flow and the dashboard and submit feedback.
  The pitch uses those real numbers (count, average, quotes). No invented numbers.
- Deploy (Vercel frontend; backend local or Render) + recorded backup video.
- Pitch deck + two full rehearsals with all 4 presenters.
