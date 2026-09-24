"""Тикет 06 (таск 06): медали — выдача, честность, отзыв.

Покрытие критериев приёмки:
- слаги каталога минус слаги с триггерами (SLUG_TRIGGERS) — пусто;
- секретные скрыты из публичного каталога (анон + авторизованный);
- создание проекта → proj-first (+ s-pioneer первому в отрасли);
- первичное подтверждение → ugt-1..L, q-leap (скачок 0→L), role-verify-1;
- первая заявка → proj-first-request; повышение → вехи proj-ugtN,
  role-mentor, m-longhaul, q-perfect-set, q-fast-start;
- коллекционер при миксе типов документов (stage + file);
- КТ-решение → role-expert-1; создание проекта в организации → org-first;
- марафон/камбэк/феникс на выводимых условиях;
- откат решения менеджера отзывает медали события;
- выдача идемпотентна; прогресс витрины честен (role-ступени).
"""

from __future__ import annotations

import asyncio
import contextlib
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


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("t06"), full_name="Таск 06", role_slug=role
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
    """Каталог 66 медалей (conftest чистит achievements после каждого теста)."""
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


async def _fake_ok_llm(system: str, user_msg: str, *, session_id: str) -> str:  # noqa: ARG001
    return "SUCCESS\nSUMMARY: Комплект достаточен\n"


def _mock_llm_ok():
    from app.api.v1 import stages as stages_module

    original = stages_module.ask_llm
    stages_module.ask_llm = _fake_ok_llm  # type: ignore[assignment]
    try:
        yield
    finally:
        stages_module.ask_llm = original


_mock_llm_ok = contextlib.contextmanager(_mock_llm_ok)


def _create_draft(
    client: TestClient, owner_token: str, category: str = "IT/цифровые платформы"
) -> int:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner_token),
        json={
            "name": "Проект-таск-06",
            "category": category,
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _approve_draft(
    client: TestClient, mgr_token: str, project_id: int, level: int = 2
) -> None:
    decide = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True, "level": level},
    )
    assert decide.status_code == 200, decide.text


def _requirements(client: TestClient, token: str, project_id: int) -> list[dict]:
    response = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(token)
    )
    assert response.status_code == 200, response.text
    return response.json()


def _upload_text(
    client: TestClient, token: str, project_id: int, requirement_id: int, title: str
) -> object:
    return client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        headers=_auth(token),
        json={
            "stage_requirement_id": requirement_id,
            "title": title,
            "content": f"Текст комплекта {title}",
        },
    )


def _promote_once(
    client: TestClient,
    owner_token: str,
    mgr_token: str,
    project_id: int,
    title: str,
) -> int:
    reqs = _requirements(client, owner_token, project_id)
    with _mock_llm_ok():
        up = _upload_text(client, owner_token, project_id, reqs[0]["id"], title)
        assert up.status_code == 201, up.text
        request_id = up.json()["request_id"]
        assert request_id is not None
    approve = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": True},
    )
    assert approve.status_code == 200, approve.text
    return request_id


def _promote_to_3(
    client: TestClient, owner_token: str, mgr_token: str, project_id: int
) -> int:
    return _promote_once(client, owner_token, mgr_token, project_id, "Акт-1")


def _user_slugs(user_id: int) -> set[str]:
    return {
        r[0]
        for r in _fetch(
            """
            SELECT a.slug FROM public.user_achievements ua
            JOIN public.achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = %s
            """,
            (user_id,),
        )
    }


def _project_slugs(project_id: int) -> set[str]:
    return {
        r[0]
        for r in _fetch(
            """
            SELECT a.slug FROM public.project_achievements pa
            JOIN public.achievements a ON a.id = pa.achievement_id
            WHERE pa.project_id = %s
            """,
            (project_id,),
        )
    }


def _run_service(coro_factory):
    async def _runner():
        from app.core.database import SessionLocal

        async with SessionLocal() as db:
            result = await coro_factory(db)
            await db.commit()
            return result

    return asyncio.run(_runner())


# ── Каталог: покрытие и секретность ──────────────────────────────────────────


def test_every_catalog_slug_has_trigger(seeded_catalog) -> None:
    """Слаги каталога минус слаги с триггерами — пусто (и наоборот)."""
    from app.db.seed_achievements import _CATALOG
    from app.services.achievements import SLUG_TRIGGERS

    catalog = {row[0] for row in _CATALOG}
    assert catalog - set(SLUG_TRIGGERS) == set()
    assert set(SLUG_TRIGGERS) - catalog == set()
    assert len(SLUG_TRIGGERS) == 66


def test_catalog_hides_secret_medals(
    client: TestClient, seeded_catalog
) -> None:
    """Публичный каталог: 60 открытых, 6 секретных скрыты (анон и auth)."""
    anon = client.get("/api/v1/achievements/catalog")
    assert anon.status_code == 200, anon.text
    anon_slugs = {item["slug"] for item in anon.json()}
    assert len(anon_slugs) == 60
    for secret in (
        "s-ghost",
        "s-comet",
        "s-pioneer",
        "s-phoenix",
        "s-epic-collection",
        "s-legend",
    ):
        assert secret not in anon_slugs
    assert "ugt-1" in anon_slugs and "proj-first" in anon_slugs

    token, _ = _register(client)
    authed = client.get("/api/v1/achievements/catalog", headers=_auth(token))
    assert authed.status_code == 200, authed.text
    assert {item["slug"] for item in authed.json()} == anon_slugs


# ── Создание проекта и первичное подтверждение ──────────────────────────────


def test_project_creation_awards_first_and_pioneer(
    client: TestClient, seeded_catalog
) -> None:
    """Создание → proj-first команде + s-pioneer первому в отрасли."""
    owner_token, owner_id = _register(client)
    project_id = _create_draft(client, owner_token)
    slugs = _user_slugs(owner_id)
    assert "proj-first" in slugs
    assert "s-pioneer" in slugs
    assert "proj-first" in _project_slugs(project_id)

    row = _fetch(
        """
        SELECT ua.event_ref FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s AND a.slug = 'proj-first'
        """,
        (owner_id,),
    )[0][0]
    assert row == f"project:{project_id}:created"

    # второй проект в той же отрасли — уже не первопроходец, но proj-first один
    owner2_token, owner2_id = _register(client)
    _create_draft(client, owner2_token)
    slugs2 = _user_slugs(owner2_id)
    assert "proj-first" in slugs2
    assert "s-pioneer" not in slugs2


def test_draft_approve_awards_levels_leap_and_verify(
    client: TestClient, seeded_catalog
) -> None:
    """Аппрув черновика на УГТ 2 → ugt-1/ugt-2, q-leap, role-verify-1."""
    owner_token, owner_id = _register(client)
    mgr_token, mgr_id = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id, level=2)

    owner_slugs = _user_slugs(owner_id)
    assert {"ugt-1", "ugt-2", "sector-it", "q-first-try", "q-leap"} <= owner_slugs
    assert {"ugt-1", "ugt-2", "q-leap"} <= _project_slugs(project_id)

    mgr_slugs = _user_slugs(mgr_id)
    assert "role-verify-1" in mgr_slugs
    times = _fetch(
        """
        SELECT ua.times FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s AND a.slug = 'role-verify-1'
        """,
        (mgr_id,),
    )[0][0]
    assert times == 1


# ── Первая заявка, вехи, наставник, долгожитель ─────────────────────────────


def test_promotion_awards_request_milestones_and_roles(
    client: TestClient, seeded_catalog
) -> None:
    """Повышение до 3 → proj-first-request, proj-ugt3, perfect-set, fast-start;
    до 4 → role-mentor создателю, m-longhaul держателю ugt-1+ugt-4;
    менеджеру — быстрая проверка."""
    owner_token, owner_id = _register(client)
    mgr_token, mgr_id = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)
    _promote_to_3(client, owner_token, mgr_token, project_id)

    owner_slugs = _user_slugs(owner_id)
    assert {
        "proj-first-request",
        "proj-ugt3",
        "q-perfect-set",
        "q-fast-start",
    } <= owner_slugs
    assert {"proj-first-request", "proj-ugt3", "q-perfect-set"} <= _project_slugs(
        project_id
    )

    _promote_once(client, owner_token, mgr_token, project_id, "Акт-2")
    owner_slugs = _user_slugs(owner_id)
    assert {"proj-ugt4", "role-mentor", "m-longhaul"} <= owner_slugs

    mgr_slugs = _user_slugs(mgr_id)
    assert "role-fast-check" in mgr_slugs


def test_manager_mine_shows_honest_role_progress(
    client: TestClient, seeded_catalog
) -> None:
    """Витрина менеджера: role-verify-1 с прогрессом 1/10."""
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)

    response = client.get("/api/v1/achievements/mine", headers=_auth(mgr_token))
    assert response.status_code == 200, response.text
    by_slug = {item["achievement"]["slug"]: item for item in response.json()}
    assert "role-verify-1" in by_slug
    assert by_slug["role-verify-1"]["progress"] == {
        "current_count": 1,
        "next_threshold": 10,
    }


# ── Эксперт, организация, коллекционер ──────────────────────────────────────


def test_control_point_decision_awards_expert(
    client: TestClient, seeded_catalog
) -> None:
    """КТ-решение менеджера → role-expert-1."""
    owner_token, _ = _register(client)
    mgr_token, mgr_id = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)

    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert detail.status_code == 200, detail.text
    cp_id = detail.json()["control_points"][0]["id"]

    decided = client.patch(
        f"/api/v1/projects/{project_id}/control-points/{cp_id}",
        headers=_auth(mgr_token),
        json={"status": "approved", "decision": "Критерии подтверждены"},
    )
    assert decided.status_code == 200, decided.text
    assert "role-expert-1" in _user_slugs(mgr_id)


def test_org_first_awarded_on_project_creation(
    client: TestClient, seeded_catalog
) -> None:
    """Проект создателя организации → org-first создателю."""
    owner_token, owner_id = _register(client)
    org = client.post(
        "/api/v1/orgs", headers=_auth(owner_token), json={"name": "Орг-таск-06"}
    )
    assert org.status_code == 201, org.text
    _create_draft(client, owner_token)
    assert "org-first" in _user_slugs(owner_id)


def test_collector_needs_two_doc_types(
    client: TestClient, seeded_catalog
) -> None:
    """Коллекционер: stage-документ + file-тип у пользователя."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)
    reqs = _requirements(client, owner_token, project_id)

    with _mock_llm_ok():
        up = _upload_text(client, owner_token, project_id, reqs[0]["id"], "stage-A")
        assert up.status_code == 201, up.text
    assert "proj-collector" not in _user_slugs(owner_id)

    # второй тип напрямую (эквивалент clean-файла /files без MinIO в тесте)
    conn = _db()
    try:
        conn.execute(
            "INSERT INTO public.project_documents "
            "(project_id, title, doc_type, version, status, uploaded_by) "
            "VALUES (%s, %s, 'file', 1, 'uploaded', %s)",
            (project_id, "file-A", owner_id),
        )
    finally:
        conn.close()

    def _award(db):
        from app.db.models import Project
        from app.services.achievements import award_document

        async def _call():
            project = await db.get(Project, project_id)
            assert project is not None
            return await award_document(db, project, owner_id, "file")

        return _call()

    _run_service(_award)
    assert "proj-collector" in _user_slugs(owner_id)


# ── Марафон / камбэк / феникс (сервисный уровень) ───────────────────────────


def test_marathon_comeback_phoenix(client: TestClient, seeded_catalog) -> None:
    """Старый проект с отказами на УГТ 7 → marathon + comeback + phoenix."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)

    old = (datetime.now(UTC) - timedelta(days=400)).isoformat()
    conn = _db()
    try:
        conn.execute(
            "UPDATE public.projects SET created_at = %s WHERE id = %s",
            (old, project_id),
        )
        for _ in range(2):
            conn.execute(
                "INSERT INTO public.promotion_requests "
                "(project_id, from_level, to_level, status, attempt_no) "
                "VALUES (%s, 6, 7, 'rejected', 1)",
                (project_id,),
            )
    finally:
        conn.close()

    def _award(db):
        from app.db.models import Project
        from app.services.achievements import award_ugt

        async def _call():
            project = await db.get(Project, project_id)
            assert project is not None
            return await award_ugt(db, project, 7)

        return _call()

    result = _run_service(_award)
    assert {"q-marathon", "q-comeback", "s-phoenix", "proj-ugt7"} <= set(
        result["awarded"]
    ) | _project_slugs(project_id)
    assert {"q-marathon", "q-comeback", "s-phoenix"} <= _user_slugs(owner_id)


# ── Откат решения ───────────────────────────────────────────────────────────


def test_revert_revokes_event_medals(client: TestClient, seeded_catalog) -> None:
    """Откат approve → уровень назад, медали события отозваны, doc-first жив."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)
    request_id = _promote_to_3(client, owner_token, mgr_token, project_id)

    event_ref = f"ugt:{project_id}:3"
    assert "ugt-3" in _project_slugs(project_id)

    revert = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/revert",
        headers=_auth(mgr_token),
        json={"reason": "Ошибка в комплекте"},
    )
    assert revert.status_code == 200, revert.text
    body = revert.json()
    assert body["status"] == "rejected"

    card = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert card.status_code == 200, card.text
    assert card.json()["project"]["current_level"] == 2

    assert "ugt-3" not in _project_slugs(project_id)
    remaining = _fetch(
        """
        SELECT a.slug FROM public.user_achievements ua
        JOIN public.achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s AND ua.event_ref = %s
        """,
        (owner_id, event_ref),
    )
    assert remaining == []
    kept = _user_slugs(owner_id)
    assert "doc-first" in kept and "proj-first" in kept

    # повторный откат и откат не-approved — 409 MANAGER_REVERT_INVALID
    again = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/revert",
        headers=_auth(mgr_token),
        json={},
    )
    assert again.status_code == 409
    assert again.headers.get("X-Error-Code") == "MANAGER_REVERT_INVALID"


# ── Идемпотентность и легенда ───────────────────────────────────────────────


def test_awards_are_idempotent(client: TestClient, seeded_catalog) -> None:
    """Повторные вызовы наградчиков не плодят записи."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)
    _promote_to_3(client, owner_token, mgr_token, project_id)

    def _counts() -> tuple[int, int]:
        users = _fetch("SELECT count(*) FROM public.user_achievements")[0][0]
        projects = _fetch("SELECT count(*) FROM public.project_achievements")[0][0]
        return users, projects

    before = _counts()

    def _repeat(db):
        from app.db.models import Project
        from app.services.achievements import award_document, award_ugt

        async def _call():
            project = await db.get(Project, project_id)
            assert project is not None
            await award_ugt(db, project, 3)
            await award_ugt(db, project, 2)
            await award_document(db, project, owner_id, "stage")

        return _call()

    _run_service(_repeat)
    assert _counts() == before


def test_legend_locked_until_full_open_catalog(
    client: TestClient, seeded_catalog
) -> None:
    """s-legend выдаётся только за весь открытый каталог (не за 100+)."""
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id = _create_draft(client, owner_token)
    _approve_draft(client, mgr_token, project_id)
    assert "s-legend" not in _user_slugs(owner_id)
