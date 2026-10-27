#!/usr/bin/env python3
"""Citizen app check (bottom nav, Map tab, map pin, My cases, PWA), on a phone-sized browser.

  1. PWA: the manifest is served and valid, every icon returns a PNG, only the citizen pages
     link it.
  2. Sign-in gate: a fresh visit shows the sign-in form alone (no nav).
  3. Tabs: Report -> My cases -> Map through the bottom nav (aria-current, URLs), browser
     back/forward, and a Map -> Report -> Map round trip: the map comes back with tiles (or the
     offline fallback) and markers, without page errors.
  4. Map pin on the report form: "Adjust on the map", drag the pin with the mouse, tap the map,
     "Use this spot", submit. The request carries location.source "pin" and no email; the backend
     stores location_source "pin" at the dropped spot.
  5. Map tab: tap-to-place + "Report something here" hands the pin to the Report form.
  6. "Me too" from a nearby marker joins the case (report count +1) and it shows in My cases.
  7. My cases shows live status: an operator-side change (API) appears within one poll; the poll
     makes about one GET /incidents per 15 s.
  8. No-ids idle: a fresh /track visit makes no GET /incidents list calls.
  9. Offline map: with tile requests blocked, the Map tab and the pin sheet fall back.
 10. Reduced motion: tabs and sheets work and no animation runs.
 Every citizen page: no horizontal overflow at 390 px, no console errors or page errors.

Needs the backend with golden step 6 data (inc_002 is a joinable pothole near MG Road):
  curl -XPOST "localhost:8000/sim/scenario/golden?step=6"

Usage:
  python3 scripts/e2e_citizen_app.py --base http://localhost:3000 --api http://localhost:8000
  python3 scripts/e2e_citizen_app.py --shots /tmp/shots     # also save phone screenshots
"""

import argparse
import json
import math
import re
import sys
import time
import urllib.request
import uuid

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

CITIZEN_NAME = "Asha App"
CITIZEN_EMAIL = "asha.app@example.com"
STEP_MS = 15_000
POLL_WAIT_S = 22
PILOT = (28.9832, 77.0864)  # Rishihood University gate, GT Road: the first landmark and the map's default centre
TILE_GLOB = re.compile(r"tile\.openstreetmap\.org")


class Check(Exception):
    """A failed assertion; the message says what was expected."""


def log(msg: str) -> None:
    print(msg, flush=True)


def api_get(api: str, path: str):
    with urllib.request.urlopen(api + path, timeout=10) as r:
        return json.loads(r.read())


def api_post(api: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(api + path, data=data, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def metres(a, b) -> float:
    rad = math.radians
    dlat, dlng = rad(b[0] - a[0]), rad(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(rad(a[0])) * math.cos(rad(b[0])) * math.sin(dlng / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


class Phone:
    """One iPhone-sized browser context that records console errors and page errors."""

    def __init__(self, p, browser, *, reduced=False, geo=None, block_tiles=False):
        opts = dict(p.devices["iPhone 13"])
        if reduced:
            opts["reduced_motion"] = "reduce"
        if geo:
            opts["geolocation"] = {"latitude": geo[0], "longitude": geo[1], "accuracy": 20}
            opts["permissions"] = ["geolocation"]
        self.ctx = browser.new_context(**opts)
        self.block_tiles = block_tiles
        if block_tiles:
            self.ctx.route(TILE_GLOB, lambda route: route.abort())
        # Count view transitions the app starts (React calls document.startViewTransition).
        self.ctx.add_init_script(
            """
            window.__vt = 0;
            const s = document.startViewTransition && document.startViewTransition.bind(document);
            if (s) document.startViewTransition = (...a) => { window.__vt += 1; return s(...a); };
            """
        )
        self.page = self.ctx.new_page()
        self.errors: list[str] = []
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e} {(e.stack or '')[:600]}"))
        self.page.on("console", self._console)

    def _console(self, msg) -> None:
        if msg.type != "error":
            return
        if self.block_tiles and ("Failed to load resource" in msg.text or "ERR_FAILED" in msg.text):
            return  # the tiles this test blocks on purpose
        self.errors.append(f"console: {msg.text}")

    def ok(self, where: str) -> None:
        """No horizontal overflow at 390 px and no errors so far."""
        overflow = self.page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        if overflow > 0:
            raise Check(f"{where}: horizontal overflow of {overflow}px at iPhone 13 size")
        if self.errors:
            raise Check(f"{where}: console/page errors: {self.errors}")

    def nav(self):
        return self.page.locator('nav[aria-label="Citizen app"]')

    def tab(self, name: str):
        return self.nav().get_by_role("link", name=re.compile(rf"^{re.escape(name)}"))

    def close(self) -> None:
        self.ctx.close()


def sign_in(ph: Phone, base: str, path: str = "/citizen") -> None:
    page = ph.page
    page.goto(base + path, wait_until="networkidle")
    page.get_by_label("Name").fill(CITIZEN_NAME)
    page.get_by_label("Email").fill(CITIZEN_EMAIL)
    page.get_by_role("button", name="Continue").click()
    try:
        page.get_by_text(f"Hi, {CITIZEN_NAME}").wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("sign-in did not complete") from e
    if page.get_by_text(f"Hi, {CITIZEN_NAME}").count() != 1:
        raise Check("the greeting must appear exactly once")


def go_tab(ph: Phone, name: str, url_suffix: str) -> None:
    ph.tab(name).click()
    try:
        ph.page.wait_for_url(re.compile(re.escape(url_suffix) + r"$"), timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check(f"tapping '{name}' did not open {url_suffix} (at {ph.page.url})") from e
    current = ph.tab(name).get_attribute("aria-current")
    if current != "page":
        raise Check(f"'{name}' tab should have aria-current=page, got {current!r}")


def wait_map(ph: Phone, where: str, allow_fallback: bool = True) -> str:
    """Waits for tiles (or the offline fallback). Returns 'tiles' or 'fallback'."""
    page = ph.page
    deadline = time.time() + STEP_MS / 1000
    while time.time() < deadline:
        if page.locator(".leaflet-tile-loaded:visible").count():
            return "tiles"
        if allow_fallback and page.get_by_text("The map isn't loading").count():
            return "fallback"
        page.wait_for_timeout(250)
    raise Check(f"{where}: the map showed neither tiles nor the offline fallback")


def map_zoom(page) -> int:
    src = page.locator(".leaflet-tile-loaded:visible").first.get_attribute("src") or ""
    m = re.search(r"/(\d+)/\d+/\d+\.png", src)
    return int(m.group(1)) if m else 17


def px_to_deg(lat: float, zoom: int, dx: float, dy: float):
    """Screen pixels to degrees at a Web Mercator zoom (good enough for a ~100 px drag)."""
    deg_per_px = 360 / (256 * 2**zoom)
    return (-dy * deg_per_px * math.cos(math.radians(lat)), dx * deg_per_px)


def drag(page, locator, dx: int, dy: int) -> None:
    box = locator.bounding_box()
    if not box:
        raise Check("the pin is not on screen")
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    steps = 12
    for i in range(1, steps + 1):
        page.mouse.move(x + dx * i / steps, y + dy * i / steps)
        page.wait_for_timeout(16)
    page.mouse.up()


def shot(page, path: str) -> None:
    """Phone screenshot once entrance animations have settled (viewport only: the nav is fixed)."""
    page.wait_for_timeout(900)
    page.screenshot(path=path)


def check_pwa(p, browser, base: str) -> None:
    ctx = browser.new_context()
    req = ctx.request
    r = req.get(f"{base}/manifest.webmanifest")
    if r.status != 200:
        raise Check(f"/manifest.webmanifest returned {r.status}")
    try:
        m = json.loads(r.text())
    except ValueError as e:
        raise Check("the manifest is not valid JSON") from e
    for key, want in {"start_url": "/citizen", "scope": "/", "id": "/citizen", "display": "standalone",
                      "theme_color": "#047857"}.items():
        if m.get(key) != want:
            raise Check(f"manifest {key} should be {want!r}, got {m.get(key)!r}")
    srcs = [i["src"] for i in m.get("icons", [])] + ["/icons/apple-touch-icon.png"]
    purposes = {i.get("purpose", "any") for i in m.get("icons", [])}
    sizes = {i.get("sizes") for i in m.get("icons", [])}
    if "maskable" not in purposes or not {"192x192", "512x512"} <= sizes:
        raise Check(f"manifest needs 192 and 512 icons plus a maskable one, got {m.get('icons')}")
    for src in srcs:
        ir = req.get(base + src)
        if ir.status != 200 or not ir.headers.get("content-type", "").startswith("image/png"):
            raise Check(f"icon {src} returned {ir.status} {ir.headers.get('content-type')}")
    citizen = req.get(f"{base}/citizen").text()
    if 'rel="manifest"' not in citizen or 'name="theme-color"' not in citizen:
        raise Check("/citizen HTML should link the manifest and set theme-color")
    track = req.get(f"{base}/track/inc_001").text()
    if 'rel="manifest"' not in track:
        raise Check("/track HTML should link the manifest")
    for path in ("/", "/operator"):
        if 'rel="manifest"' in req.get(base + path).text():
            raise Check(f"{path} must not link the citizen manifest")
    ctx.close()
    log(f"PWA: OK (manifest valid, {len(srcs)} icons 200 image/png, linked only from citizen pages)")


def check_gate(p, browser, base: str) -> None:
    ph = Phone(p, browser)
    ph.page.goto(f"{base}/citizen/map", wait_until="networkidle")
    if ph.page.get_by_label("Name").count() != 1:
        raise Check("a fresh visit should show exactly one Name field (the sign-in form)")
    if ph.nav().count():
        raise Check("the bottom nav must not show on the sign-in screen")
    if ph.page.get_by_text("Add to Home Screen").count():
        raise Check("the install hint must not show on the sign-in screen")
    ph.ok("sign-in gate")
    ph.close()
    log("gate: OK (sign-in alone, no nav, no install hint)")


def check_tabs_and_pin(p, browser, base: str, api: str, shots: str | None, marker: str) -> str:
    ph = Phone(p, browser)
    page = ph.page
    sign_in(ph, base)
    if ph.nav().get_by_role("link").count() != 3:
        raise Check("the bottom nav should have 3 links")
    if ph.tab("Report").get_attribute("aria-current") != "page":
        raise Check("Report should be the current tab after sign-in")
    ph.ok("/citizen")
    if shots:
        shot(page, f"{shots}/01-report.png")

    go_tab(ph, "My cases", "/citizen/cases")
    page.get_by_role("heading", name="My cases", exact=True).wait_for(timeout=STEP_MS)
    page.get_by_text("No cases yet").wait_for(timeout=STEP_MS)
    ph.ok("/citizen/cases (empty)")

    go_tab(ph, "Map", "/citizen/map")
    got = wait_map(ph, "/citizen/map")
    if got == "tiles":
        page.locator(".leaflet-marker-icon").first.wait_for(timeout=STEP_MS)
    ph.ok("/citizen/map")
    page.go_back()
    page.wait_for_url(re.compile(r"/citizen/cases$"), timeout=STEP_MS)
    page.go_forward()
    page.wait_for_url(re.compile(r"/citizen/map$"), timeout=STEP_MS)
    # Map -> Report -> Map through the nav: the hidden map screen must come back working.
    go_tab(ph, "Report", "/citizen")
    go_tab(ph, "Map", "/citizen/map")
    got = wait_map(ph, "/citizen/map after a round trip")
    if got == "tiles":
        size = page.locator(".cz-map:visible").first.bounding_box()
        if not size or size["width"] < 200 or size["height"] < 200:
            raise Check(f"map box has no size after a round trip: {size}")
        if page.locator(".leaflet-marker-icon:visible").count() < 2:
            raise Check("map lost its markers after a round trip (expected the pin and nearby issues)")
    ph.ok("/citizen/map round trip")
    vt = page.evaluate("window.__vt || 0")
    log(f"tabs: OK (nav, aria-current, back/forward, map round trip: {got}; {vt} view transitions started)")

    # --- Map tab: tap to place the pin, hand it to the Report form. ---
    if got == "tiles":
        box = page.locator(".cz-map:visible").first.bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.25, box["y"] + box["height"] * 0.3)
        page.wait_for_timeout(200)
    if shots:
        shot(page, f"{shots}/03-map.png")
    page.get_by_role("button", name="Report something here").click()
    page.wait_for_url(re.compile(r"/citizen$"), timeout=STEP_MS)
    try:
        page.get_by_text("Pinned on the map", exact=True).wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("'Report something here' did not hand the pin to the Report form") from e
    page.get_by_role("button", name="Undo pin").click()
    page.get_by_role("button", name="Adjust on the map").wait_for(timeout=STEP_MS)
    log("map tab: OK (tap-to-place, 'Report something here' pre-fills the pin, Undo)")

    # --- Report form: adjust on the map, drag, tap, use this spot, submit. ---
    page.get_by_role("button", name="Adjust on the map").click()
    sheet = page.get_by_role("dialog", name="Adjust the spot")
    sheet.wait_for(timeout=STEP_MS)
    got = wait_map(ph, "pin sheet", allow_fallback=False)
    page.wait_for_timeout(400)  # the sheet's entrance and the recentre settle
    ph.ok("pin sheet")
    if shots:
        shot(page, f"{shots}/05-pin-sheet.png")
    pin = sheet.locator('.leaflet-marker-icon[title="Your spot"]')
    zoom = map_zoom(page)
    start = PILOT  # the form's default landmark: Rishihood University gate
    dx, dy = 70, -90
    drag(page, pin, dx, dy)
    page.wait_for_timeout(400)
    dlat, dlng = px_to_deg(start[0], zoom, dx, dy)
    expect = (start[0] + dlat, start[1] + dlng)
    sheet.get_by_role("button", name="Use this spot").click()
    sheet.wait_for(state="detached", timeout=STEP_MS)
    page.get_by_text("Pinned on the map", exact=True).wait_for(timeout=STEP_MS)
    ph.ok("report form with a pin")

    text = f"Streetlight out at the pinned spot {marker}"
    page.get_by_placeholder(re.compile(r"e\.g\. Water leaking from a pipe near the (university gate|metro)")).fill(text)
    with page.expect_request(lambda r: r.url.endswith("/reports") and r.method == "POST") as req_info:
        page.get_by_role("button", name="Submit report").click()
    body = req_info.value.post_data or ""
    sent = json.loads(body)
    loc = sent.get("location") or {}
    if loc.get("source") != "pin" or loc.get("label") != "Pinned on the map" or loc.get("accuracy_m") is not None:
        raise Check(f"pinned report should send location source 'pin', got {loc}")
    if sent.get("reporter") != "citizen:Asha":
        raise Check(f"reporter should be the first name only, got {sent.get('reporter')!r}")
    if CITIZEN_EMAIL in body or "email" in body.lower():
        raise Check("the report body must never contain the email")
    if not -180 <= sent["lng"] <= 180:
        raise Check(f"lng out of range: {sent['lng']}")
    off = metres((sent["lat"], sent["lng"]), expect)
    if off > 25:
        raise Check(f"pinned spot {sent['lat']},{sent['lng']} is {off:.0f} m from the drop point {expect}")
    track = page.get_by_role("link", name="Track your case")
    track.wait_for(timeout=STEP_MS)
    case_id = (track.get_attribute("href") or "").rsplit("/", 1)[-1]
    detail = api_get(api, f"/incidents/{case_id}")
    mine = [r for r in detail["reports"] if r["text"] == text]
    if not mine or mine[0].get("location_source") != "pin":
        raise Check(f"backend should store location_source 'pin' for {case_id}, got {mine}")
    stored = (mine[0]["lat"], mine[0]["lng"])
    if metres(stored, expect) > 25:
        raise Check(f"backend stored {stored}, {metres(stored, expect):.0f} m from the drop point")
    ph.ok("report submitted")
    log(f"pin report: OK ({case_id}; sent source 'pin', {off:.0f} m from the drop at zoom {zoom}; backend location_source 'pin')")

    # --- Me too from a nearby marker on the Map tab. ---
    go_tab(ph, "Map", "/citizen/map")
    got = wait_map(ph, "/citizen/map before Me too")
    joinable = [i for i in api_get(api, "/incidents") if i["status"] != "verified_closed" and not i["completed_at"]
                and i["id"] != case_id and metres((i["lat"], i["lng"]), PILOT) <= 1500]
    if not joinable:
        raise Check("no joinable incident near MG Road: seed golden step 6 first")
    target = joinable[0]
    before = len(target["report_ids"])
    if got == "tiles":
        page.locator(f'.leaflet-marker-icon[title^="{target["title"][:20]}"]').first.evaluate("el => el.click()")
    else:
        page.get_by_role("button", name=target["title"][:20]).first.click()
    sheet = page.get_by_role("dialog")
    sheet.wait_for(timeout=STEP_MS)
    sheet.get_by_text(target["title"]).first.wait_for(timeout=STEP_MS)
    page.wait_for_timeout(350)
    ph.ok("nearby sheet")
    if shots:
        shot(page, f"{shots}/04-map-sheet.png")
    sheet.get_by_role("button", name="Me too").click()
    try:
        sheet.get_by_text(re.compile(r"You \+ \d+ neighbou?rs? → 1 case")).wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("'Me too' did not confirm joining the case") from e
    after = len(api_get(api, f"/incidents/{target['id']}")["incident"]["report_ids"])
    if after != before + 1:
        raise Check(f"'Me too' should add one report to {target['id']}: {before} -> {after}")
    if shots:
        shot(page, f"{shots}/04b-map-sheet-joined.png")
    sheet.get_by_role("button", name="Close").click()
    sheet.wait_for(state="detached", timeout=STEP_MS)
    ph.ok("after Me too")
    log(f"me too: OK ({target['id']} reports {before} -> {after})")

    # --- My cases: both cases listed, live status within one poll. ---
    list_calls: list[float] = []
    page.on("request", lambda r: list_calls.append(time.time())
            if r.method == "GET" and re.search(r"/incidents$", r.url) else None)
    go_tab(ph, "My cases", "/citizen/cases")
    for cid in (case_id, target["id"]):
        try:
            page.locator(f'a[href="/track/{cid}"]').first.wait_for(timeout=STEP_MS)
        except PlaywrightTimeout as e:
            raise Check(f"My cases does not list {cid}") from e
    row = page.locator(f'a[href="/track/{case_id}"]').first
    status_el = row.locator("[data-status]")
    before_status = status_el.get_attribute("data-status")
    if shots:
        shot(page, f"{shots}/02-my-cases.png")
    # Operator side moves the case forward.
    if before_status == "assigned":
        api_post(api, f"/incidents/{case_id}/start")
    else:
        api_post(api, f"/incidents/{case_id}/complete", {"note": "e2e"})
    want = api_get(api, f"/incidents/{case_id}")["incident"]["status"]
    t0 = time.time()
    list_calls.clear()
    try:
        page.locator(f'a[href="/track/{case_id}"] [data-status="{want}"]').wait_for(timeout=POLL_WAIT_S * 1000)
    except PlaywrightTimeout as e:
        raise Check(f"My cases did not show {case_id} moving {before_status} -> {want} within {POLL_WAIT_S}s") from e
    took = time.time() - t0
    page.wait_for_timeout(max(0, (POLL_WAIT_S - took)) * 1000)
    window = time.time() - t0
    if len(list_calls) > math.ceil(window / 15) + 1:
        raise Check(f"My cases polled GET /incidents {len(list_calls)} times in {window:.0f}s (expected ~1 per 15s)")
    ph.ok("/citizen/cases (live)")
    log(f"my cases: OK ({case_id} {before_status} -> {want} in {took:.1f}s; {len(list_calls)} list calls in {window:.0f}s)")

    # --- The case page inside the app. ---
    row.click()
    page.wait_for_url(re.compile(rf"/track/{case_id}$"), timeout=STEP_MS)
    page.get_by_role("heading", name="Is it fixed?").wait_for(timeout=STEP_MS)
    if ph.tab("My cases").get_attribute("aria-current") != "true":
        raise Check("on a case page, the My cases tab should be marked aria-current=true")
    page.get_by_text("Reported at a spot pinned on the map").wait_for(timeout=STEP_MS)
    ph.ok(f"/track/{case_id}")
    if shots:
        shot(page, f"{shots}/06-track.png")
    log("track page in the app: OK (nav, pinned-spot line)")
    ph.close()
    return case_id


def check_idle(p, browser, base: str) -> None:
    ph = Phone(p, browser)
    calls: list[str] = []
    ph.page.on("request", lambda r: calls.append(r.url) if r.method == "GET" and re.search(r"/incidents$", r.url) else None)
    ph.page.goto(f"{base}/track/inc_001", wait_until="networkidle")
    ph.page.get_by_role("heading", name="Is it fixed?").wait_for(timeout=STEP_MS)
    ph.page.wait_for_timeout(2500)
    if calls:
        raise Check(f"a device with no cases should not poll GET /incidents, saw {calls}")
    if ph.page.get_by_text("Add to Home Screen").count():
        raise Check("the install hint must not show on /track")
    ph.ok("/track/inc_001 (fresh)")
    ph.close()
    log("no-ids idle: OK (fresh /track makes no list calls)")


def check_offline_map(p, browser, base: str) -> None:
    ph = Phone(p, browser, block_tiles=True)
    sign_in(ph, base, "/citizen/map")
    page = ph.page
    try:
        page.get_by_text("The map isn't loading right now").wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("with tiles blocked, the Map tab should fall back to its list") from e
    if page.get_by_role("heading", name=re.compile(r"nearby$|Nothing open nearby")).count() != 1:
        raise Check("the nearby list should stay as the fallback")
    ph.ok("/citizen/map offline")
    go_tab(ph, "Report", "/citizen")
    page.get_by_role("button", name="Adjust on the map").click()
    try:
        page.get_by_text("The map isn't loading. Pick a nearby place instead.").wait_for(timeout=STEP_MS)
    except PlaywrightTimeout as e:
        raise Check("with tiles blocked, the pin sheet should close back to the landmark list") from e
    if page.get_by_role("dialog").count():
        raise Check("the pin sheet should close when the map can't load")
    ph.ok("/citizen offline pin sheet")
    ph.close()
    log("offline map: OK (Map tab list fallback, pin sheet falls back to landmarks)")


def running_animations(page) -> int:
    return page.evaluate(
        "document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity).length"
    )


def check_reduced_motion(p, browser, base: str) -> None:
    ph = Phone(p, browser, reduced=True)
    page = ph.page
    sign_in(ph, base)
    steps = []
    for name, url in (("My cases", "/citizen/cases"), ("Map", "/citizen/map"), ("Report", "/citizen")):
        go_tab(ph, name, url)
        page.wait_for_timeout(60)
        steps.append((name, running_animations(page)))
    go_tab(ph, "Map", "/citizen/map")
    wait_map(ph, "reduced-motion map")
    nearby = page.locator("section[aria-labelledby=nearby-list-heading] button").first
    if nearby.count():
        nearby.click()
        page.get_by_role("dialog").wait_for(timeout=STEP_MS)
        steps.append(("sheet open", running_animations(page)))
        page.get_by_role("dialog").get_by_role("button", name="Close").click()
        try:
            page.get_by_role("dialog").wait_for(state="detached", timeout=2000)
        except PlaywrightTimeout as e:
            raise Check("under reduced motion the sheet must close at once (no animationend)") from e
    go_tab(ph, "Report", "/citizen")
    page.get_by_role("button", name="Adjust on the map").click()
    page.get_by_role("dialog", name="Adjust the spot").wait_for(timeout=STEP_MS)
    steps.append(("pin sheet", running_animations(page)))
    page.get_by_role("dialog").get_by_role("button", name="Cancel").click()
    try:
        page.get_by_role("dialog").wait_for(state="detached", timeout=2000)
    except PlaywrightTimeout as e:
        raise Check("under reduced motion the pin sheet must close at once") from e
    moving = [s for s in steps if s[1]]
    if moving:
        raise Check(f"animations running under reduced motion: {moving}")
    ph.ok("reduced motion")
    ph.close()
    log(f"reduced motion: OK (no running animations across {len(steps)} steps; sheets close at once)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default="http://localhost:3000", help="frontend URL (default: %(default)s)")
    parser.add_argument("--api", default="http://localhost:8000", help="backend URL (default: %(default)s)")
    parser.add_argument("--shots", default=None, help="directory for phone screenshots (optional)")
    parser.add_argument("--headed", action="store_true", help="show the browser windows")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    api = args.api.rstrip("/")
    marker = uuid.uuid4().hex[:6]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        try:
            check_pwa(p, browser, base)
            check_gate(p, browser, base)
            check_tabs_and_pin(p, browser, base, api, args.shots, marker)
            check_idle(p, browser, base)
            check_offline_map(p, browser, base)
            check_reduced_motion(p, browser, base)
        except Check as e:
            log(f"FAIL: {e}")
            return 1
        except PlaywrightError as e:
            log(f"FAIL: browser error: {e}")
            return 1
        finally:
            browser.close()

    log("PASS: citizen app shell, map pin, My cases and PWA checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
