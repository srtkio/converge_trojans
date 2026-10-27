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
