"""Citizen photos (stored, served, metadata stripped) and report location fields."""
import base64

from sqlalchemy import create_engine, inspect, text

from app import db
from app.engine import photos

from .images import jpeg, png, webp
from .test_rules import BASE, finish_work, report

b64 = lambda raw: base64.b64encode(raw).decode()  # noqa: E731


def post_report(c, photo=None, location=None, **kw):
    body = {"text": kw.get("text", "Water leaking from a pipe"), "category": kw.get("category", "water_leak"),
            "lat": kw.get("lat", BASE[0]), "lng": kw.get("lng", BASE[1]), "reporter": "citizen:Asha"}
    if photo is not None:
        body["photo"] = photo
    if location is not None:
        body["location"] = location
    return c.post("/reports", json=body)


def test_report_photo_is_stored_and_served(client):
    r = post_report(client, photo={"data": b64(jpeg()), "media_type": "image/jpeg"}).json()
    url = r["report"]["photo_url"]
    assert url.startswith("/photos/ph_") and len(url) == len("/photos/ph_") + 16
    got = client.get(url)
    assert got.status_code == 200
    assert got.content == jpeg()
    assert got.headers["content-type"] == "image/jpeg"
    assert got.headers["x-content-type-options"] == "nosniff"
    assert "immutable" in got.headers["cache-control"]
    detail = client.get(f"/incidents/{r['incident']['id']}").json()
    assert detail["reports"][0]["photo_url"] == url
    assert "photo_id" not in detail["reports"][0]


def test_report_without_photo_or_location_has_null_fields(client):
    rep = report(client)["report"]
    assert rep["photo_url"] is None
    assert (rep["location_source"], rep["location_accuracy_m"], rep["location_label"]) == (None, None, None)


def test_jpeg_exif_gps_and_trailing_data_are_stripped(client):
    original = jpeg(exif=True, extras=True, trailing=jpeg(exif=True))
    assert b"GPSLatitude" in original
    url = post_report(client, photo={"data": b64(original), "media_type": "image/jpeg"}).json()["report"]["photo_url"]
    served = client.get(url).content
    for secret in (b"Exif", b"GPSLatitude", b"PhoneX", b"MPF", b"owner: Asha"):
        assert secret not in served, secret
    assert served.startswith(b"\xff\xd8") and served.endswith(b"\xff\xd9")
    assert served.count(b"\xff\xd8") == 1  # the appended second image is gone
    assert b"JFIF" in served and b"ICC_PROFILE" in served  # harmless colour/format data kept
    assert b"\x12\xff\x00\x34\xff\xd0\x56" in served  # pixel data untouched


def test_png_and_webp_metadata_stripped():
    clean_png = photos.strip_metadata(png(text=True), "image/png")
    assert b"tEXt" not in clean_png and b"eXIf" not in clean_png and b"IDAT" in clean_png
    assert clean_png.endswith(b"IEND\xaeB`\x82")
    clean_webp = photos.strip_metadata(webp(exif=True), "image/webp")
    assert b"EXIF" not in clean_webp and b"GPSLatitude" not in clean_webp
    assert int.from_bytes(clean_webp[4:8], "little") == len(clean_webp) - 8
    vp8x_flags = clean_webp[clean_webp.index(b"VP8X") + 8]
    assert vp8x_flags & 0x08 == 0


def test_evidence_photo_is_stored(client):
    inc = report(client)["incident"]["id"]
    finish_work(client, inc)
    r = client.post(f"/incidents/{inc}/evidence", json={
        "kind": "citizen_followup", "supports_resolution": False, "note": "still leaking", "source": "citizen:Asha",
        "photo": {"data": b64(jpeg(exif=True)), "media_type": "image/jpeg"}}).json()
    url = r["evidence"]["photo_url"]
    assert url and b"GPSLatitude" not in client.get(url).content
    ev = client.get(f"/incidents/{inc}").json()["evidence"]
    assert ev[-1]["photo_url"] == url


def test_photo_limits(client):
    big = b"\xff\xd8\xff" + b"\x00" * (5 * 1024 * 1024)
    assert post_report(client, photo={"data": b64(big), "media_type": "image/jpeg"}).status_code == 413
    assert post_report(client, photo={"data": "not base64!!", "media_type": "image/jpeg"}).status_code == 422
    # Declared JPEG but actually HTML: never stored, never served as an image.
    html = b"<html><script>alert(1)</script></html>"
    assert post_report(client, photo={"data": b64(html), "media_type": "image/jpeg"}).status_code == 422
    assert post_report(client, photo={"data": b64(png()), "media_type": "image/jpeg"}).status_code == 422
    assert post_report(client, photo={"data": b64(jpeg()[:-2]), "media_type": "image/jpeg"}).status_code == 422
    assert post_report(client, photo={"data": b64(jpeg()), "media_type": "image/tiff"}).status_code == 422
    assert client.get("/incidents").json() == []  # rejected uploads created nothing


def test_unknown_photo_404(client):
    assert client.get("/photos/ph_0123456789abcdef").status_code == 404
    assert client.get("/photos/../../etc/passwd").status_code == 404
    assert client.get("/photos/rep_001").status_code == 404


def test_reset_wipes_photos_but_keeps_feedback(client):
    url = post_report(client, photo={"data": b64(jpeg()), "media_type": "image/jpeg"}).json()["report"]["photo_url"]
    client.post("/feedback", json={"rating": 4, "role": "citizen", "comment": "photo test"})
    before = client.get("/feedback/summary").json()["count"]
    client.post("/sim/reset")
    assert client.get(url).status_code == 404
    assert client.get("/feedback/summary").json()["count"] == before


def test_location_fields_round_trip(client):
    gps = {"source": "gps", "accuracy_m": 18.5, "label": "Current location"}
    r = post_report(client, location=gps, lat=28.98371, lng=77.09098).json()
    rep = r["report"]
    assert (rep["lat"], rep["lng"]) == (28.98371, 77.09098)
    assert (rep["location_source"], rep["location_accuracy_m"], rep["location_label"]) == ("gps", 18.5, "Current location")
    assert post_report(client, location={"source": "satellite"}).status_code == 422
    assert post_report(client, location={"source": "gps", "accuracy_m": -1}).status_code == 422


def test_citizen_activity_carries_photo_and_location(client):
    r = post_report(client, photo={"data": b64(jpeg()), "media_type": "image/jpeg"},
                    location={"source": "landmark", "accuracy_m": None, "label": "Rishihood University gate"}).json()
    inc = r["incident"]["id"]
    finish_work(client, inc)
    client.post(f"/incidents/{inc}/evidence", json={
        "kind": "citizen_followup", "supports_resolution": True, "note": "fixed", "source": "citizen:Asha",
        "photo": {"data": b64(jpeg()), "media_type": "image/jpeg"}})
    items = {i["kind"]: i for i in client.get("/citizen/activity").json()}
    c, e = items["complaint"], items["evidence"]
    assert c["photo_url"] == r["report"]["photo_url"]
    assert (c["lat"], c["lng"], c["location_source"], c["location_label"]) == (BASE[0], BASE[1], "landmark", "Rishihood University gate")
    assert e["photo_url"].startswith("/photos/ph_")
    assert (e["lat"], e["lng"], e["location_source"]) == (None, None, None)


def test_migration_adds_missing_columns_to_an_old_database(tmp_path):
    """A database created by the previous release (no photo/location columns) is upgraded in place."""
    eng = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with eng.begin() as conn:
        conn.execute(text("CREATE TABLE report (id VARCHAR PRIMARY KEY, text VARCHAR NOT NULL, category VARCHAR NOT NULL, "
                          "lat FLOAT NOT NULL, lng FLOAT NOT NULL, reporter VARCHAR NOT NULL, created_at VARCHAR NOT NULL, "
                          "incident_id VARCHAR)"))
        conn.execute(text("INSERT INTO report VALUES ('rep_001', 'old report', 'pothole', 28.98, 77.09, 'citizen:Ravi', "
                          "'2026-10-27T09:00:00Z', 'inc_001')"))
    added = db.add_missing_columns(eng)
    assert {"report.photo_id", "report.location_source", "report.location_accuracy_m", "report.location_label"} <= set(added)
    cols = {c["name"] for c in inspect(eng).get_columns("report")}
    assert {"photo_id", "location_source", "location_accuracy_m", "location_label"} <= cols
    with eng.begin() as conn:
        row = conn.execute(text("SELECT text, photo_id, location_source FROM report WHERE id = 'rep_001'")).one()
    assert tuple(row) == ("old report", None, None)
    assert db.add_missing_columns(eng) == []  # idempotent on every boot


def test_pin_location_source_accepted(client):
    rep = post_report(client, location={"source": "pin", "accuracy_m": None, "label": "Pinned on the map"}).json()["report"]
    assert (rep["location_source"], rep["location_label"]) == ("pin", "Pinned on the map")
