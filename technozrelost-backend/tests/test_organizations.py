"""Тикет 03 identity-organizations: карточка организации по ИНН.

Покрытие: валидация ИНН/ОГРН (контрольная сумма, нормализация), создание
карточки (draft), дубликат ИНН → 409, запрет self-verify (пользователь и
менеджер-участник → 403), менеджерская верификация verify/reject + аудит,
не-менеджер → 403, IDOR чужой непубличной карточки → 404, внутренние поля
не публичны, join только к verified, аудит org.created/updated/submitted/joined.
"""

from __future__ import annotations

import uuid

import psycopg
from fastapi.testclient import TestClient

from app.core.validators import is_valid_inn, is_valid_ogrn, normalize_inn
from tests.support import register_test_user

DB_DSN = "host=127.0.0.1 port=5432 user=technoz password=change_me dbname=technozrelost_test"

# Известные валидные ИНН (контрольная сумма сходится).
INN_LEGAL_10 = "7707083893"  # 10 цифр, юрлицо
INN_IP_12 = "500100732259"  # 12 цифр, ИП
INN_LEGAL_10_B = "7710140679"
INN_IP_12_B = "183500905166"
OGRN_13 = "1170000000001"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> dict:
    return register_test_user(
        client, email=_email("org"), full_name="Организационный Юзер", role_slug=role
    )


def _register_manager(client: TestClient) -> dict:
    return register_test_user(
        client, email=_email("orgmgr"), full_name="Менеджер Орг", role_slug="cntr_manager"
    )


def _create_card(client: TestClient, token: str, inn: str = INN_LEGAL_10, **overrides) -> dict:
    payload = {
        "name": "ООО Тестовая Организация",
        "inn": inn,
        "ogrn": OGRN_13,
        "kpp": "770401001",
        "org_type": "ООО",
        "region": "Удмуртская Республика",
        "contacts": [{"type": "email", "value": "info@example.com"}],
        **overrides,
    }
    response = client.post("/api/v1/organizations", headers=_auth(token), json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _submit_card(client: TestClient, token: str, org_id: int) -> dict:
    response = client.post(f"/api/v1/organizations/{org_id}/submit", headers=_auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def _audit_actions() -> list[str]:
    conn = psycopg.connect(DB_DSN, autocommit=True)
    try:
        rows = conn.execute(
            "SELECT action FROM public.audit_trail WHERE action LIKE 'org.%' ORDER BY id"
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()


# ── ИНН/ОГРН: валидация и нормализация ─────────────────────────────────────


def test_inn_validation_known_valid() -> None:
    assert is_valid_inn(INN_LEGAL_10)
    assert is_valid_inn(INN_IP_12)
    assert is_valid_inn(INN_LEGAL_10_B)
    assert is_valid_inn(INN_IP_12_B)


def test_inn_validation_invalid() -> None:
    # неверная длина
    assert not is_valid_inn("770708389")
    assert not is_valid_inn("77070838931")
    # неверная контрольная сумма (10 и 12)
    assert not is_valid_inn("7707083894")
    assert not is_valid_inn("500100732250")
    # буквы/символы внутри
    assert not is_valid_inn("77a07083893")
    assert not is_valid_inn("7707-0838-93")
    # пусто
    assert not is_valid_inn("")
    assert not is_valid_inn(None)


def test_inn_normalization() -> None:
    assert normalize_inn("7707 0838 93") == INN_LEGAL_10
    assert normalize_inn("  7707083893  ") == INN_LEGAL_10
    assert is_valid_inn("7707 0838 93")
    assert normalize_inn("") == ""
    assert normalize_inn(None) == ""


def test_ogrn_validation() -> None:
    assert is_valid_ogrn(OGRN_13)
    assert is_valid_ogrn(None)
    assert is_valid_ogrn("")
    assert not is_valid_ogrn("117000000001")  # 12 цифр
    assert not is_valid_ogrn("1170000000001x")  # буква


# ── Создание карточки ───────────────────────────────────────────────────────


def test_create_card_draft_normalizes_inn(client: TestClient) -> None:
    user = _register(client)
    card = _create_card(client, user["access_token"], inn="7707 0838 93")
    assert card["state"] == "draft"
    assert card["inn"] == INN_LEGAL_10
    assert card["ogrn"] == OGRN_13
    assert card["kpp"] == "770401001"
    assert card["contacts"] == [{"type": "email", "value": "info@example.com"}]
    assert card["member_role"] == "admin"
    assert card["is_primary"] is True
    assert "org.created" in _audit_actions()


def test_create_card_duplicate_inn_409(client: TestClient) -> None:
    alice = _register(client)
    bob = _register(client, "rd_executor")
    _create_card(client, alice["access_token"], inn=INN_LEGAL_10)

    duplicate = client.post(
        "/api/v1/organizations",
        headers=_auth(bob["access_token"]),
        json={
            "name": "ООО Дубликат",
            "inn": INN_LEGAL_10,
            "region": "Ижевск",
        },
    )
    assert duplicate.status_code == 409
    # безопасный ответ: не раскрывает, чья это карточка
    assert "уже предложена" in duplicate.json()["detail"]
    assert "alice" not in duplicate.json()["detail"].lower()


def test_create_card_invalid_inn_422(client: TestClient) -> None:
    user = _register(client)
    for bad_inn in ("7707083894", "770708389", "77a07083893"):
        response = client.post(
            "/api/v1/organizations",
            headers=_auth(user["access_token"]),
            json={"name": "ООО Плохой ИНН", "inn": bad_inn},
        )
        assert response.status_code == 422, bad_inn


def test_create_card_invalid_ogrn_422(client: TestClient) -> None:
    user = _register(client)
    response = client.post(
        "/api/v1/organizations",
        headers=_auth(user["access_token"]),
        json={"name": "ООО Плохой ОГРН", "inn": INN_IP_12, "ogrn": "117000000001"},
    )
    assert response.status_code == 422


# ── Запрет self-verified ─────────────────────────────────────────────────────


def test_user_cannot_verify_own_org(client: TestClient) -> None:
    user = _register(client)
    card = _create_card(client, user["access_token"])
    _submit_card(client, user["access_token"], card["id"])

    response = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(user["access_token"]),
        json={"decision": "verified"},
    )
    assert response.status_code == 403


def test_manager_verify_org_success_and_audit(client: TestClient) -> None:
    user = _register(client)
    manager = _register_manager(client)
    card = _create_card(client, user["access_token"])
    _submit_card(client, user["access_token"], card["id"])

    response = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(manager["access_token"]),
        json={"decision": "verified", "internal_comment": "ОГРН и ИНН совпадают с ЕГРЮЛ"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["state"] == "verified"
    assert body["verification_decision"] == "verified"
    assert body["review_comment"] == "ОГРН и ИНН совпадают с ЕГРЮЛ"
    assert body["reviewed_by"] == manager["user"]["id"]
    assert "org.verified" in _audit_actions()


def test_manager_reject_org_and_audit(client: TestClient) -> None:
    user = _register(client)
    manager = _register_manager(client)
    card = _create_card(client, user["access_token"], inn=INN_IP_12)
    _submit_card(client, user["access_token"], card["id"])

    response = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(manager["access_token"]),
        json={"decision": "rejected", "internal_comment": "ИНН не найден в ЕГРЮЛ"},
    )
    assert response.status_code == 200
    assert response.json()["state"] == "rejected"
    assert response.json()["verification_decision"] == "rejected"
    assert "org.rejected" in _audit_actions()


def test_manager_verify_requires_pending(client: TestClient) -> None:
    user = _register(client)
    manager = _register_manager(client)
    card = _create_card(client, user["access_token"])

    response = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(manager["access_token"]),
        json={"decision": "verified"},
    )
    assert response.status_code == 409


def test_manager_verify_own_creation_forbidden(client: TestClient) -> None:
    """Self-verified: менеджер не верифицирует карточку, которую создал сам."""
    manager = _register_manager(client)
    card = _create_card(client, manager["access_token"], inn=INN_IP_12)
    _submit_card(client, manager["access_token"], card["id"])

    response = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(manager["access_token"]),
        json={"decision": "verified"},
    )
    assert response.status_code == 403


def test_manager_verify_own_membership_forbidden(client: TestClient) -> None:
    """Self-verified: менеджер, состоящий в организации, верифицировать не может."""
    user = _register(client)
    manager = _register_manager(client)
    card = _create_card(client, user["access_token"])
    _submit_card(client, user["access_token"], card["id"])

    # менеджер добавляется участником напрямую (join к pending закрыт — 404)
    conn = psycopg.connect(DB_DSN, autocommit=True)
    try:
        conn.execute(
            "INSERT INTO public.organization_members "
            "(user_id, organization_id, role_in_org, is_primary) "
            "VALUES (%s, %s, 'member', FALSE)",
            (manager["user"]["id"], card["id"]),
        )
    finally:
        conn.close()

    response = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(manager["access_token"]),
        json={"decision": "verified"},
    )
    assert response.status_code == 403


def test_non_manager_verify_forbidden(client: TestClient) -> None:
    user = _register(client)
    outsider = _register(client, "rd_executor")
    card = _create_card(client, user["access_token"])
    _submit_card(client, user["access_token"], card["id"])

    response = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(outsider["access_token"]),
        json={"decision": "verified"},
    )
    assert response.status_code == 403


# ── Доступ и IDOR ────────────────────────────────────────────────────────────


def test_idor_foreign_draft_card_404(client: TestClient) -> None:
    alice = _register(client)
    bob = _register(client, "rd_executor")
    card = _create_card(client, alice["access_token"])

    # чужая непубличная карточка не раскрывается (404, не 403)
    foreign = client.get(
        f"/api/v1/organizations/{card['id']}", headers=_auth(bob["access_token"])
    )
    assert foreign.status_code == 404
    # аноним — тоже 404
    assert client.get(f"/api/v1/organizations/{card['id']}").status_code == 404
    # владелец (участник) видит свою карточку
    own = client.get(f"/api/v1/organizations/{card['id']}", headers=_auth(alice["access_token"]))
    assert own.status_code == 200
    assert own.json()["member_role"] == "admin"
    assert own.json()["id"] == card["id"]
    # несуществующая карточка — 404
    missing = client.get(
        "/api/v1/organizations/999999", headers=_auth(bob["access_token"])
    )
    assert missing.status_code == 404


def test_internal_fields_not_public(client: TestClient) -> None:
    user = _register(client)
    manager = _register_manager(client)
    card = _create_card(client, user["access_token"])
    _submit_card(client, user["access_token"], card["id"])
    verified = client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(manager["access_token"]),
        json={"decision": "verified", "internal_comment": "внутренний комментарий менеджера"},
    ).json()
    assert verified["state"] == "verified"

    # публичный просмотр: внутренние поля скрыты
    public_resp = client.get(
        f"/api/v1/organizations/{card['id']}", headers=_auth(user["access_token"])
    )
    public = public_resp.json()
    assert public["review_comment"] is None
    assert public["verification_decision"] is None
    assert public["reviewed_by"] is None
    assert public["reviewed_at"] is None
    assert public["created_by"] is None
    # публичные поля видны
    assert public["inn"] == INN_LEGAL_10
    assert public["name"] == "ООО Тестовая Организация"

    # staff видит внутренние поля
    staff = client.get(
        f"/api/v1/organizations/{card['id']}", headers=_auth(manager["access_token"])
    ).json()
    assert staff["review_comment"] == "внутренний комментарий менеджера"
    assert staff["verification_decision"] == "verified"
    assert staff["reviewed_by"] == manager["user"]["id"]
    assert staff["created_by"] == user["user"]["id"]

    # анонимный просмотр verified-карточки — публичные поля без auth
    anon = client.get(f"/api/v1/organizations/{card['id']}").json()
    assert anon["inn"] == INN_LEGAL_10
    assert anon["review_comment"] is None


def test_join_only_verified(client: TestClient) -> None:
    alice = _register(client)
    bob = _register(client, "rd_executor")
    manager = _register_manager(client)

    card = _create_card(client, alice["access_token"])
    # join к draft — 404 (непубличная карточка)
    draft_join = client.post(
        f"/api/v1/organizations/{card['id']}/join", headers=_auth(bob["access_token"])
    )
    assert draft_join.status_code == 404

    # верифицируем
    _submit_card(client, alice["access_token"], card["id"])
    client.post(
        f"/api/v1/manager/orgs/{card['id']}/verify",
        headers=_auth(manager["access_token"]),
        json={"decision": "verified"},
    )

    # join к verified — ок
    joined = client.post(
        f"/api/v1/organizations/{card['id']}/join", headers=_auth(bob["access_token"])
    )
    assert joined.status_code == 200
    assert joined.json()["member_role"] == "member"
    assert "org.joined" in _audit_actions()

    # повторный join — 409
    again = client.post(
        f"/api/v1/organizations/{card['id']}/join", headers=_auth(bob["access_token"])
    )
    assert again.status_code == 409


# ── Обновление карточки и аудит ─────────────────────────────────────────────


def test_card_update_inn_and_audit(client: TestClient) -> None:
    alice = _register(client)
    card = _create_card(client, alice["access_token"], inn=INN_LEGAL_10)

    updated = client.patch(
        f"/api/v1/orgs/{card['id']}",
        headers=_auth(alice["access_token"]),
        json={
            "name": "ООО Переименовано",
            "inn": INN_IP_12,
            "kpp": "183101001",
            "contacts": [{"type": "phone", "value": "+7 3412 00-00-00"}],
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "ООО Переименовано"
    assert "org.updated" in _audit_actions()

    # дубликат ИНН при обновлении — 409
    bob = _register(client, "rd_executor")
    _create_card(client, bob["access_token"], inn=INN_LEGAL_10_B)
    conflict = client.patch(
        f"/api/v1/orgs/{card['id']}",
        headers=_auth(alice["access_token"]),
        json={"name": "ООО Переименовано", "inn": INN_LEGAL_10_B},
    )
    assert conflict.status_code == 409

    # невалидный ИНН при обновлении — 422
    bad = client.patch(
        f"/api/v1/orgs/{card['id']}",
        headers=_auth(alice["access_token"]),
        json={"name": "ООО Переименовано", "inn": "7707083894"},
    )
    assert bad.status_code == 422


def test_submit_card_requires_inn(client: TestClient) -> None:
    """Карточка без ИНН (legacy /orgs) не уходит на проверку новым контуром."""
    user = _register(client)
    legacy = client.post(
        "/api/v1/orgs", headers=_auth(user["access_token"]), json={"name": "ООО Без ИНН"}
    )
    assert legacy.status_code == 201
    org_id = legacy.json()["id"]

    response = client.post(
        f"/api/v1/organizations/{org_id}/submit", headers=_auth(user["access_token"])
    )
    assert response.status_code == 422
    assert "ИНН" in response.json()["detail"]


def test_org_submitted_audit(client: TestClient) -> None:
    user = _register(client)
    card = _create_card(client, user["access_token"])
    _submit_card(client, user["access_token"], card["id"])
    assert "org.submitted" in _audit_actions()
