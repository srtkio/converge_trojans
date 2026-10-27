# Existing civic complaint systems: what they do and what's missing

Draft by the coordinator Claude, from a quick web search. Each cell is either a sourced fact or
marked **to verify**. Check every row before it goes into the pitch. Public-facing claims need a
source a judge can open.

Gap columns: does the system **merge duplicates**, **link related causes**, **check evidence
before closing**, and **escalate on missed SLAs**? "Not documented" means the search didn't find
it, not that it doesn't exist.

| System | Scope | What it does | Merges duplicates? | Links related causes? | Evidence-checked closure? | SLA escalation? | Sources |
|---|---|---|---|---|---|---|---|
| **CPGRAMS** (India, central grievances) | Central government grievances | One registration ID per case, routed to a last-mile grievance officer. Disposal target cut from 30 to 21 days (Aug 2024 guidelines). | Not documented in results. **To verify** on pgportal.gov.in. | No | No (case is closed by the officer) | Timelines set; escalation path **to verify** | [PIB document](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/aug/doc202689948801.pdf); [overview](https://www.shankariasparliament.com/current-affairs/mains-analysis/centralised-public-grievance-redress-and-monitoring-system-cpgrams) |
| **Swachhata app** (India, MoHUA, sanitation) | Urban sanitation complaints | Photo + location, forwarded to the ward sanitary inspector. Citizens get a push with the "Resolved" photo and can reopen. Non-animal complaints due in 12 h; unresolved ones escalate to a higher level. Citizens can upvote and rate. | Not documented. Upvoting is not merging. | No | Partly: resolution photo from the inspector; citizen can reopen. No independent check described. | Yes, 12 h then escalate (per a 2017-era article; **to verify current rule**) | [Better India](https://thebetterindia.com/96351/swachhtaa-app-ministry-of-urban-development); [Khaleej Times](https://www.khaleejtimes.com/uae/govts-cleanliness-app-a-big-hit); [UX4G case study](https://www.ux4g.gov.in/case-studies/ux4g-swachhata.php) (notes the app faces engagement and tracking challenges) |
| **FixMyStreet** (UK, councils) | Potholes, streetlights, fly-tipping | Public reports show status changes. Councils close duplicates and point to the original report number. | Councils mark duplicates by hand. Matching logic **to verify** on the FixMyStreet help pages. | No (the duplicate is a pointer, not a shared cause) | No. A report can be closed as duplicate, then reopened when the problem persists. | Not documented in results | [Oxfordshire duplicate example](https://fixmystreet.oxfordshire.gov.uk/report/8531976); [Northumberland pothole](https://fix.northumberland.gov.uk/report/6999843); [Bristol](https://fixmystreet.bristol.gov.uk/report/8526852) |
| **SeeClickFix / CivicPlus 311 CRM** (US, councils) | 311 requests across councils | Vendor says it detects and merges duplicates by location and category, and routes by area. Dublin, CA warns residents before a duplicate is filed. | **Yes, per vendor marketing.** Not independently verified. | Not documented | Not documented | Not documented | [CivicPlus unified platform](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/); [Dublin, CA](https://dublin.ca.gov/Archive.aspx?ADID=1125) |
| **Houston 311** (US city, general 311) | General 311 | Departments close requests with a listed reason (completed, inspector could not confirm, duplicate). Residents can dispute the closure. | Duplicate is a closure reason. Merge logic **to verify**. | No | No. A closure reason is recorded, but no evidence is required to close. | Not documented in results | [Why was my request closed?](https://www.houstontx.gov/311/whywasmyservicerequestclosed.html) |

## The gap, in one line per missing feature

- **Duplicate merging:** Several systems detect or point to duplicates. None shows a clear merge that
  keeps every reporter on one case. Vendor claims need checking.
- **Related-cause linking:** Nothing in the results links a pothole to a water leak it may come
  from. Each complaint is handled alone.
- **Evidence-checked closure:** Closure is typically the department's own call. Several systems
  let the citizen reopen, but none requires independent evidence before a case closes.
- **SLA escalation:** Swachhata is the clearest example (12 h, then escalate). The others don't show
  a documented escalation rule in the results.

## Sources needing a follow-up search

- NYC Council bill on duplicate requests (noted by SeeClickFix coverage): the page's year is
  inconsistent, so **verify** before quoting.
- NYC Introductions 800 and 822: proposals only, not law. Do not present as facts.
- CPGRAMS escalation and duplicate rules: check pgportal.gov.in and the DARPG guidelines.

## Check before using PRESENTER.md line 2

Your market-gap line says "None of them merge duplicate reports". The SeeClickFix / CivicPlus row
above is a vendor claim that it does merge duplicates. Suggested safer wording, if you keep the
pitch as is: "Most of them flag or point to duplicates; none we found link a shared cause or
require proof before closing." Change it only after you've checked the sources.
