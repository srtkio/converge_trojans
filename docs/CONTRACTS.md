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
