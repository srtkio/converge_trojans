# CONVERGE Team Guide

Plain-language guide to what we're building, who's doing what, and how to share work.
Maintained by Sarthak's Claude. Every AI that does meaningful work adds a line under
"Progress log" at the bottom.

---

## 1. What we're building (in one minute)

Citizens report city problems (potholes, water leaks, broken streetlights, garbage).
Today, most city systems:
- open a separate ticket for every report, even if 10 people report the same leak,
- close a ticket the moment a department says "done", even if the problem is still there,
- let deadlines slip quietly.

**CONVERGE fixes that.** It:
1. **Groups reports.** Same problem reported twice → one incident. A nearby connected problem
   (a leak causing a pothole) → linked as "related".
2. **Assigns work.** Picks the right department and the nearest available crew.
3. **Replans.** If that crew becomes unavailable, it reassigns automatically.
4. **Watches deadlines.** Each problem type has a deadline (e.g. water leak = 12 hours). Missed →
   escalated.
5. **Checks the fix is real.** "Done" only means *waiting for proof*. If a citizen says "still
   leaking", the case reopens. It closes only when evidence (photo, inspector) confirms the fix.
6. **Records everything.** Every step is written to an audit trail anyone can review.

We prove it works by running the same demo against a "naive" system and showing the numbers:
fewer duplicate work orders, false closures caught, deadlines enforced.

## 2. Who does what

**Builders:** Sarthak and Prachi, each with Claude, plus a coordinator Claude session (`trojans-a0`).
**Presenters:** all four. Each person's script and Q&A prep is in `team/<name>/PRESENTER.md`.

| Person | Builds | Presents |
|---|---|---|
| Sarthak (`srtkio`) | Lead, dashboard (v2 UI), integration, pitch deck | Hook, demo narration, close |
| Prachi (`Prachivats-21`) | Backend engine, v2 root cause, v3 photo check + SLA risk | How it works + architecture |
| Antriksh (`Antrikshcodes`) | Pitch Deck, Frontend | Drives the live demo |
| Poorvi (`poorvig222`) | Research and Development | Market gap, results, business, future |
| Coordinator Claude | v3 citizen page + feedback widget, PR prep, keeps docs current | — |

Plan for the remaining hours: [docs/ROADMAP.md](docs/ROADMAP.md). Product spec: [docs/PRD.md](docs/PRD.md).
Architecture explained: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 3. Timeline (about 9 hours)

| When | What |
|---|---|
| 0:00 – 0:45 | Plan, rules, and starter code pushed ✅ |
| 0:45 – 4:00 | Backend and frontend built in parallel |
| 4:00 – 5:30 | Connect them; run the full demo |
| 5:30 – 6:30 | AI-written link explanations; before/after numbers |
| **6:30** | **Scope freeze: bug fixes only after this** |
| 6:30 – 7:30 | Polish, backup screen recording |
| 7:30 – 9:00 | Pitch deck, rehearse twice |

## 4. Where things are

| Path | What it is |
|---|---|
| `README.md` | Problem statement, how to run |
| `TEAM_GUIDE.md` | This file |
| `CHANNEL.md` | Message board for people and AIs |
| `docs/PLAN.md` | Detailed plan |
| `docs/CONTRACTS.md` | The exact rules and API both sides code against (developers) |
| `docs/PRESENTATION_SCRIPT.md` | The single on-stage script: speakers, timing, demo cues, Q&A |
| `docs/CONVERGE_Hackathon_Blueprint.pdf` | Original research blueprint |
| `backend/` | Python API (FastAPI) |
| `frontend/` | Web dashboard (Next.js) |
| `team/<name>/` | Your personal folder for sharing files |

## 5. Sharing files (your team folder)

Everyone has a folder: `team/sarthak`, `team/prachi`, `team/antriksh`, `team/poorvi`.
Put anything you want others (or the AIs) to see there: notes, research, screenshots, slides,
PDFs, data.

**First time only (get the repo on your computer):**
```bash
cd ~/Desktop
git clone https://github.com/srtkio/converge_trojans.git converge
```

**Every time you share something:**
```bash
cd ~/Desktop/converge
git pull                                   # get everyone's latest
# copy your file into team/<your-name>/
git add team/<your-name>
git commit -m "Add <what it is>"
git push
```
Others get it with `git pull`. Or just ask your AI: *"put this file in my team folder and
push it."*

Rules:
- Only edit your own folder. Read anyone's.
- No passwords, API keys, or `.env` files, ever.
- Keep files under ~50 MB (GitHub limit is 100 MB).

## 6. Talking to each other's AIs

AIs don't talk directly across laptops. They use **`CHANNEL.md`**:
- Before starting: pull and read it.
- After a step: add one line, e.g.
  `- [2026-10-27] Prachi (Claude): dedup rule done, 6 tests passing. Next: SLA engine.`
- Push right away.

To hand an AI a task, write it in the channel with: what to build, which branch, and what must
pass.

## 7. How code gets in

- Shared docs and team folders → straight to `main`.
- Code → your feature branch → Pull Request into `main` → Sarthak merges after it runs.
- Never force-push `main`.

## 8. Words you'll hear

| Term | Meaning |
|---|---|
| Incident | One real-world problem, possibly reported by many people |
| Duplicate | Another report of the same incident |
| Related | A different problem that's probably connected (leak → pothole) |
| SLA / deadline | How long a department has to fix it |
| Escalation | Deadline missed → flagged higher up and reassigned |
| Pending verification | Department said "done"; waiting for proof |
| False closure | "Done" was claimed but evidence says it isn't |
| Replan | Crew unavailable → automatically reassigned |
| Audit trail | Log of every change and why |
| Golden scenario | The fixed 10-step demo we replay for judges |
| Baseline | A naive system we compare against to show improvement |

---

## Progress log

- [2026-10-27] Repo set up; problem statement locked; plan, contracts, backend + frontend starters pushed.
- [2026-10-27] Repo renamed to `srtkio/converge_trojans`; team folders and this guide added.
- [2026-10-27] Backend done (Prachi, Claude): all CONTRACTS.md endpoints, rule engine, golden scenario end-to-end; `cd backend && pytest` = 26 passed. Merged into main.
- [2026-10-27] Backend merged (Prachi's Claude): all rules work, 26 tests pass.
- [2026-10-27] Dashboard merged (Sarthak's Claude): click-through demo works end to end — open http://localhost:3000, press Reset, then Next step. Screenshots in docs/screenshots/.
- [2026-10-27] v1 MVP complete on main (35 tests, smoke PASS). Antriksh and Poorvi move to presenting. Added PRD, ARCHITECTURE, ROADMAP (v2 root cause, v3 citizen loop) and PRESENTER.md per person.
- [2026-10-27] Claude (coordinator): v3 citizen page + feedback widget on PR #6 (lint and build pass; not yet tested in a browser). Poorvi's research.md drafted on PR #7 with one correction for her market-gap line (SeeClickFix claims duplicate merging).
- [2026-10-27] Claude (coordinator): Docs updated for v2 root-cause scenario: DEMO.md (8-step v2 walkthrough), all PRESENTER.md demo rows, new docs/PITCH.md (9 slides, numbers from both scenario runs; user-testing slide left TBD).
- [2026-10-27] Progress: PRs #1–#12 are all merged on main. #13 (this log sync) is the only open PR; the merge is awaiting the user's approval. Next: re-run both scenarios on main and refresh docs/PITCH.md numbers; fill docs/TESTING.md from /feedback/summary after the six tests.
- [2026-10-27] ALL MERGED to main (#4–#13): v1 loop, v2 root cause + coordinated repair, v3 citizen page, feedback, photo signal, SLA risk, Render deploy config, Gemini/Claude switch. 85 tests + smoke PASS on main; v2 scenario: 3 crew visits → 1.
- [2026-10-27] Merged #16 portals (start page, citizen sign-in, operator badge sign-in; dashboard now at /operator), #17 e2e demo check (`python3 scripts/e2e.py`), #18 steady street map. e2e PASS on main. Next: Render + Vercel deploy, user testing.
- [2026-10-27] LIVE: app https://converge-web-ten.vercel.app (Vercel), backend https://converge-backend-hnp0.onrender.com (Render + Postgres). e2e and citizen-flow tests PASS on production. Merged #19 city data, #20 citizen→operator inbox, #21 Gemini fixes. AI stays off (Gemini free tier not available on the team's Google project).
- [2026-10-28] Citizen side redesigned (Prachi, Claude): PR #25 makes /, /citizen and /track friendlier and premium. Readable on dark-mode phones, plain-language status and timeline, progress bar, "Your reports", case lookup, subtle motion. e2e + citizen-flow PASS; before/after screenshots in docs/screenshots/citizen-ux/. Open; waiting for review and merge.
- [2026-10-28] Presentation script added (`docs/PRESENTATION_SCRIPT.md`): speakers, timing, demo cues, Q&A, limits. Open decision: the demo slot is 2 minutes but the v1 walkthrough takes about 3.
- [2026-10-28] LIVE: judge-feedback build. Operator console redesign (sidebar, live SLA timers, alert toasts, escalation ladder), fake-complaint countermeasures (trust badge, reject as invalid, rate limit), operator hierarchy (officer → head → command), citizen photos + GPS shown to operators. Both e2e PASS on production.
