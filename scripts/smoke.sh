#!/usr/bin/env bash
# Smoke test for the CONVERGE golden scenario.
# Runs the 10-step demo against a running backend and asserts the final /metrics.
#
# Usage: scripts/smoke.sh [base_url]
#   base_url defaults to $CONVERGE_URL, then http://localhost:8000.
#   On this machine port 8000 belongs to another project, so use:
#     CONVERGE_URL=http://localhost:8001 scripts/smoke.sh
set -euo pipefail

BASE="${1:-${CONVERGE_URL:-http://localhost:8000}}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# Backend must be up before we start.
curl -fsS "$BASE/health" >/dev/null || fail "backend not reachable at $BASE (start it with uvicorn)"

# Run every golden step. Starting from step 1 resets the simulation first.
curl -fsS -X POST "$BASE/sim/scenario/golden" >/dev/null || fail "golden scenario request failed"

METRICS=$(curl -fsS "$BASE/metrics") || fail "could not fetch /metrics"

# Assert the final numbers the demo promises.
echo "$METRICS" | python3 -c '
import json, sys

m = json.load(sys.stdin)
expected = {
    "duplicate_work_orders_avoided": 1,
    "false_closures_caught": 1,
    "verified_closures": 1,
    "sla_breaches": 1,
}
failures = [
    f"{key}: expected {want}, got {m.get(key)}"
    for key, want in expected.items()
    if m.get(key) != want
]
if failures:
    print("FAIL: metrics mismatch", file=sys.stderr)
    for line in failures:
        print("  " + line, file=sys.stderr)
    sys.exit(1)
print("PASS: golden scenario metrics as expected")
print(json.dumps({k: m[k] for k in expected}, indent=2))
' || fail "metrics did not match the golden scenario"
