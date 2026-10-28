# Instructions for every AI assistant on CONVERGE

Read this file first. Then read the end of `CHANNEL.md` (latest status and assignments) and
`TEAM_GUIDE.md` section 9 (current status). `CLAUDE.md` and `GEMINI.md` point here.

## What the project is

CONVERGE is a civic complaint platform. Citizens report problems; CONVERGE groups duplicates,
links related causes, assigns crews, enforces deadlines, and closes a case only when evidence
supports the fix. Decisions come from rules in code. AI only writes wording, and it is off in the
live demo.

## Where things are now (2026-10-28)

- **Demo location:** Murthal–Sonipat, Haryana (moved from Bengaluru). The data is in
  `docs/CONTRACTS.md` ("Demo location") and `backend/app/seed/`.
- **Live app:** https://converge-web-ten.vercel.app (`/` start, `/citizen`, `/operator`)
- **Live backend:** https://converge-backend-hnp0.onrender.com (`/health`, `/feedback/summary`)
- **Free Render sleeps.** Open `/health` and wait for `{"ok":true}` before any demo or test.
- **Scope freeze:** near. Only bug fixes, polish and docs land now. No new features.
- **Hackathon ends at 6pm.** Keep changes small and merged.

## Who owns what

- **Sarthak (lead):** landing page, operator dashboard (`frontend/src/components/Dashboard.tsx`,
  `IncidentDetailPanel.tsx`), all deploys (Vercel and Render), merges with the user's approval.
- **Prachi:** the citizen app (`/citizen`, `/track/[id]`) and the backend engine
  (`backend/app/engine/`). Her branch `wip/prachi-sheet` is unfinished; an Antigravity session may
  be taking it over.
- **Coordinator (Claude):** docs upkeep, reviews, end-to-end checks. No deploys.
- **Antriksh and Poorvi:** presenting. Their notes are in `team/<name>/PRESENTER.md`.

## Rules

- **One branch per feature.** Open a PR into `main`. Never push code straight to `main`.
- **AIs never merge.** The user merges PRs. Reviews go in PR comments.
- **Never force-push** `main` or any shared branch. To catch up a branch, merge `main` into it.
- **Never commit secrets:** `.env`, API keys, passwords, tokens. Demo sign-in codes are in the
  README and are demo-only.
- **Citizens:** store and show the first name only. Never store or show an email.
- **Numbers shown to judges** come from the backend (`/metrics`, `/feedback/summary`), never invented.
- **No deploy commands** unless you are the lead's session.
- **Backend engine** logic belongs to Prachi. Do not change rule behaviour without a channel post.
- **Before a PR:** both e2e scripts must pass (see below), plus `pnpm lint` and `pnpm build`.
- **Next.js 16:** read `frontend/node_modules/next/dist/docs/` before using an unfamiliar API.

## Shared channel and team folders

- `CHANNEL.md` is append-only. Add one short line after each meaningful step, in the format
  `- [YYYY-MM-DD] <who> (<AI>): <what changed / what's next / blockers>`. Pull before you write.
- `TEAM_GUIDE.md` is the plain-language guide for humans. Add one line to its progress log after
  each meaningful step.
- `team/<name>/` is for each person's shared files. Only write to your own person's folder.

## How to run and check

```bash
cd backend && python3 -m uvicorn app.main:app --port 8001     # 8000 is another project on some machines
cd backend && python3 -m pytest -q
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8001 pnpm dev   # http://localhost:3000
cd frontend && pnpm lint && pnpm build
python3 scripts/e2e.py --base http://localhost:3000
python3 scripts/e2e_citizen_flow.py --base http://localhost:3000
```

Against the live site, the same scripts take `--base https://converge-web-ten.vercel.app`. Do not run
them against production if they leave data you cannot reset; ask first.

## Document map

| File | What it is |
|---|---|
| `README.md` | Problem, how to run, live links, demo sign-in (demo-only) |
| `TEAM_GUIDE.md` | Plain-language guide: usability, tech stack, status, glossary, progress log |
| `CHANNEL.md` | Live message board for people and AIs |
| `docs/CONTRACTS.md` | Frozen data model, rules, API, demo location |
| `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/ROADMAP.md`, `docs/PLAN.md` | Design, product, plan |
| `docs/DEMO.md`, `docs/PRESENTATION_SCRIPT.md`, `docs/PITCH.md` | Demo clicks, on-stage script, pitch slides |
| `docs/TESTING.md` | User-testing script for six testers and the results table |
| `team/<name>/PRESENTER.md` | Each presenter's lines and judge answers |
