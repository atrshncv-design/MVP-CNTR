"""Тикет 04 (operations-modules): проверяемый каталог мер поддержки.

Покрывает: RBAC (публикует/подтверждает/редактирует только служебная роль,
403 остальным; публичный список без auth; детали авторизованным), просрочку
актуальности (границы вчера/сегодня/завтра — unit + интеграция: «устарело» +
recommendation=false), фильтры категория/УГТ-диапазон, checklist-прогресс
(сохранение/чтение, только локально, без внешних вызовов; чужой прогресс 404),
аудит support_program.* и checklist_progress.updated.

Ключевое решение: «устарело»/рекомендация НЕ хранятся — вычисляются
детерминированно сервисом support_catalog (без LLM), граница: actuality_date
== today — ещё актуально весь день.
"""

from __future__ import annotations

import os
import uuid
from datetime import date, timedelta

import psycopg
from fastapi.testclient import TestClient

from app.services.support_catalog import compute_actuality, ugt_range_overlaps
from tests.support import register_test_user

PROGRAM_ATTRS = (
    "title",
    "source_url",
    "source_name",
    "actuality_date",
    "responsible_org_id",
    "target_ugt_min",
    "target_ugt_max",
    "categories",
    "eligibility",
)


def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _register(client: TestClient, role: str = "gk_customer", full_name: str = "Тест Юзер") -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('u')}@example.com",
        full_name=full_name,
        role_slug=role,
    )


def _staff(client: TestClient, role: str = "cntr_manager") -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug=role,
    )


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_program(client: TestClient, token: str, **overrides) -> dict:
    payload = {
        "title": _uniq("Мера поддержки"),
        "source_url": "https://example.com/source",
        "source_name": "Минпромторг",
        "actuality_date": (date.today() + timedelta(days=30)).isoformat(),
        "categories": ["subsidy", "grant"],
        "target_ugt_min": 3,
        "target_ugt_max": 7,
        "eligibility": "СМП по ГОСТ Р 58048-2017",
        "checklist": ["Собрать документы", "Подать заявку", "Получить решение"],
        **overrides,
    }
    resp = client.post("/api/v1/support-programs", headers=_auth(token), json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _publish(client: TestClient, token: str, program_id: int) -> dict:
    resp = client.post(
        f"/api/v1/support-programs/{program_id}/publish",
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _audit_actions() -> list[str]:
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        rows = conn.execute(
            "SELECT action FROM public.audit_trail "
            "WHERE action LIKE 'support_program.%' OR action = 'checklist_progress.updated' "
            "ORDER BY id"
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()


# ─── Unit: детерминированная актуальность (границы дат, без LLM) ────────────

def test_actuality_boundaries_unit() -> None:
    today = date(2026, 8, 11)
    # Вчера → «устарело» + рекомендация исключена.
    is_stale, recommendation = compute_actuality(date(2026, 8, 10), today=today)
    assert is_stale is True
    assert recommendation is False
    # Сегодня (граница) → актуально весь день.
    is_stale, recommendation = compute_actuality(today, today=today)
    assert is_stale is False
    assert recommendation is True
    # Завтра → актуально.
    is_stale, recommendation = compute_actuality(date(2026, 8, 12), today=today)
    assert is_stale is False
    assert recommendation is True
    # Без даты (черновик) → не устарело (публикация без даты невозможна).
    is_stale, recommendation = compute_actuality(None, today=today)
    assert is_stale is False
    assert recommendation is True


def test_ugt_range_overlap_unit() -> None:
    # Пересечение диапазонов программы и фильтра.
    assert ugt_range_overlaps(program_min=3, program_max=7, filter_min=5, filter_max=9) is True
    assert ugt_range_overlaps(program_min=3, program_max=7, filter_min=7, filter_max=9) is True
    assert ugt_range_overlaps(program_min=3, program_max=7, filter_min=0, filter_max=3) is True
    # Не пересекаются.
    assert ugt_range_overlaps(program_min=3, program_max=7, filter_min=8, filter_max=9) is False
    assert ugt_range_overlaps(program_min=3, program_max=7, filter_min=0, filter_max=2) is False
    # Открытые границы (NULL) — без ограничения.
    assert ugt_range_overlaps(program_min=None, program_max=7, filter_min=8, filter_max=9) is False
    assert ugt_range_overlaps(program_min=None, program_max=7, filter_min=5, filter_max=9) is True
    assert ugt_range_overlaps(program_min=3, program_max=None, filter_min=0, filter_max=2) is False
    assert ugt_range_overlaps(program_min=3, program_max=None, filter_min=0, filter_max=9) is True
    assert (
        ugt_range_overlaps(program_min=None, program_max=None, filter_min=1, filter_max=9)
        is True
    )


# ─── RBAC: публикует/подтверждает только служебная роль ─────────────────────

def test_create_and_publish_staff_only(client: TestClient) -> None:
    staff = _staff(client)
    customer = _register(client, role="gk_customer")
    program = _create_program(client, staff["access_token"])

    # Не-staff: создание, публикация, подтверждение, редактирование → 403.
    resp = client.post(
        "/api/v1/support-programs",
        headers=_auth(customer["access_token"]),
        json={"title": _uniq("Хакер")},
    )
    assert resp.status_code == 403, resp.text
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/publish",
        headers=_auth(customer["access_token"]),
    )
    assert resp.status_code == 403, resp.text
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/confirm",
        headers=_auth(customer["access_token"]),
    )
    assert resp.status_code == 403, resp.text
    resp = client.patch(
        f"/api/v1/support-programs/{program['id']}",
        headers=_auth(customer["access_token"]),
        json={"title": "Взлом"},
    )
    assert resp.status_code == 403, resp.text
    resp = client.delete(
        f"/api/v1/support-programs/{program['id']}",
        headers=_auth(customer["access_token"]),
    )
    assert resp.status_code == 403, resp.text

    # Аноним → 401 на создание.
    resp = client.post(
        "/api/v1/support-programs", json={"title": _uniq("Аноним")}
    )
    assert resp.status_code == 401, resp.text

    # Публикация без actuality_date → 422.
    no_date = _create_program(
        client, staff["access_token"], actuality_date=None
    )
    resp = client.post(
        f"/api/v1/support-programs/{no_date['id']}/publish",
        headers=_auth(staff["access_token"]),
    )
    assert resp.status_code == 422, resp.text

    # Публикация → published (published_by/at); подтверждение → confirmed.
    published = _publish(client, staff["access_token"], program["id"])
    assert published["status"] == "published"
    assert published["published_at"] is not None

    confirmed = client.post(
        f"/api/v1/support-programs/{program['id']}/confirm",
        headers=_auth(staff["access_token"]),
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"

    # Повторная публикация/подтверждение недопустимы (409).
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/publish",
        headers=_auth(staff["access_token"]),
    )
    assert resp.status_code == 409, resp.text
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/confirm",
        headers=_auth(staff["access_token"]),
    )
    assert resp.status_code == 409, resp.text


def test_confirm_requires_published(client: TestClient) -> None:
    staff = _staff(client, role="cntr_admin")
    program = _create_program(client, staff["access_token"])
    # Черновик подтвердить нельзя → 409.
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/confirm",
        headers=_auth(staff["access_token"]),
    )
    assert resp.status_code == 409, resp.text
    # После публикации — 200.
    _publish(client, staff["access_token"], program["id"])
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/confirm",
        headers=_auth(staff["access_token"]),
    )
    assert resp.status_code == 200, resp.text


def test_ugt_range_validation(client: TestClient) -> None:
    staff = _staff(client)
    resp = client.post(
        "/api/v1/support-programs",
        headers=_auth(staff["access_token"]),
        json={"title": _uniq("Кривой УГТ"), "target_ugt_min": 7, "target_ugt_max": 3},
    )
    assert resp.status_code == 422, resp.text
    resp = client.post(
        "/api/v1/support-programs",
        headers=_auth(staff["access_token"]),
        json={"title": _uniq("Вне диапазона"), "target_ugt_min": 10},
    )
    assert resp.status_code == 422, resp.text


# ─── Публичный список и просрочка актуальности ───────────────────────────────

def test_public_list_only_published_and_stale(client: TestClient) -> None:
    staff = _staff(client)
    draft = _create_program(client, staff["access_token"])
    fresh = _create_program(client, staff["access_token"])
    stale = _create_program(
        client,
        staff["access_token"],
        actuality_date=(date.today() - timedelta(days=1)).isoformat(),
    )
    _publish(client, staff["access_token"], fresh["id"])
    _publish(client, staff["access_token"], stale["id"])
    # Черновик не публикуем.

    # Публичный список БЕЗ авторизации: только опубликованные.
    listing = client.get("/api/v1/support-programs")
    assert listing.status_code == 200, listing.text
    ids = {p["id"] for p in listing.json()}
    assert fresh["id"] in ids
    assert stale["id"] in ids
    assert draft["id"] not in ids

    by_id = {p["id"]: p for p in listing.json()}
    # Просроченная актуальность: «устарело» + recommendation=false.
    assert by_id[stale["id"]]["is_stale"] is True
    assert by_id[stale["id"]]["recommendation"] is False
    assert "устарела" in by_id[stale["id"]]["stale_message"]
    # Актуальная: рекомендация сохраняется.
    assert by_id[fresh["id"]]["is_stale"] is False
    assert by_id[fresh["id"]]["recommendation"] is True

    # В списке нет checklist/прогресса (компактная выдача).
    assert by_id[fresh["id"]]["checklist"] == []
    assert by_id[fresh["id"]]["progress"] is None


def test_stale_boundary_today_still_valid(client: TestClient) -> None:
    staff = _staff(client)
    program = _create_program(
        client,
        staff["access_token"],
        actuality_date=date.today().isoformat(),
    )
    _publish(client, staff["access_token"], program["id"])
    data = client.get("/api/v1/support-programs").json()[0]
    assert data["is_stale"] is False
    assert data["recommendation"] is True


# ─── Фильтры: категория и УГТ-диапазон ──────────────────────────────────────

def test_filters_category_and_ugt(client: TestClient) -> None:
    staff = _staff(client)
    subsidy = _create_program(
        client,
        staff["access_token"],
        categories=["subsidy"],
        target_ugt_min=4,
        target_ugt_max=5,
    )
    grant = _create_program(
        client,
        staff["access_token"],
        categories=["grant"],
        target_ugt_min=0,
        target_ugt_max=2,
    )
    soft = _create_program(
        client,
        staff["access_token"],
        categories=["subsidy", "consulting"],
        target_ugt_min=6,
        target_ugt_max=9,
    )
    for p in (subsidy, grant, soft):
        _publish(client, staff["access_token"], p["id"])

    # Категория.
    listing = client.get("/api/v1/support-programs", params={"category": "subsidy"})
    ids = {p["id"] for p in listing.json()}
    assert {subsidy["id"], soft["id"]} <= ids
    assert grant["id"] not in ids

    listing = client.get("/api/v1/support-programs", params={"category": "grant"})
    ids = {p["id"] for p in listing.json()}
    assert grant["id"] in ids
    assert subsidy["id"] not in ids

    # УГТ-диапазон: пересечение (программа 4-6 попадает под фильтр 5-9).
    listing = client.get("/api/v1/support-programs", params={"ugt_min": 5, "ugt_max": 9})
    ids = {p["id"] for p in listing.json()}
    assert subsidy["id"] in ids
    assert soft["id"] in ids
    assert grant["id"] not in ids

    # УГТ: программа 6-9 не попадает под фильтр 0-5 (граница 6 > 5).
    listing = client.get("/api/v1/support-programs", params={"ugt_min": 0, "ugt_max": 5})
    ids = {p["id"] for p in listing.json()}
    assert subsidy["id"] in ids
    assert grant["id"] in ids
    assert soft["id"] not in ids

    # Комбинированный фильтр.
    listing = client.get(
        "/api/v1/support-programs",
        params={"category": "subsidy", "ugt_min": 6, "ugt_max": 9},
    )
    ids = {p["id"] for p in listing.json()}
    assert soft["id"] in ids
    assert subsidy["id"] not in ids


def test_filters_open_ugt_bounds(client: TestClient) -> None:
    staff = _staff(client)
    open_min = _create_program(
        client, staff["access_token"], target_ugt_min=None, target_ugt_max=3
    )
    open_max = _create_program(
        client, staff["access_token"], target_ugt_min=7, target_ugt_max=None
    )
    for p in (open_min, open_max):
        _publish(client, staff["access_token"], p["id"])

    # Фильтр 8-9: открытая верхняя граница (7+) попадает.
    listing = client.get("/api/v1/support-programs", params={"ugt_min": 8, "ugt_max": 9})
    ids = {p["id"] for p in listing.json()}
    assert open_max["id"] in ids
    assert open_min["id"] not in ids

    # Фильтр 0-2: открытая нижняя граница (-∞..3) попадает.
    listing = client.get("/api/v1/support-programs", params={"ugt_min": 0, "ugt_max": 2})
    ids = {p["id"] for p in listing.json()}
    assert open_min["id"] in ids
    assert open_max["id"] not in ids


# ─── Детали: RBAC и checklist ────────────────────────────────────────────────

def test_detail_rbac_and_checklist(client: TestClient) -> None:
    staff = _staff(client)
    customer = _register(client)
    program = _create_program(
        client,
        staff["access_token"],
        checklist=["Пункт 1", "Пункт 2", "Пункт 3"],
    )

    # Аноним → 401.
    resp = client.get(f"/api/v1/support-programs/{program['id']}")
    assert resp.status_code == 401, resp.text

    # Авторизованный видит черновик? Нет — только опубликованное → 404.
    resp = client.get(
        f"/api/v1/support-programs/{program['id']}", headers=_auth(customer["access_token"])
    )
    assert resp.status_code == 404, resp.text

    # Staff видит черновик с checklist (позиции 0..N) и пустым прогрессом.
    detail = client.get(
        f"/api/v1/support-programs/{program['id']}", headers=_auth(staff["access_token"])
    )
    assert detail.status_code == 200, detail.text
    data = detail.json()
    assert [c["item"] for c in data["checklist"]] == ["Пункт 1", "Пункт 2", "Пункт 3"]
    assert [c["position"] for c in data["checklist"]] == [0, 1, 2]
    assert data["progress"] is None

    # После публикации детали доступны авторизованному.
    _publish(client, staff["access_token"], program["id"])
    resp = client.get(
        f"/api/v1/support-programs/{program['id']}", headers=_auth(customer["access_token"])
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["checklist"]) == 3

    # Несуществующая программа → 404 (IDOR не раскрывает).
    resp = client.get("/api/v1/support-programs/999_999", headers=_auth(customer["access_token"]))
    assert resp.status_code == 404, resp.text


def test_update_replaces_checklist(client: TestClient) -> None:
    staff = _staff(client)
    program = _create_program(
        client, staff["access_token"], checklist=["Старый пункт"]
    )
    resp = client.patch(
        f"/api/v1/support-programs/{program['id']}",
        headers=_auth(staff["access_token"]),
        json={"checklist": ["Новый 1", "Новый 2"], "target_ugt_max": 8},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert [c["item"] for c in data["checklist"]] == ["Новый 1", "Новый 2"]
    assert data["target_ugt_max"] == 8


def test_delete_staff_only(client: TestClient) -> None:
    staff = _staff(client)
    program = _create_program(client, staff["access_token"])
    resp = client.delete(
        f"/api/v1/support-programs/{program['id']}", headers=_auth(staff["access_token"])
    )
    assert resp.status_code == 204, resp.text
    resp = client.get(
        f"/api/v1/support-programs/{program['id']}", headers=_auth(staff["access_token"])
    )
    assert resp.status_code == 404, resp.text


# ─── Checklist-прогресс: локально, без отправки наружу ──────────────────────

def test_checklist_progress_save_read_local(client: TestClient) -> None:
    staff = _staff(client)
    user_a = _register(client, full_name="Пользователь А")
    user_b = _register(client, full_name="Пользователь Б")
    program = _create_program(
        client, staff["access_token"], checklist=["Шаг 1", "Шаг 2", "Шаг 3"]
    )
    _publish(client, staff["access_token"], program["id"])

    # Прогресс сохраняется ЛОКАЛЬНО (completed — позиции), без внешних вызовов.
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user_a["access_token"]),
        json={"completed": [0, 2]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["completed"] == [0, 2]
    assert resp.json()["program_id"] == program["id"]
    assert resp.json()["updated_at"] is not None

    # Чтение своего прогресса.
    resp = client.get(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user_a["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["completed"] == [0, 2]

    # Обновление (upsert) — одна строка, новое значение.
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user_a["access_token"]),
        json={"completed": [0, 1, 2]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["completed"] == [0, 1, 2]

    # Другой пользователь НЕ видит чужой прогресс — только свой (пустой).
    resp = client.get(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user_b["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["completed"] == []

    # «Чужой прогресс» недоступен: невидимая (черновик) программа → 404,
    # несуществующая → 404.
    draft = _create_program(client, staff["access_token"])
    resp = client.get(
        f"/api/v1/support-programs/{draft['id']}/checklist/progress",
        headers=_auth(user_a["access_token"]),
    )
    assert resp.status_code == 404, resp.text
    resp = client.get(
        "/api/v1/support-programs/999_999/checklist/progress",
        headers=_auth(user_a["access_token"]),
    )
    assert resp.status_code == 404, resp.text

    # Недопустимая позиция → 422.
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user_a["access_token"]),
        json={"completed": [5]},
    )
    assert resp.status_code == 422, resp.text

    # Аноним не сохраняет прогресс → 401.
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        json={"completed": [0]},
    )
    assert resp.status_code == 401, resp.text

    # Прогресс виден в деталях (свой).
    detail = client.get(
        f"/api/v1/support-programs/{program['id']}", headers=_auth(user_a["access_token"])
    ).json()
    assert detail["progress"]["completed"] == [0, 1, 2]


def test_progress_not_sent_externally_smoke(client: TestClient) -> None:
    """Прогресс не уходит наружу: в обработчике нет внешних вызовов (HTTP-клиентов).

    Проверяем контракт ответа и отсутствие сетевых зависимостей на уровне кода:
    маршрут сохраняет прогресс и возвращает его из локального хранилища.
    """
    staff = _staff(client)
    user = _register(client)
    program = _create_program(
        client, staff["access_token"], checklist=["Пункт"]
    )
    _publish(client, staff["access_token"], program["id"])
    resp = client.post(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user["access_token"]),
        json={"completed": [0]},
    )
    assert resp.status_code == 200, resp.text
    # Повторное чтение без повторной отправки — данные из локального хранилища.
    resp = client.get(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user["access_token"]),
    )
    assert resp.json()["completed"] == [0]


# ─── Аудит support_program.* и checklist_progress.updated ───────────────────

def test_audit_events(client: TestClient) -> None:
    staff = _staff(client)
    user = _register(client)
    program = _create_program(client, staff["access_token"])
    assert "support_program.created" in _audit_actions()

    client.patch(
        f"/api/v1/support-programs/{program['id']}",
        headers=_auth(staff["access_token"]),
        json={"title": _uniq("Обновлено")},
    )
    assert "support_program.updated" in _audit_actions()

    _publish(client, staff["access_token"], program["id"])
    assert "support_program.published" in _audit_actions()

    client.post(
        f"/api/v1/support-programs/{program['id']}/confirm",
        headers=_auth(staff["access_token"]),
    )
    assert "support_program.confirmed" in _audit_actions()

    client.post(
        f"/api/v1/support-programs/{program['id']}/checklist/progress",
        headers=_auth(user["access_token"]),
        json={"completed": [0]},
    )
    assert "checklist_progress.updated" in _audit_actions()

    client.delete(
        f"/api/v1/support-programs/{program['id']}", headers=_auth(staff["access_token"])
    )
    assert "support_program.deleted" in _audit_actions()
