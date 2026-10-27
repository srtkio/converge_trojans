# Poorvi — pitch and research

Owner: Poorvi (`poorvig222`). Coordinator: the Claude session on the coordination branch.
Questions go to CHANNEL.md, tagged `@Poorvi`.

## 1. Research four existing systems (deadline: 90 min from now)

Write `team/poorvi/research.md` with one table. Pick four systems, for example:
CPGRAMS, Swachhata app, FixMyStreet, SeeClickFix.

Columns:

| System | Country / scope | What it does for citizens | What it does for departments | Duplicate merging? | Evidence-checked closure? | SLA escalation? | Source link |
|---|---|---|---|---|---|---|---|

Use only facts you can link to. If you cannot verify a cell, write "unclear" and say why. The
gap we are pitching is: no duplicate merging, no evidence-checked closure, no SLA escalation.
Mark each cell that shows the gap.

## 2. Pitch deck outline (deadline: 2.5 h from now; final slides by hour 7.5)

Write `team/poorvi/pitch_outline.md`, 8 to 10 slides. For each slide, give the title, the one
message, and the speaker notes in 2 to 3 lines.

Required slides, in order:

1. Problem: citizens report the same pothole ten times, and nobody sees the pattern.
2. Why "closed" is not "resolved": a work order marked complete is not a fixed road.
3. Solution loop: report → dedupe/link → assign → replan → SLA → verify → reopen or close.
4. Live demo: the golden scenario, which runs in about 3 minutes (see `docs/DEMO.md`).
5. Numbers: naive system vs CONVERGE, taken from `/metrics` (duplicates avoided, false closures
   caught, SLA breaches escalated).
6. Architecture: frontend, FastAPI backend, rules engine, LLM only for wording.
7. Future: the same engine for water, food, and health complaints.
8. Business model: who pays (city departments, state platforms) and why.
9. Team.

Put the final slides, in whatever tool you use, in `team/poorvi/` and link them from the outline.

## Rules

- Do not change the product claims in `docs/PLAN.md` without asking on CHANNEL.md.
- Use the numbers from the real `/metrics` output, not invented ones.
- Never commit `.env` or API keys.
