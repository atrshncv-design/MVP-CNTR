"""Реестры: технологии (организация, фильтры) и исполнители (организации + пользователи)."""

from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient

from app.db.models import Organization, Technology


def _register(client: TestClient, role: str = "gk_customer") -> str:
    email = f"reg-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Reg User",
            "role_slug": role,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_registries() -> None:
    async def _create() -> None:
        from sqlalchemy import select

        from app.core.database import SessionLocal

        async with SessionLocal() as db:
            existing = await db.scalar(select(Organization).limit(1))
            if existing:
                return
            org = Organization(
                name="НИИ Искусственного Интеллекта",
                short_name="НИИ ИИ",
                ogrn="1234567890",
                org_type="scientific_org",
                competencies=["машинное обучение", "компьютерное зрение"],
                projects_count=5,
            )
            db.add(org)
            await db.flush()
            db.add(
                Technology(
                    name="Нейросетевой анализатор дефектов",
                    description="AI-система контроля качества",
                    category="AI/ML",
                    keywords=["нейросети", "контроль"],
                    current_level=3,
                    target_level=7,
                    registration_number="ABC-001",
                    organization_id=org.id,
                )
            )
            db.add(
                Technology(
                    name="Композитный материал",
                    description="Материаловедение",
                    category="Материалы",
                    keywords=["композиты"],
                    current_level=1,
                    target_level=9,
                    registration_number="ABC-002",
                )
            )
            await db.commit()

    asyncio.run(_create())


def test_technologies_return_organization_and_filters(client: TestClient) -> None:
    _seed_registries()
    token = _register(client)

    all_tech = client.get("/api/v1/technologies", headers=_auth(token))
    assert all_tech.status_code == 200
    assert len(all_tech.json()) == 2

    ai = client.get("/api/v1/technologies?category=AI/ML", headers=_auth(token))
    assert ai.status_code == 200
    assert len(ai.json()) == 1
    assert ai.json()[0]["organization"] == "НИИ Искусственного Интеллекта"
    assert ai.json()[0]["current_level"] == 3

    high = client.get("/api/v1/technologies?min_level=2", headers=_auth(token))
    assert len(high.json()) == 1
    assert high.json()[0]["name"] == "Нейросетевой анализатор дефектов"


def test_technologies_require_auth(client: TestClient) -> None:
    response = client.get("/api/v1/technologies")
    assert response.status_code == 401


def test_executors_include_organizations_and_users(client: TestClient) -> None:
    _seed_registries()
    gk_token = _register(client)
    _register(client, "rd_executor")  # живой пользователь-исполнитель

    response = client.get("/api/v1/executors", headers=_auth(gk_token))
    assert response.status_code == 200
    data = response.json()

    orgs = [e for e in data if e["id"] < 0]
    users = [e for e in data if e["id"] > 0]
    assert len(orgs) == 1
    assert orgs[0]["full_name"] == "НИИ ИИ"
    assert orgs[0]["organization"] == "НИИ Искусственного Интеллекта"
    assert orgs[0]["role_slug"] == "scientific_org"
    assert orgs[0]["competencies"] == ["машинное обучение", "компьютерное зрение"]
    assert orgs[0]["completed_projects"] == 5
    assert len(users) >= 1


def test_executors_role_filter(client: TestClient) -> None:
    _seed_registries()
    gk_token = _register(client)

    scientific = client.get(
        "/api/v1/executors?role=scientific_org", headers=_auth(gk_token)
    )
    assert scientific.status_code == 200
    assert all(e["role_slug"] == "scientific_org" for e in scientific.json())
    assert len(scientific.json()) == 1
