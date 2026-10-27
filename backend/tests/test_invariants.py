"""Randomised operation sequences; after every step the core invariants must hold."""
import random

import pytest

from .test_rules import BASE, M_LAT

CATEGORIES = ["pothole", "streetlight", "water_leak", "garbage", "sewage", "other"]
RESOURCES = ["res_roads_1", "res_roads_2", "res_water_1", "res_elec_1", "res_sanit_1", "res_gen_1"]


def random_op(c, rng: random.Random, incidents: list[dict]):
    op = rng.choices(["report", "start", "complete", "evidence", "down", "up", "tick"],
                     weights=[30, 15, 15, 20, 5, 6, 9])[0]
    if op == "report" or not incidents:
        north, east = rng.uniform(-500, 500), rng.uniform(-500, 500)
        c.post("/reports", json={"text": "random report", "category": rng.choice(CATEGORIES),
                                 "lat": BASE[0] + north * M_LAT, "lng": BASE[1] + east * M_LAT,
                                 "reporter": "fuzz"})
        return
    inc = rng.choice(incidents)["id"]
    if op == "start":
        c.post(f"/incidents/{inc}/start")
    elif op == "complete":
        c.post(f"/incidents/{inc}/complete", json={"note": "done"})
    elif op == "evidence":
        c.post(f"/incidents/{inc}/evidence", json={
            "kind": rng.choice(["photo", "sensor", "citizen_followup", "inspector"]),
            "supports_resolution": rng.random() < 0.6, "note": "", "source": "fuzz"})
    elif op == "down":
        c.post(f"/resources/{rng.choice(RESOURCES)}/unavailable")
    elif op == "up":
        c.post(f"/resources/{rng.choice(RESOURCES)}/available")
    else:
        c.post("/sim/tick", params={"minutes": rng.choice([5, 30, 120, 600, 1500])})


def check_invariants(c):
    incidents = {i["id"]: i for i in c.get("/incidents").json()}
    resources = {r["id"]: r for r in c.get("/resources").json()}
    audit = c.get("/audit").json()
    m = c.get("/metrics").json()

    for inc in incidents.values():
        iid, st = inc["id"], inc["status"]
        changes = [a for a in audit if a["incident_id"] == iid and a["to_status"] is not None]
        assert changes and changes[0]["to_status"] == "open"
        for prev, cur in zip(changes, changes[1:]):
            assert cur["from_status"] == prev["to_status"], (iid, prev, cur)
        assert changes[-1]["to_status"] == st, iid

        rid = inc["assigned_resource_id"]
        if rid:
            assert iid in resources[rid]["active_incident_ids"], (iid, rid)
            assert st != "verified_closed"
        if st == "in_progress":
            assert rid, iid
        if st == "pending_verification":
            assert inc["completed_at"], iid
        if st == "verified_closed":
            d = c.get(f"/incidents/{iid}").json()
            done = [a for a in d["audit"] if a["event_type"] == "work_completed"]
            closes = [a for a in d["audit"] if a["event_type"] == "verified_closed"]
            assert done and closes, iid
            # The closing evidence supports resolution and came after the last completion.
            ev = {e["id"]: e for e in d["evidence"]}
            closing = ev[closes[-1]["evidence_ids"][0]]
            assert closing["supports_resolution"] is True
            assert closing["created_at"] >= done[-1]["timestamp"]
        assert inc["deadline"] > inc["created_at"]
        assert inc["report_ids"], iid
        for other in inc["related_incident_ids"]:
            assert iid in incidents[other]["related_incident_ids"]

    for res in resources.values():
        if not res["available"]:
            assert res["active_incident_ids"] == [], res
        for iid in res["active_incident_ids"]:
            assert incidents[iid]["assigned_resource_id"] == res["id"], (res["id"], iid)

    assert m["incidents"] == len(incidents)
    assert m["duplicate_work_orders_avoided"] == m["duplicates_linked"]
    assert sum(len(i["report_ids"]) for i in incidents.values()) == m["reports"]
    assert m["false_closures_caught"] == m["baseline"]["false_closures_accepted"]


@pytest.mark.parametrize("seed", range(12))
def test_random_operation_sequences_keep_invariants(client, seed):
    rng = random.Random(seed)
    incidents: list[dict] = []
    for _ in range(120):
        random_op(client, rng, incidents)
        incidents = client.get("/incidents").json()
        check_invariants(client)
