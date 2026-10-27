#!/usr/bin/env python3
"""End-to-end demo check for CONVERGE, driven through the browser with Playwright.

What it does, against a running frontend and backend:
  1. Sign in to the operator dashboard (demo credentials) if the sign-in form appears.
  2. v1 "Verified loop": Reset, then Next step until step 10. Assert the naive-vs-CONVERGE table.
  3. v2 "Root cause": Reset, then Next step until step 8. Assert the crew-visits row too.
  4. Open /track/inc_001 at iPhone 13 size. Assert no horizontal overflow and no console errors.

Exits 0 when everything passes, 1 on the first failure.

Usage:
  python3 scripts/e2e.py                       # frontend on :3000
  python3 scripts/e2e.py --base http://localhost:3002
  python3 scripts/e2e.py --headed              # watch it run

Requires: pip install playwright && playwright install chromium
"""

import argparse
import re
import sys

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

V1_STEPS = 10
V2_STEPS = 8
DEMO_BADGE = "OPS-WTR-01"
DEMO_CODE = "water-demo-2026"
TIMEOUT_MS = 15_000


class Check(Exception):
    """A failed assertion. The message says what was expected and what was shown."""


def log(msg: str) -> None:
    print(msg, flush=True)


def sign_in_if_needed(page, base: str, dashboard_path: str) -> None:
    page.goto(base + dashboard_path, wait_until="networkidle")
    if page.get_by_label("Badge ID").count():
        page.get_by_label("Badge ID").fill(DEMO_BADGE)
        page.get_by_label("Access code").fill(DEMO_CODE)
        page.get_by_role("button", name="Sign in").click()
    try:
        page.get_by_role("button", name="Reset").wait_for(timeout=TIMEOUT_MS)
    except PlaywrightTimeout as e:
        raise Check(f"dashboard did not load at {base + dashboard_path}") from e
    log(f"signed in / dashboard ready at {base + dashboard_path}")


def select_scenario(page, label: str) -> None:
    page.get_by_role("button", name=label).click()


def reset(page) -> None:
    page.get_by_role("button", name="Reset").click()
    # Step 0 means nothing has run yet. The step line disappears until the first Next step.
    page.get_by_text("Press Next step").wait_for(timeout=TIMEOUT_MS)


def run_to(page, target: int) -> None:
    for n in range(1, target + 1):
        page.get_by_role("button", name="Next step →").click()
        try:
            page.get_by_text(f"Step {n}:", exact=False).first.wait_for(timeout=TIMEOUT_MS)
        except PlaywrightTimeout as e:
            raise Check(f"stepper did not reach step {n} of {target}") from e
    log(f"reached step {target}")


def metrics_row(page, label: str) -> tuple[str, str]:
    """Return (naive cell, CONVERGE cell) text for one row of the comparison table."""
    row = page.locator("tr", has=page.locator("td", has_text=re.compile(rf"^{re.escape(label)}$")))
    try:
        row.first.wait_for(timeout=TIMEOUT_MS)
    except PlaywrightTimeout as e:
        raise Check(f"table row '{label}' not found") from e
    cells = row.first.locator("td")
    return cells.nth(1).inner_text().strip(), cells.nth(2).inner_text().strip()


def expect_cell(label: str, got: str, want_prefix: str) -> None:
    if not got.startswith(want_prefix):
        raise Check(f"{label}: expected to start with '{want_prefix}', got '{got}'")


def check_v1(page) -> None:
    select_scenario(page, "v1 · Verified loop")
    reset(page)
    run_to(page, V1_STEPS)

    naive, converge = metrics_row(page, "Work orders")
    expect_cell("v1 work orders (naive)", naive, "3")
    expect_cell("v1 work orders (CONVERGE)", converge, "2")
    if "duplicate" not in converge:
        raise Check(f"v1 work orders (CONVERGE) should note the avoided duplicate, got '{converge}'")

    naive, converge = metrics_row(page, "False closures accepted")
    expect_cell("v1 false closures (naive)", naive, "1")
    expect_cell("v1 false closures (CONVERGE)", converge, "0")
    if "caught" not in converge:
        raise Check(f"v1 false closures (CONVERGE) should show a caught closure, got '{converge}'")
    log("v1 table: OK (work orders 3 vs 2, false closures accepted 1 vs 0, 1 caught)")


def check_v2(page) -> None:
    select_scenario(page, "v2 · Root cause")
    reset(page)
    run_to(page, V2_STEPS)

    naive, converge = metrics_row(page, "Crew visits")
    expect_cell("v2 crew visits (naive)", naive, "3")
    expect_cell("v2 crew visits (CONVERGE)", converge, "1")
    if "shared root cause" not in converge:
        raise Check(f"v2 crew visits (CONVERGE) should show the saved visits, got '{converge}'")

    naive, converge = metrics_row(page, "False closures accepted")
    expect_cell("v2 false closures (naive)", naive, "0")
    log("v2 table: OK (crew visits 3 vs 1, 2 saved)")


def check_track_page(p, browser, base: str) -> None:
    device = browser.new_context(**p.devices["iPhone 13"])
    page = device.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    def on_console(msg) -> None:
        if msg.type == "error":
            errors.append(msg.text)

    page.on("console", on_console)

    page.goto(f"{base}/track/inc_001", wait_until="networkidle")
    try:
        page.get_by_role("heading", name="Is it fixed?").wait_for(timeout=TIMEOUT_MS)
    except PlaywrightTimeout as e:
        raise Check("/track/inc_001 did not render 'Is it fixed?'") from e

    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    if overflow > 0:
        raise Check(f"/track/inc_001 has horizontal overflow of {overflow}px at iPhone 13 size")
    if errors:
        raise Check(f"/track/inc_001 logged console errors: {errors}")
    log("track page at iPhone 13: OK (no overflow, no console errors)")
    device.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default="http://localhost:3000", help="frontend URL (default: %(default)s)")
    parser.add_argument("--dashboard-path", default="/operator",
                        help="where the operator dashboard lives (default: %(default)s)")
    parser.add_argument("--headed", action="store_true", help="show the browser window")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        try:
            desktop = browser.new_context(viewport={"width": 1440, "height": 900})
            page = desktop.new_page()
            sign_in_if_needed(page, base, args.dashboard_path)
            check_v1(page)
            check_v2(page)
            check_track_page(p, browser, base)
        except Check as e:
            log(f"FAIL: {e}")
            return 1
        except PlaywrightError as e:
            log(f"FAIL: browser error: {e}")
            return 1
        finally:
            browser.close()

    log("PASS: all checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
