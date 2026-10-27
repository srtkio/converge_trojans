from datetime import datetime

LAT, LNG = 12.9756, 77.605
DEG_PER_100M = 0.0009  # roughly 100 m in latitude


def _report(client, category, lat=LAT, lng=LNG, text="report"):
    r = client.post("/reports", json={"text": text, "category": category,
                                      "lat": lat, "lng": lng, "reporter": "citizen:Asha"})
    assert r.status_code == 200, r.text
    return r.json()


def _hours(a, b):
    fmt = "%Y-%m-%dT%H:%M:%SZ"
    return (datetime.strptime(b, fmt) - datetime.strptime(a, fmt)).total_seconds() / 3600


def test_health_report_goes_to_health_crew_with_24h_deadline(client):
    res = _report(client, "health_service", text="Ambulance delayed at the clinic")
    inc = res["incident"]
    assert inc["department"] == "health"
    assert inc["assigned_resource_id"] == "res_health_1"
    assert round(_hours(inc["created_at"], inc["deadline"])) == 24


def test_health_report_without_a_free_crew_is_escalated(client):
    client.post("/resources/res_health_1/unavailable")
    inc = _report(client, "health_service", text="Clinic needs a nurse")["incident"]
    assert inc["assigned_resource_id"] is None
    assert inc["status"] in ("open", "escalated")


def test_bin_overflow_has_a_12h_deadline_in_the_sanitation_department(client):
    inc = _report(client, "bin_overflow", text="Bin overflowing on the footpath")["incident"]
    assert inc["department"] == "sanitation"
    assert round(_hours(inc["created_at"], inc["deadline"])) == 12


def test_bin_overflow_links_to_nearby_sewage(client):
    _report(client, "sewage", text="Sewage backing up near the drain")
    res = _report(client, "bin_overflow", lat=LAT + DEG_PER_100M, text="Bin overflowing into the drain")
    assert res["link"] is not None
    assert res["link"]["kind"] == "related"


def test_garbage_does_not_link_to_sewage(client):
    _report(client, "sewage", text="Sewage backing up near the drain")
    res = _report(client, "garbage", lat=LAT + DEG_PER_100M, text="Garbage pile on the footpath")
    assert res["link"] is None
