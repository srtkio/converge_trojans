#!/usr/bin/env python3
"""Citizen → operator visibility check, driven through two browsers.

  1. Citizen signs in at /citizen and files a complaint with a unique marker.
  2. Citizen opens the case from the "Track your case" link, adds a note, answers "Still broken".
  3. Operator signs in at /operator (demo badge) in a separate browser.
  4. Within 20 seconds the operator's Citizen activity panel must show the complaint and the
     evidence, with the citizen's first name only. The email must not appear anywhere on the page.

Exits 0 on pass, 1 on the first failure.

Usage:
  python3 scripts/e2e_citizen_flow.py                        # frontend on :3000
  python3 scripts/e2e_citizen_flow.py --base http://localhost:3005
"""

import argparse
import re
import sys
import uuid

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

DEMO_BADGE = "OPS-WTR-01"
DEMO_CODE = "water-demo-2026"
CITIZEN_NAME = "Asha Test"
CITIZEN_EMAIL = "asha.test@example.com"
STEP_MS = 15_000
INBOX_MS = 20_000


class Check(Exception):
    """A failed assertion; the message says what was expected."""


def log(msg: str) -> None:
    print(msg, flush=True)


def citizen_files_complaint(page, base: str, marker: str) -> str:
    page.goto(f"{base}/citizen", wait_until="networkidle")
    page.get_by_label("Name").fill(CITIZEN_NAME)
    page.get_by_label("Email").fill(CITIZEN_EMAIL)
    page.get_by_role("button", name="Continue").click()
    try:
        page.get_by_text(f"Hi, {CITIZEN_NAME}").wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("citizen sign-in did not complete") from e

    page.get_by_placeholder("e.g. Water leaking from a pipe near the metro").fill(
        f"Water leaking by the bus stop {marker}")
    page.get_by_role("button", name="Submit report").click()
    track = page.get_by_role("link", name="Track your case")
    try:
        track.wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("the citizen's report did not produce a 'Track your case' link") from e
    href = track.get_attribute("href") or ""
    log(f"citizen filed a complaint; case link {href}")
    return href


def citizen_answers_still_broken(page, base: str, track_href: str, marker: str) -> None:
    page.goto(base + track_href, wait_until="networkidle")
    try:
        page.get_by_role("heading", name="Is it fixed?").wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("track page did not render 'Is it fixed?'") from e
    page.get_by_label("Add a note").fill(f"Still wet near the stop {marker}")
    page.get_by_role("button", name="Still broken").click()
    try:
        page.get_by_text("Thanks. Your answer is recorded").wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("citizen's 'Still broken' answer was not accepted") from e
    log("citizen answered 'Still broken' with a note")


def operator_sees(page, base: str, marker: str) -> None:
    page.goto(f"{base}/operator", wait_until="networkidle")
    if page.get_by_label("Badge ID").count():
        page.get_by_label("Badge ID").fill(DEMO_BADGE)
        page.get_by_label("Access code").fill(DEMO_CODE)
        page.get_by_role("button", name="Sign in").click()
    try:
        # The citizen inbox lives in the Notifications tab of the operator dashboard.
        notifications = page.get_by_role("tab", name=re.compile(r"^Notifications"))
        notifications.wait_for(timeout=STEP_MS)
        notifications.click()
        page.get_by_role("heading", name="Citizen activity").wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("operator dashboard with the Citizen activity panel did not load") from e

    complaint = page.get_by_text(f"Water leaking by the bus stop {marker}")
    evidence = page.get_by_text(f"Still wet near the stop {marker}")
    try:
        complaint.first.wait_for(timeout=INBOX_MS)
    except PlaywrightTimeout as e:
        raise Check("operator inbox never showed the citizen's complaint") from e
    try:
        evidence.first.wait_for(timeout=INBOX_MS)
    except PlaywrightTimeout as e:
        raise Check("operator inbox never showed the citizen's evidence note") from e

    inbox_text = page.locator("section[aria-labelledby=inbox-heading]").inner_text()
    first = CITIZEN_NAME.split()[0]
    if first not in inbox_text:
        raise Check(f"operator inbox does not show the citizen's first name '{first}'")
    if CITIZEN_NAME in inbox_text:
        raise Check("operator inbox shows the citizen's full name; only the first name may appear")
    body_text = page.inner_text("body")
    if CITIZEN_EMAIL in body_text:
        raise Check("the citizen's email appears on the operator page; it must never leave the citizen's browser")
    log("operator inbox shows the complaint, the evidence note, and the first name only (no email)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default="http://localhost:3000", help="frontend URL (default: %(default)s)")
    parser.add_argument("--headed", action="store_true", help="show the browser windows")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    marker = uuid.uuid4().hex[:6]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        try:
            citizen_ctx = browser.new_context(**p.devices["iPhone 13"])
            citizen_page = citizen_ctx.new_page()
            citizen_errors: list[str] = []
            citizen_page.on("pageerror", lambda e: citizen_errors.append(str(e)))

            track_href = citizen_files_complaint(citizen_page, base, marker)
            citizen_answers_still_broken(citizen_page, base, track_href, marker)
            if citizen_errors:
                raise Check(f"citizen pages raised errors: {citizen_errors}")

            operator_ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            operator_sees(operator_ctx.new_page(), base, marker)
        except Check as e:
            log(f"FAIL: {e}")
            return 1
        except PlaywrightError as e:
            log(f"FAIL: browser error: {e}")
            return 1
        finally:
            browser.close()

    log("PASS: citizen complaint and evidence are visible to the operator")
    return 0


if __name__ == "__main__":
    sys.exit(main())
