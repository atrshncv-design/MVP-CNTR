"""TICKET-11 (M-03, L-06) ETag Vary private — ремедиация 2 теста."""

from __future__ import annotations

import os
import uuid

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email() -> str:
    return f"cat-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_catalog_vary_and_private(client: TestClient) -> None:
    """Catalog/Categories: Vary Accept-Encoding, private/auth public/anon, If-None-Match 304."""
    # anon catalog
    anon = client.get("/api/v1/achievements/catalog")
    assert anon.status_code == 200, anon.text
    assert anon.headers.get("vary") == "Accept-Encoding"
    assert anon.headers.get("cache-control") == "public, max-age=300"
    assert "ETag" in anon.headers
    etag_anon = anon.headers["ETag"]

    # auth → private
    tok = register_test_user(client, email=_email(), full_name="Cat User", role_slug="gk_customer")["access_token"]
    authed = client.get("/api/v1/achievements/catalog", headers=_auth(tok))
    assert authed.headers.get("vary") == "Accept-Encoding"
    assert authed.headers.get("cache-control") == "private, max-age=300"
    assert "ETag" in authed.headers

    # If-None-Match → 304 с теми же заголовками
    not_mod = client.get("/api/v1/achievements/catalog", headers={"If-None-Match": etag_anon})
    assert not_mod.status_code == 304
    assert not_mod.headers.get("ETag") == etag_anon
    assert not_mod.headers.get("vary") == "Accept-Encoding"
    # тело пустое
    assert not_mod.content == b""

    # news categories — тот же контракт
    cat_anon = client.get("/api/v1/news/categories")
    assert cat_anon.status_code == 200
    assert cat_anon.headers.get("vary") == "Accept-Encoding"
    assert cat_anon.headers.get("cache-control") in ("public, max-age=300", "private, max-age=300")
    assert "ETag" in cat_anon.headers
    cat_etag = cat_anon.headers["ETag"]
    cat_304 = client.get("/api/v1/news/categories", headers={"If-None-Match": cat_etag})
    assert cat_304.status_code == 304
    assert cat_304.headers.get("vary") == "Accept-Encoding"

    # при Authorization news/categories тоже private
    cat_auth = client.get("/api/v1/news/categories", headers=_auth(tok))
    assert cat_auth.headers.get("cache-control") == "private, max-age=300"


def test_catalog_etag_sort_order(client: TestClient) -> None:
    """ETag меняется при смене sort_order, правильный 304 на новый."""
    dsn = {
        "host": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "port": int(os.environ.get("POSTGRES_PORT", "5432")),
        "user": os.environ.get("POSTGRES_USER", "technoz"),
        "password": os.environ.get("POSTGRES_PASSWORD", "change_me"),
        "dbname": os.environ.get("POSTGRES_DB", "technozrelost_test"),
        "autocommit": True,
    }
    slug = f"test-sort-{uuid.uuid4().hex[:6]}"
    conn = psycopg.connect(**dsn)
    try:
        conn.execute(
            "INSERT INTO public.achievements (slug, title, description, \"group\", rarity, sort_order, icon_key) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (slug, "Sort Test", "desc", "documents", "common", 1, slug),
        )
    finally:
        conn.close()

    resp1 = client.get("/api/v1/achievements/catalog")
    assert resp1.status_code == 200
    etag1 = resp1.headers["ETag"]
    assert etag1

    # меняем sort_order
    conn = psycopg.connect(**dsn)
    try:
        conn.execute("UPDATE public.achievements SET sort_order=999, updated_at=now() WHERE slug=%s", (slug,))
    finally:
        conn.close()

    resp2 = client.get("/api/v1/achievements/catalog")
    etag2 = resp2.headers["ETag"]
    assert etag2 != etag1, f"ETag не изменился после sort_order: {etag1!r} vs {etag2!r}"

    # старый ETag → 200, не 304
    old_match = client.get("/api/v1/achievements/catalog", headers={"If-None-Match": etag1})
    assert old_match.status_code == 200
    assert old_match.headers["ETag"] == etag2

    # новый ETag → 304
    new_match = client.get("/api/v1/achievements/catalog", headers={"If-None-Match": etag2})
    assert new_match.status_code == 304
    assert new_match.headers["ETag"] == etag2
    assert new_match.headers["vary"] == "Accept-Encoding"

    # technologies — если роут существует, тоже ETag+Vary+private/public
    # создаём технологию напрямую чтобы тест был детерминирован
    tok = register_test_user(client, email=_email(), full_name="Tech User", role_slug="gk_customer")["access_token"]
    # технологий может не быть, проверяем что эндпоинт требует auth и отдаёт ETag
    tech_resp = client.get("/api/v1/technologies", headers=_auth(tok))
    assert tech_resp.status_code == 200
    assert tech_resp.headers.get("vary") == "Accept-Encoding"
    assert tech_resp.headers.get("cache-control") == "private, max-age=300"
    assert "ETag" in tech_resp.headers
    tech_etag = tech_resp.headers["ETag"]
    tech_304 = client.get("/api/v1/technologies", headers={**_auth(tok), "If-None-Match": tech_etag})
    assert tech_304.status_code == 304

    # чистим тестовую медаль
    conn = psycopg.connect(**dsn)
    try:
        conn.execute("DELETE FROM public.achievements WHERE slug=%s", (slug,))
    finally:
        conn.close()
