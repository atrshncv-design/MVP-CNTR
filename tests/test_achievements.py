"""Тикет 02 (news-achievements): механика наградчиков достижений.

Покрытие:
- подтверждение УГТ N → ugt-N команде проекта на момент события
  (project_achievements + user_achievements активных участников);
- повторное подтверждение того же уровня не дублирует записи;
- принятый документ → doc-first + ступени 5/10 по счётчику уникальных
  документов пользователя в проекте (повторная версия не награждает повторно);
- отраслевая медаль по категории проекта;
- мета-медали (первая медаль) при начислении других;
- уведомление о каждой новой медали (notify_user);
- отзыв по event_ref удаляет персональные и командные медали.

Мок-паттерн — как в tests/test_requirement_sets.py: подменяется модуль,
КОТОРЫЙ вызывает (app.api.v1.stages.ask_llm), ask_llm возвращает строку
"SUCCESS: ...". Каталог медалей пере-сеивается после truncate (conftest
чистит achievements/user_achievements/project_achievements после каждого теста).
"""

from __future__ import annotations

import asyncio
import contextlib
import uuid
from datetime import datetime

import psycopg
import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user

DB_DSN = "host=127.0.0.1 port=5432 user=technoz password=change_me dbname=technozrelost_test"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("ach"), full_name="Достижения", role_slug=role
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


@pytest.fixture()
def seeded_catalog() -> None:
    """Каталог 66 медалей (после truncate в conftest каталог пуст)."""
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


async def _fake_ok_llm(system: str, user_msg: str) -> str:  # noqa: ARG001
    return "SUCCESS\nSUMMARY: Комплект достаточен\n"


def _mock_llm_ok():
    """Подмена ask_llm в МОДУЛЕ-ВЫЗЫВАТЕЛЕ (app.api.v1.stages), как в тикете 07."""
    from app.api.v1 import stages as stages_module

    original = stages_module.ask_llm
    stages_module.ask_llm = _fake_ok_llm  # type: ignore[assignment]
    try:
        yield
    finally:
        stages_module.ask_llm = original


_mock_llm_ok = contextlib.contextmanager(_mock_llm_ok)


# ── Флоу-хелперы (паттерн tests/test_requirement_sets.py) ───────────────────


def _published_project(
    client: TestClient,
    owner_token: str,
    mgr_token: str,
    category: str = "IT/цифровые платформы",
) -> tuple[int, str]:
    """Проект: preliminary 3 → подтверждён менеджером на УГТ 2 → published."""
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner_token),
        json={
            "name": "Проект-достижения",
            "category": category,
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    project_id = response.json()["id"]
    card = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert card.status_code == 200, card.text
    join_token = ((card.json().get("project") or {}).get("join_token") or "").strip().upper()
    decide = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True, "level": 2},
    )
    assert decide.status_code == 200, decide.text
    return project_id, join_token


def _requirements(client: TestClient, token: str, project_id: int) -> list[dict]:
    response = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(token)
    )
    assert response.status_code == 200, response.text
    return response.json()


def _upload_text(
    client: TestClient, token: str, project_id: int, requirement_id: int, title: str
) -> object:
    """Документ этапа текстом (legacy): без сканера, считается принятым."""
    return client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        headers=_auth(token),
        json={
            "stage_requirement_id": requirement_id,
            "title": title,
            "content": f"Текст комплекта {title}",
        },
    )


def _join_active_member(
    client: TestClient, project_id: int, owner_token: str, join_token: str
) -> tuple[str, int]:
    """Участник: join → pending → одобрение владельца → active."""
    member_token, member_id = _register(client)
    joined = client.post(
        "/api/v1/projects/join",
        headers=_auth(member_token),
        json={"token": join_token, "role_in_project": "participant"},
    )
    assert joined.status_code == 200, joined.text
    requests = client.get(
        f"/api/v1/projects/{project_id}/join-requests", headers=_auth(owner_token)
    )
    assert requests.status_code == 200, requests.text
    member_req_id = requests.json()[0]["id"]
    approved = client.post(
        f"/api/v1/projects/{project_id}/join-requests/{member_req_id}/decide",
        headers=_auth(owner_token),
        json={"approve": True},
    )
    assert approved.status_code == 200, approved.text
    return member_token, member_id


def _promotion_request(
    client: TestClient, owner_token: str, project_id: int, title: str = "Акт-1"
) -> int:
    """Полный комплект → автозаявка (LLM мокнут на SUCCESS → pending_manager)."""
    reqs = _requirements(client, owner_token, project_id)
    up = _upload_text(client, owner_token, project_id, reqs[0]["id"], title)
    assert up.status_code == 201, up.text
    request_id = up.json()["request_id"]
    assert request_id is not None
    return request_id


def _user_medal_rows(user_id: int) -> list[tuple]:
    return _fetch(
        """
        SELECT a.slug, ua.times, ua.event_ref, ua.project_id
        FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s
        ORDER BY a.slug
        """,
        (user_id,),
    )


def _project_medal_slugs(project_id: int) -> set[str]:
    rows = _fetch(
        """
        SELECT a.slug
        FROM public.project_achievements pa
        JOIN public.achievements a ON a.id = pa.achievement_id
        WHERE pa.project_id = %s
        """,
        (project_id,),
    )
    return {r[0] for r in rows}


def _run_service(coro_factory):
    """Запуск сервисной функции наградчиков в отдельном цикле.

    Движок тестов — NullPool (app.core.database), поэтому соединения не
    привязаны к циклу TestClient; коммит — явный (get_db не коммитит).
    """

    async def _runner():
        from app.core.database import SessionLocal

        async with SessionLocal() as db:
            result = await coro_factory(db)
            await db.commit()
            return result

    return asyncio.run(_runner())


# ── УГТ: командная медаль уровня ────────────────────────────────────────────


def test_ugt_level_awarded_to_team(client: TestClient, seeded_catalog) -> None:
    """Подтверждение УГТ N → ugt-N команде + отраслевая + quality + мета."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, join_token = _published_project(client, owner_token, mgr_token)
    member_token, member_id = _join_active_member(
        client, project_id, owner_token, join_token
    )

    with _mock_llm_ok():
        request_id = _promotion_request(client, owner_token, project_id)
    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text

    # командная медаль проекта
    project_slugs = _project_medal_slugs(project_id)
    assert "ugt-3" in project_slugs
    assert "sector-it" in project_slugs  # категория "IT/цифровые платформы"
    assert "q-first-try" in project_slugs

    # участники на момент события (owner + member) получили ugt-3
    for user_id in (owner_id, member_id):
        rows = _user_medal_rows(user_id)
        slugs = {r[0] for r in rows}
        assert "ugt-3" in slugs, f"user {user_id}: {slugs}"
        assert "sector-it" in slugs
        assert "q-first-try" in slugs
        # у всех медалей события — общий event_ref для отзыва
        for slug in ("ugt-3", "sector-it", "q-first-try"):
            row = next(r for r in rows if r[0] == slug)
            assert row[2] == f"ugt:{project_id}:3", row

    # owner: doc-first (загрузил документ) + m-first-medal (первая медаль)
    owner_slugs = {r[0] for r in _user_medal_rows(owner_id)}
    assert "doc-first" in owner_slugs
    assert "m-first-medal" in owner_slugs
    # member: первая медаль — ugt-3 → m-first-medal тоже
    member_slugs = {r[0] for r in _user_medal_rows(member_id)}
    assert "m-first-medal" in member_slugs

    # уведомления о каждой новой медали (персональное + outbox)
    notified = _fetch(
        "SELECT count(*) FROM public.notifications "
        "WHERE type = 'achievement.awarded' AND user_id = %s",
        (owner_id,),
    )[0][0]
    assert notified >= 4  # doc-first, ugt-3, sector-it, q-first-try


def test_repeat_level_confirmation_no_duplicate(
    client: TestClient, seeded_catalog
) -> None:
    """Повторное подтверждение того же уровня не дублирует записи."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, _join_token = _published_project(client, owner_token, mgr_token)

    with _mock_llm_ok():
        request_id = _promotion_request(client, owner_token, project_id)
    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text

    def _count_ugt3() -> int:
        return _fetch(
            """
            SELECT count(*) FROM public.user_achievements ua
            JOIN public.achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = %s AND a.slug = 'ugt-3'
            """,
            (owner_id,),
        )[0][0]

    assert _count_ugt3() == 1

    # повторный вызов наградчика того же уровня — идемпотентно
    def _repeat(db):
        from app.db.models import Project
        from app.services.achievements import award_ugt

        async def _call():
            project = await db.get(Project, project_id)
            return await award_ugt(db, project, 3)

        return _call()

    _run_service(_repeat)
    assert _count_ugt3() == 1
    assert len(_project_medal_slugs(project_id)) == 3  # ugt-3, sector-it, q-first-try


# ── Документы: doc-first, ступени, повторные версии ─────────────────────────


def test_document_awards_and_steps(client: TestClient, seeded_catalog) -> None:
    """Принятый документ → doc-first; ступени 5/10 по счётчику; версии не дублируют."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, _join_token = _published_project(client, owner_token, mgr_token)
    reqs = _requirements(client, owner_token, project_id)
    requirement_id = reqs[0]["id"]

    def _count(slug: str) -> int:
        return _fetch(
            """
            SELECT count(*) FROM public.user_achievements ua
            JOIN public.achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = %s AND a.slug = %s
            """,
            (owner_id, slug),
        )[0][0]

    with _mock_llm_ok():
        # первый документ
        up = _upload_text(client, owner_token, project_id, requirement_id, "doc-A")
        assert up.status_code == 201, up.text
        # повторная версия того же документа — не награждает повторно
        up = _upload_text(client, owner_token, project_id, requirement_id, "doc-A")
        assert up.status_code == 201, up.text
        # ещё 4 уникальных → всего 5 уникальных документов (doc-A + B..E)
        for title in ("doc-B", "doc-C", "doc-D", "doc-E"):
            up = _upload_text(client, owner_token, project_id, requirement_id, title)
            assert up.status_code == 201, up.text

    assert _count("doc-first") == 1
    assert _count("doc-5") == 1
    assert _count("doc-10") == 0

    times5 = _fetch(
        """
        SELECT ua.times FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s AND a.slug = 'doc-5'
        """,
        (owner_id,),
    )[0][0]
    assert times5 == 5

    with _mock_llm_ok():
        # ещё 5 уникальных → всего 10 → doc-10
        for title in ("doc-F", "doc-G", "doc-H", "doc-I", "doc-J"):
            up = _upload_text(client, owner_token, project_id, requirement_id, title)
            assert up.status_code == 201, up.text

    assert _count("doc-10") == 1
    times10 = _fetch(
        """
        SELECT ua.times FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s AND a.slug = 'doc-10'
        """,
        (owner_id,),
    )[0][0]
    assert times10 == 10


# ── Отзыв медалей при отмене события ────────────────────────────────────────


def test_revoke_for_event_removes_records(
    client: TestClient, seeded_catalog
) -> None:
    """Отзыв по event_ref удаляет персональные и командные медали события."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, _join_token = _published_project(client, owner_token, mgr_token)

    with _mock_llm_ok():
        request_id = _promotion_request(client, owner_token, project_id)
    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text

    event_ref = f"ugt:{project_id}:3"
    assert "ugt-3" in _project_medal_slugs(project_id)

    def _revoke(db):
        from app.services.achievements import revoke_for_event

        return revoke_for_event(db, event_ref)

    result = _run_service(_revoke)
    assert result["user_records"] >= 3  # ugt-3 + sector-it + q-first-try
    assert result["project_records"] == 3

    remaining = _fetch(
        """
        SELECT a.slug FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s AND ua.event_ref = %s
        """,
        (owner_id, event_ref),
    )
    assert remaining == []
    assert "ugt-3" not in _project_medal_slugs(project_id)
    assert "sector-it" not in _project_medal_slugs(project_id)
    # не-событийные медали (doc-first, m-first-medal) сохраняются
    slugs = {r[0] for r in _user_medal_rows(owner_id)}
    assert "doc-first" in slugs
    assert "m-first-medal" in slugs


# ── Отраслевые медали ───────────────────────────────────────────────────────


def test_sector_medal_by_project_category(client: TestClient, seeded_catalog) -> None:
    """Категория проекта → отраслевая медаль (все 7 маппингов)."""
    mgr_token, _ = _register(client, "cntr_manager")
    cases = {
        "сельское хозяйство": "sector-agri",
        "нефтедобыча": "sector-oil",
        "машиностроение": "sector-machinery",
        "IT/цифровые платформы": "sector-it",
        "медицина": "sector-medicine",
        "энергетика": "sector-energy",
        "транспорт": "sector-transport",
    }
    for category, expected_slug in cases.items():
        owner_token, owner_id = _register(client)
        project_id, _join_token = _published_project(
            client, owner_token, mgr_token, category=category
        )
        with _mock_llm_ok():
            request_id = _promotion_request(client, owner_token, project_id)
        approve = client.post(
            f"/api/v1/manager/queue/promotions/{request_id}/decide",
            headers=_auth(mgr_token),
            json={"approve": True},
        )
        assert approve.status_code == 200, approve.text
        slugs = {r[0] for r in _user_medal_rows(owner_id)}
        assert expected_slug in slugs, f"{category} → {expected_slug}: {slugs}"
        assert expected_slug in _project_medal_slugs(project_id)


# ── Витрина: GET /achievements/mine (тикет 03, спека §4.6) ───────────────────


def test_mine_requires_auth(client: TestClient, seeded_catalog) -> None:
    """Витрина mine — только для авторизованных (401 без токена)."""
    response = client.get("/api/v1/achievements/mine")
    assert response.status_code == 401


def test_mine_returns_medals_progress_and_history(
    client: TestClient, seeded_catalog
) -> None:
    """mine: медали с полями, историей (дата/проект) и прогрессом ступеней."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, _join_token = _published_project(client, owner_token, mgr_token)

    # УГТ 3 → командные медали (ugt-3, sector-it, q-first-try) + doc-first +
    # m-first-medal + m-5-medals (total=5 → ступень 5 мета-медалей)
    with _mock_llm_ok():
        request_id = _promotion_request(client, owner_token, project_id)
    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text

    # ещё 9 уникальных документов → всего 10 → doc-5 и doc-10
    reqs = _requirements(client, owner_token, project_id)
    requirement_id = reqs[0]["id"]
    with _mock_llm_ok():
        for title in (f"doc-extra-{i}" for i in range(9)):
            up = _upload_text(
                client, owner_token, project_id, requirement_id, title
            )
            assert up.status_code == 201, up.text

    response = client.get("/api/v1/achievements/mine", headers=_auth(owner_token))
    assert response.status_code == 200, response.text
    items = response.json()
    by_slug = {item["achievement"]["slug"]: item for item in items}

    for slug in (
        "doc-first",
        "doc-5",
        "doc-10",
        "m-first-medal",
        "m-5-medals",
        "ugt-3",
        "sector-it",
        "q-first-try",
    ):
        assert slug in by_slug, f"missing {slug}: {sorted(by_slug)}"

    # поля записи: times, awarded_at ISO, project_id/имя проекта
    doc10 = by_slug["doc-10"]
    assert doc10["times"] == 10
    assert doc10["project_id"] == project_id
    assert doc10["project_name"] == "Проект-достижения"
    datetime.fromisoformat(doc10["awarded_at"])  # ISO 8601
    assert doc10["achievement"]["title"] == "Рабочий ритм — 10 документов"

    # прогресс ступеней: doc-10 → current 10, следующая doc-25 (порог 25)
    assert doc10["progress"] == {"current_count": 10, "next_threshold": 25}
    assert by_slug["doc-5"]["progress"] == {
        "current_count": 10,
        "next_threshold": 25,
    }
    # doc-first — не ступень: прогресса нет
    assert by_slug["doc-first"]["progress"] is None
    # мета-ступень m-5-medals (times=5) → следующая m-15-medals
    assert by_slug["m-5-medals"]["progress"] == {
        "current_count": 5,
        "next_threshold": 15,
    }
    # командная медаль УГТ: project_id заполнен, прогресса нет
    assert by_slug["ugt-3"]["project_id"] == project_id
    assert by_slug["ugt-3"]["progress"] is None

    # история: свежие начисления сверху (awarded_at не возрастает)
    dates = [datetime.fromisoformat(item["awarded_at"]) for item in items]
    assert dates == sorted(dates, reverse=True)
    assert owner_id  # регистрация прошла


# ── Витрина: GET /projects/{id}/achievements (тикет 03, спека §4.6) ──────────


def test_project_achievements_access_and_public(
    client: TestClient, seeded_catalog
) -> None:
    """Командные медали: участник видит; аноним — 404 для приватного,
    медали видны после публикации проекта (is_public=True)."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, _join_token = _published_project(client, owner_token, mgr_token)

    with _mock_llm_ok():
        request_id = _promotion_request(client, owner_token, project_id)
    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text

    # участник видит командные медали проекта
    response = client.get(
        f"/api/v1/projects/{project_id}/achievements", headers=_auth(owner_token)
    )
    assert response.status_code == 200, response.text
    items = response.json()
    slugs = {item["achievement"]["slug"] for item in items}
    assert {"ugt-3", "sector-it", "q-first-try"} <= slugs
    for item in items:
        datetime.fromisoformat(item["awarded_at"])
        assert item["achievement"]["title"]

    # аноним: приватный проект → 404 (существование не раскрываем)
    anon = client.get(f"/api/v1/projects/{project_id}/achievements")
    assert anon.status_code == 404

    # посторонний авторизованный (не участник) → 404
    outsider_token, _ = _register(client)
    outsider = client.get(
        f"/api/v1/projects/{project_id}/achievements",
        headers=_auth(outsider_token),
    )
    assert outsider.status_code == 404

    # публикация проекта → аноним видит те же медали
    pub = client.put(
        f"/api/v1/projects/{project_id}/publish",
        headers=_auth(owner_token),
        json={"is_public": True},
    )
    assert pub.status_code == 200, pub.text
    anon_public = client.get(f"/api/v1/projects/{project_id}/achievements")
    assert anon_public.status_code == 200, anon_public.text
    assert {item["achievement"]["slug"] for item in anon_public.json()} == slugs

    # несуществующий проект → 404
    missing = client.get("/api/v1/projects/999999/achievements")
    assert missing.status_code == 404
