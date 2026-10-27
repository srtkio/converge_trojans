# CONVERGE Team Guide

Plain-language guide to what CONVERGE is, how it works, what it's built with, how to run it, and
where we are. Written so someone new can start from zero.

Maintained by the coordinator Claude. Anyone (human or AI) who ships something meaningful adds one
line to the **Progress log** at the bottom.

---

## 1. What CONVERGE is (one minute)

Citizens report city problems: potholes, water leaks, broken streetlights, garbage, sewage.
Most city systems fail in three ways:
- one ticket per report, even when ten people report the same leak;
- a ticket closes the moment a department says "done", even if the leak is still running;
- deadlines slip quietly.

**CONVERGE is a verified loop:** report → group → assign → replan → deadline → verify → reopen or close.

1. **Groups reports.** A repeat report becomes a *duplicate* of an existing incident. A different but
   connected problem (a leak under a road) becomes *related*.
2. **Assigns work.** The right department and the nearest free crew.
3. **Replans.** If a crew drops out, its jobs are reassigned automatically.
4. **Watches deadlines.** Each category has one (water leak 12 h, pothole 48 h). A missed deadline
   escalates the case.
5. **Verifies the fix.** "Done" means *awaiting proof*. A citizen saying "still leaking" reopens
   the case. It only closes when evidence supports it.
6. **Shows its work.** Every decision lands in an audit trail.
7. **v2 root cause:** several complaints that share one cause get one hypothesis; an operator
   confirms it, and one repair covers them all. Crew visits drop from 3 to 1 in the demo.

Decisions are made by **deterministic rules in code**, never by an AI. An LLM can only rewrite
wording (link explanations) and, when enabled, return a signal about a photo. It cannot change a status.

## 2. How it's used (usability walkthrough)

The start page (`/`) asks *"Who are you?"*.

**Citizen portal** (`/citizen`)
1. Enter a name and email. Only the first name is ever stored with a report; the email never leaves the browser.
2. Describe the problem, pick a category and a nearby place, and submit.
3. Follow the **Track your case** link (`/track/<id>`), which shows:
   status, deadline countdown, assigned crew, and a timeline of what happened.
4. Answer **"Is it fixed?"** with *Yes* or *Still broken*, with an optional note.
5. Rate the experience (1–5 stars, role, comment).

**Operator portal** (`/operator`), after a badge ID and access code (see README)
- **Citizen activity** panel at the top: every citizen complaint and citizen follow-up, newest first,
  marked *New* when it arrives while you watch, with links to each case.
- **Queue and map:** open incidents by department, on a small street map of MG Road, Bengaluru.
- **Incident detail:** linked reports, evidence, audit trail, assigned crew, and actions
  (start, complete, add evidence, crew unavailable/available).
- **Scenario bar:** the two demo scripts (v1 *Verified loop*, 10 steps; v2 *Root cause*, 8 steps),
  Reset, and a simulated clock (+1 h, +12 h, +48 h) to show deadlines.
- **Metrics:** "same reports, naive ticketing vs CONVERGE" table, plus counters.

**Demo driver:** the scenario bar is for demonstrations. Testers should use the citizen and operator
flows as real users would.

## 3. Tools and tech stack

| Layer | What we use | Where |
|---|---|---|
| Backend API | Python, FastAPI, SQLModel (SQLAlchemy), Uvicorn | `backend/app/` |
| Database | SQLite locally; Postgres (Render free) live | `CONVERGE_DB_URL` |
| Rules engine | Plain Python: dedup, assign, SLA, verify, root cause, audit | `backend/app/engine/` |
| Demo scenarios | Scripted steps over the real engine | `backend/app/sim.py` |
| Optional AI wording | Gemini or Anthropic (Claude Haiku), off by default | `backend/app/engine/llm.py` |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, pnpm | `frontend/src/` |
| Maps | Leaflet 1.9 + react-leaflet 5, OpenStreetMap tiles (no key) | `frontend/src/components/StreetMap.tsx` |
| Backend tests | pytest (about 98 tests, incl. invariant fuzzing) | `backend/tests/` |
| Frontend checks | ESLint, `next build` | `frontend/` |
| End-to-end tests | Python Playwright | `scripts/e2e.py`, `scripts/e2e_citizen_flow.py` |
| Smoke test | curl the golden scenario and assert metrics | `scripts/smoke.sh` |
| Hosting | Vercel (frontend), Render (backend Docker image + Postgres) | see Section 4 |
| Collaboration | GitHub (repo, PRs), `CHANNEL.md` for AI and human messages | `srtkio/converge_trojans` |

Environment variables (set locally in `backend/.env`, or in Render's dashboard; never in git):
`CONVERGE_DB_URL`, `CONVERGE_CORS_ORIGINS`, `CONVERGE_CORS_ORIGIN_REGEX`, `CONVERGE_LLM` (`off` to
disable AI wording), `CONVERGE_LLM_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ANTHROPIC_API_KEY`.
Frontend: `NEXT_PUBLIC_API_URL` (baked in at build time).

## 4. Where it runs

| What | Address | Notes |
|---|---|---|
| App (citizen and operator) | https://converge-web-ten.vercel.app | Start page; `/citizen`, `/operator` |
| Backend API | https://converge-backend-hnp0.onrender.com | `/health`, `/feedback/summary` |

Use these aliases only. Per-deploy Vercel URLs change with every deploy.

- **Render free plan sleeps** after about 15 minutes idle. The first request can take about a minute.
  Always open `/health` first and wait for `{"ok":true}`.
- **AI is off on the live site** (`CONVERGE_LLM=off`). The demo runs on rules, which is the intended behaviour.
- **Feedback survives resets.** `/sim/reset` clears demo data but keeps the feedback table.
- Deploys are owned by the lead (Sarthak). Nobody else runs Render or Vercel commands.

## 5. Run it yourself

**Backend** (from `backend/`):
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8001
pytest                      # tests
```

**Frontend** (from `frontend/`):
```bash
pnpm install
NEXT_PUBLIC_API_URL=http://localhost:8001 pnpm dev     # http://localhost:3000
pnpm lint && pnpm build
```

Demo sign-in for the operator portal is in the README ("Portals and demo sign-in"). It's demo-only.

**Checks before a PR:**
```bash
cd backend && pytest
cd frontend && pnpm lint && pnpm build
CONVERGE_URL=http://localhost:8001 scripts/smoke.sh
python3 scripts/e2e.py --base http://localhost:3000             # demo script, both scenarios, track page
python3 scripts/e2e_citizen_flow.py --base http://localhost:3000   # citizen files, operator sees it
```
`e2e.py` assumes the operator dashboard is at `/operator`; use `--dashboard-path /` for older builds.

## 6. Repo map

| Path | What it is |
|---|---|
| `README.md` | Problem statement, how to run, live links, demo sign-in |
| `TEAM_GUIDE.md` | This file |
| `CHANNEL.md` | Message board for people and AIs (append only) |
| `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/PLAN.md` | Product, design, roadmap, plan |
| `docs/CONTRACTS.md` | Data model, rules, API (frozen; changes go through the channel and a PR) |
| `docs/DEMO.md` | Presenter script: v1 (10 steps) and v2 (8 steps) |
| `docs/PITCH.md` | Pitch outline; numbers come from the scenario runs |
| `docs/TESTING.md` | 10-minute user-testing script for six testers and the results table |
| `backend/app/main.py` | All HTTP routes |
| `backend/app/engine/` | Rules: `intake`, `assign`, `sla`, `verify`, `rootcause`, `impact`, `feedback`, `llm`, `audit`, `metrics` |
| `backend/app/sim.py` | Demo scenarios (golden v1, rootcause v2, city data) and the simulated clock |
| `backend/app/seed/` | Crews, city services, operator accounts (hashed codes) |
| `backend/tests/` | pytest suite |
| `frontend/src/app/` | Pages: `/` start, `/citizen`, `/operator`, `/track/[id]` |
| `frontend/src/components/` | Dashboard, citizen inbox, maps, incident panel, scenario bar, metrics, feedback |
| `scripts/` | `e2e.py`, `e2e_citizen_flow.py`, `smoke.sh` |
| `render.yaml` | Render Blueprint (Docker web service + Postgres) |
| `team/<name>/` | Personal folder for shared files (notes, slides, screenshots) |

## 7. Team and roles

| Person | Role |
|---|---|
| Sarthak (`srtkio`) | Lead. Dashboard and map, integration, all deploys (Render and Vercel), pitch deck |
| Prachi (`Prachivats-21`) | Backend engine (rules, v2 root cause, v3 photo signal, SLA risk); citizen-side UX (`feat/citizen-ux`) |
| Antriksh (`Antrikshcodes`) | Presenter: drives the live demo; QA and scenarios |
| Poorvi (`poorvig222`) | Presenter: research, market gap, results, business, future |
| Coordinator Claude | Merge queue prep, reviews, end-to-end checks, docs upkeep, this guide |
| The user | Merges every PR. AIs never merge. |

Presenter scripts: `team/<name>/PRESENTER.md`.

## 8. Working rules

- **Branches and PRs.** One branch per feature (`feat/…`, `fix/…`, `docs/…`). Open a PR into `main`.
- **Merges belong to the user.** Reviewers comment on PRs; nobody merges their own work.
- **Never force-push `main`.** Merge `main` into a branch instead of rebasing a branch that others use.
- **Shared docs and channel** can go straight to `main`. Code goes through a PR.
- **Secrets:** never commit `.env`, API keys, or passwords. Demo credentials are the only exception,
  and they are labelled demo-only.
- **Scope freeze:** after the freeze only bug fixes land. Polish is allowed if it doesn't change behaviour.
- **Before any PR:** run the checks in Section 5, and keep both e2e scripts green.
- **Personal data:** citizens' names are stored as first names only. Emails are never stored with reports or evidence.

## 9. Status (as of 2026-10-28)

**Built and merged on `main`**
- v1 verified loop: dedup, assignment, replan, SLA escalation, evidence-checked closure, audit, metrics.
- v2 root cause: hypotheses, confirm/reject, one repair for several complaints, affected services, crew visits 3 → 1.
- v3 citizen loop: citizen portal and sign-in, track page with timeline and "Is it fixed?", feedback
  widget and `/feedback/summary`, photo signal (AI off on live), SLA at-risk flag.
- Portals: start page, citizen sign-in, operator badge sign-in (dashboard at `/operator`).
- Operator inbox for citizen complaints and evidence (`/citizen/activity`).
- Small-area city dataset for the map (about 10 reports within 1 km of MG Road).
- Demo tooling: v1 and v2 scenarios, both e2e scripts, smoke test, docs and presenter scripts.
- Deployed: frontend on Vercel, backend and Postgres on Render. Both e2e scripts passed on production.

**In progress**
- Citizen-side UX (`feat/citizen-ux`, Prachi). Layout, copy and polish on `/`, `/citizen` and
  `/track/[id]`. No new map features. Must land before the freeze, or be skipped.
- User testing: six real testers, script in `docs/TESTING.md`. Results table fills from
  `/feedback/summary` after the sessions. Feedback starts at 0.

**Known limits (say these in the pitch, don't hide them)**
- Sign-in is demo-grade: sessions last for the tab, the API itself is open, and codes are demo credentials.
- Citizen photos are not stored. Citizens can answer yes or no and add a note.
- AI wording is off on the live site. Rules decide everything either way.
- The map shows the small demo area around MG Road, not the whole city.
- Free Render sleeps when idle.
- An empty Vercel project named `converge-web` exists in the `callisto5` team (created by mistake).
  Don't deploy there. Its deletion is pending the user's decision.

**Next**
1. Review and merge `feat/citizen-ux` if it passes the checks.
2. Run user testing with six people; fill `docs/TESTING.md`.
3. Refresh `docs/PITCH.md` numbers from the live scenario runs before the pitch.
4. Rehearse the demo twice with all four presenters.

## 10. Words you'll hear

| Term | Meaning |
|---|---|
| Incident | One real-world problem, possibly reported by many people |
| Duplicate | Another report of the same incident (within 150 m and 72 h, same category) |
| Related | A different but probably connected problem (leak → pothole, within 400 m) |
| Deadline / SLA | How long a department has to fix it, by category |
| Escalation | Deadline missed: flagged higher up and reassigned |
| Awaiting proof | Department said "done"; waiting for evidence |
| False closure | "Done" was claimed but the evidence says otherwise; the case reopens |
| Replan | A crew drops out; its jobs are reassigned automatically |
| Hypothesis | A proposed shared cause for several incidents (v2); confirmed by an operator |
| Crew visits saved | Visits avoided by fixing the shared cause once |
| Audit trail | Log of every change and the reason for it |
| Golden scenario | The fixed 10-step v1 demo |
| Root-cause scenario | The fixed 8-step v2 demo |
| Baseline | A naive system (one work order per report, accepts every "done") used for comparison |
| Signal only | An AI result stored for humans to see; it never changes a status |

---

## Progress log

- [2026-10-27] Repo set up; problem statement locked; plan, contracts, starters pushed.
- [2026-10-27] Repo renamed to `srtkio/converge_trojans`; team folders and guide added.
- [2026-10-27] Backend (Prachi): all contract endpoints, rule engine, golden scenario. Merged.
- [2026-10-27] Dashboard (Sarthak): click-through demo end to end. Merged.
- [2026-10-27] v1 MVP on main; PRD, architecture, roadmap, presenter files added.
- [2026-10-27] v2 root cause and v3 backend (hypotheses, impact, photo signal, SLA risk, feedback). Merged (#9).
- [2026-10-27] Citizen track page and feedback widget (#6). Presenter docs and pitch outline (#10, #14).
- [2026-10-27] Portals (#16), e2e demo check (#17), steady street map (#18), citizen-to-operator inbox (#20).
- [2026-10-27] Render Blueprint (#12, #22), live URLs in the testing doc (#23), Gemini fixes (#21).
- [2026-10-27] LIVE: frontend on Vercel, backend on Render with Postgres. Both e2e scripts pass on production.
- [2026-10-28] This guide rewritten from scratch: usability walkthrough, tech stack, run steps, repo map, status.
