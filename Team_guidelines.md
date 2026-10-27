CONVERGE — Team Guidelines

Team: TROJANS
Project: CONVERGE — Smart Cities: Citizen Reports → Verified Resolution
Event: HackO’Ween 2026 | ALTA School of Technology
College: Rishihood University

⸻

1. Project Mission

CONVERGE is a civic operations platform that connects citizen complaints, incidents, departments, crews, deadlines, and evidence.

Our core principle:

Work completed is not the same as problem resolved.

The system must identify duplicate complaints, connect related incidents, assign available crews, track service-level agreements (SLAs), and require evidence before closing an incident.

Every important decision must be explainable and auditable.

2. Team Rules

1. Communicate before making changes that affect another person’s work.
2. Assign a clear owner to every task.
3. Check the GitHub Issues and project board before starting new work.
4. Avoid duplicating work already assigned to another teammate.
5. Share progress, blockers, and completed work in the team communication channel.
6. Keep pull requests focused on one feature or fix.
7. Never merge code that breaks existing functionality without explicit team approval.
8. Document important decisions so every teammate can understand the current implementation.
9. Prioritize a working, tested product over unnecessary features.
10. During the final hours, prioritize stability, bug fixes, and presentation readiness.

3. GitHub Workflow

Branching

Use descriptive branch names:

* main — stable, integrated code.
* feat/<feature-name> — new features.
* fix/<issue-name> — bug fixes.
* docs/<document-name> — documentation changes.
* test/<test-name> — testing improvements.

Examples:

* feat/root-cause-detection
* feat/citizen-tracking
* fix/incident-verification
* docs/api-contracts

Before Starting Work

1. Pull the latest changes from main.
2. Read the relevant documentation and existing code.
3. Check for related open issues or pull requests.
4. Confirm the expected behavior and API contract.
5. Create a dedicated branch.

Before Opening a Pull Request

* Ensure the code follows the existing architecture.
* Run the relevant automated tests.
* Check for accidental changes to unrelated files.
* Remove debugging statements and unused code.
* Never include API keys, passwords, tokens, or .env files.
* Explain what changed and how it was tested.

Pull Request Format

Every pull request should include:

Summary: What changed?

Reason: Why was the change needed?

Implementation: How was it implemented?

Testing: Which commands or scenarios were executed?

Screenshots: Include screenshots for UI changes.

Risks: Mention any known limitations or breaking changes.

4. Frozen API Contracts

The API contract is the shared agreement between the frontend and backend.

Do not change API schemas, field names, endpoint behavior, incident states, or response formats without coordination.

Before changing a contract:

1. Explain the required change to the team.
2. Update the relevant contract documentation.
3. Agree on the change with the affected contributors.
4. Update the backend and frontend consistently.
5. Add or update automated tests.
6. Submit the changes through a pull request.

All timestamps must follow the existing ISO-8601 UTC contract.

Use the simulated clock for SLA calculations and scenario execution. Do not introduce wall-clock dependencies into incident-engine logic.

5. Core Engineering Principles

A. Deterministic Decisions

Operational decisions must be made by explicit, testable rules.

This includes:

* Duplicate detection.
* Related-incident detection.
* Crew assignment.
* Re-planning when a crew becomes unavailable.
* SLA tracking and escalation.
* Incident verification and reopening.
* Root-cause scoring.

B. AI Is Advisory

AI may assist with explanations and photo-based signals.

It must not independently decide incident status, confirm root causes, or bypass verification rules.

If AI is unavailable, the system must fall back gracefully to deterministic behavior wherever the existing implementation supports it.

C. Verification Before Closure

The incident lifecycle must preserve the distinction between completion and resolution.

A repair marked complete moves to pending_verification.

Supporting evidence may permit closure. Contradictory evidence must be able to reopen the incident.

Related incidents must not be automatically closed merely because a parent incident is resolved.

D. Auditability

Every important state change must generate the appropriate audit event.

Record the actor, event type, relevant status transition, reason, evidence references, and timestamp according to the existing data model.

E. Preserve Existing Behavior

New features must not silently break existing scenarios, API responses, or metrics.

Prefer additive changes unless a breaking change has been explicitly approved.

6. Testing Requirements

Before merging changes, run the relevant tests.

Backend

cd backend
pytest

Frontend

cd frontend
pnpm build

Integration

Where applicable, verify that:

* A duplicate report links to the correct incident.
* A related report creates the appropriate relationship.
* The nearest available crew is assigned.
* Crew unavailability triggers re-planning.
* Missed deadlines trigger escalation.
* Completion does not immediately close an incident.
* Contradictory evidence reopens an incident.
* Supporting evidence permits verified closure.
* Audit events are created for state changes.
* Existing golden and root-cause scenarios still work.
* Metrics remain consistent with the documented baseline.

Run the smoke test where available:

./scripts/smoke.sh

Never claim a test passed unless it was actually executed successfully.

7. Frontend Guidelines

The frontend should prioritize clarity, usability, and operational visibility.

Key interface elements include:

* Incident queue sorted by urgency.
* City map and incident locations.
* Incident detail panels.
* Duplicate and related-incident explanations.
* Crew assignment and availability controls.
* SLA deadlines and escalation indicators.
* Evidence submission and verification status.
* Audit history and activity feed.
* Baseline comparison metrics.
* Citizen complaint tracking.

For UI changes:

* Keep labels clear and consistent with backend states.
* Make critical information easy to identify.
* Handle loading, empty, and error states.
* Ensure the citizen experience works on mobile.
* Avoid displaying simulated information as real-world data.
* Use realistic mockups and screenshots only when they accurately represent the product.

8. Demo Reliability

The demonstration must be repeatable.

Before presenting:

1. Confirm that the backend and frontend are running.
2. Check the backend health endpoint.
3. Reset the demonstration environment.
4. Run the golden scenario from the beginning.
5. Verify incident statuses and metrics.
6. Test the root-cause scenario if it will be presented.
7. Keep a backup recording or local demonstration ready.

Use the simulated clock for SLA demonstrations.

Do not add untested features immediately before the presentation.

If a feature is incomplete, either exclude it from the demonstration or explain its current status honestly.

9. Data, Security, and Secrets

* Never commit API keys or production credentials.
* Keep .env files out of Git.
* Use environment variables for secrets.
* Never use real personal information in demonstration data without authorization.
* Clearly label simulated incidents, locations, metrics, and service impacts.
* Do not claim production-grade security unless it has been implemented and tested.
* Do not expose private credentials in screenshots, logs, or documentation.

10. Pitch and Reporting Rules

All pitch claims must match the implemented product.

Use the documented scenarios and actual backend metrics as the source of truth for demo results.

Current documented comparison:

Metric	Naive baseline	CONVERGE
Work orders	3	2
Crew visits in root-cause scenario	3	1
False closures accepted	1	0
Duplicate work orders avoided	—	1
SLA breaches in the golden scenario	—	1

These are seeded demonstration results, not citywide field-trial results. Re-run the scenarios before the presentation to verify that the numbers remain unchanged.

User-testing metrics must come from real feedback submissions. Never invent tester counts, average ratings, or user quotes.

Be transparent about limitations, including disabled integrations, demo-grade authentication, and simulated data where applicable.

11. Scope Control

Our priority is a reliable demonstration of the core CONVERGE workflow.

Before adding a feature, ask:

1. Does it solve a real problem in the current scope?
2. Can it be implemented and tested within the available time?
3. Could it break an existing feature?
4. Does it improve the product demonstration?
5. Is it more important than fixing an existing issue?

If a feature is not essential, document it as future work rather than risking the stability of the existing product.

12. Definition of Done

A task is complete only when:

* The implementation matches the agreed requirements.
* Relevant tests pass.
* Existing functionality remains intact.
* Documentation is updated where necessary.
* The pull request explains the changes and testing.
* The changes have been reviewed and merged according to the team’s workflow.

A feature that works only on the developer’s machine is not considered complete.

13. Our Engineering Standard

We are not building a chatbot that merely describes civic problems.

We are building a system that connects reports to coordinated action, tracks accountability, and verifies outcomes.

Our standard:

* Rules decide.
* Evidence verifies.
* Audits explain.
* Tests protect.
* The team communicates.
* The product tells the truth.

CONVERGE — See it. Coordinate it. Verify it.
