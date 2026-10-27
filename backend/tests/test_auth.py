from app.auth import verify_operator, valid_email


def test_operator_with_correct_badge_and_code_is_verified(client):
    r = client.post("/auth/operator", json={"badge_id": "OPS-WTR-01", "access_code": "water-demo-2026"})
    assert r.status_code == 200
    assert r.json() == {"badge_id": "OPS-WTR-01", "name": "Water Dept Officer", "department": "water",
                        "role": "officer"}


def test_operator_with_wrong_code_is_refused(client):
    r = client.post("/auth/operator", json={"badge_id": "OPS-WTR-01", "access_code": "guess"})
    assert r.status_code == 401


def test_unknown_badge_is_refused_even_with_a_valid_code(client):
    r = client.post("/auth/operator", json={"badge_id": "OPS-XXX-99", "access_code": "water-demo-2026"})
    assert r.status_code == 401


def test_code_from_another_department_does_not_work(client):
    r = client.post("/auth/operator", json={"badge_id": "OPS-RDS-01", "access_code": "water-demo-2026"})
    assert r.status_code == 401


def test_citizen_login_normalises_email(client):
    r = client.post("/auth/citizen", json={"name": " Asha ", "email": " Asha@Example.COM "})
    assert r.json() == {"name": "Asha", "email": "asha@example.com"}


def test_citizen_login_rejects_bad_email(client):
    assert client.post("/auth/citizen", json={"name": "Asha", "email": "not-an-email"}).status_code == 422


def test_email_helper():
    assert valid_email("a@b.co")
    assert not verify_operator("OPS-WTR-01", "")
