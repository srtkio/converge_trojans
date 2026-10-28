# CONVERGE: notes for Claude sessions

Read `AGENTS.md` (rules, owners, current status) and the end of `CHANNEL.md` before doing anything.
Product: `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`. API and frozen rules: `docs/CONTRACTS.md`.

## Run locally
- Backend: `cd backend && python3 -m uvicorn app.main:app --port 8001`.
- Frontend: `cd frontend && pnpm dev` with `NEXT_PUBLIC_API_URL=http://localhost:8001` in
  `frontend/.env.local`. Black pages or stale styles: delete `frontend/.next` and restart.
- Tests: `cd backend && python3 -m pytest -q`; `python3 scripts/e2e.py`;
  `python3 scripts/e2e_citizen_flow.py`.

## Live
- App: https://converge-web-ten.vercel.app (only the lead deploys; see `AGENTS.md`).
- Backend: https://converge-backend-hnp0.onrender.com. Free plan sleeps; hit `/health` first.
  Reset with `POST /sim/reset` after e2e runs against it.

## Rules that bite
- Branch + PR. Both e2e scripts must pass before a PR. Never force-push or merge `main`; AIs don't merge.
- Citizens: first name only, never an email. AI is optional and off in the demo; no live-AI claims.
- Never commit `.env`.
