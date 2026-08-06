"""Тикет 03 Friday RC: личные профили, организации, членство, проверка менеджером.

Покрытие: состояние профиля draft/pending/verified/rejected, несколько
организаций у пользователя, RBAC (менеджер решает, пользователь — 403),
только verified-профили попадают в каталог исполнителей.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> dict:
    return register_test_user(
        client, email=_email("prof"), full_name="Профильный Юзер", role_slug=role
    )


def _register_manager(client: TestClient) -> dict:
    return register_test_user(
        client, email=_email("mgr"), full_name="Менеджер Центра", role_slug="cntr_manager"
    )


def _get_profile(client: TestClient, token: str) -> dict:
    response = client.get("/api/v1/profile", headers=_auth(token))
    assert response.status_code == 200, response.text
    return response.json()


# ── Профиль ──────────────────────────────────────────────────────────────────


def test_profile_auto_created_draft_and_editable(client: TestClient) -> None:
    user = _register(client)
    data = _get_profile(client, user["access_token"])
    profile = data["profile"]
    assert profile["state"] == "draft"
    assert profile["headline"] is None

    response = client.patch(
        "/api/v1/profile",
        headers=_auth(user["access_token"]),
        json={"headline": "Ведущий инженер", "region": "Удмуртия", "skills": ["ML", "CV"]},
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["headline"] == "Ведущий инженер"
    assert updated["region"] == "Удмуртия"
    assert updated["skills"] == ["ML", "CV"]


def test_profile_submit_requires_headline(client: TestClient) -> None:
    user = _register(client)
    response = client.post("/api/v1/profile/submit", headers=_auth(user["access_token"]))
    assert response.status_code == 422


def test_profile_lifecycle_draft_pending_verified(client: TestClient) -> None:
    user = _register(client)
    manager = _register_manager(client)

    client.patch(
        "/api/v1/profile",
        headers=_auth(user["access_token"]),
        json={"headline": "Инженер-исследователь"},
    )
    submitted = client.post("/api/v1/profile/submit", headers=_auth(user["access_token"]))
    assert submitted.status_code == 200
    assert submitted.json()["state"] == "pending"
    profile_id = submitted.json()["id"]

    # редактирование закрыто в pending
    locked = client.patch(
        "/api/v1/profile",
        headers=_auth(user["access_token"]),
        json={"headline": "Другое"},
    )
    assert locked.status_code == 409

    queue = client.get(
        "/api/v1/manager/profiles?state=pending", headers=_auth(manager["access_token"])
    )
    assert queue.status_code == 200
    assert any(item["id"] == profile_id for item in queue.json())

    decided = client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "verify", "comment": "Документы в порядке"},
    )
    assert decided.status_code == 200
    assert decided.json()["state"] == "verified"
    assert decided.json()["review_comment"] == "Документы в порядке"


def test_profile_reject_then_resubmit(client: TestClient) -> None:
    user = _register(client)
    manager = _register_manager(client)

    client.patch(
        "/api/v1/profile",
        headers=_auth(user["access_token"]),
        json={"headline": "Инженер"},
    )
    submitted = client.post("/api/v1/profile/submit", headers=_auth(user["access_token"])).json()
    profile_id = submitted["id"]

    rejected = client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "reject", "comment": "Не хватает портфолио"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["state"] == "rejected"
    assert rejected.json()["review_comment"] == "Не хватает портфолио"

    # в rejected снова можно редактировать и переотправлять
    edit = client.patch(
        "/api/v1/profile",
        headers=_auth(user["access_token"]),
        json={"headline": "Инженер", "bio": "Портфолио добавлено"},
    )
    assert edit.status_code == 200
    resubmit = client.post("/api/v1/profile/submit", headers=_auth(user["access_token"]))
    assert resubmit.status_code == 200
    assert resubmit.json()["state"] == "pending"


def test_profile_rbac_only_manager_decides(client: TestClient) -> None:
    user = _register(client)
    outsider = _register(client, "rd_executor")

    client.patch(
        "/api/v1/profile",
        headers=_auth(user["access_token"]),
        json={"headline": "Инженер"},
    )
    profile_id = client.post(
        "/api/v1/profile/submit", headers=_auth(user["access_token"])
    ).json()["id"]

    forbidden = client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(outsider["access_token"]),
        json={"action": "verify", "comment": "сам себя"},
    )
    assert forbidden.status_code == 403

    queue_forbidden = client.get(
        "/api/v1/manager/profiles?state=pending", headers=_auth(outsider["access_token"])
    )
    assert queue_forbidden.status_code == 403


def test_profile_decide_requires_pending(client: TestClient) -> None:
    user = _register(client)
    manager = _register_manager(client)

    profile_id = _get_profile(client, user["access_token"])["profile"]["id"]
    response = client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "verify", "comment": "не в очереди"},
    )
    assert response.status_code == 409


# ── Организации ──────────────────────────────────────────────────────────────


def test_organization_create_and_multi_membership(client: TestClient) -> None:
    alice = _register(client)
    bob = _register(client, "rd_executor")

    created = client.post(
        "/api/v1/orgs",
        headers=_auth(alice["access_token"]),
        json={"name": "ООО Робототехника", "ogrn": "1170000000001", "region": "Ижевск"},
    )
    assert created.status_code == 201, created.text
    org_id = created.json()["id"]
    assert created.json()["member_role"] == "admin"
    assert created.json()["is_primary"] is True
    assert created.json()["state"] == "draft"

    mine = client.get("/api/v1/orgs/mine", headers=_auth(alice["access_token"]))
    assert mine.status_code == 200
    assert len(mine.json()) == 1

    # bob вступает; alice создаёт вторую организацию — обе состоят в нескольких
    joined = client.post(f"/api/v1/orgs/{org_id}/join", headers=_auth(bob["access_token"]))
    assert joined.status_code == 200
    assert joined.json()["member_role"] == "member"

    second = client.post(
        "/api/v1/orgs",
        headers=_auth(alice["access_token"]),
        json={"name": "ООО Оптика"},
    )
    assert second.status_code == 201
    alice_orgs = client.get("/api/v1/orgs/mine", headers=_auth(alice["access_token"]))
    assert len(alice_orgs.json()) == 2
    assert len(client.get("/api/v1/orgs/mine", headers=_auth(bob["access_token"])).json()) == 1

    # повторное вступление запрещено
    again = client.post(f"/api/v1/orgs/{org_id}/join", headers=_auth(bob["access_token"]))
    assert again.status_code == 409


def test_organization_edit_only_admin(client: TestClient) -> None:
    alice = _register(client)
    bob = _register(client, "rd_executor")

    org_id = client.post(
        "/api/v1/orgs", headers=_auth(alice["access_token"]), json={"name": "ООО Тест"}
    ).json()["id"]
    client.post(f"/api/v1/orgs/{org_id}/join", headers=_auth(bob["access_token"]))

    forbidden = client.patch(
        f"/api/v1/orgs/{org_id}",
        headers=_auth(bob["access_token"]),
        json={"name": "Переименовал не-админ"},
    )
    assert forbidden.status_code == 403

    allowed = client.patch(
        f"/api/v1/orgs/{org_id}",
        headers=_auth(alice["access_token"]),
        json={"name": "ООО Тест-2", "description": "Описание"},
    )
    assert allowed.status_code == 200
    assert allowed.json()["name"] == "ООО Тест-2"


def test_organization_verification_flow(client: TestClient) -> None:
    alice = _register(client)
    manager = _register_manager(client)

    org_id = client.post(
        "/api/v1/orgs", headers=_auth(alice["access_token"]), json={"name": "ООО Верификация"}
    ).json()["id"]

    submitted = client.post(f"/api/v1/orgs/{org_id}/submit", headers=_auth(alice["access_token"]))
    assert submitted.status_code == 200
    assert submitted.json()["state"] == "pending"

    queue = client.get("/api/v1/manager/orgs?state=pending", headers=_auth(manager["access_token"]))
    assert queue.status_code == 200
    assert any(item["id"] == org_id for item in queue.json())

    decided = client.post(
        f"/api/v1/manager/orgs/{org_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "verify", "comment": "ОГРН подтверждён"},
    )
    assert decided.status_code == 200
    assert decided.json()["state"] == "verified"

    # не-админ не может отправить на проверку
    bob = _register(client, "rd_executor")
    org2 = client.post(
        "/api/v1/orgs", headers=_auth(bob["access_token"]), json={"name": "ООО Боб"}
    ).json()["id"]
    client.post(f"/api/v1/orgs/{org2}/join", headers=_auth(alice["access_token"]))
    forbidden = client.post(f"/api/v1/orgs/{org2}/submit", headers=_auth(alice["access_token"]))
    assert forbidden.status_code == 403


# ── Каталог исполнителей: только verified-профили ───────────────────────────


def test_executors_catalog_excludes_unverified_profiles(client: TestClient) -> None:
    gk = _register(client)
    executor = _register(client, "rd_executor")
    manager = _register_manager(client)

    response = client.get("/api/v1/executors", headers=_auth(gk["access_token"]))
    assert response.status_code == 200
    users = [e for e in response.json() if e["id"] > 0]
    assert all(u["full_name"] != "Профильный Юзер" for u in users)

    # после проверки профиля исполнитель появляется в каталоге
    client.patch(
        "/api/v1/profile",
        headers=_auth(executor["access_token"]),
        json={"headline": "R&D инженер"},
    )
    profile_id = client.post(
        "/api/v1/profile/submit", headers=_auth(executor["access_token"])
    ).json()["id"]
    client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "verify", "comment": "ok"},
    )

    after = client.get("/api/v1/executors", headers=_auth(gk["access_token"]))
    users_after = [e for e in after.json() if e["id"] > 0]
    assert any(u["full_name"] == "Профильный Юзер" for u in users_after)
