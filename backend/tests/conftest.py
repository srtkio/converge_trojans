import os

os.environ["CONVERGE_DB_URL"] = "sqlite://"
os.environ["CONVERGE_LLM"] = "off"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        assert c.post("/sim/reset").json() == {"ok": True}
        yield c
