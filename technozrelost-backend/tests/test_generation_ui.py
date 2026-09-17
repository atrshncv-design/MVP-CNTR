"""Таск 05: кнопки генерации ТЗ/Паспорт/ТЭО + одиночный шаблон GET /rag/templates/{id}.

Шов generation: POST /projects/{id}/generate/{doc} (создатель/участник/staff,
черновик + аудит) и скачивание серверного шаблона без fallback.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    email = f"genui-{uuid.uuid4().hex[:8]}@example.com"
    data = register_test_user(
        client,
        email=email,
        full_name=f"Gen UI User {role}",
        role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


_TEMPLATES = {
    "tz": "ТЕХНИЧЕСКОЕ ЗАДАНИЕ\nПроект: {{project_name}}\nОписание: {{project_description}}",
    "passport": "ПАСПОРТ ПРОЕКТА\nПроект: {{project_name}}\nУровень: {{level_1_percentage}}",
    "teo": "ТЭО\nПроект: {{project_name}}\nБюджет: {{project_budget}} руб.",
}


def _seed_templates(client: TestClient, admin_token: str) -> dict[str, int]:
    ids: dict[str, int] = {}
    for doc_type, raw_text in _TEMPLATES.items():
        response = client.post(
            "/api/v1/rag/templates",
            json={
                "title": f"Шаблон {doc_type} — UI",
                "doc_type": doc_type,
                "raw_text": raw_text,
                "template_metadata": {"variables": [], "version": "v2"},
            },
            headers=_auth(admin_token),
        )
        assert response.status_code == 201, response.text
        ids[doc_type] = response.json()["id"]
    return ids


def _create_project(client: TestClient, token: str) -> dict:
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "UI-генерация документов",
            "description": "Проект для кнопок ТЗ/Паспорт/ТЭО",
            "category": "IT",
            "target_level": 4,
            "budget": 500000,
            "questionnaire_results": [
                {
                    "level_id": 1,
                    "checked_items": ["Критерий UI"],
                    "percentage": 80.0,
                }
            ],
        },
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_generate_all_three_doc_types_200_draft_audit(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    _seed_templates(client, admin_token)

    owner_token, _ = _register(client)
    project = _create_project(client, owner_token)

    for doc_type in ("tz", "passport", "teo"):
        response = client.post(
            f"/api/v1/projects/{project['id']}/generate/{doc_type}",
            headers=_auth(owner_token),
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["doc_type"] == doc_type
        assert data["content"]
        assert "{{" not in data["content"]
        assert "UI-генерация документов" in data["content"]
        assert data["document_id"] is not None

    detail = client.get(
        f"/api/v1/projects/{project['id']}", headers=_auth(owner_token)
    )
    assert detail.status_code == 200
    documents = detail.json()["documents"]
    by_type = {d["doc_type"]: d for d in documents}
    for doc_type in ("tz", "passport", "teo"):
        assert doc_type in by_type, f"черновик {doc_type} не сохранён"
        assert by_type[doc_type]["status"] == "draft"

    actions = [a["action"] for a in detail.json()["audit_trail"]]
    assert actions.count("document.generated") >= 3


def test_template_single_get_200_and_404(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    ids = _seed_templates(client, admin_token)

    user_token, _ = _register(client)
    response = client.get(
        f"/api/v1/rag/templates/{ids['tz']}", headers=_auth(user_token)
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["id"] == ids["tz"]
    assert data["doc_type"] == "tz"
    assert "{{project_name}}" in data["raw_text"]

    missing = client.get("/api/v1/rag/templates/987654321", headers=_auth(user_token))
    assert missing.status_code == 404


def test_generate_outsider_404_masking(client: TestClient) -> None:
    admin_token, _ = _register(client, "cntr_admin")
    _seed_templates(client, admin_token)

    owner_token, _ = _register(client)
    outsider_token, _ = _register(client, "investor")
    project = _create_project(client, owner_token)

    for doc_type in ("tz", "passport", "teo"):
        response = client.post(
            f"/api/v1/projects/{project['id']}/generate/{doc_type}",
            headers=_auth(outsider_token),
        )
        assert response.status_code == 404, response.text


def test_generate_invalid_doc_type_400(client: TestClient) -> None:
    owner_token, _ = _register(client)
    project = _create_project(client, owner_token)

    response = client.post(
        f"/api/v1/projects/{project['id']}/generate/not_a_doc",
        headers=_auth(owner_token),
    )
    assert response.status_code == 400
