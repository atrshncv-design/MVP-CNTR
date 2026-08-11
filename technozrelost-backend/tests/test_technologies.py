"""Тикет 11: реестр технологий — organization, компетенции, фильтры, без 500."""

from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> str:
    data = register_test_user(
        client, email=_email("t11t"), full_name="Тикет11Т", role_slug=role
    )
    return data["access_token"]


def _seed_org_and_technologies() -> None:
    """Прямая запись в БД: организация + 3 технологии (2 — с общей организацией)."""

    async def _create() -> None:
        from app.core.database import SessionLocal
        from app.db.models import Organization, Technology

        async with SessionLocal() as db:
            org = Organization(
                name="ООО НАУЧНЫЕ СИСТЕМЫ",
                short_name="НАУЧСИСТЕМЫ",
                ogrn="1027700132196",
                org_type="company",
                region="Удмуртская Республика",
                competencies=["робототехника", "компьютерное зрение"],
                projects_count=3,
            )
            db.add(org)
            await db.flush()

            db.add_all(
                [
                    Technology(
                        name="Система технического зрения",
                        description="Нейросетевая система распознавания дефектов.",
                        category="ИИ и машинное обучение",
                        keywords=["компьютерное зрение", "нейросети"],
                        current_level=7,
                        target_level=9,
                        status="active",
                        organization_id=org.id,
                    ),
                    Technology(
                        name="Промышленный робот-манипулятор",
                        description="Робот для сборочных производств.",
                        category="Робототехника",
                        keywords=["робототехника"],
                        current_level=5,
                        target_level=8,
                        status="active",
                        organization_id=org.id,
                    ),
                    Technology(
                        name="Композитный материал",
                        description="Лёгкий высокопрочный композит.",
                        category="Материалы",
                        keywords=["композиты"],
                        current_level=3,
                        target_level=6,
                        status="archived",
                        organization_id=None,
                    ),
                ]
            )
            await db.commit()

    asyncio.run(_create())


def test_technologies_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/technologies").status_code == 401


def test_technologies_returns_organization_and_competencies(client: TestClient) -> None:
    """organization из связанной организации + компетенции без дубликатов."""
    _seed_org_and_technologies()
    token = _register(client)

    response = client.get("/api/v1/technologies", headers=_auth(token))
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) == 3

    tech = next(t for t in data if t["name"] == "Система технического зрения")
    assert tech["organization"] == "ООО НАУЧНЫЕ СИСТЕМЫ"
    # компетенции = keywords технологии + competencies организации, без дублей
    assert tech["competencies"] == ["компьютерное зрение", "нейросети", "робототехника"]
    assert len(tech["competencies"]) == len(set(tech["competencies"]))

    without_org = next(t for t in data if t["name"] == "Композитный материал")
    assert without_org["organization"] is None
    assert without_org["competencies"] == ["композиты"]


def test_technologies_filters_status_category_levels(client: TestClient) -> None:
    _seed_org_and_technologies()
    token = _register(client)

    by_status = client.get(
        "/api/v1/technologies?status=active", headers=_auth(token)
    )
    assert by_status.status_code == 200
    assert {t["name"] for t in by_status.json()} == {
        "Система технического зрения",
        "Промышленный робот-манипулятор",
    }

    by_category = client.get(
        "/api/v1/technologies?category=Робототехника", headers=_auth(token)
    )
    assert by_category.status_code == 200
    assert len(by_category.json()) == 1
    assert by_category.json()[0]["name"] == "Промышленный робот-манипулятор"

    by_min = client.get("/api/v1/technologies?min_level=5", headers=_auth(token))
    assert by_min.status_code == 200
    assert {t["name"] for t in by_min.json()} == {
        "Система технического зрения",
        "Промышленный робот-манипулятор",
    }

    by_max = client.get("/api/v1/technologies?max_level=6", headers=_auth(token))
    assert by_max.status_code == 200
    assert {t["name"] for t in by_max.json()} == {
        "Композитный материал",
        "Промышленный робот-манипулятор",  # current_level=5 ≤ 6
    }

    combined = client.get(
        "/api/v1/technologies?status=active&min_level=7", headers=_auth(token)
    )
    assert combined.status_code == 200
    assert {t["name"] for t in combined.json()} == {"Система технического зрения"}


def test_technologies_no_duplicates_for_shared_org(client: TestClient) -> None:
    """Общая организация не дублирует записи (DISTINCT-поведение, без 500)."""
    _seed_org_and_technologies()
    token = _register(client)

    response = client.get("/api/v1/technologies", headers=_auth(token))
    assert response.status_code == 200, response.text
    data = response.json()
    names = [t["name"] for t in data]
    assert len(names) == len(set(names)), f"дубликаты в реестре: {names}"
    assert len(data) == 3
