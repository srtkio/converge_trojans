"""Portal sign-in. Demo-grade: operator codes are checked against seeded SHA-256 hashes; citizens
just give a name and email, and the browser keeps the session. Not production auth."""
import hashlib
import hmac
import json
import re
from pathlib import Path

SEED = Path(__file__).parent / "seed" / "operators.json"
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _operators() -> list[dict]:
    return json.loads(SEED.read_text())


def verify_operator(badge_id: str, access_code: str) -> dict | None:
    """Return the operator's public profile if the badge and code match, else None."""
    digest = hashlib.sha256(access_code.encode()).hexdigest()
    for op in _operators():
        if hmac.compare_digest(op["badge_id"], badge_id.strip()) and hmac.compare_digest(op["code_sha256"], digest):
            return {"badge_id": op["badge_id"], "name": op["name"], "department": op["department"]}
    return None


def valid_email(email: str) -> bool:
    return bool(EMAIL.match(email.strip()))
