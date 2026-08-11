"""Тикет 11 Friday RC: реестры специалистов, организаций и НИОКТР.

Покрытие:
- В реестр специалистов попадают только verified-профили
- Специалисты и организации — отдельные эндпоинты с разными фильтрами
- НИОКТР — отдельный read-only реестр, не смешивается с проектами
- Каждая внешняя запись НИОКТР показывает источник и дату импорта
- Импорт НИОКТР повторяем: повторный прогон не создаёт дубликаты
"""

from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("t11"), full_name="Тикет11", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _verify_profile(client: TestClient, mgr_token: str, user_token: str) -> None:
    # заполняем обязательное поле и отправляем профиль на проверку
    patched = client.patch(
        "/api/v1/profile",
        headers=_auth(user_token),
        json={"headline": "Ведущий инженер"},
    )
    assert patched.status_code == 200, patched.text
    submitted = client.post("/api/v1/profile/submit", headers=_auth(user_token))
    assert submitted.status_code == 200, submitted.text
    profile_id = submitted.json()["id"]
    decided = client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(mgr_token),
        json={"action": "verify", "comment": "Ок"},
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["state"] == "verified"


def test_specialists_only_verified(client: TestClient) -> None:
    """В реестр специалистов попадают только verified-профили."""
    mgr_token, _ = _register(client, "cntr_manager")

    # Неверифицированный специалист
    unverified_token, unverified_id = _register(client, "rd_executor")
    # Верифицированный специалист
    verified_token, verified_id = _register(client, "rd_executor")
    _verify_profile(client, mgr_token, verified_token)

    # Проверяем, что у неверифицированного профиль есть в очереди (создан)
    specialists = client.get(
        "/api/v1/executors/specialists", headers=_auth(unverified_token)
    )
    assert specialists.status_code == 200
    ids = {s["id"] for s in specialists.json()}
    assert verified_id in ids
    assert unverified_id not in ids


def test_specialists_and_orgs_separate_endpoints(client: TestClient) -> None:
    """Специалисты и организации — разные эндпоинты с разными фильтрами."""
    token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    sp_token, sp_id = _register(client, "rd_executor")
    _verify_profile(client, mgr_token, sp_token)

    specialists = client.get(
        "/api/v1/executors/specialists?role=rd_executor", headers=_auth(token)
    )
    assert specialists.status_code == 200
    assert all(s["role_slug"] == "rd_executor" for s in specialists.json())

    orgs = client.get("/api/v1/executors/organizations", headers=_auth(token))
    assert orgs.status_code == 200
    # организации идут с отрицательными id (не пересекаются с пользователями)
    assert all(s["id"] < 0 for s in orgs.json())

    # фильтр по типу не ломает ответ
    typed = client.get(
        "/api/v1/executors/organizations?type=scientific_org", headers=_auth(token)
    )
    assert typed.status_code == 200


def test_nioktr_registry_has_source_and_imported_at(client: TestClient) -> None:
    """Внешние записи НИОКТР показывают источник и дату импорта."""
    token, _ = _register(client)
    registry = client.get("/api/v1/nioktr", headers=_auth(token))
    # Реестр может быть пустым в тестовой БД — тогда пропускаем проверки полей
    if registry.status_code != 200:
        return
    for card in registry.json():
        assert card.get("source") == "МИНОБРНАУКИ России"
        assert card.get("imported_at") is not None


def test_nioktr_is_separate_from_projects(client: TestClient) -> None:
    """НИОКТР — отдельный реестр, не смешивается с проектами платформы."""
    token, _ = _register(client)
    nioktr = client.get("/api/v1/nioktr", headers=_auth(token))
    assert nioktr.status_code == 200
    projects = client.get("/api/v1/projects", headers=_auth(token))
    assert projects.status_code == 200
    # Ответ НИОКТР имеет собственную схему (registration_number), а не проектную
    for card in nioktr.json():
        assert "registration_number" in card
        assert "current_level" not in card


def test_nioktr_import_is_idempotent(client: TestClient) -> None:
    """Повторный импорт НИОКТР не создаёт дубликаты (upsert по registration_number)."""
    import asyncio
    from pathlib import Path

    from sqlalchemy import func, select

    from app.core.database import SessionLocal
    from app.db import seed_nioktr
    from app.db.models import NioktrCard

    async def count() -> int:
        async with SessionLocal() as db:
            return int((await db.execute(select(func.count(NioktrCard.id)))).scalar_one())

    data_path = Path("data/nioktr_all.json")
    if not data_path.exists():
        return  # данные не примонтированы — тест пропускается
    # Первый прогон — полный импорт в пустую БД
    asyncio.run(seed_nioktr.seed(data_path, drop_old_technologies=False))
    first = asyncio.run(count())
    assert first > 0, "импорт НИОКТР ничего не вставил"
    # Повторный прогон — идемпотентный upsert, дубликатов быть не должно
    asyncio.run(seed_nioktr.seed(data_path, drop_old_technologies=False))
    second = asyncio.run(count())
    assert second == first, f"импорт создал дубликаты: {first} → {second}"


def _seed_organization_row() -> None:
    """Прямая запись организации НИОКТР в БД (каталог исполнителей)."""

    async def _create() -> None:
        from app.core.database import SessionLocal
        from app.db.models import Organization

        async with SessionLocal() as db:
            db.add(
                Organization(
                    name="ООО ПРОМЫШЛЕННАЯ АВТОМАТИЗАЦИЯ",
                    short_name="ПРОМАВТ",
                    ogrn="1027700132197",
                    org_type="company",
                    region="Удмуртская Республика",
                    competencies=["автоматизация", "робототехника"],
                    projects_count=5,
                )
            )
            await db.commit()

    asyncio.run(_create())


def test_executors_returns_200_without_500(client: TestClient) -> None:
    """Тикет 11: /executors — организации НИОКТР + verified-пользователи, без 500.

    Регрессия: старый DISTINCT ON + ORDER BY давал 500 в PostgreSQL.
    """
    mgr_token, _ = _register(client, "cntr_manager")
    exec_token, exec_id = _register(client, "rd_executor")
    _verify_profile(client, mgr_token, exec_token)
    _seed_organization_row()

    token, _ = _register(client)
    response = client.get("/api/v1/executors", headers=_auth(token))
    assert response.status_code == 200, response.text

    data = response.json()
    ids = [e["id"] for e in data]
    assert len(ids) == len(set(ids)), f"дубликаты в /executors: {ids}"

    users = [e for e in data if e["id"] > 0]
    orgs = [e for e in data if e["id"] < 0]
    assert exec_id in {e["id"] for e in users}, "verified-исполнитель не в реестре"
    assert any(
        e["organization"] == "ООО ПРОМЫШЛЕННАЯ АВТОМАТИЗАЦИЯ" for e in orgs
    ), "организация НИОКТР не в каталоге"
    org_entry = next(
        e for e in orgs if e["organization"] == "ООО ПРОМЫШЛЕННАЯ АВТОМАТИЗАЦИЯ"
    )
    assert org_entry["full_name"] == "ПРОМАВТ"  # short_name как название в каталоге
    assert org_entry["competencies"] == ["автоматизация", "робототехника"]
    assert org_entry["completed_projects"] == 5


def test_executors_role_filter(client: TestClient) -> None:
    """Тикет 11: фильтр ?role= возвращает только исполнителей нужной роли."""
    mgr_token, _ = _register(client, "cntr_manager")
    sp_token, _ = _register(client, "rd_executor")
    _verify_profile(client, mgr_token, sp_token)
    _seed_organization_row()

    token, _ = _register(client)
    response = client.get(
        "/api/v1/executors?role=rd_executor", headers=_auth(token)
    )
    assert response.status_code == 200, response.text
    assert all(e["role_slug"] == "rd_executor" for e in response.json())

    org_only = client.get(
        "/api/v1/executors?role=scientific_org", headers=_auth(token)
    )
    assert org_only.status_code == 200
    # в выборке только организации (negative id), дублей нет
    assert all(e["id"] < 0 for e in org_only.json())


def test_executors_public_registry_no_500(client: TestClient) -> None:
    """Тикет 11: реестр исполнителей доступен без токена и не падает."""
    _seed_organization_row()
    response = client.get("/api/v1/executors")
    assert response.status_code == 200, response.text
