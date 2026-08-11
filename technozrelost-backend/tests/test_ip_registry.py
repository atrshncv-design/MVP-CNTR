"""Тикет 03 (operations-modules): реестр РИД.

Покрывает: RBAC карточек (staff создаёт/редактирует, участник проекта/владелец
org читают своё, IDOR → 404), детерминированные предупреждения (границы дат —
unit, без LLM), авторы (привязка user/внешний + маскировка ПДн по ролям),
документы-файлы (upload/scan/доступ/404/409), аудит ip_asset.*.
"""

from __future__ import annotations

import os
import uuid
from datetime import date, timedelta

import psycopg
from fastapi.testclient import TestClient

from app.services.ip_registry import author_display_name, compute_ip_warnings
from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"


def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _register(client: TestClient, role: str = "gk_customer", full_name: str = "Тест Юзер") -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('u')}@example.com",
        full_name=full_name,
        role_slug=role,
    )


def _staff(client: TestClient) -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug="cntr_manager",
    )


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> int:
    resp = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={"name": _uniq("Проект"), "description": "Проект тикета РИД", "category": "it"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_org(client: TestClient, token: str) -> dict:
    resp = client.post("/api/v1/orgs", headers=_auth(token), json={"name": _uniq("Орг")})
    assert resp.status_code == 201, resp.text
    return resp.json()


def _join_org(client: TestClient, token: str, org_id: int) -> None:
    resp = client.post(f"/api/v1/orgs/{org_id}/join", headers=_auth(token))
    assert resp.status_code == 200, resp.text


def _create_asset(client: TestClient, staff_token: str, **overrides) -> dict:
    payload = {"title": _uniq("РИД"), "type": "patent", **overrides}
    resp = client.post("/api/v1/ip-assets", headers=_auth(staff_token), json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _upload_doc(
    client: TestClient,
    token: str,
    asset_id: int,
    *,
    content: bytes = PDF_BYTES,
    title: str | None = None,
) -> dict:
    resp = client.post(
        f"/api/v1/ip-assets/{asset_id}/documents",
        headers=_auth(token),
        params={"title": title} if title else None,
        files={"file": ("patent.pdf", content, "application/pdf")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _audit_actions() -> list[str]:
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        rows = conn.execute(
            "SELECT action FROM public.audit_trail WHERE action LIKE 'ip_asset.%' ORDER BY id"
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()


def _set_doc_scan_status(doc_id: int, scan_status: str) -> None:
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        conn.execute(
            "UPDATE public.ip_documents SET scan_status = %s WHERE id = %s",
            (scan_status, doc_id),
        )
    finally:
        conn.close()


# ─── Unit: детерминированные предупреждения (границы дат, без LLM) ──────────

def test_warnings_expiry_boundaries_unit() -> None:
    today = date(2026, 8, 11)
    # Вчера → «истёк».
    warnings = compute_ip_warnings(
        expiry_date=date(2026, 8, 10), owner_organization_id=1, today=today
    )
    assert [w["code"] for w in warnings] == ["expired"]
    # Сегодня (граница) → НЕ истёк: действует весь день.
    warnings = compute_ip_warnings(
        expiry_date=today, owner_organization_id=1, today=today
    )
    assert warnings == []
    # Завтра → нет.
    warnings = compute_ip_warnings(
        expiry_date=date(2026, 8, 12), owner_organization_id=1, today=today
    )
    assert warnings == []
    # Без expiry_date → нет.
    warnings = compute_ip_warnings(expiry_date=None, owner_organization_id=1, today=today)
    assert warnings == []


def test_warnings_no_owner_unit() -> None:
    today = date(2026, 8, 11)
    warnings = compute_ip_warnings(expiry_date=None, owner_organization_id=None, today=today)
    assert [w["code"] for w in warnings] == ["no_owner"]
    # Оба условия одновременно — оба предупреждения.
    warnings = compute_ip_warnings(
        expiry_date=date(2026, 8, 10), owner_organization_id=None, today=today
    )
    assert [w["code"] for w in warnings] == ["expired", "no_owner"]
    # Правообладатель указан → предупреждения нет.
    warnings = compute_ip_warnings(expiry_date=None, owner_organization_id=7, today=today)
    assert warnings == []


def test_author_mask_unit() -> None:
    # Staff видит ФИО пользователя или имя внешнего автора.
    assert author_display_name(7, is_staff=True, user_full_name="Иван Петров") == "Иван Петров"
    assert author_display_name(7, is_staff=True, external_name="Внешний Автор") == "Внешний Автор"
    # Остальные роли — «Автор N» (id записи, без user_id и ФИО).
    assert author_display_name(7, is_staff=False) == "Автор 7"
    assert author_display_name(7, is_staff=False, user_full_name="Иван Петров") == "Автор 7"


# ─── RBAC карточек ───────────────────────────────────────────────────────────

def test_create_asset_staff_only(client: TestClient) -> None:
    staff = _staff(client)
    owner = _register(client)
    pid = _create_project(client, owner["access_token"])

    # Аноним → 401.
    resp = client.post(
        "/api/v1/ip-assets", json={"title": _uniq("РИД"), "type": "patent"}
    )
    assert resp.status_code == 401, resp.text

    # Не-staff → 403.
    resp = client.post(
        "/api/v1/ip-assets",
        headers=_auth(owner["access_token"]),
        json={"title": _uniq("РИД"), "type": "patent", "project_id": pid},
    )
    assert resp.status_code == 403, resp.text

    # Staff → 201; без правообладателя — детерминированное предупреждение.
    resp = client.post(
        "/api/v1/ip-assets",
        headers=_auth(staff["access_token"]),
        json={"title": _uniq("РИД"), "type": "patent", "project_id": pid},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "draft"
    assert {w["code"] for w in data["warnings"]} == {"no_owner"}


def test_create_asset_unknown_refs_404(client: TestClient) -> None:
    staff = _staff(client)
    resp = client.post(
        "/api/v1/ip-assets",
        headers=_auth(staff["access_token"]),
        json={"title": _uniq("РИД"), "type": "software", "project_id": 999_999},
    )
    assert resp.status_code == 404, resp.text
    resp = client.post(
        "/api/v1/ip-assets",
        headers=_auth(staff["access_token"]),
        json={"title": _uniq("РИД"), "type": "software", "owner_organization_id": 999_999},
    )
    assert resp.status_code == 404, resp.text


def test_list_scoped_and_idor_404(client: TestClient) -> None:
    staff = _staff(client)
    owner_a = _register(client, full_name="Владелец А")
    owner_b = _register(client, full_name="Владелец Б")
    stranger = _register(client)
    pid_a = _create_project(client, owner_a["access_token"])
    pid_b = _create_project(client, owner_b["access_token"])
    asset_a = _create_asset(client, staff["access_token"], project_id=pid_a)
    asset_b = _create_asset(client, staff["access_token"], project_id=pid_b)

    # Участник проекта A видит только свой РИД.
    listing = client.get("/api/v1/ip-assets", headers=_auth(owner_a["access_token"]))
    assert listing.status_code == 200, listing.text
    ids = {a["id"] for a in listing.json()}
    assert asset_a["id"] in ids
    assert asset_b["id"] not in ids

    # Посторонний — пустой список и 404 на чужую карточку (IDOR).
    listing = client.get("/api/v1/ip-assets", headers=_auth(stranger["access_token"]))
    assert listing.json() == []
    resp = client.get(
        f"/api/v1/ip-assets/{asset_a['id']}", headers=_auth(stranger["access_token"])
    )
    assert resp.status_code == 404, resp.text
    resp = client.get(
        f"/api/v1/ip-assets/{asset_a['id']}", headers=_auth(owner_b["access_token"])
    )
    assert resp.status_code == 404, resp.text

    # Staff видит всё.
    listing = client.get("/api/v1/ip-assets", headers=_auth(staff["access_token"]))
    ids = {a["id"] for a in listing.json()}
    assert {asset_a["id"], asset_b["id"]} <= ids


def test_org_owner_access(client: TestClient) -> None:
    staff = _staff(client)
    org_creator = _register(client, full_name="Создатель Орг")
    plain_member = _register(client, full_name="Рядовой Член")
    stranger = _register(client)
    org = _create_org(client, org_creator["access_token"])
    _join_org(client, plain_member["access_token"], org["id"])
    asset = _create_asset(
        client, staff["access_token"], owner_organization_id=org["id"]
    )

    # Создатель организации (владелец) видит карточку.
    resp = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(org_creator["access_token"])
    )
    assert resp.status_code == 200, resp.text

    # Рядовой участник организации → 404 (решение: доступ у владельца org).
    resp = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(plain_member["access_token"])
    )
    assert resp.status_code == 404, resp.text

    # Посторонний → 404; staff → 200.
    resp = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(stranger["access_token"])
    )
    assert resp.status_code == 404, resp.text
    resp = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(staff["access_token"])
    )
    assert resp.status_code == 200, resp.text


def test_update_delete_staff_only(client: TestClient) -> None:
    staff = _staff(client)
    owner = _register(client)
    pid = _create_project(client, owner["access_token"])
    asset = _create_asset(client, staff["access_token"], project_id=pid)

    # Не-staff не редактирует и не удаляет.
    resp = client.patch(
        f"/api/v1/ip-assets/{asset['id']}",
        headers=_auth(owner["access_token"]),
        json={"title": "Взлом"},
    )
    assert resp.status_code == 403, resp.text
    resp = client.delete(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(owner["access_token"])
    )
    assert resp.status_code == 403, resp.text

    # Staff: статус + истёкший срок → предупреждение «истёк» в выдаче.
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    resp = client.patch(
        f"/api/v1/ip-assets/{asset['id']}",
        headers=_auth(staff["access_token"]),
        json={"status": "registered", "expiry_date": yesterday},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "registered"
    assert {w["code"] for w in data["warnings"]} == {"expired", "no_owner"}

    # Staff удаляет → 204, затем 404.
    resp = client.delete(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(staff["access_token"])
    )
    assert resp.status_code == 204, resp.text
    resp = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(staff["access_token"])
    )
    assert resp.status_code == 404, resp.text


# ─── Авторы: привязка и маскировка ПДн ──────────────────────────────────────

def test_authors_binding_and_masking(client: TestClient) -> None:
    staff = _staff(client)
    owner = _register(client)
    author_user = _register(client, full_name="Иван Петров")
    pid = _create_project(client, owner["access_token"])
    asset = _create_asset(client, staff["access_token"], project_id=pid)

    # Staff привязывает автора-пользователя и внешнего автора.
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/authors",
        headers=_auth(staff["access_token"]),
        json={"user_id": author_user["user"]["id"], "contribution": "Методика"},
    )
    assert resp.status_code == 201, resp.text
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/authors",
        headers=_auth(staff["access_token"]),
        json={"name": "Внешний Автор"},
    )
    assert resp.status_code == 201, resp.text

    # Staff видит ФИО и user_id.
    detail = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(staff["access_token"])
    ).json()
    user_author = next(
        a for a in detail["authors"] if a["user_id"] == author_user["user"]["id"]
    )
    assert user_author["display_name"] == "Иван Петров"
    assert user_author["contribution"] == "Методика"
    assert any(a["display_name"] == "Внешний Автор" for a in detail["authors"])

    # Участник проекта: маскировка — «Автор N», без user_id (ПДн скрыты).
    detail = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(owner["access_token"])
    ).json()
    assert len(detail["authors"]) == 2
    for author in detail["authors"]:
        assert author["user_id"] is None
        assert author["display_name"].startswith("Автор ")
        assert "Петров" not in author["display_name"]

    # Валидация: оба поля → 422, ни одного → 422, неизвестный user → 404.
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/authors",
        headers=_auth(staff["access_token"]),
        json={"user_id": author_user["user"]["id"], "name": "Оба"},
    )
    assert resp.status_code == 422, resp.text
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/authors",
        headers=_auth(staff["access_token"]),
        json={"contribution": "Без автора"},
    )
    assert resp.status_code == 422, resp.text
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/authors",
        headers=_auth(staff["access_token"]),
        json={"user_id": 999_999},
    )
    assert resp.status_code == 404, resp.text

    # Не-staff не добавляет авторов; удаление — staff.
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/authors",
        headers=_auth(owner["access_token"]),
        json={"name": "Хакер"},
    )
    assert resp.status_code == 403, resp.text
    resp = client.delete(
        f"/api/v1/ip-assets/{asset['id']}/authors/{user_author['id']}",
        headers=_auth(staff["access_token"]),
    )
    assert resp.status_code == 204, resp.text
    detail = client.get(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(staff["access_token"])
    ).json()
    assert len(detail["authors"]) == 1


# ─── Документы-файлы: доступ, scan, 404/409 ─────────────────────────────────

def test_documents_upload_access_and_scan(client: TestClient) -> None:
    staff = _staff(client)
    owner = _register(client)
    stranger = _register(client)
    pid = _create_project(client, owner["access_token"])
    asset = _create_asset(client, staff["access_token"], project_id=pid)

    # Участник проекта загружает PDF → scan в тестовом окружении clean.
    doc = _upload_doc(
        client, owner["access_token"], asset["id"], title="Патентоспособность"
    )
    assert doc["scan_status"] == "clean"
    assert doc["sha256"]
    assert doc["mime"] == "application/pdf"

    # Список документов и скачивание для участника.
    listing = client.get(
        f"/api/v1/ip-assets/{asset['id']}/documents",
        headers=_auth(owner["access_token"]),
    )
    assert listing.status_code == 200, listing.text
    assert [d["id"] for d in listing.json()] == [doc["id"]]
    download = client.get(
        f"/api/v1/ip-assets/documents/{doc['id']}/download",
        headers=_auth(owner["access_token"]),
    )
    assert download.status_code == 200, download.text
    assert download.content == PDF_BYTES

    # Чужой: upload/list/download → 404 (IDOR не раскрывает документ).
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/documents",
        headers=_auth(stranger["access_token"]),
        files={"file": ("x.pdf", PDF_BYTES, "application/pdf")},
    )
    assert resp.status_code == 404, resp.text
    resp = client.get(
        f"/api/v1/ip-assets/{asset['id']}/documents",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404, resp.text
    resp = client.get(
        f"/api/v1/ip-assets/documents/{doc['id']}/download",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404, resp.text

    # Недопустимый формат → 422.
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/documents",
        headers=_auth(owner["access_token"]),
        files={"file": ("evil.exe", b"MZ\x90\x00binary", "application/octet-stream")},
    )
    assert resp.status_code == 422, resp.text

    # Infected → скачивание 409; rescan (test-env) возвращает clean.
    _set_doc_scan_status(doc["id"], "infected")
    resp = client.get(
        f"/api/v1/ip-assets/documents/{doc['id']}/download",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 409, resp.text
    resp = client.post(
        f"/api/v1/ip-assets/documents/{doc['id']}/rescan",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["scan_status"] == "clean"


# ─── Аудит ip_asset.* ────────────────────────────────────────────────────────

def test_audit_events(client: TestClient) -> None:
    staff = _staff(client)
    owner = _register(client)
    pid = _create_project(client, owner["access_token"])
    asset = _create_asset(client, staff["access_token"], project_id=pid)
    assert "ip_asset.created" in _audit_actions()

    client.patch(
        f"/api/v1/ip-assets/{asset['id']}",
        headers=_auth(staff["access_token"]),
        json={"status": "registered", "registration_number": "RU-2026-001"},
    )
    resp = client.post(
        f"/api/v1/ip-assets/{asset['id']}/authors",
        headers=_auth(staff["access_token"]),
        json={"name": "Внешний Автор"},
    )
    assert resp.status_code == 201, resp.text
    _upload_doc(client, owner["access_token"], asset["id"], title="Свидетельство")

    actions = _audit_actions()
    for expected in (
        "ip_asset.created",
        "ip_asset.updated",
        "ip_asset.status_changed",
        "ip_asset.author_added",
        "ip_asset.document_uploaded",
    ):
        assert expected in actions, f"ожидалось событие {expected}, есть {actions}"

    # Удаление фиксируется до физического удаления записи.
    client.delete(
        f"/api/v1/ip-assets/{asset['id']}", headers=_auth(staff["access_token"])
    )
    assert "ip_asset.deleted" in _audit_actions()
