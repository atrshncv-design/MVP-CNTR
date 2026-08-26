"""Новое ядро (тикеты 20-25): экспресс-оценка, очереди менеджера, автозаявка,
реестр published-проектов, верифицирующие документы."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.api.v1 import stages as stages_module
from tests.support import priority_share_sig, register_test_user


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    email = f"core-{uuid.uuid4().hex[:8]}@example.com"
    data = register_test_user(
        client,
        email=email,
        full_name=f"Core {role}",
        organization="Орг",
        role_slug=role,
    )
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _assessment(client: TestClient, token: str, levels: list[dict] | None = None) -> dict:
    payload = {
        "name": "Экспресс-проект",
        "description": "Черновик из экспресс-оценки",
        "questionnaire_results": levels
        or [
            {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0},
            {"level_id": 2, "checked_items": ["Концепция"], "percentage": 100.0},
            {"level_id": 3, "checked_items": ["Эксперимент"], "percentage": 100.0},
        ],
    }
    response = client.post("/api/v1/assessments", json=payload, headers=_auth(token))
    assert response.status_code == 201, response.text
    return response.json()


def _approve_draft(client: TestClient, manager_token: str, project_id: int, level: int = 2) -> None:
    response = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        json={"approve": True, "level": level},
        headers=_auth(manager_token),
    )
    assert response.status_code == 200, response.text


# ─── Тикет 21: экспресс-оценка ───────────────────────────────────────────────


def test_assessment_creates_draft_with_preliminary_level(client: TestClient) -> None:
    token, _ = _register(client)
    draft = _assessment(client, token)

    assert draft["status"] == "draft"
    assert draft["preliminary_level"] == 3  # 1..3 непрерывно
    assert draft["current_level"] == 2  # тикет 05: официальный УГТ капнут на 2
    assert len(draft["questionnaire_results"]) == 3


def test_assessment_mine_lists_own_drafts(client: TestClient) -> None:
    token, _ = _register(client)
    _assessment(client, token)

    mine = client.get("/api/v1/assessments/mine", headers=_auth(token))
    assert mine.status_code == 200
    assert len(mine.json()) == 1
    assert mine.json()[0]["preliminary_level"] == 3


def test_assessment_403_after_real_project(client: TestClient) -> None:
    token, _ = _register(client)
    created = client.post(
        "/api/v1/projects",
        json={"name": "Полный проект", "target_level": 5},
        headers=_auth(token),
    )
    assert created.status_code == 201

    denied = client.post(
        "/api/v1/assessments",
        json={"questionnaire_results": [{"level_id": 1, "checked_items": [], "percentage": 100}]},
        headers=_auth(token),
    )
    assert denied.status_code == 403
    assert "переоценка" in denied.json()["detail"].lower()


def test_draft_invisible_to_others(client: TestClient) -> None:
    owner_token, _ = _register(client)
    outsider_token, _ = _register(client, "investor")
    draft = _assessment(client, owner_token)

    hidden = client.get(f"/api/v1/projects/{draft['id']}", headers=_auth(outsider_token))
    assert hidden.status_code == 404


# ─── Тикет 22: очереди менеджера ─────────────────────────────────────────────


def test_manager_queues_require_manager_role(client: TestClient) -> None:
    gk_token, _ = _register(client)
    denied = client.get("/api/v1/manager/queue/drafts", headers=_auth(gk_token))
    assert denied.status_code == 403


def test_manager_approve_publishes_and_reject_records_reason(client: TestClient) -> None:
    owner_token, _ = _register(client)
    manager_token, _ = _register(client, "cntr_manager")
    draft = _assessment(client, owner_token)

    # Отклонение с причиной
    rejected = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        json={"approve": False, "reason": "Нет обоснования бюджета"},
        headers=_auth(manager_token),
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["rejection_reason"] == "Нет обоснования бюджета"

    owner_view = client.get(f"/api/v1/projects/{draft['id']}", headers=_auth(owner_token))
    assert owner_view.status_code == 200  # причина видна владельцу через карточку

    # Тикет 22: отклонённый драфт можно переоценить (resubmit) — новый черновик
    resubmitted = client.post(
        "/api/v1/assessments",
        json={
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0}
            ]
        },
        headers=_auth(owner_token),
    )
    assert resubmitted.status_code == 201
    assert resubmitted.json()["id"] != draft["id"]

    # Новый черновик новым пользователем → апрув сразу на заявленный уровень
    new_token, _ = _register(client)
    draft2 = _assessment(client, new_token)
    _approve_draft(client, manager_token, draft2["id"], level=3)
    assert draft2["id"] != draft["id"]


def test_manager_reject_requires_reason_field_optional(client: TestClient) -> None:
    owner_token, _ = _register(client)
    manager_token, _ = _register(client, "cntr_manager")
    draft = _assessment(client, owner_token)

    rejected = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        json={"approve": False},
        headers=_auth(manager_token),
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"


# ─── Тикеты 23-25: автозаявка, реестр, верифицирующие документы ──────────────


def _published_project(
    client: TestClient, owner_token: str, manager_token: str, level: int = 2
) -> int:
    draft = _assessment(client, owner_token)
    _approve_draft(client, manager_token, draft["id"], level=level)
    return draft["id"]


def test_stage_requirements_and_auto_application(client: TestClient, monkeypatch) -> None:
    owner_token, owner_id = _register(client)
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token, level=2)

    # Требования этапа 1→2 (8 переходов в словаре)
    reqs = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    )
    assert reqs.status_code == 200
    stage = reqs.json()
    assert len(stage) == 1  # один переход на этап
    assert stage[0]["from_level"] == 2 and stage[0]["to_level"] == 3
    assert stage[0]["uploaded"] is False

    # Мок LLM: оценка успешна
    async def _fake_llm(system: str, user_msg: str) -> str:
        return "SUCCESS\nSUMMARY: комплект полный\n"

    monkeypatch.setattr(stages_module, "ask_llm", _fake_llm)

    # Загрузка последнего документа участником (не владельцем) → автозаявка
    member_token, member_id = _register(client, "rd_executor")
    join_token = _get_join_token(client, owner_token, project_id)
    joined = client.post(
        "/api/v1/projects/join",
        json={
            "token": join_token,
            "role_in_project": "rd_executor",
            "share_sig": priority_share_sig(client, owner_token, project_id),
        },
        headers=_auth(member_token),
    )
    assert joined.status_code == 200

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        json={
            "stage_requirement_id": stage[0]["id"],
            "title": "Концепция проекта",
            "content": "Обоснование технологической концепции…",
        },
        headers=_auth(member_token),
    )
    assert uploaded.status_code == 201
    assert uploaded.json()["request_id"] is not None
    assert uploaded.json()["request_status"] == "pending_manager"

    # Менеджер видит заявку в очереди + уведомление
    queue = client.get("/api/v1/manager/queue/promotions", headers=_auth(manager_token))
    assert queue.status_code == 200
    assert any(r["project_id"] == project_id for r in queue.json())

    notes = client.get("/api/v1/notifications", headers=_auth(manager_token))
    assert notes.status_code == 200
    assert any(n["type"] == "promotion.pending" for n in notes.json())

    # Апрув повышения: N→N+1
    request_id = uploaded.json()["request_id"]
    decided = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        json={"approve": True},
        headers=_auth(manager_token),
    )
    assert decided.status_code == 200
    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert detail.json()["project"]["current_level"] == 3

    # История попыток доступна менеджеру
    history = client.get(
        f"/api/v1/manager/queue/history/{project_id}", headers=_auth(manager_token)
    )
    assert history.status_code == 200
    assert len(history.json()) == 1


def _get_join_token(client: TestClient, owner_token: str, project_id: int) -> str:
    detail = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    return detail.json()["project"]["join_token"]


def test_stage_evaluate_failure_and_retry(client: TestClient, monkeypatch) -> None:
    owner_token, _ = _register(client)
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token, level=2)

    reqs = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    ).json()

    async def _fake_fail(system: str, user_msg: str) -> str:
        return "FAIL\nSUMMARY: не хватает обоснования\nMISSING: ТЭО этапа\n"

    monkeypatch.setattr(stages_module, "ask_llm", _fake_fail)

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        json={
            "stage_requirement_id": reqs[0]["id"],
            "title": "Концепция",
            "content": "Текст",
        },
        headers=_auth(owner_token),
    )
    assert uploaded.status_code == 201
    # Оценка не успешна → заявка не ушла менеджеру
    assert uploaded.json()["evaluation_success"] is False

    # Повторная оценка
    evaluate = client.post(
        f"/api/v1/projects/{project_id}/stage-evaluate", headers=_auth(owner_token)
    )
    assert evaluate.status_code == 200
    assert evaluate.json()["success"] is False
    assert "ТЭО этапа" in evaluate.json()["missing"]

    queue = client.get("/api/v1/manager/queue/promotions", headers=_auth(manager_token))
    assert not any(r["project_id"] == project_id for r in queue.json())


def test_stage_evaluate_success_sends_to_manager(client: TestClient, monkeypatch) -> None:
    owner_token, _ = _register(client)
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token, level=2)

    reqs = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(owner_token)
    ).json()

    async def _fake_ok(system: str, user_msg: str) -> str:
        return "SUCCESS\nSUMMARY: документы подтверждают переход\n"

    monkeypatch.setattr(stages_module, "ask_llm", _fake_ok)

    client.post(
        f"/api/v1/projects/{project_id}/stage-documents",
        json={"stage_requirement_id": reqs[0]["id"], "title": "Акт", "content": "Текст"},
        headers=_auth(owner_token),
    )

    evaluate = client.post(
        f"/api/v1/projects/{project_id}/stage-evaluate", headers=_auth(owner_token)
    )
    assert evaluate.status_code == 200
    assert evaluate.json()["success"] is True

    queue = client.get("/api/v1/manager/queue/promotions", headers=_auth(manager_token))
    assert any(r["project_id"] == project_id for r in queue.json())


# ─── Тикет 24: общий реестр ──────────────────────────────────────────────────


def test_registry_shows_only_published(client: TestClient) -> None:
    owner_token, _ = _register(client)
    manager_token, _ = _register(client, "cntr_manager")
    investor_token, _ = _register(client, "investor")

    # Черновик — не светится
    draft = _assessment(client, owner_token)
    # Апрувнутый проект уровня 3 — в реестре (другой владелец: переоценка запрещена)
    second_owner, _ = _register(client)
    approved = _assessment(client, second_owner)
    _approve_draft(client, manager_token, approved["id"], level=3)
    # тикет 10: публикация с согласием владельца
    pub = client.put(
        f"/api/v1/projects/{approved['id']}/publish",
        headers=_auth(second_owner),
        json={"is_public": True},
    )
    assert pub.status_code == 200, pub.text

    registry = client.get("/api/v1/projects/registry", headers=_auth(investor_token))
    assert registry.status_code == 200
    ids = [p["id"] for p in registry.json()]
    assert approved["id"] in ids
    assert draft["id"] not in ids

    # Фильтр УГТ 7+ (реестр технологий)
    high = client.get(
        "/api/v1/projects/registry?ugt_min=7", headers=_auth(investor_token)
    )
    assert high.status_code == 200
    assert all(p["current_level"] >= 7 for p in high.json())


# ─── Тикет 25: верифицирующие документы ──────────────────────────────────────


def test_verification_docs_before_and_after_join(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    reg_token, _ = _register(client, "regulating_organization")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token, level=2)

    # До вступления — 403
    before = client.post(
        f"/api/v1/projects/{project_id}/verification-docs",
        json={"title": "Подтверждение УГТ", "comment": "Акт"},
        headers=_auth(reg_token),
    )
    assert before.status_code == 403

    # После вступления по токену — 200
    join_token = _get_join_token(client, owner_token, project_id)
    joined = client.post(
        "/api/v1/projects/join",
        json={
            "token": join_token,
            "role_in_project": "regulating_organization",
            "share_sig": priority_share_sig(client, owner_token, project_id),
        },
        headers=_auth(reg_token),
    )
    assert joined.status_code == 200

    after = client.post(
        f"/api/v1/projects/{project_id}/verification-docs",
        json={"title": "Подтверждение УГТ 1", "comment": "Акт верификации"},
        headers=_auth(reg_token),
    )
    assert after.status_code == 201
    assert after.json()["uploader_name"] == "Core regulating_organization"

    # Верифицирующий документ виден владельцу в карточке проекта
    card = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert card.status_code == 200
    vdocs = card.json()["verification_documents"]
    assert len(vdocs) == 1
    assert vdocs[0]["title"] == "Подтверждение УГТ 1"
    assert vdocs[0]["uploader_name"] == "Core regulating_organization"
    assert vdocs[0]["project_id"] == project_id


def test_verification_docs_empty_list_in_card(client: TestClient) -> None:
    owner_token, _ = _register(client)
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token, level=2)

    card = client.get(f"/api/v1/projects/{project_id}", headers=_auth(owner_token))
    assert card.status_code == 200
    assert card.json()["verification_documents"] == []


def test_regular_participant_can_upload_verification_doc(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    rd_token, _ = _register(client, "rd_executor")
    manager_token, _ = _register(client, "cntr_manager")
    project_id = _published_project(client, owner_token, manager_token, level=2)

    join_token = _get_join_token(client, owner_token, project_id)
    client.post(
        "/api/v1/projects/join",
        json={
            "token": join_token,
            "role_in_project": "rd_executor",
            "share_sig": priority_share_sig(client, owner_token, project_id),
        },
        headers=_auth(rd_token),
    )

    uploaded = client.post(
        f"/api/v1/projects/{project_id}/verification-docs",
        json={"title": "Материал", "comment": "Протокол испытаний"},
        headers=_auth(rd_token),
    )
    assert uploaded.status_code == 201
