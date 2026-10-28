# CONVERGE presentation script (5 minutes plus Q&A)

This is the single script the four presenters follow on stage. It sets the order, who speaks, what is
on screen, and the exact lines. Click-by-click detail for the demo is in `docs/DEMO.md`; numbers are in
`docs/PITCH.md`. Use only what is merged on `main` when you rehearse. Anything still in a PR is out.

## Before you go on

- Warm up the backend: open `https://converge-backend-hnp0.onrender.com/health` and wait for `{"ok":true}`.
  Free Render sleeps, and the first request can take about a minute.
- Open the app: `https://converge-web-ten.vercel.app`. Operator sign-in is in the README.
- Press **Reset** in the operator scenario bar before you go on stage.
- Fallback: if the live site fails, use the local backup in `docs/TESTING.md`. Keep the backup video
  (`team/sarthak/`) ready.

## Who speaks and when

| Time | Section | Speaker | Screen |
|---|---|---|---|
| 0:00 – 0:45 | Hook and problem | Sarthak | Title slide |
| 0:45 – 1:30 | Market gap | Poorvi | Research table slide |
| 1:30 – 3:30 | Live demo | Antriksh drives, Sarthak narrates | Operator dashboard, then citizen phone |
| 3:30 – 4:15 | How it works | Prachi | Architecture slide |
| 4:15 – 5:00 | Results, close | Poorvi, then Sarthak | Scorecard, then closing slide |

## 1. Hook and problem (Sarthak, 0:00)

> "In most cities, when ten people report the same burst pipe, the city opens ten tickets. When a crew
> says *fixed*, the ticket closes, even if the water is still flowing. We built CONVERGE to close that gap."

## 2. Market gap (Poorvi, 0:45)

> "CPGRAMS, the Swachhata app, FixMyStreet, SeeClickFix: they collect complaints and route them. Most of
> them flag or point to duplicates. None we found link a shared cause or require proof before closing.
> That is the gap."

Use the wording in `team/poorvi/research.md`. Do not say "none of them merge duplicates".

## 3. Live demo (Antriksh drives, Sarthak narrates, 1:30 – 3:30)

Time is tight. The full v1 walkthrough in `docs/DEMO.md` takes about 3 minutes, and this slot is 2.
**Decision needed:** either trim v1 to the cue steps below, or give the demo a longer slot. Until
that is decided, rehearse the cut version.

**v1 · Verified loop (cut version, about 90 seconds)**

| Cue | Antriksh clicks | Sarthak says | Point at |
|---|---|---|---|
| Step 2 | Next step → | "A citizen reports a water leak. CONVERGE opens one incident and assigns the nearest crew." | The incident and its crew |
| Step 3 | Next step → | "The same leak, reported again. A naive system opens a second ticket. CONVERGE links it as a duplicate." | **Duplicates linked** counter |
| Step 7 | Next step → | "The citizen says it is still leaking. The 'done' is reversed. The case reopens." | The reopened case and **False closures caught** |
| Step 10 | Next step → | "Same reports: the naive system opens three work orders and accepts one false closure. CONVERGE opens two, catches the false closure, and escalates the missed deadline." | The scorecard, pause 5 s |

Pause after steps 3, 7 and 10 so the judges can read the screen.

**v2 · Root cause (about 60 seconds, optional if time runs short)**

| Cue | Antriksh clicks | Sarthak says | Point at |
|---|---|---|---|
| Step 4 | Next step → | "A third complaint, and CONVERGE proposes one shared cause: the leak." | The hypothesis card |
| Step 5 | Next step → | "One operator confirms it. Three crew visits become one." | **Crew visits 3 → 1** |

**Citizen moment (optional, 20 seconds, only if the citizen pop-up is merged).** Antriksh opens
`/citizen` on a phone, files a complaint, and answers "Still broken" with a note. Sarthak says: "The
operator sees it straight away, in the Citizen activity panel, and gets a pop-up on the dashboard."
The panel is on the **Incidents** tab. The pop-up alert is live.

## 4. How it works (Prachi, 3:30)

> "Every outcome is decided by plain rules in code. The AI only writes wording, and it cannot change a
> status. Each decision is written to an audit trail."

Show the architecture slide. Do not claim live AI: the live site runs with AI switched off.

## 5. Results and close (Poorvi, then Sarthak, 4:15)

Poorvi reads the scorecard from `docs/PITCH.md` slide 5 and slide 6 numbers. Use the numbers from the
last scenario run only. Slide 7 (user testing) is shown only once the six tests are done and the
feedback count comes from `/feedback/summary`.

Sarthak closes:

> "Same reports, fewer work orders, zero false closures accepted, every decision auditable. CONVERGE is the
> verification layer every city complaint system is missing."

## Judge questions

Answers are in each person's `team/<name>/PRESENTER.md`. Quick answers:

- **Who pays?** Municipal corporations, Smart City SPVs, command-centre vendors.
- **Why not AI for everything?** Rules decide, so every decision can be explained. AI only writes wording.
- **Is it secure?** No. Sign-in is demo-grade and the API is open. Say so.
- **How does a city adopt it?** It sits on top of the existing portal through an API. Start with one ward.

## Known limits to state honestly

- Sign-in is demo-grade. Citizen photos are not stored yet. AI is off on the live site.
- The map covers only the demo area on the Murthal–Sonipat corridor.
- The live backend sleeps when idle.

## Rehearsal

- Each presenter rehearses their own lines, and the group runs the whole thing twice, with a timer.
- Antriksh rehearses the clicks three times, starting from **Reset**.
- Do not add features to the demo in the last hour before the presentation.
