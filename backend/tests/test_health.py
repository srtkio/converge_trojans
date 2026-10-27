from fastapi.testclient import TestClient

from app.main import app


def test_health():
    assert TestClient(app).get("/health").json() == {"ok": True}


def test_cors_allows_configured_frontend():
    r = TestClient(app).options("/incidents", headers={
        "Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_origin_regex(monkeypatch):
    import importlib

    import app.main as main_mod

    monkeypatch.setenv("CONVERGE_CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")
    mod = importlib.reload(main_mod)
    try:
        r = TestClient(mod.app).options("/incidents", headers={
            "Origin": "https://converge-abc.vercel.app", "Access-Control-Request-Method": "GET"})
        assert r.headers.get("access-control-allow-origin") == "https://converge-abc.vercel.app"
        r = TestClient(mod.app).options("/incidents", headers={
            "Origin": "https://evil.example.com", "Access-Control-Request-Method": "GET"})
        assert "access-control-allow-origin" not in r.headers
    finally:
        monkeypatch.delenv("CONVERGE_CORS_ORIGIN_REGEX")
        importlib.reload(main_mod)
