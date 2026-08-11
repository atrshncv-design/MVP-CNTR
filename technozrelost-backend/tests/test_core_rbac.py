"""Пачка C (тикеты 20–25): негативные RBAC/IDOR, миграция роли, словарь этапов.

Позитивные сценарии нового ядра уже покрыты tests/test_new_core.py. Здесь —
недостающие проверки: состояние роли после миграции (20), словарь 8 переходов (20/23),
RBAC-отказы и IDOR-404 по очередям менеджера (22), этапам (23), реестрам (24)
и верифицирующим документам (25).
"""

from __future__ import annotations

import asyncio
import os
import uuid

import psycopg
from fastapi.testclient import TestClient

from app.api.v1 import stages as stages_module
from app.core.database import SessionLocal
from app.db.models import Project, ProjectMember
from tests.support import register_test_user

PASSWORD = "Probe12345"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _register(client: TestClient, role: str) -> tuple[str, int]:
    data = register_test_user(
        client,
        email=_email(role),
        full_name=f"Core {role}",
        organization="Орг",
        role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _db() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _assessment(client: TestClient, token: str) -> dict:
    payload = {
        "name": "Экспресс-проект",
        "description": "Черновик из экспресс-оценки",
        "questionnaire_results": [
            {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0},
            {"level_id": 2, "checked_items": ["Концепция"], "percentage": 100.0},
            {"level_id": 3, "checked_items": ["Эксперимент"], "percentage": 100.0},
        ],
    }
    response = client.post("/api/v1/assessments", json=payload, headers=_auth(token))
    assert response.status_code == 201, response.text
    return response.json()


def _approve_draft(
    client: TestClient, manager_token: str, project_id: int, level: int = 2
) -> None:
    response = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        json={"approve": True, "level": level},
        headers=_auth(manager_token),
    )
    assert response.status_code == 200, response.text


def _publish(client: TestClient, token: str, project_id: int) -> None:
    response = client.put(
        f"/api/v1/projects/{project_id}/publish",
        headers=_auth(token),
        json={"is_public": True},
    )
    assert response.status_code == 200, response.text


def _published_project(
    client: TestClient, owner_token: str, manager_token: str, level: int = 2
) -> int:
    draft = _assessment(client, owner_token)
    _approve_draft(client, manager_token, draft["id"], level=level)
    _publish(client, owner_token, draft["id"])
    return draft["id"]


def _create_db_project(
    owner_id: int, *, status: str = "published", current_level: int = 9, name: str = "DB Project"
) -> int:
    """Проект напрямую в БД (для краевых состояний уровня)."""

    async def _create() -> int:
        async with SessionLocal() as db:
            project = Project(
                name=name,
                category="IT",
                target_level=9,
                current_level=current_level,
                status=status,
                created_by=owner_id,
            )
            db.add(project)
            await db.flush()
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=owner_id,
                    role_in_project="gk_customer",
                    is_priority=True,
                )
            )
            await db.commit()
            await db.refresh(project)
            return project.id

    return asyncio.run(_create())


def _join(
    client: TestClient,
    token: str,
    owner_token: str,
    owner_id: int,
    project_id: int,
    role: str,
) -> None:
    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    join_token = detail.json()["project"]["join_token"]
    joined = client.post(
        "/api/v1/projects/join",
        json={
            "token": join_token,
            "role_in_project": role,
            "shared_by": owner_id,
        },
        headers=_auth(token),
    )
    assert joined.status_code == 200, joined.text


def _mock_llm(monkeypatch, answer: str) -> None:
    async def _fake(system: str, user_msg: str) -> str:
        return answer

    monkeypatch.setattr(stages_module, "ask_llm", _fake)


# ─── Тикет 20: миграция роли и словарь этапов ────────────────────────────────


def test_role_renamed_to_regulating_organization(client: TestClient) -> None:
    """Переименование ugt_expert → regulating_organization без потери прав и пользователей."""
    with _db() as conn:
        row = conn.execute(
            "SELECT role_no, slug, name FROM public.roles WHERE slug = 'regulating_organization'"
        ).fetchone()
        assert row is not None, "роль regulating_organization отсутствует после миграций"
        role_no, slug, name = row
        assert slug == "regulating_organization"
        assert name == "Регулирующая организация"
        assert role_no == 5, "порядковый номер роли изменился — сломаются user_roles"

        old = conn.execute(
            "SELECT count(*) FROM public.roles WHERE slug = 'ugt_expert'"
        ).fetchone()[0]
        assert old == 0, "старый slug ugt_expert остался в справочнике ролей"

        perms = conn.execute(
            """
            SELECT count(*) FROM public.role_permissions rp
            JOIN public.roles r ON r.id = rp.role_id
            WHERE r.slug = 'regulating_organization'
            """
        ).fetchone()[0]
        assert perms > 0, "права роли потеряны при переименовании"

    # Присвоение роли работает по id (user_roles), а не по имени
    token, user_id = _register(client, "regulating_organization")
    assert token
    with _db() as conn:
        assigned = conn.execute(
            """
            SELECT count(*) FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = %s AND r.slug = 'regulating_organization'
            """,
            (user_id,),
        ).fetchone()[0]
        assert assigned == 1


def test_stage_requirements_dictionary_8_transitions(client: TestClient) -> None:
    """Словарь требований: ровно 8 переходов 1→2 … 8→9, уникальные пары, контент не пуст."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT from_level, to_level, title, description "
            "FROM public.stage_requirements ORDER BY from_level"
        ).fetchall()
        assert [r[0] for r in rows] == [1, 2, 3, 4, 5, 6, 7, 8]
        assert [r[1] for r in rows] == [2, 3, 4, 5, 6, 7, 8, 9]
        assert all(r[2] and r[3] for r in rows), "есть пустые требования"

        dup = conn.execute(
            """
            SELECT count(*) FROM (
                SELECT from_level, to_level FROM public.stage_requirements
                GROUP BY from_level, to_level HAVING count(*) > 1
            ) d
            """
        ).fetchone()[0]
        assert dup == 0


def test_stage_requirements_level9_conflict(client: TestClient) -> None:
    owner_token, owner_id = _register(client, "gk_customer")
    project_id = _create_db_project(owner_id, current_level=9)

    response = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    )
    assert response.status_code == 409
    assert "максимального УГТ" in response.json()["detail"]


def test_stage_requirements_level8_last_transition(client: TestClient) -> None:
    owner_token, owner_id = _register(client, "gk_customer")
    project_id = _create_db_project(owner_id, current_level=8)

    response = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    )
    assert response.status_code == 200
    stage = response.json()
    assert len(stage) == 1
    assert stage[0]["from_level"] == 8 and stage[0]["to_level"] == 9


# ─── Тикет 21: экспресс-оценка — видимость черновика ─────────────────────────


def test_draft_visible_to_manager_and_owner_only(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    outsider_token, _ = _register(client, "investor")
    draft = _assessment(client, owner_token)

    owner_view = client.get(f"/api/v1/projects/{draft['id']}", headers=_auth(owner_token))
    assert owner_view.status_code == 200

    manager_view = client.get(f"/api/v1/projects/{draft['id']}", headers=_auth(manager_token))
    assert manager_view.status_code == 200  # менеджер видит черновик (очередь)

    outsider_view = client.get(f"/api/v1/projects/{draft['id']}", headers=_auth(outsider_token))
    assert outsider_view.status_code == 404  # IDOR: чужие черновики не раскрываются


# ─── Тикет 22: очереди менеджера — RBAC и IDOR ───────────────────────────────


def test_draft_decide_rbac_non_manager(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    outsider_token, _ = _register(client, "investor")
    draft = _assessment(client, owner_token)

    denied = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        json={"approve": True, "level": 2},
        headers=_auth(outsider_token),
    )
    assert denied.status_code == 403


def test_draft_decide_404_unknown_project(client: TestClient) -> None:
    manager_token, _ = _register(client, "cntr_manager")
    response = client.post(
        "/api/v1/manager/queue/drafts/999999/decide",
        json={"approve": True, "level": 2},
        headers=_auth(manager_token),
    )
    assert response.status_code == 404


def test_draft_decide_404_not_a_draft(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token)

    response = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        json={"approve": True, "level": 2},
        headers=_auth(manager_token),
    )
    assert response.status_code == 404  # уже опубликован — не черновик


def test_draft_approve_level_above_preliminary_400(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    draft = _assessment(client, owner_token)  # preliminary_level = 3

    denied = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        json={"approve": True, "level": 5},
        headers=_auth(manager_token),
    )
    assert denied.status_code == 400
    assert "выше предварительного" in denied.json()["detail"]


def test_draft_approve_level_below_2_400(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    draft = _assessment(client, owner_token)

    denied = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        json={"approve": True, "level": 1},
        headers=_auth(manager_token),
    )
    assert denied.status_code == 400
    assert "ниже УГТ 2" in denied.json()["detail"]


def test_promotions_rbac_non_manager(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    outsider_token, _ = _register(client, "rd_executor")

    denied_queue = client.get(
        "/api/v1/manager/queue/promotions", headers=_auth(outsider_token)
    )
    assert denied_queue.status_code == 403

    denied_decide = client.post(
        "/api/v1/manager/queue/promotions/1/decide",
        json={"approve": True},
        headers=_auth(outsider_token),
    )
    assert denied_decide.status_code == 403


def test_promotion_decide_404_unknown_and_already_decided(
    client: TestClient, monkeypatch
) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token)

    with _db() as conn:
        req_id = conn.execute(
            "SELECT id FROM public.promotion_requests WHERE project_id = %s", (project_id,)
        ).fetchone()
        assert req_id is None  # заявок ещё нет

    unknown = client.post(
        "/api/v1/manager/queue/promotions/999999/decide",
        json={"approve": True},
        headers=_auth(manager_token),
    )
    assert unknown.status_code == 404

    # Создаём заявку (полный комплект + успешная оценка) и дважды решаем
    reqs = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    ).json()
    uploaded = _stage_doc_with_llm(client, owner_token, project_id, reqs[0]["id"], monkeypatch)
    assert uploaded["request_id"] is not None

    first = client.post(
        f"/api/v1/manager/queue/promotions/{uploaded['request_id']}/decide",
        json={"approve": True},
        headers=_auth(manager_token),
    )
    assert first.status_code == 200
    assert first.json()["status"] == "approved"

    second = client.post(
        f"/api/v1/manager/queue/promotions/{uploaded['request_id']}/decide",
        json={"approve": True},
        headers=_auth(manager_token),
    )
    assert second.status_code == 404  # уже рассмотрена


def _stage_doc_with_llm(
    client: TestClient, token: str, project_id: int, requirement_id: int, monkeypatch
) -> dict:
    if monkeypatch is not None:
        _mock_llm(monkeypatch, "SUCCESS\nSUMMARY: комплект полный\n")
    response = client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        json={"stage_requirement_id": requirement_id, "title": "Акт", "content": "Текст"},
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


# ─── Тикет 23: этапы — RBAC/IDOR и валидация ─────────────────────────────────


def test_stage_requirements_rbac_non_member_404(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    outsider_token, _ = _register(client, "investor")
    project_id = _published_project(client, owner_token, manager_token)

    denied = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(outsider_token)
    )
    assert denied.status_code == 404  # IDOR: чужая карточка не раскрывается


def test_stage_documents_rbac_non_member_404(client: TestClient, monkeypatch) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    outsider_token, _ = _register(client, "rd_executor")
    project_id = _published_project(client, owner_token, manager_token)

    reqs = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    ).json()
    _mock_llm(monkeypatch, "SUCCESS\nSUMMARY: ок\n")

    denied = client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        json={"stage_requirement_id": reqs[0]["id"], "title": "Чужой", "content": "Текст"},
        headers=_auth(outsider_token),
    )
    assert denied.status_code == 404


def test_stage_documents_wrong_requirement_400(client: TestClient, monkeypatch) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token)  # level 2 → этап 2→3

    with _db() as conn:
        other_req = conn.execute(
            "SELECT id FROM public.stage_requirements WHERE from_level = 1 LIMIT 1"
        ).fetchone()
        assert other_req is not None
        other_req_id = other_req[0]

    _mock_llm(monkeypatch, "SUCCESS\nSUMMARY: ок\n")
    denied = client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        json={"stage_requirement_id": other_req_id, "title": "Акт", "content": "Текст"},
        headers=_auth(owner_token),
    )
    assert denied.status_code == 400
    assert "не относится к текущему этапу" in denied.json()["detail"]


def test_stage_documents_on_draft_409(client: TestClient, monkeypatch) -> None:
    owner_token, _ = _register(client, "gk_customer")
    draft = _assessment(client, owner_token)  # статус draft

    with _db() as conn:
        req = conn.execute(
            "SELECT id FROM public.stage_requirements WHERE from_level = 1 LIMIT 1"
        ).fetchone()
        assert req is not None
        requirement_id = req[0]

    _mock_llm(monkeypatch, "SUCCESS\nSUMMARY: ок\n")
    denied = client.post(
        f"/api/v1/projects/{draft['id']}/stage-documents",
        json={"stage_requirement_id": requirement_id, "title": "Акт", "content": "Текст"},
        headers=_auth(owner_token),
    )
    assert denied.status_code == 409
    assert "не опубликован" in denied.json()["detail"]


def test_stage_evaluate_without_request_409(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token)

    denied = client.post(
        f"/api/v1/projects/{project_id}/stage-evaluate", headers=_auth(owner_token)
    )
    assert denied.status_code == 409
    assert "загрузите документы" in denied.json()["detail"]


# ─── Тикет 24: реестры — исключения и фильтры ────────────────────────────────


def test_registry_excludes_rejected(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    investor_token, _ = _register(client, "investor")

    draft = _assessment(client, owner_token)
    rejected = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        json={"approve": False, "reason": "Недостаточно обоснования"},
        headers=_auth(manager_token),
    )
    assert rejected.status_code == 200

    # Отклонённый нельзя опубликовать и он не светится в реестре
    publish_denied = client.put(
        f"/api/v1/projects/{draft['id']}/publish",
        json={"is_public": True},
        headers=_auth(owner_token),
    )
    assert publish_denied.status_code == 409

    registry = client.get("/api/v1/projects/registry", headers=_auth(investor_token))
    assert registry.status_code == 200
    assert draft["id"] not in [p["id"] for p in registry.json()]


def test_registry_filters_ugt_max_category_budget(client: TestClient) -> None:
    owner_a, _ = _register(client, "gk_customer")
    owner_b, _ = _register(client, "rd_executor")
    manager_token, _ = _register(client, "cntr_manager")
    investor_token, _ = _register(client, "investor")

    # Проект A: категория AI, бюджет 10 млн, УГТ 3
    draft_a = client.post(
        "/api/v1/assessments",
        json={
            "name": "AI-проект",
            "category": "AI",
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0},
                {"level_id": 2, "checked_items": ["Концепция"], "percentage": 100.0},
                {"level_id": 3, "checked_items": ["Эксперимент"], "percentage": 100.0},
            ],
        },
        headers=_auth(owner_a),
    )
    assert draft_a.status_code == 201, draft_a.text
    project_a_id = draft_a.json()["id"]
    with _db() as conn:
        conn.execute(
            "UPDATE public.projects SET budget = %s WHERE id = %s",
            (10_000_000, project_a_id),
        )
    _approve_draft(client, manager_token, project_a_id, level=3)
    _publish(client, owner_a, project_a_id)

    # Проект B: категория Materials, бюджет 0.5 млн, УГТ 2
    draft_b = client.post(
        "/api/v1/assessments",
        json={
            "name": "Materials-проект",
            "category": "Materials",
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0},
                {"level_id": 2, "checked_items": ["Концепция"], "percentage": 100.0},
            ],
        },
        headers=_auth(owner_b),
    )
    assert draft_b.status_code == 201, draft_b.text
    project_b_id = draft_b.json()["id"]
    with _db() as conn:
        conn.execute(
            "UPDATE public.projects SET budget = %s WHERE id = %s",
            (500_000, project_b_id),
        )
    # preliminary=2 → auto_confirmed: менеджерский апрув не требуется, публикуем напрямую
    _publish(client, owner_b, project_b_id)

    by_category = client.get(
        "/api/v1/projects/registry?category=AI", headers=_auth(investor_token)
    )
    assert by_category.status_code == 200
    assert [p["name"] for p in by_category.json()] == ["AI-проект"]

    by_ugt_max = client.get(
        "/api/v1/projects/registry?ugt_max=2", headers=_auth(investor_token)
    )
    assert [p["name"] for p in by_ugt_max.json()] == ["Materials-проект"]

    by_budget_min = client.get(
        "/api/v1/projects/registry?budget_min=1000000", headers=_auth(investor_token)
    )
    assert [p["name"] for p in by_budget_min.json()] == ["AI-проект"]

    by_budget_max = client.get(
        "/api/v1/projects/registry?budget_max=1000000", headers=_auth(investor_token)
    )
    assert [p["name"] for p in by_budget_max.json()] == ["Materials-проект"]


def test_registry_anonymous_200(client: TestClient) -> None:
    response = client.get("/api/v1/projects/registry")
    assert response.status_code == 200
    assert response.json() == []


# ─── Тикет 25: верифицирующие документы — IDOR и очередь менеджера ───────────


def test_verification_docs_404_unknown_project(client: TestClient) -> None:
    token, _ = _register(client, "regulating_organization")
    response = client.post(
        "/api/v1/projects/999999/verification-docs",
        json={"title": "Документ", "comment": "Материал"},
        headers=_auth(token),
    )
    assert response.status_code == 404


def test_verification_docs_anonymous_401(client: TestClient) -> None:
    owner_token, _ = _register(client, "gk_customer")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token)

    response = client.post(
        f"/api/v1/projects/{project_id}/verification-docs",
        json={"title": "Документ", "comment": "Материал"},
    )
    assert response.status_code == 401


def test_verification_doc_in_manager_queue(client: TestClient, monkeypatch) -> None:
    owner_token, owner_id = _register(client, "gk_customer")
    reg_token, _ = _register(client, "regulating_organization")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token)

    # Заявка в очереди менеджера (полный комплект + успешная оценка)
    reqs = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    ).json()
    uploaded = _stage_doc_with_llm(client, owner_token, project_id, reqs[0]["id"], monkeypatch)
    assert uploaded["request_status"] == "pending_manager"

    # Регулирующая организация вступает и добавляет верифицирующий документ
    _join(client, reg_token, owner_token, owner_id, project_id, "regulating_organization")
    doc = client.post(
        f"/api/v1/projects/{project_id}/verification-docs",
        json={"title": "Подтверждение УГТ", "comment": "Акт верификации"},
        headers=_auth(reg_token),
    )
    assert doc.status_code == 201, doc.text

    # Документ — материал в очереди менеджера
    queue = client.get("/api/v1/manager/queue/promotions", headers=_auth(manager_token))
    assert queue.status_code == 200
    item = next(r for r in queue.json() if r["project_id"] == project_id)
    assert any(v["title"] == "Подтверждение УГТ" for v in item["verification_docs"])


def test_verification_doc_regulator_before_join_403(client: TestClient) -> None:
    """403 до вступления (не 404) — специальный RBAC-кейс тикета 25."""
    owner_token, _ = _register(client, "gk_customer")
    reg_token, _ = _register(client, "regulating_organization")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token)

    before = client.post(
        f"/api/v1/projects/{project_id}/verification-docs",
        json={"title": "Подтверждение", "comment": "Акт"},
        headers=_auth(reg_token),
    )
    assert before.status_code == 403
    assert "присоединитесь" in before.json()["detail"]
