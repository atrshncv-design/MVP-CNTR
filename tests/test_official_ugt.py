"""Тикет 05 Friday RC: опросник и официальный УГТ до 2.

Покрытие: детерминированный server-side расчёт; preliminary 1–2 → авто-
подтверждение официального уровня; preliminary 3–9 → официальный УГТ 2 и
путь первичного подтверждения через менеджера; предварительный и
подтверждённый уровни не смешиваются (реестр фильтрует по current_level).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> str:
    data = register_test_user(client, email=_email("ugt"), full_name="Оценщик", role_slug=role)
    return data["access_token"]


def _register_manager(client: TestClient) -> str:
    data = register_test_user(
        client, email=_email("mgr"), full_name="Менеджер", role_slug="cntr_manager"
    )
    return data["access_token"]


def _assess(client: TestClient, token: str, levels: list[dict]) -> dict:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={"name": "Проект-оценка", "questionnaire_results": levels},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _levels(up_to: int, full: bool = True) -> list[dict]:
    """Уровни 1..up_to; full=True — 100% (проверено), иначе пусто."""
    return [
        {
            "level_id": i,
            "checked_items": [f"Рубеж {i}"] if full else [],
            "percentage": 100.0 if full else 0.0,
        }
        for i in range(1, up_to + 1)
    ]


# ── Авто-подтверждение официального УГТ ──────────────────────────────────────


def test_preliminary_1_2_auto_confirmed_same_level(client: TestClient) -> None:
    token = _register(client)

    project = _assess(client, token, _levels(1))
    assert project["preliminary_level"] == 1
    assert project["current_level"] == 1
    assert project["status"] == "auto_confirmed"

    token2 = _register(client)
    project2 = _assess(client, token2, _levels(2))
    assert project2["preliminary_level"] == 2
    assert project2["current_level"] == 2
    assert project2["status"] == "auto_confirmed"


def test_preliminary_3_9_capped_to_official_2(client: TestClient) -> None:
    for up_to in (3, 5, 9):
        other = _register(client)
        project = _assess(client, other, _levels(up_to))
        assert project["preliminary_level"] == up_to, f"up_to={up_to}"
        assert project["current_level"] == 2, f"official cap at 2, up_to={up_to}"
        assert project["status"] == "draft", "выше 2 — первичное подтверждение менеджером"


def test_auto_confirmed_not_in_manager_draft_queue(client: TestClient) -> None:
    token = _register(client)
    manager = _register_manager(client)

    _assess(client, token, _levels(1))  # auto_confirmed
    _assess(client, _register(client), _levels(5))  # draft (ожидает менеджера)

    queue = client.get("/api/v1/manager/queue/drafts", headers=_auth(manager))
    assert queue.status_code == 200
    ids = [p["id"] for p in queue.json()]
    assert len(ids) == 1, "в очереди только черновик с preliminary 3+"
    # проект с preliminary 5 в очереди, авто-подтверждённого нет
    assert all(p["preliminary_level"] == 5 for p in queue.json())


def test_manager_approve_promotes_above_2(client: TestClient) -> None:
    """Первичное подтверждение: менеджер присваивает заявленный уровень (US 59)."""
    token = _register(client)
    manager = _register_manager(client)

    project = _assess(client, token, _levels(5))
    assert project["current_level"] == 2

    queue = client.get("/api/v1/manager/queue/drafts", headers=_auth(manager)).json()
    draft_id = queue[0]["id"]
    decided = client.post(
        f"/api/v1/manager/queue/drafts/{draft_id}/decide",
        headers=_auth(manager),
        json={"approve": True, "level": 5},
    )
    assert decided.status_code == 200
    assert decided.json()["status"] == "published"
    assert decided.json()["current_level"] == 5


def test_registry_uses_confirmed_level_not_preliminary(client: TestClient) -> None:
    """Реестр фильтрует и сортирует по подтверждённому УГТ (не смешивание)."""
    token = _register(client)
    manager = _register_manager(client)

    # preliminary 5, official 2 — до апрува менеджера
    project = _assess(client, token, _levels(5))
    registry = client.get(
        "/api/v1/projects/registry?ugt_min=3", headers=_auth(_register(client))
    )
    assert registry.status_code == 200
    assert project["id"] not in [p["id"] for p in registry.json()], (
        "предварительный УГТ 5 не должен попадать в фильтр по подтверждённому 3+"
    )

    # после апрува менеджером на УГТ 5 — проект появляется в фильтре 3+
    draft_id = client.get(
        "/api/v1/manager/queue/drafts", headers=_auth(manager)
    ).json()[0]["id"]
    client.post(
        f"/api/v1/manager/queue/drafts/{draft_id}/decide",
        headers=_auth(manager),
        json={"approve": True, "level": 5},
    )
    registry2 = client.get(
        "/api/v1/projects/registry?ugt_min=3", headers=_auth(_register(client))
    )
    assert project["id"] in [p["id"] for p in registry2.json()]


def test_registry_excludes_unpublished_and_preliminary(client: TestClient) -> None:
    token = _register(client)
    _assess(client, token, _levels(1))  # auto_confirmed — ещё не published

    registry = client.get("/api/v1/projects/registry", headers=_auth(_register(client)))
    assert registry.status_code == 200
    assert registry.json() == [], "авто-подтверждённый черновик без согласия не в реестре"


def test_readiness_continuity_and_critical_boundaries(client: TestClient) -> None:
    """Непрерывность: preliminary N требует выполнения уровней 1..N."""
    token = _register(client)
    # уровень 2 заполнен, уровень 1 пуст → непрерывность не выполняется
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={
            "name": "Разрыв",
            "questionnaire_results": [
                {"level_id": 1, "checked_items": [], "percentage": 0.0},
                {"level_id": 2, "checked_items": ["Рубеж 2"], "percentage": 100.0},
            ],
        },
    )
    assert response.status_code == 201, response.text
    project = response.json()
    assert project["preliminary_level"] < 2, "непрерывность: уровень 1 не выполнен"
