# User testing script (6 real testers, 10 minutes each)

Goal: six people who did not build CONVERGE try the citizen page and the operator dashboard, then
rate it in the app. The pitch uses only the numbers from `GET /feedback/summary`. Do not fill in a
result by hand.

## Live site (use these, never the per-deploy URLs)

- **App for testers:** https://converge-web-ten.vercel.app
  - Citizen: https://converge-web-ten.vercel.app/citizen
  - Operator: https://converge-web-ten.vercel.app/operator (the facilitator gives the demo badge and
    access code; see README › Portals and demo sign-in)
- **Backend (results come from here):** https://converge-backend-hnp0.onrender.com

These are aliases. Vercel deploy URLs change with every deploy, so do not put them in a shared document.

## Before the session

1. **Warm up the backend first.** Render's free plan sleeps after about 15 minutes idle, and the first
   request can take about a minute. Run `curl -s https://converge-backend-hnp0.onrender.com/health`
   until it prints `{"ok":true}`. Do this again before every session.
2. **Set up the demo case.** The phone task needs `inc_001` waiting for proof:
   `curl -s -X POST https://converge-backend-hnp0.onrender.com/sim/reset`, then
   `curl -s -X POST "https://converge-backend-hnp0.onrender.com/sim/scenario/golden?step=6"`.
   Check that `inc_001` is `pending_verification`:
   `curl -s https://converge-backend-hnp0.onrender.com/incidents/inc_001`.
   Reset clears incidents, not feedback.
3. **Open https://converge-web-ten.vercel.app once** on your phone and on your laptop. Confirm the start
   page loads, and that https://converge-web-ten.vercel.app/track/inc_001 shows the case.
4. **Note the starting feedback count.** Feedback is stored in the backend's Postgres database, so it
   survives restarts and resets. Check `GET /feedback/summary` before the first tester, so the final
   count is correct.

### Backup: run locally (only if the live site is down)

1. Backend, from `backend/`: `uvicorn app.main:app --host 0.0.0.0 --port 8001`
2. Frontend, from `frontend/`: `NEXT_PUBLIC_API_URL=http://<your-lan-ip>:8001 pnpm dev -- -H 0.0.0.0`
3. Allow the phone's origin in the backend CORS list, then restart the backend:
   `CONVERGE_CORS_ORIGINS=http://localhost:3000,http://<your-lan-ip>:3000`. Without this, the phone's
   browser is blocked by CORS.
4. Run the golden scenario to step 6 on `http://localhost:8001` (`POST /sim/scenario/golden?step=6`).

## The 10-minute script

Read this to each tester, word for word where quoted.

**0:00 – 0:30. Welcome.**
"This is a prototype for city complaints. We are testing the tool, not you. There are no wrong
answers, and you can stop at any time."

**0:30 – 4:00. Citizen task (phone).**
Hand over the phone with https://converge-web-ten.vercel.app/track/inc_001 open.
"A water leak was reported on the main road, and a crew says it's fixed. Please look at this case and
tell me what you think is happening."
- Watch for: can they find the status, the deadline, and the crew without help?
- Ask: "Is it fixed?" Let them press a button. Note which one they pressed and whether they
  understood what it does.
- Do not explain the rules of the system. Note any question they ask out loud.

**4:00 – 6:30. Operator task (laptop).**
Open https://converge-web-ten.vercel.app/operator on the laptop. Give the tester the demo badge and
access code, and let them sign in.
"You work for the water department. Find the open leak and tell me what you would do next."
- Watch for: can they find the queue, the map, and an incident's detail panel?
- Ask: "What does the status 'Awaiting proof' mean to you?"

**6:30 – 9:00. Feedback.**
Scroll to "Rate this" on the citizen page.
"Please rate what you just used, from 1 to 5 stars, and tell us in a sentence what you'd change."
- The tester fills in stars, role, and comment. Do not coach the rating.

**9:00 – 10:00. Wrap-up.**
"Thank you. Anything confusing you want to tell us about?" Write down their words exactly.

## Facilitator notes

- Write down each tester's words in the notes, not in a summary.
- If the last session was more than 15 minutes ago, warm up `/health` again before the first tester.
- If a tester gets stuck for more than a minute, note the screen and move on.
- Do not reset the demo between testers unless the page is broken. Each tester starts from
  step 6 of the golden scenario.

## Results (fill only from `GET /feedback/summary`)

Run `curl https://converge-backend-hnp0.onrender.com/feedback/summary` after the last tester. Copy the values as they
appear. Leave a cell blank until the value exists.

| Field | Value |
|---|---|
| Testers who submitted feedback (`count`) | |
| Average rating (`average`, out of 5) | |
| Rating 1 (`distribution."1"`) | |
| Rating 2 (`distribution."2"`) | |
| Rating 3 (`distribution."3"`) | |
| Rating 4 (`distribution."4"`) | |
| Rating 5 (`distribution."5"`) | |
| Citizen average (`by_role.citizen.average`) | |
| Operator average (`by_role.operator.average`) | |
| Quotes (from `recent`, verbatim, with role) | |

Quotes are verbatim from `recent[].comment`. Do not edit them, and do not add quotes that did not
come from the summary.

## Rules

- Pitch numbers come from this table only.
- Testers may be named only by role in any shared document.
- Shared documents use the aliases above, never a per-deploy Vercel URL.
- Never commit a backend `.env` or an API key.
