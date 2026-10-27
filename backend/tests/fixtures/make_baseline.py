"""Records the scenario outputs used by test_trust_roles.test_scenarios_unchanged_vs_main.

The committed scenario_baseline.json was generated from origin/main BEFORE the trust/roles change.
Do not regenerate it to make that test pass: the point is to prove the outputs did not change.
Usage (from backend/): python3 tests/fixtures/make_baseline.py tests/fixtures/scenario_baseline.json
"""
import json
import os
import sys

os.environ["CONVERGE_DB_URL"] = "sqlite://"
os.environ["CONVERGE_LLM"] = "off"
sys.path.insert(0, os.getcwd())

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

out = {}
with TestClient(app) as c:
    for name in ("golden", "rootcause", "city"):
        c.post("/sim/reset")
        r = c.post(f"/sim/scenario/{name}").json()
        out[name] = {"run": r, "incidents": c.get("/incidents").json(), "metrics": c.get("/metrics").json()}
with open(sys.argv[1], "w") as f:
    json.dump(out, f, indent=1, sort_keys=True)
print({k: len(v["incidents"]) for k, v in out.items()})
