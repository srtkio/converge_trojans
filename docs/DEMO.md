# CONVERGE demo script (about 3 minutes)

Ten golden steps, shown in the dashboard. Each step says what to click, what to say, and which
number to point at.

## Before you start

1. Backend running: `cd backend && uvicorn app.main:app --port 8000`
   (if 8000 is taken by another project, use `--port 8001` and set
   `NEXT_PUBLIC_API_URL=http://localhost:8001` in `frontend/.env.local`).
2. Frontend running: `cd frontend && pnpm dev`, then open http://localhost:3000.
3. Press **Reset**. The dashboard should show no incidents.
4. Optional check: `scripts/smoke.sh` should print `PASS` (use `CONVERGE_URL=http://localhost:8001`
   if the backend is on 8001). Run it, then press **Reset** again before presenting.

Use **Next step →** for each step below. You can also jump to any step by replaying from a
reset.

---

## 1. Reset (0:00)

**Click:** Reset.
**Say:** "Every city runs on a ticket queue. Ours tracks a complaint from the moment a citizen files
it until the fix is verified on the ground."
**Point at:** the empty queue, and the four crews on the map: two roads, one water, one electrical.

## 2. Report A: water leak on MG Road (0:20)

**Click:** Next step →.
**Say:** "A citizen reports a water leak. CONVERGE opens incident I1 and assigns it to water crew
W1, the nearest available water crew."
**Point at:** I1 in the queue, with the water department and the crew W1 assigned.

## 3. Report B: same leak, 60 m away (0:40)

**Click:** Next step →.
**Say:** "A second citizen reports the same leak 60 metres away. A naive system opens a second work
order. CONVERGE links it as a duplicate of I1."
**Point at:** the duplicate link on I1. The **Duplicates linked** counter goes to 1, and the
baseline's work orders row shows "−1 duplicate".

## 4. Report C: pothole 250 m away (1:00)

**Click:** Next step →.
**Say:** "This pothole is different: it is a road defect. CONVERGE does not merge it, because it is
a different job. It opens I2 and marks it related to I1, since the leak is probably undermining the
road."
**Point at:** I2 on the map, with the related link back to I1. This is the cross-department link.

## 5. W1 goes unavailable (1:15)

**Click:** Next step →.
**Say:** "Crew W1 drops out. CONVERGE replans every incident assigned to it. There is no other
water crew, so I1 is escalated and flagged."
**Point at:** I1 marked escalated and the **Replans** counter at 1. This is the replan rule and the
escalation path.

## 6. W1 is back, and the fix is marked complete (1:30)

**Click:** Next step →.
**Say:** "W1 returns. I1 is reassigned, started, and marked complete. Completion is not the same as
resolution, so the incident moves to pending verification."
**Point at:** I1 in the **pending verification** state. Note that it is not closed yet.

## 7. Citizen says it is still leaking (1:50)

**Click:** Next step →.
**Say:** "The citizen says it is still leaking. That contradicts the closure, so CONVERGE reopens
I1. A system that trusts 'work order complete' would have closed this and moved on."
**Point at:** I1 reopened, the audit entry `false_closure_detected`, and the baseline's **False
closures accepted** row, which shows "1 caught & reopened" in green.

## 8. Repaired again, and the inspector confirms (2:10)

**Click:** Next step →.
**Say:** "Crew W1 repairs the pipe again. An inspector photo shows the road is dry with no seepage.
Only now, with evidence that supports the fix, is I1 verified closed."
**Point at:** I1 at **Verified closed**, the inspector evidence, and the **Verified closed**
counter at 1.

## 9. Clock jumps 49 hours (2:25)

**Click:** Next step →.
**Say:** "Two days pass and nobody touches I2, the pothole. Its service level deadline is missed, so
CONVERGE escalates it automatically. Nobody has to notice."
**Point at:** I2 escalated, the audit entry `sla_breach`, and the **SLA breaches** counter at 1.

## 10. The scorecard (2:45)

**Click:** Next step →.
**Say:** "Here is the comparison. A naive system would have opened 3 work orders and accepted one
false closure. CONVERGE opened 2 incidents, caught the false closure, and escalated the missed
deadline. Every step is in the audit log."
**Point at:** the baseline table on the metrics bar, and the counters beside it:

| Dashboard row or counter | Value |
|---|---|
| Baseline **Work orders** | 3 reports, one work order each. The "−1 duplicate" note shows CONVERGE avoided one. |
| Baseline **False closures accepted** | 1, shown in red. "1 caught & reopened" is CONVERGE's result. |
| **SLA breaches** | 1 |

Close with: "We do not stop at ticket closed. We close it when the fix is verified."

---

## Notes for the presenter

- If a step looks wrong, press **Reset** and run again from step 1. The scenario is deterministic.
- The LLM only rewrites link explanations when `ANTHROPIC_API_KEY` is set. The decisions do not
  depend on it, so the demo works without a key.
- Full API details are in `docs/CONTRACTS.md`.
