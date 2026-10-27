# CONVERGE flows

Seven process flows. **A is implemented** in the v1 backend. **B to G are design or roadmap**:
they describe where the platform is going, not what the code does today. Each flow says which.

Notes on A: the code simplifies some steps. Validation is schema-level (bad input is rejected with an
error, not quarantined for review). Location is a coordinate match, not a full asset lookup. Escalation
goes to a department head or the command centre, as described in the README.

## A. V1 incident loop (implemented)

```mermaid
flowchart TD
  A1["Citizen report, sensor event or work order"] --> A2["Validate and normalise event"]
  A2 --> A3{"Valid event?"}
  A3 -->|"No"| A4["Quarantine and explain the validation failure"]
  A3 -->|"Yes"| A5["Resolve location and identify assets"]
  A5 --> A6["Retrieve nearby and historical incidents"]
  A6 --> A7["Duplicate and relationship analysis"]
  A7 --> A8{"Same underlying incident?"}
  A8 -->|"Yes"| A9["Link report to existing incident"]
  A8 -->|"No"| A10["Create new incident"]
  A9 --> A11["Update incident graph"]
  A10 --> A11
  A11 --> A12["Assess severity, dependencies and SLA"]
  A12 --> A13["Generate candidate response plans"]
  A13 --> A14["Check hard constraints and permissions"]
  A14 --> A15{"Feasible plan exists?"}
  A15 -->|"No"| A16["Escalate resource conflict to authorised staff"]
  A15 -->|"Yes"| A17["Commit plan and create work orders"]
  A17 --> A18["Monitor events and deadlines"]
  A18 --> A19{"New event or failure?"}
  A19 -->|"Yes"| A20["Identify affected tasks and dependencies"]
  A20 --> A21["Invalidate stale decisions"]
  A21 --> A13
  A19 -->|"No"| A22{"Completion evidence received?"}
  A22 -->|"No"| A18
  A22 -->|"Yes"| A23["Evaluate evidence against closure policy"]
  A23 --> A24{"Resolution verified?"}
  A24 -->|"Yes"| A25["Close incident with evidence provenance"]
  A25 --> A26["Update metrics and recurrence history"]
  A24 -->|"No"| A27["Reopen, gather evidence or replan"]
  A27 --> A13
```

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
