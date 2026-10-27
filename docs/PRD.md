# CONVERGE — Product Requirements

## Problem
City complaint systems count a ticket as solved when a department *says* it's done. The same
leak gets reported ten times and becomes ten tickets. Connected problems (a leak that sinks the
road) are fixed separately. Deadlines slip silently. Citizens never find out, or report again.

## Users
| User | Needs |
|---|---|
| Citizen | Report fast, see progress, confirm whether it's really fixed |
| Department operator | One queue, no duplicates, clear deadlines, know which crew to send |
| Command-centre supervisor | See escalations, false closures, root causes, and proof of every decision |

## Core promise
**"Closed" means verified.** Work marked complete waits for evidence. Contradicting evidence
reopens the case automatically.

## Requirements
| # | Requirement | Version |
|---|---|---|
| R1 | Accept a report (text, category, location) and link it as duplicate / related / new, with the reason shown | v1 ✅ |
| R2 | Route to the right department and the nearest available crew | v1 ✅ |
| R3 | Replan automatically when a crew becomes unavailable | v1 ✅ |
| R4 | SLA deadline per category; escalate on breach | v1 ✅ |
| R5 | "Complete" → awaiting proof; supporting evidence closes, contradicting evidence reopens | v1 ✅ |
| R6 | Every state change is audited with actor, reason, and evidence | v1 ✅ |
| R7 | Measured comparison against a naive ticket system | v1 ✅ |
| R8 | Shared root-cause hypotheses with evidence for/against; one coordinated repair | v2 |
| R9 | Show which city services an incident affects | v2 |
| R10 | Citizen tracking page with one-tap fix confirmation | v3 |
| R11 | AI photo check as a verification signal (never a decision) | v3 |
| R12 | SLA-at-risk early warning | v3 |
| R13 | Collect real user feedback and show it | v3 |

## Non-goals
Real dispatch, replacing city systems, claiming causality from correlation, healthcare/food/water
modules (pitched as future work on the same engine).

## Success metrics (shown live in the dashboard)
Duplicate work orders avoided · false closures caught · verified closures · SLA breaches and
escalations · crew visits saved (v2) · real tester count and average rating (v3).

## Principles
1. Rules decide; AI explains. The LLM never changes a decision.
2. Show uncertainty: confidence and evidence for/against, not "the AI says".
3. Everything replayable: reset and rerun the scenario any time.
4. Honest numbers: simulated data is labelled; user-test numbers are real submissions only.
