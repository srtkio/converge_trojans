# TROJANS — CONVERGE

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

Set `ANTHROPIC_API_KEY` in `backend/.env` for LLM link explanations. Without it the system falls
back to deterministic rules.
