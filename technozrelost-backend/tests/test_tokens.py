"""M2 P2 тикет 01 — N-09..N-12: токены, файлы, новости."""

from __future__ import annotations

import io
import uuid
import zipfile

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_token_pair(client: TestClient) -> dict:
    email = _email("tok")
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Probe12345", "full_name": "Tok", "role_slug": "gk_customer"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _make_valid_docx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        )
        zf.writestr("word/document.xml", "<w:document/>")
        zf.writestr("_rels/.rels", "<Relationships/>")
    return buf.getvalue()


def _make_zip_without_content_types() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", "<fake/>")
    return buf.getvalue()


def test_n09_reuse_revoked_revokes_family(client: TestClient) -> None:
    """N-09: reuse отозванного refresh ревокит всю семью → новый тоже 401."""
    first = _register_token_pair(client)
    old_refresh = first["refresh_token"]
    # ротация
    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 200, refreshed.text
    new_refresh = refreshed.json()["refresh_token"]
    # reuse старого
    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert replay.status_code == 401
    # семья отозвана — новый тоже мёртв
    again = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert again.status_code == 401


def test_n10_metrics_without_user_id(client: TestClient) -> None:
    """N-10: /chat/metrics/ai не отдаёт карту requests_by_user."""
    token = register_test_user(client, email=_email("n10"), full_name="N10", role_slug="gk_customer")["access_token"]
    # сделаем чат-запрос чтобы был трафик
    client.post("/api/v1/chat", headers=_auth(token), json={"message": "привет"})
    resp = client.get("/api/v1/chat/metrics/ai", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "requests_by_user" not in data
    # дополнительно: ни один ключ не должен быть похож на user_id
    for k in data.keys():
        assert k != "requests_by_user"


def test_n11_ooxml_requires_content_types(client: TestClient) -> None:
    """N-11: ZIP без [Content_Types].xml → 422; валидный OOXML → 201."""
    from tests.support import register_test_user as reg

    token = reg(client, email=_email("n11"), full_name="N11", role_slug="gk_customer")["access_token"]
    # создать проект
    proj = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={"name": "N11", "questionnaire_results": [{"level_id": 1, "checked_items": ["Идея"], "percentage": 100}]},
    )
    assert proj.status_code == 201, proj.text
    pid = proj.json()["id"]

    valid = _make_valid_docx()
    ok = client.post(
        f"/api/v1/projects/{pid}/files",
        headers=_auth(token),
        files={"file": ("valid.docx", io.BytesIO(valid), "application/octet-stream")},
    )
    assert ok.status_code == 201, ok.text

    fake = _make_zip_without_content_types()
    bad = client.post(
        f"/api/v1/projects/{pid}/files",
        headers=_auth(token),
        files={"file": ("fake.docx", io.BytesIO(fake), "application/octet-stream")},
    )
    assert bad.status_code == 422


def test_n12_news_content_max_length(client: TestClient) -> None:
    """N-12: NewsCreateIn.content max_length 20000 → превышение 422."""
    admin = register_test_user(client, email=_email("n12a"), full_name="Admin", role_slug="cntr_admin")["access_token"]
    long_content = "x" * 20001
    resp = client.post(
        "/api/v1/news",
        headers=_auth(admin),
        json={"title": "Тест", "content": long_content},
    )
    assert resp.status_code == 422
    # ровно 20000 — проходит
    ok_content = "x" * 20000
    resp2 = client.post(
        "/api/v1/news",
        headers=_auth(admin),
        json={"title": "Тест ok", "content": ok_content},
    )
    assert resp2.status_code == 201, resp2.text
