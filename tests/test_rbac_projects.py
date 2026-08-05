"""RBAC: доступ к проектам — владелец, активный участник, персонал ЦНТР, посторонний."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.db.models import Project, ProjectMember
from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _register(client: TestClient, email: str, role: str) -> tuple[str, int]:
    data = register_test_user(
        client,
        email=email,
        full_name=f"User {role}",
        role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project_with_members(
    owner_id: int, member_id: int, member_role: str = "rd_executor"
) -> tuple[int, str]:
    """Создаёт проект напрямую в БД (эндпоинт создания появится в тикете 05)."""
    import asyncio

    from app.core.database import SessionLocal

    async def _create() -> tuple[int, str]:
        async with SessionLocal() as db:
            project = Project(
                name="RBAC Test Project",
                description="project for access checks",
                category="IT",
                target_level=5,
                current_level=2,
                created_by=owner_id,
            )
            db.add(project)
            await db.flush()
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=owner_id,
                    role_in_project="gk_customer",
                    is_priority=True,
                )
            )
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=member_id,
                    role_in_project=member_role,
                )
            )
            await db.commit()
            await db.refresh(project)
            return project.id, project.join_token

    return asyncio.run(_create())


def test_owner_can_read_project(client: TestClient) -> None:
    owner_token, owner_id = _register(client, _email("owner"), "gk_customer")
    member_token, member_id = _register(client, _email("member"), "rd_executor")
    project_id, _ = _create_project_with_members(owner_id, member_id)

    response = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert response.status_code == 200
    assert response.json()["project"]["name"] == "RBAC Test Project"


def test_active_member_can_read_project(client: TestClient) -> None:
    owner_token, owner_id = _register(client, _email("owner"), "gk_customer")
    member_token, member_id = _register(client, _email("member"), "rd_executor")
    project_id, _ = _create_project_with_members(owner_id, member_id)

    response = client.get(f"/api/v1/projects/{project_id}", headers=_auth(member_token))
    assert response.status_code == 200


def test_outsider_gets_404_not_403(client: TestClient) -> None:
    owner_token, owner_id = _register(client, _email("owner"), "gk_customer")
    member_token, member_id = _register(client, _email("member"), "rd_executor")
    outsider_token, _ = _register(client, _email("outsider"), "investor")
    project_id, _ = _create_project_with_members(owner_id, member_id)

    # 404 — не раскрываем существование проекта посторонним
    response = client.get(f"/api/v1/projects/{project_id}", headers=_auth(outsider_token))
    assert response.status_code == 404


def test_cntr_manager_sees_any_project(client: TestClient) -> None:
    owner_token, owner_id = _register(client, _email("owner"), "gk_customer")
    member_token, member_id = _register(client, _email("member"), "rd_executor")
    manager_token, _ = _register(client, _email("manager"), "cntr_manager")
    project_id, _ = _create_project_with_members(owner_id, member_id)

    response = client.get(f"/api/v1/projects/{project_id}", headers=_auth(manager_token))
    assert response.status_code == 200


def test_project_list_is_scoped(client: TestClient) -> None:
    owner_token, owner_id = _register(client, _email("owner"), "gk_customer")
    member_token, member_id = _register(client, _email("member"), "rd_executor")
    outsider_token, _ = _register(client, _email("outsider"), "investor")
    project_id, _ = _create_project_with_members(owner_id, member_id)

    owner_list = client.get("/api/v1/projects", headers=_auth(owner_token))
    assert owner_list.status_code == 200
    assert any(p["id"] == project_id for p in owner_list.json())

    member_list = client.get("/api/v1/projects", headers=_auth(member_token))
    assert member_list.status_code == 200
    assert any(p["id"] == project_id for p in member_list.json())

    outsider_list = client.get("/api/v1/projects", headers=_auth(outsider_token))
    assert outsider_list.status_code == 200
    assert all(p["id"] != project_id for p in outsider_list.json())


def test_questionnaire_save_requires_access(client: TestClient) -> None:
    owner_token, owner_id = _register(client, _email("owner"), "gk_customer")
    member_token, member_id = _register(client, _email("member"), "rd_executor")
    outsider_token, _ = _register(client, _email("outsider"), "investor")
    project_id, _ = _create_project_with_members(owner_id, member_id)

    payload = {
        "project_id": project_id,
        "level_id": 1,
        "checked_items": ["item-1"],
        "percentage": 50.0,
    }
    ok = client.post(
        "/api/v1/projects/questionnaire",
        json=payload,
        headers=_auth(owner_token),
    )
    assert ok.status_code == 201

    forbidden = client.post(
        "/api/v1/projects/questionnaire",
        json=payload,
        headers=_auth(outsider_token),
    )
    assert forbidden.status_code == 404


def test_unauthorized_request_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/projects/1")
    assert response.status_code == 401


def test_executors_catalog_public(client: TestClient) -> None:
    """Каталог исполнителей публичен (тикет 22: B1)."""
    anonymous = client.get("/api/v1/executors")
    assert anonymous.status_code == 200
