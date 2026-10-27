# TROJANS - CONVERGE

**From citizen reports to verified resolution.**

## Problem statement

> Smart Cities — From Citizen Reports to Verified Resolution
>
> Create a platform that processes citizen complaints, identifies duplicate and related incidents,
> assigns work across departments, and tracks service-level deadlines. When a department misses a
> deadline or evidence contradicts a closure report, the system must reopen or escalate the case
> and coordinate the next steps.

## Pitch

Most civic systems stop at "ticket closed". CONVERGE treats *work order complete* and *issue
resolved* as different things. It links duplicate and related reports, assigns the right
department and crew, replans when a crew drops out, escalates on missed SLAs, and only closes an
incident when evidence backs it. Every step is audited.

## Live demo

- **App:** https://converge-web-ten.vercel.app (start page → citizen or operator portal)
- **Operator dashboard:** https://converge-web-ten.vercel.app/operator (demo badges in "Portals and demo sign-in" below)
- **Citizen tracking (phones):** https://converge-web-ten.vercel.app/track/inc_001 after running a scenario
- **Backend API:** https://converge-backend-hnp0.onrender.com (`/health`)

The backend is on Render's free plan and sleeps after ~15 minutes idle; the first request then takes
about a minute. Open `/health` a few minutes before judging or testing. Check the whole flow with
`python3 scripts/e2e.py --base https://converge-web-ten.vercel.app`.

## Docs

- [docs/PLAN.md](docs/PLAN.md) — scope, timeline, who owns what
- [docs/CONTRACTS.md](docs/CONTRACTS.md) — data model, states, API (code against this)
- [docs/CONVERGE_Hackathon_Blueprint.pdf](docs/CONVERGE_Hackathon_Blueprint.pdf) — original research blueprint
- [CHANNEL.md](CHANNEL.md) — team + AI message board
- [TEAM_GUIDE.md](TEAM_GUIDE.md) — plain-language guide, roles, how to share files

## Run

Backend (FastAPI, port 8000):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# tests
pytest
```

Frontend (Next.js, port 3000):

```bash
cd frontend
pnpm install
pnpm dev
```

If port 8000 is taken, run the backend with `--port 8001` and put
`NEXT_PUBLIC_API_URL=http://localhost:8001` in `frontend/.env.local`.

Demo: open http://localhost:3000/operator, sign in with a demo operator account (see "Portals and
demo sign-in" below), press **Reset**, then **Next step →** through the 10-step golden scenario.
`/operator?incident=inc_001` opens an incident directly. Before presenting, run `python3 scripts/e2e.py`.

Set `ANTHROPIC_API_KEY` in `backend/.env` for LLM link explanations. Without it the system falls
back to deterministic rules. See `backend/.env.example` for all backend settings, including
`CONVERGE_CORS_ORIGINS` (comma-separated frontend URLs, needed when the frontend is deployed).

LLM provider: set `ANTHROPIC_API_KEY` (claude-haiku-5-5) or `GEMINI_API_KEY` (Gemini Flash, free
tier). The LLM only writes explanation text and an advisory photo check; decisions stay rule-based.

Deploy backend to Render: Dashboard → New → Blueprint → this repo (`render.yaml` creates the
Docker web service plus a free Postgres so feedback survives restarts). Set `GEMINI_API_KEY` /
`ANTHROPIC_API_KEY` in the dashboard, add the Vercel URL to `CONVERGE_CORS_ORIGINS`, then set the
frontend's `NEXT_PUBLIC_API_URL` to the Render URL.

Backend via Docker (e.g. Render/Railway; honours `$PORT`):

```bash
cd backend
docker build -t converge-backend .
docker run -p 8000:8000 -e CONVERGE_CORS_ORIGINS=http://localhost:3000 converge-backend
```

## Portals and demo sign-in

The start page asks who you are.

- **Citizen:** enter a name and email at `/citizen`, then report a problem and track it.
- **Operator:** `/operator` checks your badge ID and access code against the backend. Demo accounts
  (demo only, not real credentials):
  - `OPS-WTR-01` / `water-demo-2026`: water department officer
  - `OPS-RDS-01` / `roads-demo-2026`: roads department officer
  - `HEAD-WTR-01` / `water-head-2026`: water department head (can reject water complaints as invalid)
  - `HEAD-RDS-01` / `roads-head-2026`: roads department head (can reject roads complaints)
  - `CMD-01` / `command-demo-2026`: city command centre (all departments; best for the demo)

  Hierarchy: officer → department head → city command centre. A missed deadline notifies the next level up.

Sign-in is demo-grade: sessions are kept in the browser tab, and operator codes are stored as
SHA-256 hashes in `backend/app/seed/operators.json`. The sign-in gates the dashboard screen only;
the API itself is not locked down. Production auth is planned for v2.

## End-to-end demo check

`scripts/e2e.py` drives the running app through the browser (Python Playwright) and checks the
demo before the pitch:

1. Signs in to the operator dashboard with the demo badge, if the sign-in form appears.
2. v1 "Verified loop": Reset, then Next step to step 10. Checks the naive-vs-CONVERGE table
   (work orders 3 vs 2, false closures accepted 1 vs 0).
3. v2 "Root cause": Reset, then Next step to step 8. Checks crew visits 3 vs 1.
4. `/track/inc_001` at iPhone 13 size: no horizontal overflow, no console errors.

It exits 0 when everything passes and 1 on the first failure.

```bash
pip install playwright && playwright install chromium
# with the backend on :8001 and the frontend on :3000
python3 scripts/e2e.py
python3 scripts/e2e.py --base http://localhost:3002 --headed   # other port, watch it run
```

The script expects the dashboard at `/operator` (the default). For an older build without the
portals, pass `--dashboard-path /`.
