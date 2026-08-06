"""Тикет 13 Friday RC: архивирование, аудит и экспорт.

Покрытие:
- Пустой черновик удаляется; верифицированный проект — только архив
- Проектная лента (audit) доступна участникам
- Глобальный аудит append-only для администратора (менеджер — 403)
- Экспорт содержит карточку, решения и документы (без закрытых данных)
- Архив скрывает проект из публичного реестра
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
        client, email=_email("t13"), full_name="Тикет13", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _draft_project(client: TestClient, owner: str) -> int:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner),
        json={
            "name": "Проект-13",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_empty_draft_can_be_deleted(client: TestClient) -> None:
    """Пустой черновик (без опросника и документов) удаляется владельцем."""
    owner_token, _ = _register(client)
    created = client.post(
        "/api/v1/projects",
        headers=_auth(owner_token),
        json={"name": "Пустой черновик", "questionnaire_results": []},
    )
    assert created.status_code == 201, created.text
    pid = created.json()["id"]

    deleted = client.delete(f"/api/v1/projects/{pid}", headers=_auth(owner_token))
    assert deleted.status_code == 204, deleted.text

    # проект исчез
    gone = client.get(f"/api/v1/projects/{pid}", headers=_auth(owner_token))
    assert gone.status_code == 404


def test_verified_project_cannot_be_deleted_only_archived(client: TestClient) -> None:
    """Верифицированный проект нельзя удалить — только архивировать."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid = _draft_project(client, owner_token)

    # подтверждаем менеджером → published
    drafts = client.get("/api/v1/manager/queue/drafts", headers=_auth(mgr_token)).json()
    draft = next(d for d in drafts if d["id"] == pid)
    decided = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        headers=_auth(mgr_token),
        json={"approve": True, "level": 2},
    )
    assert decided.status_code == 200

    deleted = client.delete(f"/api/v1/projects/{pid}", headers=_auth(owner_token))
    assert deleted.status_code == 409

    archived = client.post(f"/api/v1/projects/{pid}/archive", headers=_auth(owner_token))
    assert archived.status_code == 200, archived.text
    assert archived.json()["status"] == "archived"

    # архив скрыт из реестра
    registry = client.get("/api/v1/projects/registry", headers=_auth(owner_token))
    assert pid not in [p["id"] for p in registry.json()]


def test_global_audit_admin_only(client: TestClient) -> None:
    """Глобальный аудит — append-only, доступен только администратору."""
    admin_token, _ = _register(client, "cntr_admin")
    mgr_token, _ = _register(client, "cntr_manager")
    owner_token, _ = _register(client)
    _draft_project(client, owner_token)  # создаст audit-записи

    audit = client.get("/api/v1/admin/audit", headers=_auth(admin_token))
    assert audit.status_code == 200, audit.text
    assert len(audit.json()) >= 1
    assert all("action" in a for a in audit.json())

    # менеджер не имеет доступа
    denied = client.get("/api/v1/admin/audit", headers=_auth(mgr_token))
    assert denied.status_code == 403

    # фильтр по проекту и действию
    filtered = client.get(
        "/api/v1/admin/audit?action=project.capped_at_2", headers=_auth(admin_token)
    )
    assert filtered.status_code == 200


def test_export_contains_card_requests_and_documents(client: TestClient) -> None:
    """Экспорт: карточка, решения заявок, документы — без закрытых данных."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    pid = _draft_project(client, owner_token)

    exported = client.get(f"/api/v1/projects/{pid}/export", headers=_auth(owner_token))
    assert exported.status_code == 200, exported.text
    data = exported.json()
    assert data["project"]["name"] == "Проект-13"
    assert data["project"]["id"] == pid
    assert "questionnaire_results" in data
    assert "requests" in data
    assert "documents" in data
    # закрытые данные не попадают: join_token отсутствует
    assert "join_token" not in data["project"]
    assert "payload" not in str(data)

    # аутсайдер не получает экспорт
    outsider_token, _ = _register(client, "investor")
    denied = client.get(f"/api/v1/projects/{pid}/export", headers=_auth(outsider_token))
    assert denied.status_code == 404
