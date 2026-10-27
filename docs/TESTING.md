# User testing script (6 real testers, 10 minutes each)

Goal: six people who did not build CONVERGE try the citizen page and the operator dashboard, then
rate it in the app. The pitch uses only the numbers from `GET /feedback/summary`. Do not fill in a
result by hand.

## Before the session

1. Start the backend from `backend/` on a port the testers can reach:
   `uvicorn app.main:app --host 0.0.0.0 --port 8001`
2. Start the frontend from `frontend/` on a LAN address:
   `NEXT_PUBLIC_API_URL=http://<your-lan-ip>:8001 pnpm dev -- -H 0.0.0.0`
3. Allow the phone's origin in the backend CORS list (env var `CONVERGE_CORS_ORIGINS`), for example
   `CONVERGE_CORS_ORIGINS=http://localhost:3000,http://<your-lan-ip>:3000`. Restart the backend.
   Without this, the phone's browser will be blocked by CORS.
4. Reset the demo (`POST /sim/reset`), then run the golden scenario to step 6
   (`POST /sim/scenario/golden?step=6`). Note the incident ID that is waiting for proof, which is
   `inc_001` on a fresh run. That ID goes into the citizen task.
5. Test the phone route once from your own phone before the first tester arrives.
6. Feedback is kept across resets. Use a fresh backend database for the real count, or start
   counting from a known number.

## The 10-minute script

Read this to each tester, word for word where quoted.

**0:00 – 0:30. Welcome.**
"This is a prototype for city complaints. We are testing the tool, not you. There are no wrong
answers, and you can stop at any time."

**0:30 – 4:00. Citizen task (phone).**
Hand over the phone with `http://<your-lan-ip>:3000/track/inc_001` open.
"A water leak was reported near MG Road, and a crew says it's fixed. Please look at this case and
tell me what you think is happening."
- Watch for: can they find the status, the deadline, and the crew without help?
- Ask: "Is it fixed?" Let them press a button. Note which one they pressed and whether they
  understood what it does.
- Do not explain the rules of the system. Note any question they ask out loud.

**4:00 – 6:30. Operator task (laptop).**
Open `http://<your-lan-ip>:3000` on the laptop.
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
- If a tester gets stuck for more than a minute, note the screen and move on.
- Do not reset the demo between testers unless the page is broken. Each tester starts from
  step 6 of the golden scenario.

## Results (fill only from `GET /feedback/summary`)

Run `curl http://localhost:8001/feedback/summary` after the last tester. Copy the values as they
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
- Never commit a backend `.env` or an API key.
