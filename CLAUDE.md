# CONVERGE: notes for Claude sessions

Read `AGENTS.md` (team rules) and the end of `CHANNEL.md` (latest status and assignments) before
doing anything. Product: `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, API: `docs/CONTRACTS.md`.

## Who owns what
- **Sarthak's Claude (lead):** landing page `/`, operator dashboard `/operator`, reviews, merges
  (with Sarthak's approval) and **all deploys** (Vercel + Render).
- **Prachi's Claude:** citizen pages `/citizen`, `/track/[id]` and the backend.
- **Coordinator Claude (`trojans-a0`):** read-only reviews and e2e checks; no deploys.

## Run locally
- Backend: `cd backend && python3 -m uvicorn app.main:app --port 8001` (8000 is another project).
- Frontend: `cd frontend && pnpm dev` with `NEXT_PUBLIC_API_URL=http://localhost:8001` in
  `frontend/.env.local`. Black pages or stale styles: delete `frontend/.next` and restart.
- Tests: `cd backend && python3 -m pytest -q`; `python3 scripts/e2e.py`;
  `python3 scripts/e2e_citizen_flow.py` (both need the app running; `--base` for another URL).

## Live
- App: https://converge-web-ten.vercel.app (Vercel project `converge-web`, team `callisto5`;
  not git-connected: deploy with `cd frontend && vercel deploy --prod --yes --scope callisto5`).
- Backend: https://converge-backend-hnp0.onrender.com (Render, autodeploys `backend/**` on main).
  Free plan sleeps; hit `/health` before demos. Reset with `POST /sim/reset` after e2e runs.

## Rules that bite
- Branch + PR; both e2e scripts must PASS before merge. Never force-push main.
- Next.js 16: read `frontend/node_modules/next/dist/docs/` before using unfamiliar APIs.
- Citizens: first name only, never store or show email. AI is optional and off in the demo
  (no live-AI claims). Never commit `.env`.
- Numbers shown to judges come from the backend (`/metrics`, `/feedback/summary`), never invented.
