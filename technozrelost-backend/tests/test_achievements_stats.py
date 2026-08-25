"""Тикет 09 (news-achievements): админ-аналитика достижений.

``GET /api/v1/admin/achievements/stats`` — cntr_admin-only агрегаты
(спека §4.7). Покрытие:
- пустая БД → 200 с нулями и пустыми списками (без ошибок);
- начисления вставляются напрямую psycopg'ом в user_achievements /
  project_achievements (каталог — через seeded_catalog) → считаются
  by_week / by_group / by_rarity / by_sector / top_achievements / totals;
- застрявшие проекты (published, уровень 1..8, updated_at старше 90 дней);
- среднее время проверки менеджера (updated_at - created_at решивших заявок);
- не-админ (gk_customer / cntr_manager) → 403.

Даты начислений задаются относительно ``now``, ожидаемые недельные корзины
считаются тем же алгоритмом (UTC, неделя с понедельника) — тест устойчив к
фактической дате прогона.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import psycopg
import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user

DB_DSN = "host=127.0.0.1 port=5432 user=technoz password=change_me dbname=technozrelost_test"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(
    client: TestClient, role: str = "gk_customer"
) -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("stats"), full_name="Статистика", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _db() -> psycopg.Connection:
    return psycopg.connect(DB_DSN, autocommit=True)


def _fetch(sql: str, params: tuple = ()) -> list[tuple]:
    conn = _db()
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def _week_start(dt: datetime) -> str:
    """Понедельник недели (UTC) — тот же алгоритм, что в achievement_stats."""
    monday = dt - timedelta(days=dt.weekday())
    return monday.date().isoformat()


@pytest.fixture()
def seeded_catalog() -> None:
    """Каталог 66 медалей (conftest truncate'ит achievements после теста)."""
    from app.db.seed_achievements import _CATALOG

    conn = _db()
    try:
        for sort_order, item in enumerate(_CATALOG, start=1):
            (
                slug,
                title,
                group_,
                rarity,
                description,
                sector_slug,
                threshold,
                ugt_level,
                secret,
            ) = item
            conn.execute(
                """
                INSERT INTO public.achievements
                    (slug, title, description, "group", rarity, sector_slug,
                     threshold, ugt_level, secret, sort_order, icon_key)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (slug) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    "group" = EXCLUDED."group",
                    rarity = EXCLUDED.rarity,
                    sector_slug = EXCLUDED.sector_slug,
                    threshold = EXCLUDED.threshold,
                    ugt_level = EXCLUDED.ugt_level,
                    secret = EXCLUDED.secret,
                    sort_order = EXCLUDED.sort_order,
                    icon_key = EXCLUDED.icon_key
                """,
                (
                    slug,
                    title,
                    description,
                    group_,
                    rarity,
                    sector_slug,
                    threshold,
                    ugt_level,
                    secret,
                    sort_order,
                    slug,
                ),
            )
    finally:
        conn.close()


def _achievement_id(slug: str) -> int:
    return _fetch(
        "SELECT id FROM public.achievements WHERE slug = %s", (slug,)
    )[0][0]


def _insert_project(
    *,
    name: str,
    current_level: int = 0,
    status: str = "published",
    category: str | None = "IT/цифровые платформы",
    updated_at: datetime,
) -> int:
    conn = _db()
    try:
        row = conn.execute(
            """
            INSERT INTO public.projects
                (name, target_level, current_level, status, category, join_token,
                 created_at, updated_at)
            VALUES (%s, 9, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                name,
                current_level,
                status,
                category,
                f"JOIN{uuid.uuid4().hex[:12].upper()}",
                updated_at - timedelta(days=200),
                updated_at,
            ),
        ).fetchone()
        return int(row[0])
    finally:
        conn.close()


def _insert_user_achievement(
    user_id: int,
    slug: str,
    awarded_at: datetime,
    project_id: int | None = None,
    event_ref: str | None = None,
) -> None:
    conn = _db()
    try:
        conn.execute(
            """
            INSERT INTO public.user_achievements
                (user_id, achievement_id, project_id, event_ref, times, awarded_at)
            VALUES (%s, %s, %s, %s, 1, %s)
            """,
            (user_id, _achievement_id(slug), project_id, event_ref, awarded_at),
        )
    finally:
        conn.close()


def _insert_project_achievement(project_id: int, slug: str, awarded_at: datetime) -> None:
    conn = _db()
    try:
        conn.execute(
            """
            INSERT INTO public.project_achievements
                (project_id, achievement_id, awarded_at)
            VALUES (%s, %s, %s)
            """,
            (project_id, _achievement_id(slug), awarded_at),
        )
    finally:
        conn.close()


def _insert_promotion_request(
    project_id: int,
    *,
    status: str,
    created_at: datetime,
    updated_at: datetime,
) -> None:
    conn = _db()
    try:
        conn.execute(
            """
            INSERT INTO public.promotion_requests
                (project_id, from_level, to_level, status, attempt_no, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 1, %s, %s)
            """,
            (project_id, 1, 2, status, created_at, updated_at),
        )
    finally:
        conn.close()


def _get_stats(client: TestClient, token: str) -> dict:
    response = client.get(
        "/api/v1/admin/achievements/stats", headers=_auth(token)
    )
    assert response.status_code == 200, response.text
    return response.json()


# ── Пустая БД ───────────────────────────────────────────────────────────────


def test_stats_empty_db_returns_zeros(client: TestClient) -> None:
    """Пустая БД: 200, нули в totals, 12 недель и 30 дней нулями, пустые списки."""
    admin_token, _ = _register(client, "cntr_admin")

    stats = _get_stats(client, admin_token)

    assert stats["totals"] == {
        "total_awards": 0,
        "awards_last_week": 0,
        "unique_users": 0,
        "unique_projects": 0,
    }
    assert len(stats["by_week"]) == 12
    assert all(point["count"] == 0 for point in stats["by_week"])
    assert len(stats["by_day"]) == 30
    assert all(point["count"] == 0 for point in stats["by_day"])
    assert stats["by_group"] == []
    assert stats["by_rarity"] == []
    assert stats["by_sector"] == []
    assert stats["top_achievements"] == []
    assert stats["stalled_projects"] == []
    assert stats["manager_review"]["avg_hours"] is None
    assert stats["manager_review"]["decided_count"] == 0


# ── RBAC: только cntr_admin ────────────────────────────────────────────────


def test_stats_forbidden_for_non_admin(client: TestClient) -> None:
    """gk_customer и cntr_manager получают 403."""
    for role in ("gk_customer", "cntr_manager"):
        token, _ = _register(client, role)
        response = client.get(
            "/api/v1/admin/achievements/stats", headers=_auth(token)
        )
        assert response.status_code == 403, response.text


# ── Агрегаты по начислениям ─────────────────────────────────────────────────


def test_stats_aggregates_awards(
    client: TestClient, seeded_catalog
) -> None:
    """Начисления в user_achievements / project_achievements считаются."""
    admin_token, _ = _register(client, "cntr_admin")
    user1_token, user1_id = _register(client)
    user2_token, user2_id = _register(client)
    assert user1_token and user2_token

    now = datetime.now(UTC)
    t1 = now - timedelta(days=6, hours=2)  # та же неделя, внутри 7-дневного окна
    t2 = now - timedelta(days=30)  # неделя 4-5 недель назад, вне окна

    project_id = _insert_project(name="Проект-отрасль", updated_at=now - timedelta(days=5))
    _insert_user_achievement(user1_id, "ugt-1", t1)
    _insert_user_achievement(user2_id, "ugt-1", t1)
    _insert_user_achievement(
        user1_id, "sector-it", t2, project_id=project_id, event_ref="ugt:1:3"
    )
    _insert_project_achievement(project_id, "sector-it", t2)

    stats = _get_stats(client, admin_token)

    assert stats["totals"]["total_awards"] == 3
    assert stats["totals"]["awards_last_week"] == 2
    assert stats["totals"]["unique_users"] == 2
    assert stats["totals"]["unique_projects"] == 1

    # недельные корзины: две заполненные, остальные нули
    by_week = {point["date"]: point["count"] for point in stats["by_week"]}
    assert len(by_week) == 12
    assert by_week[_week_start(t1)] == 2
    assert by_week[_week_start(t2)] == 1
    assert sum(by_week.values()) == 3

    # распределения
    by_group = {item["key"]: item for item in stats["by_group"]}
    assert by_group["ugt"]["count"] == 2
    assert by_group["sector"]["count"] == 1
    assert by_group["ugt"]["percent"] == round(2 * 100.0 / 3, 1)
    by_rarity = {item["key"]: item for item in stats["by_rarity"]}
    assert by_rarity["common"]["count"] == 3

    # отраслевой срез — по project_achievements
    assert stats["by_sector"] == [
        {"category": "IT/цифровые платформы", "count": 1, "projects": 1}
    ]

    # топ-10: ugt-1 (2 начисления) выше sector-it (1)
    assert stats["top_achievements"][0]["slug"] == "ugt-1"
    assert stats["top_achievements"][0]["count"] == 2
    assert stats["top_achievements"][1]["slug"] == "sector-it"


# ── Застрявшие проекты и время проверки менеджера ──────────────────────────


def test_stats_stalled_projects_and_manager_review(
    client: TestClient, seeded_catalog
) -> None:
    """Проекты на уровне 1..8 без обновлений 90+ дней; среднее время проверки."""
    admin_token, _ = _register(client, "cntr_admin")
    now = datetime.now(UTC)

    stalled_id = _insert_project(
        name="Застрявший", current_level=5, updated_at=now - timedelta(days=100)
    )
    _insert_project(
        name="Активный", current_level=3, updated_at=now - timedelta(days=10)
    )
    _insert_project(
        name="Финалист", current_level=9, updated_at=now - timedelta(days=100)
    )
    _insert_project(
        name="Черновик", current_level=2, status="draft", updated_at=now - timedelta(days=100)
    )

    # решившие заявки: 48 и 24 календарных часа → среднее 36.0
    _insert_promotion_request(
        stalled_id,
        status="approved",
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(days=8),
    )
    _insert_promotion_request(
        stalled_id,
        status="rejected",
        created_at=now - timedelta(days=5),
        updated_at=now - timedelta(days=4),
    )
    # нерешённая заявка в среднее не входит
    _insert_promotion_request(
        stalled_id,
        status="pending_manager",
        created_at=now - timedelta(days=3),
        updated_at=now - timedelta(days=3),
    )

    stats = _get_stats(client, admin_token)

    stalled = stats["stalled_projects"]
    assert len(stalled) == 1
    assert stalled[0]["id"] == stalled_id
    assert stalled[0]["name"] == "Застрявший"
    assert stalled[0]["current_level"] == 5
    assert stalled[0]["days"] >= 90

    review = stats["manager_review"]
    assert review["decided_count"] == 2
    assert review["avg_hours"] == 36.0
