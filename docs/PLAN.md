# TROJANS — Smart Cities: Citizen Reports → Verified Resolution (9h plan)

## Context
Problem statement: build a platform that processes citizen complaints, finds duplicate/related
incidents, assigns work across departments, tracks SLA deadlines, and reopens/escalates when a
department misses a deadline or evidence contradicts a closure.

ChatGPT's blueprint (`~/Downloads/CONVERGE_Hackathon_Blueprint.pdf`, "CONVERGE") is solid on the
core idea: the differentiator is a **verified loop** (link → assign → replan → verify closure →
reopen/escalate, all audited), not a chatbot or map. But it's sized for 5 owners and includes V2
(water, food, healthcare), OR-Tools, EPANET, and PostGIS. With 9 hours, two Claude sessions, and
a fresh repo, we build **V1 only** and treat V2 as one pitch slide.

## Analysis of the blueprint
Keep:
- Golden scenario (Appendix A): 3 reports → 2 duplicates + 1 related → crew assigned → crew
  unavailable → replan → "completed" but a follow-up report contradicts it → reopen → valid
  evidence → verified close. This is the demo.
- Invariant: "work order complete" ≠ "incident resolved."
- LLM only for fuzzy work (is this report a duplicate? explain the link); deterministic code for
  state transitions, SLA rules, assignment, verification.
- Seeded data + reset/replay + baseline comparison as proof.

Cut:
- V2 domains, cross-domain coordination, counterfactual simulation → 1 slide "future work".
- OR-Tools, EPANET, PostGIS, NetworkX → plain Python rules + haversine distance.
- Separate research packets A–E → the PS is fixed; skip.
- Plan versioning beyond "stale → new plan" field.

## Model recommendation
- **Coding sessions (Claude Code): Opus 5.5** for the backend core (state machine, SLA engine,
  verification logic — correctness matters, few re-dos). Prachi's Claude is already on Opus 5.5.
  This session: switch to **Opus 5.5** for contracts + integration; use **Sonnet 5.5** if you
  hit usage limits — it's fast and strong for frontend/UI work. Use Haiku only for git/chores.
- **LLM inside the app: `claude-haiku-5-5`** for duplicate/related classification and short
  explanations (cheap, fast, demo-safe), with a deterministic fallback (distance + time window +
  category match) so the demo works offline or if the API fails.
- Gemini / Antigravity / DeepSeek: optional. Good uses: pitch deck, seed data writing, README.
  Don't give them core code — two Claudes on separate areas is enough.

## Stack (from blueprint, trimmed)
- Backend: FastAPI + Pydantic + SQLite (SQLModel). Python already installed (`fastapi`, `uvicorn`, `pytest`, `ruff`, `uv`).
- Frontend: Next.js + Tailwind (+ shadcn). Node 26 + pnpm installed.
- LLM: Anthropic SDK, `claude-haiku-5-5`; key in `.env` (never committed).
- Deploy (optional, last hour): Vercel for frontend; backend local or Render/Railway.

## Repo layout
```
backend/   app/main.py, models.py, engine/{dedup,assign,sla,verify}.py, seed/, tests/
frontend/  Next.js app: incident queue, incident detail (links, timeline, audit), scenario controls
docs/      PROBLEM.md, CONTRACTS.md (schemas + API), DEMO.md
```

## API contract (freeze first, both sides code against it)
- `POST /reports` — citizen report → returns incident it was linked to (or new) + link reason
- `GET /incidents`, `GET /incidents/{id}` (incl. linked reports, assignment, deadline, evidence, audit)
- `POST /incidents/{id}/complete` — department marks work done (status `pending_verification`)
- `POST /incidents/{id}/evidence` — photo/sensor/follow-up; verifies or contradicts → close or reopen
- `POST /resources/{id}/unavailable` — triggers replan
- `POST /sim/tick?minutes=N` — advance clock; SLA engine escalates overdue
- `POST /sim/reset`, `POST /sim/scenario/golden` — replay demo
- `GET /metrics` — duplicates avoided, false closures caught, SLA breaches, vs baseline

Incident states: `open → assigned → in_progress → pending_verification → verified_closed`,
with `reopened` and `escalated` transitions; every transition writes an AuditEvent.

## Work split (2 Claude sessions + humans)
| Owner | Area | Branch |
|---|---|---|
| This session (Sarthak) | Contracts, scaffolding, frontend, golden scenario, integration, demo | `feat/frontend`, `main` |
| Prachi's Claude | Backend engine: models, dedup, assignment, SLA, verify/reopen, metrics, tests | `feat/backend` |
| Humans / Gemini | Seed data realism, pitch deck, demo script, README | `docs/*` |

## Timeline (9h)
- **0:00–0:45** Push PS + plan + contracts + scaffolds to `main`; post assignments in CHANNEL.md.
- **0:45–4:00** Parallel build. Backend: state machine + dedup + assignment + SLA + verify, pytest per rule. Frontend: queue + detail + controls on mock data from contracts.
- **4:00–5:30** Integrate; run golden scenario end-to-end via UI.
- **5:30–6:30** LLM link explanations + baseline vs our system metrics.
- **6:30 — SCOPE FREEZE.** Only fixes after this.
- **6:30–7:30** Polish UI, reset/replay reliability, fallback screen recording.
- **7:30–9:00** Pitch deck, rehearse demo twice from a clean reset.

## What I'll push to GitHub first (once plan approved)
1. `README.md` — PS verbatim, one-line pitch, how to run.
2. `docs/PLAN.md` — this plan (scope, cuts, timeline, ownership).
3. `docs/CONTRACTS.md` — schemas, states, API above.
4. `docs/CONVERGE_Hackathon_Blueprint.pdf` — reference copy.
5. `backend/` and `frontend/` minimal scaffolds that run.
6. `CHANNEL.md` entry — assignments + branch names + "tests must pass: `pytest` / `pnpm build`".
Commit straight to `main` (setup only); feature work goes through branches + PRs after that.

## Verification
- `cd backend && pytest` — unit tests for each rule: duplicate link, related link, replan on unavailable crew, SLA escalation, contradicted closure reopens, valid evidence closes.
- `POST /sim/reset` then `POST /sim/scenario/golden` → final incident `verified_closed` with full audit trail; `/metrics` shows non-zero duplicates avoided + 1 false closure caught.
- Frontend: `pnpm build` passes; golden scenario clickable end-to-end from the UI.
- Fresh clone on a teammate machine runs with README steps.
