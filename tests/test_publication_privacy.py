"""Тикет 10 Friday RC: публичная карточка, реестры, приватность.

Покрытие:
- УГТ 1–2 публикуется после авто-подтверждения (`auto_confirmed`)
- УГТ 3–9 публикуется только после решения менеджера
- Предварительный уровень показывается только при согласии (`show_preliminary`)
- Реестр показывает только `is_public` проекты
- Фильтры используют только подтверждённый УГТ
- Реестр технологий = УГТ 7+ (`ugt_min=7`)
- Приватный проект не виден в реестре
- Публикация без подтверждения УГТ → 409
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("t10"), full_name="Тикет10", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _create_and_confirm_ugt2(client: TestClient, owner: str, mgr: str) -> int:
    """Создаёт проект с preliminary=2 → auto_confirmed."""
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner),
        json={
            "name": "Проект-10-АВТО",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2)
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_publish_ugt2_after_auto_confirmation(client: TestClient) -> None:
    """УГТ 1–2 публикуется после авто-подтверждения."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid = _create_and_confirm_ugt2(client, owner_token, mgr_token)

    # auto_confirmed → публикация разрешена
    publish = client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(owner_token),
        json={"is_public": True, "show_preliminary": True},
    )
    assert publish.status_code == 200, publish.text
    assert publish.json()["is_public"] is True
    assert publish.json()["show_preliminary"] is True

    # Реестр показывает проект
    registry = client.get("/api/v1/projects/registry", headers=_auth(owner_token))
    assert registry.status_code == 200
    items = [r for r in registry.json() if r["id"] == pid]
    assert len(items) == 1
    assert items[0]["is_public"] is True
    assert items[0]["preliminary_level"] is not None  # show_preliminary=True


def test_publish_without_confirmation_returns_409(client: TestClient) -> None:
    """Публикация проекта без подтверждённого УГТ (draft, preliminary > 2) → 409."""
    owner_token, _ = _register(client)
    # preliminary=3 → cap на УГТ 2, статус draft (требует менеджера)
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner_token),
        json={
            "name": "Черновик-10",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    pid = response.json()["id"]

    publish = client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(owner_token),
        json={"is_public": True},
    )
    assert publish.status_code == 409


def test_unpublish_hides_from_registry(client: TestClient) -> None:
    """Скрытие проекта убирает его из реестра."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid = _create_and_confirm_ugt2(client, owner_token, mgr_token)

    # Публикуем
    client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(owner_token),
        json={"is_public": True},
    )
    # Скрываем
    unpublish = client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(owner_token),
        json={"is_public": False},
    )
    assert unpublish.status_code == 200
    assert unpublish.json()["is_public"] is False

    registry = client.get("/api/v1/projects/registry", headers=_auth(owner_token))
    items = [r for r in registry.json() if r["id"] == pid]
    assert len(items) == 0


def test_preliminary_hidden_without_consent(client: TestClient) -> None:
    """Предварительный уровень скрыт при show_preliminary=False."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid = _create_and_confirm_ugt2(client, owner_token, mgr_token)

    client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(owner_token),
        json={"is_public": True, "show_preliminary": False},
    )

    registry = client.get("/api/v1/projects/registry", headers=_auth(owner_token))
    items = [r for r in registry.json() if r["id"] == pid]
    assert len(items) == 1
    assert items[0]["preliminary_level"] is None  # скрыт


def test_registry_filter_by_ugt(client: TestClient) -> None:
    """Фильтры используют подтверждённый current_level; УГТ 2 не попадает в ?ugt_min=7."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid = _create_and_confirm_ugt2(client, owner_token, mgr_token)
    client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(owner_token),
        json={"is_public": True},
    )

    # Проект с УГТ 2 → не должен попасть в реестр технологий (ugt_min=7)
    tech = client.get(
        "/api/v1/projects/registry?ugt_min=7", headers=_auth(owner_token)
    )
    assert tech.status_code == 200
    tech_ids = {r["id"] for r in tech.json()}
    assert pid not in tech_ids
    assert all(r["current_level"] >= 7 for r in tech.json())

    # В общем реестре (без фильтра) проект виден
    all_registry = client.get(
        "/api/v1/projects/registry", headers=_auth(owner_token)
    )
    all_ids = {r["id"] for r in all_registry.json()}
    assert pid in all_ids


def test_publish_forbidden_for_outsider(client: TestClient) -> None:
    """Публикация посторонним → 403/404."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    outsider_token, _ = _register(client, "investor")
    pid = _create_and_confirm_ugt2(client, owner_token, mgr_token)

    denied = client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(outsider_token),
        json={"is_public": True},
    )
    assert denied.status_code in (403, 404)
