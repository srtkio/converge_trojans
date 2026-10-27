# Architecture (explain-it-to-a-judge version)

```
 Citizen phone / Operator dashboard        (Frontend: Next.js 16 + React 19 + Tailwind)
              │  HTTP JSON
              ▼
 FastAPI app  ── routes in backend/app/main.py
              │
              ├─ engine/intake.py     new report → dedup/related decision
              ├─ engine/dedup.py      distance + time + category rules (150 m, 72 h, 400 m)
              ├─ engine/assign.py     nearest available crew; replan when a crew drops out
              ├─ engine/sla.py        deadline per category; escalate on breach
              ├─ engine/verify.py     complete ≠ resolved; evidence closes or reopens
              ├─ engine/audit.py      every change recorded with actor + reason + evidence
              ├─ engine/metrics.py    CONVERGE vs naive baseline
              ├─ engine/llm.py        optional Claude/Gemini wording (never decides; off in the demo)
              └─ sim.py               simulated clock + replayable golden scenario
              │
              ▼
 SQLite (SQLModel)   reports · incidents · links · resources · evidence · audit_events
```

## Frontend — what it does
The operator dashboard (`frontend/src/components/`): incident queue sorted by urgency, city map
(drawn to scale, works offline), incident detail with *why it was linked*, evidence buttons, crew
on/off toggles, live activity feed, a naive-vs-CONVERGE metrics table, and a demo stepper.
v3 adds a mobile citizen page.

## Backend — what it does
A rules engine behind a REST API. Every decision is plain, testable Python (35 tests). The API is
listed in `docs/CONTRACTS.md`.

## Database — what it stores
SQLite: one file, no setup, resets in milliseconds for demos. Lists (report IDs, related IDs)
are JSON columns. Swap for Postgres in production without code changes (SQLModel).

## Integrations
- **Optional LLM (Claude Haiku 5.5 or Gemini)**: rewrites link reasons into plain English, nudges
  confidence by at most ±0.15, and gives a photo hint (signal only). With no key, or `CONVERGE_LLM=off`,
  it falls back silently to the rule text. The live demo runs with it off: Gemini's free tier isn't
  enabled on the team's Google project.
- **Simulated clock**: makes 48-hour deadlines demoable in seconds.
- Production path: complaint portals (CPGRAMS, city apps), GIS, IoT sensors, WhatsApp intake.

## Why this design
- Deterministic rules = explainable and auditable; judges and city officials can trust them.
- AI only where language is fuzzy, with a hard cap on what it can change.
- Replayable scenario = a demo that can't randomly fail.
