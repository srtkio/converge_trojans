# Antriksh — live demo driver

## You own
- Driving the live demo smoothly (clicks), and the backup video if the network fails.

## What to do before the pitch
1. `git pull`, start the backend and frontend (README), open http://localhost:3000/operator and sign in
   with the demo operator badge (README › Portals and demo sign-in). Run `python3 scripts/e2e.py`; it must say PASS.
2. Practise `docs/DEMO.md` three times: Reset → Next step ×10. Know what appears after each step.
3. Know where the backup recording is (`team/sarthak/` once recorded).

## During the pitch (1:30–3:30)
Click **Next step** on Sarthak's cue. After steps 3, 5, 7 and 10, pause so judges can read the screen:
- Step 3: "duplicate · 80%" badge and *Why linked*.
- Step 5: escalation when the only water crew goes offline.
- Step 7: **Reopened**: the citizen said it's still leaking.
- Step 10: the naive vs CONVERGE table.

## Judge questions you take
- *Is this live or a video?* Live, against our running backend; the scenario is replayable.
- *Can I file a report?* Yes, use the form on the right; pick a nearby place from the list to show a duplicate link.

## Pitch running order (5 min + Q&A)
| # | Section | Presenter | Time |
|---|---|---|---|
| 1 | Hook + problem | Sarthak | 0:00–0:45 |
| 2 | Market gap: what existing systems miss | Poorvi | 0:45–1:30 |
| 3 | Live demo (v1 golden, or v2 root cause) | Antriksh drives, Sarthak narrates | 1:30–3:30 |
| 4 | How it works: engine + architecture | Prachi | 3:30–4:15 |
| 5 | Results, user testing, business, future, close | Poorvi → Sarthak | 4:15–5:00 |

Everyone: be able to explain the one-line pitch and the core rule.
- **One line:** "CONVERGE turns citizen complaints into *verified* fixes. It merges duplicates, finds shared causes, enforces deadlines, and only closes a case when evidence proves it's fixed."
- **Core rule:** "A department saying *done* is not proof. Done means *waiting for evidence*; contradicting evidence reopens the case automatically."
