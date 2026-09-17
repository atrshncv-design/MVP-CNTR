"""Таск 03 (R01/R03, истории 5–7): публичные деталки, серверный поиск, описание+статус.

Шов — публичная HTTP-граница реестров (без токена):
- GET /projects/registry/{id} — деталка проекта, 404 на мусор/приватный
- GET /nioktr/{reg} и GET /nioktr/organizations/{ogrn} — деталки без токена, 404
- ?search= — серверный поиск по всей базе (проекты, специалисты,
  организации, НИОКТР), а не по загруженному в браузер
- RegistryProjectOut отдаёт description и status
"""

from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import NioktrCard, Organization


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _register(client: TestClient, role: str = "gk_customer") -> str:
    from tests.support import register_test_user

    data = register_test_user(
        client,
        email=_email("d3"),
        full_name=f"Деталка {uuid.uuid4().hex[:4]}",
        role_slug=role,
    )
    return data["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_published(
    client: TestClient, name: str, description: str
) -> tuple[int, str]:
    """Проект УГТ 1–2 → auto_confirmed → опубликованный (виден в реестре).

    У каждого проекта свой владелец: переоценка тем же пользователем закрыта
    (403), поэтому владелец создаётся внутри хелпера. Возвращает (id, токен).
    """
    owner_token = _register(client)
    created = client.post(
        "/api/v1/assessments",
        headers=_auth(owner_token),
        json={
            "name": name,
            "description": description,
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2)
            ],
        },
    )
    assert created.status_code == 201, created.text
    pid = created.json()["id"]
    publish = client.put(
        f"/api/v1/projects/{pid}/publish",
        headers=_auth(owner_token),
        json={"is_public": True},
    )
    assert publish.status_code == 200, publish.text
    return pid, owner_token


def _seed_nioktr() -> tuple[str, str]:
    """Две карточки + организация; возвращает (reg_number, ogrn)."""
    ogrn = "1027700132195"
    reg1 = "125010100001-1"
    reg2 = "125010100002-2"

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
                ogrn=ogrn,
                org_type="scientific_org",
                competencies=["искусственный интеллект", "нейросети"],
                projects_count=2,
            )
            db.add(org)
            await db.flush()
            db.add(
                NioktrCard(
                    registration_number=reg1,
                    name="Исследование методов глубокого обучения для анализа изображений",
                    annotation="Разработка нейросетевых подходов к сегментации изображений.",
                    keywords=["глубокое обучение"],
                    nioktr_types=["Фундаментальное исследование"],
                    created_date="2025-01-10",
                    is_ai_area=True,
                    is_ai_usage=True,
                    executor_name=org.name,
                    executor_short_name=org.short_name,
                    executor_ogrn=org.ogrn,
                    customer_name="Министерство науки и высшего образования РФ",
                    budgets=[],
                    organization_id=org.id,
                )
            )
            db.add(
                NioktrCard(
                    registration_number=reg2,
                    name="Разработка композитных материалов для авиастроения",
                    annotation="Создание лёгких высокопрочных композитов.",
                    keywords=["композиты"],
                    nioktr_types=["Прикладное исследование"],
                    created_date="2025-02-15",
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
    return reg1, ogrn


def _verify_executor(client: TestClient, mgr_token: str, user_token: str) -> None:
    patched = client.patch(
        "/api/v1/profile",
        headers=_auth(user_token),
        json={"headline": "Ведущий инженер"},
    )
    assert patched.status_code == 200, patched.text
    submitted = client.post("/api/v1/profile/submit", headers=_auth(user_token))
    assert submitted.status_code == 200, submitted.text
    decided = client.post(
        f"/api/v1/manager/profiles/{submitted.json()['id']}/decide",
        headers=_auth(mgr_token),
        json={"action": "verify", "comment": "Ок"},
    )
    assert decided.status_code == 200, decided.text


# ─── Проект: деталка, карточка, поиск ────────────────────────────────────────


def test_public_project_detail_anonymous_and_404(client: TestClient) -> None:
    """Деталка проекта без токена; мусор и приватный проект — 404."""
    token_suffix = uuid.uuid4().hex[:8]
    pid, owner = _create_published(
        client, f"Публичный стенд {token_suffix}", f"Описание стенда {token_suffix}"
    )

    # Без токена — 200 с описанием и статусом
    detail = client.get(f"/api/v1/projects/registry/{pid}")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["id"] == pid
    assert body["description"] == f"Описание стенда {token_suffix}"
    assert body["status"] == "auto_confirmed"
    assert body["is_public"] is True

    # Мусор — 404 с кодом каталога, без токена
    garbage = client.get("/api/v1/projects/registry/999999999")
    assert garbage.status_code == 404
    assert garbage.headers.get("X-Error-Code") == "PROJECT_NOT_FOUND"

    # Приватный проект по прямой ссылке не раскрывается — тоже 404.
    # Отдельный владелец: у него ещё нет оценённых проектов.
    draft_owner = _register(client)
    draft = client.post(
        "/api/v1/assessments",
        headers=_auth(draft_owner),
        json={
            "name": f"Черновик {token_suffix}",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert draft.status_code == 201, draft.text
    draft_id = draft.json()["id"]
    hidden = client.get(f"/api/v1/projects/registry/{draft_id}")
    assert hidden.status_code == 404
    assert hidden.headers.get("X-Error-Code") == "PROJECT_NOT_FOUND"


def test_registry_card_has_description_and_status(client: TestClient) -> None:
    """Карточка витрины отдаёт описание и статус (история 7)."""
    token_suffix = uuid.uuid4().hex[:8]
    pid, _ = _create_published(
        client, f"Карточка {token_suffix}", f"Описание карточки {token_suffix}"
    )
    registry = client.get("/api/v1/projects/registry")
    assert registry.status_code == 200
    items = [r for r in registry.json() if r["id"] == pid]
    assert len(items) == 1
    assert items[0]["description"] == f"Описание карточки {token_suffix}"
    assert items[0]["status"] == "auto_confirmed"


def test_registry_server_search_finds_not_loaded(client: TestClient) -> None:
    """Серверный поиск находит то, что не загружено в браузер (история 6)."""
    uniq = uuid.uuid4().hex[:8]
    first, _ = _create_published(client, f"Альфа проект {uniq}", f"Описание альфа {uniq}")
    second, _ = _create_published(
        client, f"Бета зонд {uniq}", f"Уникальное сигма-описание {uniq}"
    )

    # Первая страница limit=1 содержит только один проект — второй
    # остаётся незагруженным в браузере; серверный поиск его находит.
    page = client.get("/api/v1/projects/registry?limit=1")
    assert page.status_code == 200
    assert len(page.json()) == 1
    page_ids = {r["id"] for r in page.json()}
    assert page_ids < {first, second}

    found = client.get(f"/api/v1/projects/registry?search=сигма-описание {uniq}")
    assert found.status_code == 200, found.text
    ids = {r["id"] for r in found.json()}
    assert second in ids
    assert first not in ids

    # Поиск по названию тоже серверный
    by_name = client.get(f"/api/v1/projects/registry?search=Бета зонд {uniq}")
    assert by_name.status_code == 200
    assert {r["id"] for r in by_name.json()} == {second}


# ─── НИОКТР и организации: деталки и поиск без токена ────────────────────────


def test_nioktr_detail_anonymous_and_404(client: TestClient) -> None:
    """Деталка НИОКТР по регномеру без токена; мусор — 404."""
    reg1, _ = _seed_nioktr()
    ok = client.get(f"/api/v1/nioktr/{reg1}")
    assert ok.status_code == 200, ok.text
    assert ok.json()["registration_number"] == reg1

    missing = client.get("/api/v1/nioktr/MUSOR-REG-999")
    assert missing.status_code == 404
    assert missing.headers.get("X-Error-Code") == "NIOKTR_CARD_NOT_FOUND"


def test_organization_detail_anonymous_and_404(client: TestClient) -> None:
    """Деталка организации по ОГРН без токена; мусор — 404."""
    _, ogrn = _seed_nioktr()
    ok = client.get(f"/api/v1/nioktr/organizations/{ogrn}")
    assert ok.status_code == 200, ok.text
    assert ok.json()["ogrn"] == ogrn

    missing = client.get("/api/v1/nioktr/organizations/0000000000000")
    assert missing.status_code == 404
    assert missing.headers.get("X-Error-Code") == "ORG_NOT_FOUND"


def test_nioktr_server_search_expanded(client: TestClient) -> None:
    """Поиск НИОКТР ищет по заказчику и регномеру, а не только по названию."""
    reg1, _ = _seed_nioktr()
    by_customer = client.get("/api/v1/nioktr?search=Авиационный")
    assert by_customer.status_code == 200
    assert {c["registration_number"] for c in by_customer.json()} == {"125010100002-2"}

    by_reg = client.get(f"/api/v1/nioktr?search={reg1}")
    assert by_reg.status_code == 200
    assert {c["registration_number"] for c in by_reg.json()} == {reg1}

    by_org = client.get("/api/v1/nioktr/organizations?search=ИПИИ")
    assert by_org.status_code == 200
    assert any(o["ogrn"] == "1027700132195" for o in by_org.json())


def test_organizations_search_and_ogrn(client: TestClient) -> None:
    """Поиск организаций серверный; карточка несёт ОГРН для деталки /customers/[ogrn]."""
    _seed_nioktr()
    found = client.get("/api/v1/executors/organizations?search=ИПИИ")
    assert found.status_code == 200, found.text
    assert any(o["ogrn"] == "1027700132195" for o in found.json())

    missing = client.get("/api/v1/executors/organizations?search=zzz-несуществует-zzz")
    assert missing.status_code == 200
    assert missing.json() == []

    # Сквозной каталог тоже ищет сервером и отдаёт ОГРН у организаций
    through = client.get("/api/v1/executors?search=ИПИИ")
    assert through.status_code == 200, through.text
    orgs = [e for e in through.json() if e["id"] < 0]
    assert orgs, "организации пропали из сквозного каталога"
    assert all(o["ogrn"] for o in orgs)


def test_specialists_server_search(client: TestClient) -> None:
    """Поиск специалистов идёт на сервере: находит незагруженного исполнителя."""
    from tests.support import register_test_user

    mgr = _register(client, "cntr_manager")
    uniq = uuid.uuid4().hex[:8]
    first = register_test_user(
        client,
        email=_email("spec1"),
        full_name=f"Альфа Исполнитель {uniq}",
        role_slug="rd_executor",
    )
    second = register_test_user(
        client,
        email=_email("spec2"),
        full_name=f"Сигма Исполнитель {uniq}",
        role_slug="rd_executor",
    )
    _verify_executor(client, mgr, first["access_token"])
    _verify_executor(client, mgr, second["access_token"])

    found = client.get(f"/api/v1/executors/specialists?search=Сигма Исполнитель {uniq}")
    assert found.status_code == 200, found.text
    names = [e["full_name"] for e in found.json()]
    assert f"Сигма Исполнитель {uniq}" in names
    assert f"Альфа Исполнитель {uniq}" not in names
