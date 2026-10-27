# CONVERGE flows

This file has two parts.

- **Part 1: implemented.** What the code does today, with the real rule values from
  `backend/app/config.py` and `backend/app/engine/`. Every number here is in the code.
- **Part 2: design and roadmap.** Where the platform is going. These flows are plans, not built features.

Contents: [A1 Report intake](#a1-report-intake-and-grouping) ·
[A2 Assignment and deadlines](#a2-assignment-replanning-and-deadlines) ·
[A3 Verification](#a3-verification-and-closure) · [A4 Incident states](#a4-incident-state-machine) ·
[A5 Shared cause](#a5-shared-cause-repair-v2) · [A6 Citizen and operator](#a6-citizen-and-operator-loop) ·
[B–G roadmap](#part-2-design-and-roadmap)

# Part 1: implemented

## A1. Report intake and grouping

Where: `POST /reports` → `engine/intake.py`, `engine/dedup.py`, `engine/trust.py`.

```mermaid
flowchart TD
  R["Citizen submits a report: text, category, location, optional photo"] --> L{"More than 5 reports from this reporter in the last hour?"}
  L -->|"Yes"| L429["Refuse with 429 and a friendly 'please wait' message"]
  L -->|"No"| V{"Valid fields and known category?"}
  V -->|"No"| V422["Refuse with 422 and explain the problem"]
  V -->|"Yes"| S["Look up department, SLA hours and severity for the category"]
  S --> D{"Open incident in the same category within 150 m and 72 h?"}
  D -->|"Yes"| DUP["Link as duplicate: no new work order"]
  DUP --> DC{"Was that incident marked done or closed?"}
  DC -->|"Yes"| RO["Reopen it: audit false_closure_detected"]
  DC -->|"No"| T["Recompute trust badge"]
  RO --> T
  D -->|"No"| REL{"Incident in a dependent category within 400 m?"}
  REL -->|"Yes"| NR["Create new incident and link it as related"]
  REL -->|"No"| N["Create new incident"]
  NR --> AS["Assign crew (see A2)"]
  N --> AS
  AS --> T
  T --> TB{"Trust badge"}
  TB -->|"Inspector or citizen photo evidence"| T3["confirmed_on_site"]
  TB -->|"2+ reporters, or photo with GPS"| T2["corroborated"]
  TB -->|"Otherwise"| T1["unverified"]
```

Dependent pairs (only these can be "related"): water leak ↔ pothole, sewage ↔ water leak, sewage ↔ pothole.

## A2. Assignment, replanning and deadlines

Where: `engine/assign.py`, `engine/sla.py`. The clock is simulated so deadlines can be demoed.

```mermaid
flowchart TD
  I["New or reopened incident"] --> P{"Free crew in the incident's department?"}
  P -->|"Yes"| A["Assign the nearest free crew"]
  P -->|"No"| NR["Audit no_resource and escalate"]
  A --> W["Crew works the incident"]
  W --> U{"Crew marked unavailable?"}
  U -->|"Yes"| RP["Replan: release the job, plan_version + 1, audit plan_invalidated and replanned"]
  RP --> P
  U -->|"No"| K["Each clock tick: check the deadline"]
  K --> AR{"Not started and under 25% of the SLA left?"}
  AR -->|"Yes"| ARF["Flag at_risk before the breach (audit sla_at_risk)"]
  AR -->|"No"| B{"Deadline passed and not closed?"}
  ARF --> B
  B -->|"No"| W
  B -->|"Yes"| E["Status escalated, escalation level + 1, deadline extended by half the SLA"]
  E --> LV{"Escalation level?"}
  LV -->|"1"| H["Notify the department head"]
  LV -->|"2 or more"| C["Notify the city command centre"]
  H --> P
  C --> P
```

SLA hours: water leak 12, sewage 12, streetlight 24, garbage 24, pothole 48, other 72.

## A3. Verification and closure

Where: `engine/verify.py`. "Done" is never the same as "fixed".

```mermaid
flowchart TD
  S["Crew starts work: in_progress"] --> C["Crew marks the job complete"]
  C --> PV["Status pending_verification: awaiting proof"]
  PV --> EV{"New evidence: inspector, photo, sensor or citizen follow-up"}
  EV -->|"Supports the fix"| CK{"Any contradicting evidence or a duplicate report since completion?"}
  CK -->|"No"| VC["verified_closed, crew released"]
  CK -->|"Yes"| RO["Reopen: audit false_closure_detected, reassign"]
  EV -->|"Contradicts the fix"| RO
  RO --> S
  PH["Optional AI photo check"] -.->|"signal only, never changes a status"| PV
  VC --> RD{"New duplicate report after closure?"}
  RD -->|"Yes"| RO
  RD -->|"No"| END["Stays closed; audit trail kept"]
```

## A4. Incident state machine

```mermaid
stateDiagram-v2
  [*] --> open: report creates incident
  open --> assigned: crew assigned
  open --> escalated: no crew free
  assigned --> in_progress: start
  in_progress --> pending_verification: complete
  pending_verification --> verified_closed: supporting evidence
  pending_verification --> reopened: contradicting evidence
  verified_closed --> reopened: new duplicate report
  reopened --> assigned: reassign
  assigned --> escalated: deadline missed
  in_progress --> escalated: deadline missed
  reopened --> escalated: deadline missed
  escalated --> assigned: crew found
  open --> rejected: head or command rejects
  assigned --> rejected: head or command rejects
  escalated --> rejected: head or command rejects
  verified_closed --> [*]
  rejected --> [*]
```

`rejected` needs a department head or the command centre, with a reason: `fake`, `not_civic`,
`cannot_locate` or `duplicate_elsewhere`. Officers get 403. Every transition writes an audit event.

## A5. Shared-cause repair (v2)

Where: `engine/rootcause.py`. Rules decide; an LLM may only write the summary sentence.

```mermaid
flowchart TD
  G["Incidents connected by related links"] --> H["Propose one hypothesis: the most upstream incident is the cause"]
  H --> SC["Score it: count, distance, time order, category dependency"]
  SC --> OP{"Operator decision"}
  OP -->|"Reject"| RJ["Hypothesis rejected; incidents continue separately"]
  OP -->|"Confirm"| PC["Cause becomes the parent; the others become children"]
  PC --> CR{"Child not started yet?"}
  CR -->|"Yes"| REL["Release the child's crew: one visit saved"]
  CR -->|"No"| KEEP["Child keeps its crew"]
  REL --> FX["Repair the parent"]
  KEEP --> FX
  FX --> PV{"Parent verified_closed?"}
  PV -->|"No"| FX
  PV -->|"Yes"| CH["Each child moves to pending_verification: never auto-closed"]
  CH --> VER["Each child needs its own evidence (see A3)"]
```

Upstream order: sewage, then water leak, then pothole. In the demo, crew visits go from 3 to 1.

## A6. Citizen and operator loop

Where: `frontend/src/app/citizen`, `frontend/src/app/track`, `frontend/src/app/operator`, `GET /citizen/activity`.

```mermaid
flowchart TD
  CI["Citizen signs in with a name and email"] --> FN["Only the first name is kept with reports; the email never leaves the browser"]
  FN --> RP["Report with photo and GPS, or a pin dropped on the map"]
  RP --> IN["Intake and grouping (see A1)"]
  IN --> OI["Operator Incidents tab: Citizen activity list"]
  IN --> PU["Operator pop-up on any tab: new complaint"]
  IN --> TR["Citizen case page /track/id: status, deadline, crew, timeline"]
  TR --> Q{"Citizen: is it fixed?"}
  Q -->|"Yes, it's fixed"| EVS["Supporting citizen evidence"]
  Q -->|"Still broken, with a note"| EVC["Contradicting citizen evidence"]
  EVS --> V["Verification rules (see A3)"]
  EVC --> V
  V --> OI
  V --> PU
  V --> TR
```

# Part 2: design and roadmap

The flows below are design work for later versions. They are **not** built features.

## B. Agent orchestration (design)

```mermaid
flowchart TD
  B1["Incoming event"] --> B2["Orchestrator"]
  B2 --> B3["Read shared state and policy"]
  B3 --> B4["Select specialist agent or deterministic tool"]
  B4 --> B5{"Operation type?"}
  B5 -->|"Interpretation"| B6["Incident intelligence agent"]
  B5 -->|"Planning"| B7["Planning agent"]
  B5 -->|"Verification"| B8["Evidence review agent"]
  B5 -->|"Calculation"| B9["Deterministic graph or optimiser tool"]
  B6 --> B10["Typed proposed action"]
  B7 --> B10
  B8 --> B10
  B10 --> B11["Policy and schema validation"]
  B11 --> B12{"Permitted and valid?"}
  B12 -->|"No"| B13["Reject, explain or request approval"]
  B12 -->|"Yes"| B14["Execute controlled tool"]
  B14 --> B15["Validated tool result"]
  B9 --> B15
  B15 --> B16["Persist state transition and audit event"]
  B16 --> B17["Check invariants and postconditions"]
  B17 --> B18{"Expected state reached?"}
  B18 -->|"Yes"| B19["Publish updated state"]
  B19 --> B20["Wait for next event"]
  B18 -->|"No"| B21["Retry safely, compensate or escalate"]
  B21 --> B2
```

## C. Root-cause investigation (design; shared-cause hypotheses are implemented in v2)

```mermaid
flowchart TD
  C1["Recurring or correlated incidents detected"] --> C2["Build local subgraph of assets, places and incidents"]
  C2 --> C3["Generate candidate causal hypotheses"]
  C3 --> C4["Retrieve supporting and contradicting evidence"]
  C4 --> C5["Rank hypotheses with explicit scoring rules"]
  C5 --> C6{"Evidence sufficient for action?"}
  C6 -->|"No"| C7["Identify most informative next observation"]
  C7 --> C8["Check cost, availability and permissions"]
  C8 --> C9{"Observation permitted and feasible?"}
  C9 -->|"Yes"| C10["Acquire simulated or authorised observation"]
  C10 --> C4
  C9 -->|"No"| C11["Request human investigation"]
  C6 -->|"Yes"| C12["Propose intervention candidates"]
  C12 --> C13["Simulate expected outcomes"]
  C13 --> C14["Check feasibility and downside risk"]
  C14 --> C15{"Policy requirements satisfied?"}
  C15 -->|"No"| C12
  C15 -->|"Yes"| C16["Request approval if required"]
  C16 --> C17["Execute permitted intervention"]
  C17 --> C18["Measure post-intervention observations"]
  C18 --> C19{"Outcome supports hypothesis?"}
  C19 -->|"Yes"| C20["Record supported explanation and outcome"]
  C20 --> C21["Monitor for recurrence"]
  C19 -->|"No"| C22["Revise hypothesis ranking"]
  C22 --> C3
```

## D. Water module (roadmap)

```mermaid
flowchart TD
  D1["Pressure, flow, consumption and maintenance events"] --> D2["Validate sensor quality and timestamps"]
  D2 --> D3["Update network state and expected operating ranges"]
  D3 --> D4["Detect anomalies and identify affected segments"]
  D4 --> D5["Generate candidate explanations"]
  D5 --> D6["Compare topology, sensor patterns and maintenance evidence"]
  D6 --> D7{"Enough evidence to act?"}
  D7 -->|"No"| D8["Choose informative inspection or sensor observation"]
  D8 --> D9["Check observation cost and feasibility"]
  D9 --> D10["Collect authorised or simulated observation"]
  D10 --> D6
  D7 -->|"Yes"| D11["Rank fault hypotheses and estimate uncertainty"]
  D11 --> D12["Generate repair options and isolation constraints"]
  D12 --> D13["Check crew skills, equipment and service impact"]
  D13 --> D14{"Safe, feasible plan?"}
  D14 -->|"No"| D15["Escalate or request additional resources"]
  D14 -->|"Yes"| D16["Authorise repair and execute work order"]
  D16 --> D17["Monitor post-repair pressure and flow"]
  D17 --> D18{"Operating state restored?"}
  D18 -->|"Yes"| D19["Verify recovery and record evidence"]
  D19 --> D20["Update maintenance history and metrics"]
  D18 -->|"No"| D21["Reopen diagnosis and update hypotheses"]
  D21 --> D5
```

## E. Food redistribution module (roadmap)

```mermaid
flowchart TD
  E1["Restaurant, hostel, food bank or recipient update"] --> E2["Normalise food, quantity, safety and expiry data"]
  E2 --> E3["Forecast near-term surplus and demand"]
  E3 --> E4["Validate recipient eligibility and food constraints"]
  E4 --> E5["Generate feasible supply-demand matches"]
  E5 --> E6["Estimate travel time, handling time and expiry slack"]
  E6 --> E7["Optimise allocations across recipients"]
  E7 --> E8{"Feasible and safe allocation?"}
  E8 -->|"No"| E9["Request additional supply or alternative recipients"]
  E9 --> E5
  E8 -->|"Yes"| E10["Create delivery plan and reserve capacity"]
  E10 --> E11["Monitor pickup, route, stock and destination state"]
  E11 --> E12{"Disruption or expiry risk?"}
  E12 -->|"Yes"| E13["Recompute feasible deliveries and affected recipients"]
  E13 --> E7
  E12 -->|"No"| E14{"Delivery confirmed?"}
  E14 -->|"No"| E11
  E14 -->|"Yes"| E15["Reconcile delivered quantities and evidence"]
  E15 --> E16["Update surplus, demand and performance metrics"]
```

## F. Healthcare administration module (roadmap; administrative only, no clinical decisions)

```mermaid
flowchart TD
  F1["Authorised clinic, lab, pharmacy or patient-system event"] --> F2["Validate identity, consent and access permissions"]
  F2 --> F3{"Authorised access?"}
  F3 -->|"No"| F4["Deny access and log the security event"]
  F3 -->|"Yes"| F5["Retrieve permitted care-pathway state"]
  F5 --> F6["Check outstanding referrals, tests and follow-ups"]
  F6 --> F7["Identify missing steps and blocked dependencies"]
  F7 --> F8["Prioritise administrative actions under policy"]
  F8 --> F9["Propose scheduling, referral or reminder actions"]
  F9 --> F10["Check permissions and human approval requirements"]
  F10 --> F11{"Action authorised?"}
  F11 -->|"No"| F12["Escalate to authorised staff"]
  F11 -->|"Yes"| F13["Execute administrative action"]
  F13 --> F14["Monitor acknowledgments and completion"]
  F14 --> F15{"Deadline missed or dependency blocked?"}
  F15 -->|"Yes"| F16["Replan administrative workflow and notify staff"]
  F16 --> F8
  F15 -->|"No"| F17{"Required completion evidence received?"}
  F17 -->|"No"| F14
  F17 -->|"Yes"| F18["Reconcile pathway state and audit the outcome"]
```

## G. Cross-domain coordination (roadmap)

```mermaid
flowchart TD
  G1["Water fault or urban disruption"] --> G2["Update shared city state"]
  G2 --> G3["Traverse affected assets, routes and services"]
  G3 --> G4["Generate downstream impact hypotheses"]
  G4 --> G5["Water: estimate service loss and repair options"]
  G4 --> G6["Smart city: assess road and crew impacts"]
  G4 --> G7["Food: assess supply, expiry and delivery disruption"]
  G4 --> G8["Healthcare: identify affected care pathways"]
  G5 --> G9["Merge proposed actions and shared constraints"]
  G6 --> G9
  G7 --> G9
  G8 --> G9
  G9 --> G10["Generate joint response candidates"]
  G10 --> G11["Simulate outcomes under common initial conditions"]
  G11 --> G12["Score service restoration, unmet demand, risk and cost"]
  G12 --> G13["Reject infeasible or unauthorised plans"]
  G13 --> G14{"Acceptable joint plan?"}
  G14 -->|"No"| G15["Request resources or escalate unresolved trade-offs"]
  G15 --> G10
  G14 -->|"Yes"| G16["Obtain required approvals"]
  G16 --> G17["Commit coordinated assignments"]
  G17 --> G18["Monitor all affected services"]
  G18 --> G19{"New event or failed outcome?"}
  G19 -->|"Yes"| G2
  G19 -->|"No"| G20["Verify domain outcomes and update the shared history"]
```
