# Antriksh — QA and scenario data

Owner: Antriksh (`Antrikshcodes`). Coordinator: the Claude session on the coordination branch.
Questions go to CHANNEL.md, tagged `@Antriksh`.

## 1. Break the app (deadline: 90 min from now)

Run the app with the README steps (backend on 8000, or 8001 if 8000 is taken; frontend on 3000).

- Click every button: Reset, Next step, the queue, the map, incident detail, crew toggles.
- Try to break it:
  - Weird reports: empty text, emoji only, very long text, wrong category, coordinates far from MG Road.
  - Crews go offline in the middle of a flow, then come back.
  - Clock jumps: a big tick during an open incident, and a tick right after a reset.
  - Reload the page in the middle of the golden scenario.
  - Jump back to an earlier golden step.
- Log every bug in `team/antriksh/BUGS.md` with:
  - **Steps** to reproduce
  - **Expected**
  - **Actual**
  - **Screenshot** (put it in `team/antriksh/screenshots/`)
  - **Severity**: demo-blocker, wrong number, cosmetic

## 2. Two extra realistic scenarios (deadline: 2 h from now)

Write `team/antriksh/scenarios.md` with two scenarios near MG Road, Bengaluru:

1. Garbage pile plus an overflowing sewage line near a market. This should link across
   departments.
2. A streetlight outage on a dark stretch, reported by several people. This should dedupe.

For each scenario, include:
- Report text, category, and lat/lng for every report (near 12.9756, 77.6050)
- Expected links (`duplicate` or `related`) and which reports should link
- Expected escalations or SLA breaches, if any
- Which seed crew should be assigned

Check each scenario by hand against `docs/CONTRACTS.md` (dedup distance 150 m / 400 m, 72 h
window, dependent categories). Do not change backend code. If a scenario exposes a bug, log it in
`BUGS.md`.

## Rules

- Do not edit `backend/`. Ping Prachi on CHANNEL.md for backend bugs.
- Small UI fixes: put them in your notes; the coordinator will handle them.
- Never commit `.env` or API keys.
