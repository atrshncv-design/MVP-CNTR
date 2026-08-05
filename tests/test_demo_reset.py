"""Тикет 19: повторяемая демо-среда — reset/seed, идемпотентность, production-guard."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text

from app.core.database import SessionLocal
from app.db import reset_demo
from app.db.models import NioktrCard, Organization, Project, User


def _write_mini_nioktr(tmp_path: Path) -> Path:
    source = tmp_path / "mini_nioktr.json"
    source.write_text(
        json.dumps(
            {
                "cards": [
                    {
                        "registration_number": "DEMO-SEED-001",
                        "name": "Демонстрационная НИОКТР",
                        "annotation": "Аннотация демо-карточки.",
                        "keyword_list": ["демо"],
                        "nioktr_types": ["Прикладное исследование"],
                        "is_ai_area": False,
                        "is_ai_usage": False,
                        "executor": {
                            "name": "ООО ДЕМО-ЛАБОРАТОРИЯ",
                            "short_name": "ДЕМОЛАБ",
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
    return source


def _counts() -> dict[str, int]:
    async def _go() -> dict[str, int]:
        async with SessionLocal() as db:
            return {
                "users": await db.scalar(select(func.count()).select_from(User)),
                "projects": await db.scalar(select(func.count()).select_from(Project)),
                "cards": await db.scalar(select(func.count()).select_from(NioktrCard)),
                "orgs": await db.scalar(select(func.count()).select_from(Organization)),
            }

    return asyncio.run(_go())


def _distinct_counts() -> dict[str, int]:
    """Счётчики уникальных ключей — должны совпадать с общими счётчиками."""

    async def _go() -> dict[str, int]:
        async with SessionLocal() as db:
            return {
                "users": await db.scalar(select(func.count(func.distinct(User.email)))),
                "projects": await db.scalar(select(func.count(func.distinct(Project.name)))),
                "cards": await db.scalar(
                    select(func.count(func.distinct(NioktrCard.registration_number)))
                ),
            }

    return asyncio.run(_go())


def _primary_roles() -> dict[str, str]:
    async def _go() -> dict[str, str]:
        async with SessionLocal() as db:
            rows = (
                await db.execute(
                    text(
                        """
                        SELECT u.email, r.slug
                        FROM public.users u
                        JOIN public.user_roles ur ON ur.user_id = u.id
                        JOIN public.roles r ON r.id = ur.role_id
                        WHERE ur.is_primary
                        """
                    )
                )
            ).all()
            return {email: slug for email, slug in rows}

    return asyncio.run(_go())


def test_demo_seed_idempotent(tmp_path: Path, client: TestClient) -> None:
    """Первый прогон — сброс + seed; повторный (через CLI) — ничего не дублирует."""
    mini = _write_mini_nioktr(tmp_path)

    asyncio.run(reset_demo.reset_database())
    asyncio.run(reset_demo.seed_all(nioktr_input=mini))
    first = _counts()

    assert first == {"users": 5, "projects": 10, "cards": 1, "orgs": 1}

    # Повторный запуск через CLI-точку входа (--seed-only): счётчики не растут.
    reset_demo.main(["--seed-only", "--nioktr-input", str(mini)])
    second = _counts()
    assert second == first

    # Дубликатов нет: уникальные ключи совпадают с общими счётчиками.
    assert _distinct_counts() == {
        "users": first["users"],
        "projects": first["projects"],
        "cards": first["cards"],
    }

    # У каждого демо-аккаунта ровно одна primary-роль из списка.
    expected = {u["email"]: u["role_slug"] for u in reset_demo.DEMO_USERS}
    assert _primary_roles() == expected

    # Демо-аккаунты реально логинятся через API.
    for email in ("demo.gk@example.com", "demo.manager@example.com", "demo.investor@example.com"):
        login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": reset_demo.DEMO_PASSWORD},
        )
        assert login.status_code == 200, login.text

    # Девять опубликованных проектов УГТ 1–9 видны в реестре.
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "demo.gk@example.com", "password": reset_demo.DEMO_PASSWORD},
    ).json()["access_token"]
    registry = client.get(
        "/api/v1/projects/registry",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert registry.status_code == 200
    levels = sorted(p["current_level"] for p in registry.json())
    assert levels == list(range(1, 10))


def test_full_reset_truncates_and_production_guard(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Полный сброс очищает данные; в production-профиле reset заблокирован."""
    mini = _write_mini_nioktr(tmp_path)

    async def _stray() -> None:
        async with SessionLocal() as db:
            user = User(email="stray@example.com", password_hash="x", full_name="Stray")
            db.add(user)
            await db.flush()
            db.add(Project(name="stray-project", target_level=9, created_by=user.id))
            await db.commit()

    asyncio.run(_stray())
    assert _counts()["users"] == 1 and _counts()["projects"] == 1

    asyncio.run(reset_demo.reset_database())
    assert _counts() == {"users": 0, "projects": 0, "cards": 0, "orgs": 0}

    asyncio.run(reset_demo.seed_all(nioktr_input=mini))
    assert _counts()["users"] == 5 and _counts()["projects"] == 10

    # US 101: production-профиль технически блокирует reset.
    monkeypatch.setattr("app.core.config.settings.app_env", "production")
    with pytest.raises(SystemExit):
        reset_demo.main(["--full"])
