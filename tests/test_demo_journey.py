"""Полный демо-маршрут (спека §3.1) одним прогоном: регистрация → проект →
опросник → вступление → генерация документов → чат."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _register(client: TestClient, role: str) -> tuple[str, int, str]:
    email = f"demo-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": f"Демо {role}",
            "organization": "Организация",
            "role_slug": role,
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return data["access_token"], data["user"]["id"], email


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_tz_template(client: TestClient, admin_token: str) -> None:
    response = client.post(
        "/api/v1/rag/templates",
        json={
            "title": "ТЗ — демо",
            "doc_type": "tz",
            "raw_text": "ТЗ\nПроект: {{project_name}}\nБюджет: {{project_budget}} руб.",
            "template_metadata": {"variables": []},
        },
        headers=_auth(admin_token),
    )
    assert response.status_code == 201, response.text


def test_full_demo_journey(client: TestClient) -> None:
    # 1. Регистрация ГК
    gk_token, gk_id, _ = _register(client, "gk_customer")

    # 2. Создание проекта через опросник
    created = client.post(
        "/api/v1/projects",
        json={
            "name": "Демо-проект",
            "description": "Описание демо",
            "category": "AI/ML",
            "target_level": 5,
            "budget": 500000,
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0},
                {"level_id": 2, "checked_items": [], "percentage": 0.0},
            ],
        },
        headers=_auth(gk_token),
    )
    assert created.status_code == 201
    project = created.json()
    project_id = project["id"]
    token = project["join_token"]
    assert project["current_level"] == 1

    # 3. Дашборд проекта виден создателю с ответами
    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(gk_token))
    assert detail.status_code == 200
    assert len(detail.json()["questionnaire_results"]) == 2

    # 4. R&D вступает по приоритетной ссылке (shared_by=gk_id) → активен
    rd_token, rd_id, _ = _register(client, "rd_executor")
    joined = client.post(
        "/api/v1/projects/join",
        json={"token": token, "role_in_project": "rd_executor", "shared_by": gk_id},
        headers=_auth(rd_token),
    )
    assert joined.status_code == 200
    assert joined.json()["status"] == "active"

    # 5. Генерация документа (шаблон засеян админом)
    admin_token, _, _ = _register(client, "cntr_admin")
    _seed_tz_template(client, admin_token)
    generated = client.post(
        f"/api/v1/projects/{project_id}/generate/tz",
        headers=_auth(gk_token),
    )
    assert generated.status_code == 200
    assert "Демо-проект" in generated.json()["content"]
    assert "{{" not in generated.json()["content"]

    # 6. Чат (без LLM-ключа в тестах — fallback)
    chat = client.post(
        "/api/v1/chat",
        json={"message": "Что такое УГТ?"},
        headers=_auth(gk_token),
    )
    assert chat.status_code == 200
    assert chat.json()["reply"]["role"] == "assistant"

    # 7. Менеджер ЦНТР видит проект и выдаёт приоритет
    manager_token, _, _ = _register(client, "cntr_manager")
    manager_view = client.get(f"/api/v1/projects/{project_id}", headers=_auth(manager_token))
    assert manager_view.status_code == 200
    grant = client.patch(
        f"/api/v1/projects/{project_id}/members/{rd_id}/priority",
        json={"is_priority": True},
        headers=_auth(manager_token),
    )
    assert grant.status_code == 200
    assert grant.json()["is_priority"] is True
