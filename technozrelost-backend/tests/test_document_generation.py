"""Генерация документов: резолв переменных (включая бюджет ТЭО), сохранение в реестр."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    email = f"gen-{uuid.uuid4().hex[:8]}@example.com"
    data = register_test_user(
        client,
        email=email,
        full_name=f"Gen User {role}",
        role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_tz_template(client: TestClient, admin_token: str) -> None:
    response = client.post(
        "/api/v1/rag/templates",
        json={
            "title": "ТЗ — тест",
            "doc_type": "tz",
            "raw_text": (
                "ТЕХНИЧЕСКОЕ ЗАДАНИЕ\n"
                "Проект: {{project_name}}\n"
                "Описание: {{project_description}}\n"
                "Бюджет: {{project_budget}} руб.\n"
                "Этап 1: {{project_budget_percent_30}} руб.\n"
                "Этап 2: {{project_budget_percent_40}} руб.\n"
                "УГТ1: {{level_1_percentage}}, критерий 0: {{level_1_checked_0}}\n"
                "Список критериев УГТ 1:\n{{level_1_items}}"
            ),
            "template_metadata": {"variables": []},
        },
        headers=_auth(admin_token),
    )
    assert response.status_code == 201, response.text


def _create_project_with_data(client: TestClient, token: str) -> dict:
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "Документный проект",
            "description": "Описание проекта для ТЗ",
            "category": "IT",
            "target_level": 4,
            "budget": 1000000,
            "questionnaire_results": [
                {
                    "level_id": 1,
                    "checked_items": ["Критерий А", "Критерий Б"],
                    "percentage": 90.0,
                }
            ],
        },
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_generate_tz_resolves_variables_and_saves(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    _seed_tz_template(client, admin_token)

    owner_token, _ = _register(client)
    project = _create_project_with_data(client, owner_token)

    response = client.post(
        f"/api/v1/projects/{project['id']}/generate/tz",
        headers=_auth(owner_token),
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["doc_type"] == "tz"
    normalized = data["content"].replace(" ", "").replace("\u00a0", "")
    assert "Документный проект" in data["content"]
    assert "Описание проекта для ТЗ" in data["content"]
    assert "1000000" in normalized  # бюджет
    assert "300000" in normalized  # 30% бюджета
    assert "400000" in normalized  # 40% бюджета
    assert "90%" in data["content"]
    assert "Критерий А" in data["content"]
    assert "Критерий Б" in data["content"]
    assert "{{" not in data["content"], "Неразрешённые переменные остались в тексте"
    assert data["document_id"] is not None

    # документ сохранён и виден в карточке проекта
    detail = client.get(f"/api/v1/projects/{project['id']}", headers=_auth(owner_token))
    assert detail.status_code == 200
    documents = detail.json()["documents"]
    assert len(documents) == 1
    assert documents[0]["doc_type"] == "tz"
    assert documents[0]["status"] == "draft"

    # аудит зафиксирован
    actions = [a["action"] for a in detail.json()["audit_trail"]]
    assert "document.generated" in actions


def test_generate_invalid_doc_type(client: TestClient) -> None:
    owner_token, _ = _register(client)
    project = _create_project_with_data(client, owner_token)

    response = client.post(
        f"/api/v1/projects/{project['id']}/generate/not_a_doc",
        headers=_auth(owner_token),
    )
    assert response.status_code == 400


def test_generate_without_template_404(client: TestClient) -> None:
    owner_token, _ = _register(client)
    project = _create_project_with_data(client, owner_token)

    response = client.post(
        f"/api/v1/projects/{project['id']}/generate/teo",
        headers=_auth(owner_token),
    )
    assert response.status_code == 404  # шаблон teo не засижен в тестовой БД


def test_generate_by_outsider_404(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    _seed_tz_template(client, admin_token)

    owner_token, _ = _register(client)
    outsider_token, _ = _register(client, "investor")
    project = _create_project_with_data(client, owner_token)

    response = client.post(
        f"/api/v1/projects/{project['id']}/generate/tz",
        headers=_auth(outsider_token),
    )
    assert response.status_code == 404


def test_generate_with_empty_levels_resolves_defaults(client: TestClient) -> None:
    """Паспорт с незаполненными уровнями не должен оставлять {{...}}."""
    admin_token, _ = _register(client, "cntr_admin")
    seeded = client.post(
        "/api/v1/rag/templates",
        json={
            "title": "Паспорт — тест",
            "doc_type": "passport",
            "raw_text": (
                "ПАСПОРТ\nУГТ 1: {{level_1_percentage}}\n"
                "УГТ 2: {{level_2_percentage}}\nКритериев: {{level_2_items_count}}"
            ),
            "template_metadata": {"variables": []},
        },
        headers=_auth(admin_token),
    )
    assert seeded.status_code == 201

    owner_token, _ = _register(client)
    project = _create_project_with_data(client, owner_token)  # ответы только для уровня 1

    response = client.post(
        f"/api/v1/projects/{project['id']}/generate/passport",
        headers=_auth(owner_token),
    )
    assert response.status_code == 200, response.text
    content = response.json()["content"]
    assert "{{" not in content
    assert "УГТ 1: 90%" in content
    assert "УГТ 2: 0%" in content
    assert "Критериев: 0" in content
