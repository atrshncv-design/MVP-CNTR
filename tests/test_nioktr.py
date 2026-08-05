"""Реестр НИОКТР: список/фильтры/деталь, каталог организаций, идемпотентность seed."""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import NioktrCard, Organization


def _register(client: TestClient, role: str = "gk_customer") -> str:
    email = f"nioktr-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Nioktr User",
            "role_slug": role,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_nioktr() -> None:
    async def _create() -> None:
        from app.core.database import SessionLocal

        async with SessionLocal() as db:
            existing = await db.scalar(select(NioktrCard).limit(1))
            if existing:
                return
            org = Organization(
                name="ФЕДЕРАЛЬНОЕ ГОСУДАРСТВЕННОЕ БЮДЖЕТНОЕ УЧРЕЖДЕНИЕ НАУКИ "
                "ИНСТИТУТ ПРОБЛЕМ ИСКУССТВЕННОГО ИНТЕЛЛЕКТА",
                short_name="ИПИИ РАН",
                ogrn="1027700132195",
                org_type="scientific_org",
                competencies=["искусственный интеллект", "нейросети"],
                projects_count=2,
            )
            db.add(org)
            await db.flush()
            db.add(
                NioktrCard(
                    registration_number="125010100001-1",
                    name="Исследование методов глубокого обучения для анализа изображений",
                    annotation="Разработка нейросетевых подходов к сегментации изображений.",
                    keywords=["глубокое обучение", "компьютерное зрение"],
                    nioktr_types=["Фундаментальное исследование"],
                    state_program="Научно-технологическое развитие РФ",
                    created_date="2025-01-10",
                    start_date="2025-01-01",
                    end_date="2027-12-31",
                    is_ai_area=True,
                    is_ai_usage=True,
                    executor_name=org.name,
                    executor_short_name=org.short_name,
                    executor_ogrn=org.ogrn,
                    customer_name="Министерство науки и высшего образования РФ",
                    budgets=[{"funds": "5000.000", "budget_type": "Средства федерального бюджета"}],
                    organization_id=org.id,
                )
            )
            db.add(
                NioktrCard(
                    registration_number="125010100002-2",
                    name="Разработка композитных материалов для авиастроения",
                    annotation="Создание лёгких высокопрочных композитов.",
                    keywords=["композиты", "авиастроение"],
                    nioktr_types=["Прикладное исследование"],
                    state_program=None,
                    created_date="2025-02-15",
                    start_date="2025-02-01",
                    end_date="2026-06-30",
                    is_ai_area=False,
                    is_ai_usage=False,
                    executor_name=org.name,
                    executor_short_name=org.short_name,
                    executor_ogrn=org.ogrn,
                    customer_name="ПАО Авиационный завод",
                    budgets=[],
                    organization_id=org.id,
                )
            )
            await db.commit()

    asyncio.run(_create())


def test_nioktr_list_and_filters(client: TestClient) -> None:
    _seed_nioktr()
    token = _register(client)

    all_cards = client.get("/api/v1/nioktr", headers=_auth(token))
    assert all_cards.status_code == 200
    assert len(all_cards.json()) == 2

    ai = client.get("/api/v1/nioktr?ai=true", headers=_auth(token))
    assert ai.status_code == 200
    assert len(ai.json()) == 1
    assert ai.json()[0]["registration_number"] == "125010100001-1"

    search = client.get("/api/v1/nioktr?search=композит", headers=_auth(token))
    assert search.status_code == 200
    assert len(search.json()) == 1
    assert search.json()[0]["registration_number"] == "125010100002-2"

    by_type = client.get(
        "/api/v1/nioktr?type=Прикладное исследование", headers=_auth(token)
    )
    assert by_type.status_code == 200
    assert len(by_type.json()) == 1

    by_customer = client.get(
        "/api/v1/nioktr?customer=Авиационный", headers=_auth(token)
    )
    assert by_customer.status_code == 200
    assert len(by_customer.json()) == 1


def test_nioktr_detail(client: TestClient) -> None:
    _seed_nioktr()
    token = _register(client)

    ok = client.get("/api/v1/nioktr/125010100001-1", headers=_auth(token))
    assert ok.status_code == 200
    data = ok.json()
    assert data["name"].startswith("Исследование методов")
    assert data["is_ai_area"] is True
    assert data["executor_short_name"] == "ИПИИ РАН"
    assert data["budgets"][0]["funds"] == "5000.000"

    missing = client.get("/api/v1/nioktr/NOT-EXISTS-99", headers=_auth(token))
    assert missing.status_code == 404


def test_nioktr_organizations_catalog(client: TestClient) -> None:
    _seed_nioktr()
    token = _register(client)

    orgs = client.get("/api/v1/nioktr/organizations", headers=_auth(token))
    assert orgs.status_code == 200
    data = orgs.json()
    assert len(data) == 1
    assert data[0]["ogrn"] == "1027700132195"
    assert data[0]["projects_count"] == 2
    assert "искусственный интеллект" in data[0]["competencies"]

    detail = client.get("/api/v1/nioktr/organizations/1027700132195", headers=_auth(token))
    assert detail.status_code == 200
    assert len(detail.json()["nioktr_cards"]) == 2

    missing = client.get("/api/v1/nioktr/organizations/999999", headers=_auth(token))
    assert missing.status_code == 404


def test_nioktr_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/nioktr").status_code == 401
    assert client.get("/api/v1/nioktr/organizations").status_code == 401


def test_nioktr_seed_idempotent(tmp_path: Path, client: TestClient) -> None:
    """Seed запускается дважды на одном входе — количество карточек не растёт."""
    token = _register(client)
    source = tmp_path / "mini_nioktr.json"
    source.write_text(
        json.dumps(
            {
                "cards": [
                    {
                        "registration_number": "SEED-TEST-001",
                        "name": "Тестовая работа",
                        "annotation": "Аннотация",
                        "keyword_list": ["тест"],
                        "nioktr_types": ["Прикладное исследование"],
                        "is_ai_area": False,
                        "is_ai_usage": False,
                        "executor": {
                            "name": "ООО ТЕСТОВАЯ ЛАБОРАТОРИЯ",
                            "short_name": "ТЕСТЛАБ",
                            "ogrn": "1112223334445",
                        },
                        "budgets": [],
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    from app.db.seed_nioktr import seed

    asyncio.run(seed(source, drop_old_technologies=True))
    asyncio.run(seed(source, drop_old_technologies=True))

    response = client.get("/api/v1/nioktr?search=Тестовая работа", headers=_auth(token))
    assert response.status_code == 200
    assert len(response.json()) == 1
