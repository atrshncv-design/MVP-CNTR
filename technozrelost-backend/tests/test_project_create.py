"""Создание проекта через API: опросник, токен, приоритет создателя, расчёт УГТ."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.db.models import ProjectMember, QuestionnaireResult


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    email = f"create-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Create User",
            "role_slug": role,
            "consents": [
                {"slug": "terms", "version": 1, "accepted": True},
                {"slug": "privacy", "version": 1, "accepted": True},
            ],
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _sample_results() -> list[dict]:
    """УГТ 1-2 закрыты (≥70%), УГТ 3 — нет → текущий уровень = 2."""
    return [
        {"level_id": 1, "checked_items": ["a", "b"], "percentage": 80.0},
        {"level_id": 2, "checked_items": ["c"], "percentage": 75.0},
        {"level_id": 3, "checked_items": [], "percentage": 40.0},
    ]


def test_create_project_returns_token_and_201(client: TestClient) -> None:
    token, _ = _register(client)

    response = client.post(
        "/api/v1/projects",
        json={
            "name": "Новый проект",
            "description": "Описание",
            "category": "IT",
            "target_level": 5,
            "questionnaire_results": _sample_results(),
        },
        headers=_auth(token),
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["id"] > 0
    assert data["join_token"].startswith("TZ-")
    assert len(data["join_token"]) == 9  # TZ- + 6 символов
    assert data["current_level"] == 2
    assert data["name"] == "Новый проект"


def test_creator_is_priority_member(client: TestClient) -> None:
    token, user_id = _register(client)
    created = client.post(
        "/api/v1/projects",
        json={"name": "Мой проект", "questionnaire_results": _sample_results()},
        headers=_auth(token),
    )
    assert created.status_code == 201
    project_id = created.json()["id"]

    import asyncio

    from sqlalchemy import select

    from app.core.database import SessionLocal

    async def _fetch() -> tuple[ProjectMember | None, list[QuestionnaireResult]]:
        async with SessionLocal() as db:
            member = await db.scalar(
                select(ProjectMember).where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id,
                )
            )
            results = list(
                (
                    await db.execute(
                        select(QuestionnaireResult).where(
                            QuestionnaireResult.project_id == project_id
                        )
                    )
                )
                .scalars()
                .all()
            )
            return member, results

    member, results = asyncio.run(_fetch())
    assert member is not None
    assert member.is_priority is True
    assert member.status == "active"
    assert len(results) == 3


def test_create_project_without_questionnaire_current_level_zero(client: TestClient) -> None:
    token, _ = _register(client)
    response = client.post(
        "/api/v1/projects",
        json={"name": "Пустой проект"},
        headers=_auth(token),
    )
    assert response.status_code == 201
    assert response.json()["current_level"] == 0


def test_new_project_visible_in_own_list_and_detail(client: TestClient) -> None:
    token, _ = _register(client)
    created = client.post(
        "/api/v1/projects",
        json={"name": "Для списка", "questionnaire_results": _sample_results()},
        headers=_auth(token),
    )
    project_id = created.json()["id"]

    listing = client.get("/api/v1/projects", headers=_auth(token))
    assert listing.status_code == 200
    assert any(p["id"] == project_id for p in listing.json())

    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(token))
    assert detail.status_code == 200
    assert detail.json()["project"]["join_token"].startswith("TZ-")
    assert len(detail.json()["questionnaire_results"]) == 3


def test_create_project_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/projects", json={"name": "Аноним"})
    assert response.status_code == 401


def test_target_level_validation(client: TestClient) -> None:
    token, _ = _register(client)
    response = client.post(
        "/api/v1/projects",
        json={"name": "Плохой уровень", "target_level": 12},
        headers=_auth(token),
    )
    assert response.status_code == 422
