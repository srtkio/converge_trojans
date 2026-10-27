# Contracts (frozen — change only via CHANNEL.md + PR)

Backend: FastAPI on `http://localhost:8000`. All times are ISO-8601 UTC strings. All IDs are
strings with a prefix (`inc_`, `rep_`, `res_`, `ev_`, `aud_`). The app uses a **simulated clock**
(`GET /sim/clock`) so SLA deadlines can be demoed; never use wall-clock time in engine logic.

## Departments and categories

| category | department | SLA (hours) |
|---|---|---|
| `pothole` | `roads` | 48 |
| `streetlight` | `electrical` | 24 |
| `water_leak` | `water` | 12 |
| `garbage` | `sanitation` | 24 |
| `sewage` | `water` | 12 |
| `other` | `general` | 72 |

## Entities

```python
Report:       id, text, category, lat, lng, reporter, created_at, incident_id | None
Incident:     id, title, category, department, lat, lng, severity (1-5), status,
              created_at, deadline, assigned_resource_id | None, plan_version (int),
              report_ids: list[str], related_incident_ids: list[str], escalation_level (int)
Link:         report_id, incident_id, kind ("duplicate" | "related"), reason (str), confidence (0-1)
Resource:     id, name, department, available (bool), location (lat, lng), active_incident_ids
Evidence:     id, incident_id, kind ("photo" | "sensor" | "citizen_followup" | "inspector"),
              supports_resolution (bool), note, source, created_at
AuditEvent:   id, incident_id, actor ("system" | "department:<x>" | "citizen" | "llm"),
              event_type, from_status | None, to_status | None, detail, evidence_ids, timestamp
```

## Incident state machine

```
open ─assign→ assigned ─start→ in_progress ─complete→ pending_verification
pending_verification ─evidence supports→ verified_closed
pending_verification ─evidence contradicts→ reopened ─assign→ assigned ...
any non-closed state ─deadline passed→ escalated (escalation_level += 1, reassign/notify)
verified_closed ─new duplicate report→ reopened
```

Rules (deterministic, in engine code, never in the LLM):
1. **Dedup**: a new report links as `duplicate` to an open incident with same category, within
   **150 m**, created within **72 h**. Otherwise `related` if within **400 m** and in a
   dependent category (e.g. `water_leak`↔`pothole`, `sewage`↔`water_leak`). Otherwise new incident.
   The LLM may only refine the `reason` text and confidence, not the decision.
2. **Assign**: nearest available resource in the incident's department. None available →
   status stays `open`, audit `no_resource`, escalate.
3. **Replan**: a resource marked unavailable → every incident assigned to it gets reassigned,
   `plan_version += 1`, audit `plan_invalidated` + `replanned`.
4. **SLA**: on each clock tick, any incident not `verified_closed` past `deadline` → `escalated`,
   `escalation_level += 1`, deadline extended by half the SLA, audit `sla_breach`.
5. **Verify**: `complete` only moves to `pending_verification`. Closure needs at least one
   evidence with `supports_resolution=true` **and** no contradicting evidence or duplicate report
   after the completion time. A contradicting item → `reopened`, audit `false_closure_detected`.
6. Every state change writes an AuditEvent.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/reports` | `{text, category, lat, lng, reporter}` | `{report, incident, link: Link \| null}` |
| GET | `/incidents` | `?status=` | `Incident[]` |
| GET | `/incidents/{id}` | | `{incident, reports, links, evidence, audit, resource}` |
| POST | `/incidents/{id}/start` | | `Incident` |
| POST | `/incidents/{id}/complete` | `{note}` | `Incident` |
| POST | `/incidents/{id}/evidence` | `{kind, supports_resolution, note, source}` | `{incident, evidence}` |
| GET | `/resources` | | `Resource[]` |
| POST | `/resources/{id}/unavailable` | | `{resource, replanned: Incident[]}` |
| POST | `/resources/{id}/available` | | `Resource` |
| GET | `/sim/clock` | | `{now}` |
| POST | `/sim/tick` | `?minutes=60` | `{now, escalated: Incident[]}` |
| POST | `/sim/reset` | | `{ok}` — wipes DB, loads seed resources |
| POST | `/sim/scenario/golden` | `?step=N` (optional) | `{step, description, state}` — runs the demo |
| GET | `/audit` | `?incident_id=` | `AuditEvent[]` |
| GET | `/metrics` | | see below |

`/metrics`:
```json
{
  "reports": 0, "incidents": 0,
  "duplicates_linked": 0, "duplicate_work_orders_avoided": 0,
  "false_closures_caught": 0, "verified_closures": 0,
  "sla_breaches": 0, "escalations": 0, "replans": 0,
  "baseline": {"work_orders": 0, "false_closures_accepted": 0}
}
```
Baseline = a naive system that opens one work order per report and accepts every "complete".

## Golden scenario (`/sim/scenario/golden`)

1. Reset; seed resources (2 roads crews, 1 water crew, 1 electrical crew).
2. Report A: water leak at MG Road → new incident I1, assigned to water crew W1.
3. Report B: same leak, 60 m away → linked `duplicate` to I1.
4. Report C: pothole 250 m away → new incident I2, linked `related` to I1 (leak undermining road).
5. W1 becomes unavailable → I1 replanned (no other water crew → escalated, flagged).
6. W1 available again → I1 reassigned, started, marked complete → `pending_verification`.
7. Citizen follow-up: "still leaking" (contradicts) → I1 `reopened`, false closure caught.
8. Repaired again, inspector photo evidence supports → I1 `verified_closed`.
9. Clock ticks 49 h with I2 untouched → I2 SLA breach → `escalated`.
10. `/metrics` shows baseline vs CONVERGE.

## v2/v3 additions (additive; v1 fields and behaviour unchanged)

Shapes as posted in CHANNEL.md. Implemented on `feat/v2-rootcause`.

- `Incident` gains `parent_incident_id | None`, `child_incident_ids: list[str]`, `at_risk: bool`.
- `Evidence` gains `signal_only: bool` (true only for AI photo checks; never changes status).
- `Hypothesis`: `{id, cause_incident_id, member_ids, evidence_for, evidence_against, confidence, status: proposed|confirmed|rejected, summary, created_at, decided_at | None}`.
  Groups = incidents connected by `related` links; cause = most upstream category
  (`sewage` > `water_leak` > `pothole`), earliest on tie. Scoring is deterministic; the LLM may
  only rewrite `summary`.
- Confirming makes the cause the parent. Children not yet started release their crew (one
  coordinated visit), cannot be started, and their SLA waits on the parent. When the parent is
  `verified_closed` each waiting child moves to `pending_verification` (audit `parent_resolved`);
  it still needs its own evidence to close.
- `at_risk`: not started, not closed, not waiting on a parent, and under 25% of the SLA left.
  Audit `sla_at_risk` once per deadline.
- Feedback is real user data: wall-clock timestamps, kept across `/sim/reset`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/hypotheses` | `?status=` | `Hypothesis[]` |
| POST | `/hypotheses/{id}/confirm` | `{note?}` (body optional) | `{hypothesis, parent, children}` |
| POST | `/hypotheses/{id}/reject` | `{note?}` (body optional) | `{hypothesis}` |
| GET | `/incidents/{id}/impact` | | `{incident_id, simulated: true, services: [{id, name, kind, distance_m, via_incident_id, impact}]}` |
| GET | `/services` | | `Service[]` `{id, name, kind, location, radius_m}` |
| POST | `/incidents/{id}/evidence` | adds optional `photo: {data, media_type}` | adds `ai_check: {appears_fixed, confidence, explanation, evidence_id} \| null` |
| POST | `/feedback` | `{rating 1-5, comment?, role?, page?, incident_id?}` | `Feedback` |
| GET | `/feedback` | | `Feedback[]` newest first |
| GET | `/feedback/summary` | | `{count, average, distribution, by_role, recent}` |
| GET/POST | `/sim/scenario/rootcause` | `?step=N` | same shape as golden |
| GET/POST | `/sim/scenario/city` | `?step=N` (1-6) | same shape; small-area (~1 km, MG Road) live-city dataset for user testing and the map, not pitch metrics |

`/metrics` adds `crew_visits_saved`, `coordinated_vs_independent: {independent_visits, coordinated_visits}`,
`hypotheses: {proposed, confirmed, rejected}`, `at_risk` (count).

## v4: trust, roles and SLA state (additive; golden/rootcause/city outputs and `/metrics` unchanged)

Implemented on `feat/trust-roles`. `backend/tests/test_trust_roles.py` proves the three scenario
outputs and `/metrics` match `origin/main` field for field, ignoring only the new computed fields.

**Incident** (every Incident in every response: `/incidents`, `/incidents/{id}`, scenario `state`,
`/sim/tick`, action responses) gains two computed, never-stored fields:
- `verification`: `"unverified" | "corroborated" | "confirmed_on_site"` (strongest that applies)
  - `confirmed_on_site`: any evidence of kind `inspector` or `photo` (not AI `signal_only` checks).
  - `corroborated`: ≥2 distinct `reporter` strings among its reports, or a report with a photo and
    GPS location (once the photos backend's Report fields exist).
  - `unverified`: otherwise (one reporter, no on-site evidence).
- `sla_state`: `"on_track" | "at_risk" | "breached" | null`
  - `null` when `verified_closed` or `rejected`.
  - `breached`: sim clock is past `deadline`, or the incident ever had an `sla_breach` (it stays
    breached after the deadline is extended, until closed).
  - `at_risk`: the existing v3 `at_risk` flag.
  - A child waiting on a confirmed root-cause parent follows its parent's `sla_state`.
  - Use `deadline` (exists) with `GET /sim/clock` for live countdowns.

**New status `rejected`** (terminal, like `verified_closed`): no SLA breach / at-risk checks, no
crew, never replanned or auto-assigned, excluded from root-cause groups, and never a duplicate or
related target for new reports (a new report there opens a fresh incident). `GET /incidents?status=rejected` works.

**Report** items in `GET /incidents/{id}` `reports[]` gain `reporter_flags: int`: the number of
OTHER incidents, now `rejected`, that contain a report from the same `reporter`. `"anonymous"` is
never flagged.

**Rate limit** on `POST /reports` (HTTP route only; scenarios are never throttled): at most 5
reports per `reporter` per rolling 60 wall-clock minutes. The 6th →
`429 {"detail": "You've sent a lot of reports in a short time. Please wait a bit and try again."}`.
In memory; cleared by `POST /sim/reset`.

**Operators** (`backend/app/seed/operators.json`, SHA-256 code hashes) gain `role`:
`"officer"` (one department) | `"head"` (department head) | `"command"` (city command centre, department `"all"`).

| badge | name | department | role | demo code |
|---|---|---|---|---|
| `OPS-WTR-01` | Water Dept Officer | water | officer | `water-demo-2026` |
| `OPS-RDS-01` | Roads Dept Officer | roads | officer | `roads-demo-2026` |
| `HEAD-WTR-01` | Water Dept Head | water | head | `water-head-2026` |
| `HEAD-RDS-01` | Roads Dept Head | roads | head | `roads-head-2026` |
| `CMD-01` | City Command Centre | all | command | `command-demo-2026` |

**Escalation ladder**: every escalation (SLA breach or no crew) writes exactly one audit
`notified` (actor `system`). `escalation_level` 1 → detail starts `"<Department> department head
notified (to_role: head; ...)"`, ≥2 → `"City command centre notified (to_role: command; ...)"`.
`to_role` is in the detail text (no new AuditEvent column). This replaces the old
"supervisor notified of breach" event rather than adding a second one.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/operator` | `{badge_id, access_code}` | adds `role`: `{badge_id, name, department, role}` |
| GET | `/operators/ladder` | | `[{role, title, notified_at_escalation_level}]`: officer 0, head 1, command 2 |
| POST | `/incidents/{id}/reject` | `{reason: "fake"\|"not_civic"\|"cannot_locate"\|"duplicate_elsewhere", note?: str, by_badge: str}` | `{incident: Incident, audit: AuditEvent}` |

Reject rules: `by_badge` is looked up in `operators.json`. Unknown badge → 403; role `officer` →
403; a `head` may only reject incidents of their own department (else 403); `command` may reject
any. Already `verified_closed`/`rejected` → 409; unknown incident → 404; bad reason → 422. On
success: status `rejected`, crew released, `at_risk` false, audit `rejected_invalid` (actor
`operator:<badge>`, `to_status` `rejected`, detail includes the reason and note). Waiting children
of a rejected root cause get audit `parent_rejected` and their own crew.
