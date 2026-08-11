"""Тикет 01 (operations-modules): универсальное сопровождение проекта.

Покрывает: детерминированный расчёт (stage_progress, unit), RBAC этапов
(владелец/staff/участник/чужой→404), задачи, контрольные точки, версии
доказательств, экспорт мониторинга по ролям.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.services.stage_progress import (
    CHECKPOINT_STATUS_APPROVED,
    CHECKPOINT_STATUS_PENDING,
    STAGE_STATUS_COMPLETED,
    STAGE_STATUS_IN_PROGRESS,
    STAGE_STATUS_PLANNED,
    TASK_STATUS_DONE,
    TASK_STATUS_IN_PROGRESS,
    TASK_STATUS_TODO,
    CheckpointSnapshot,
    StageSnapshot,
    TaskSnapshot,
    compute_progress,
    compute_stage_status,
    is_overdue,
)
from tests.support import register_test_user

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _register(client: TestClient, role: str = "gk_customer") -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('user')}@example.com",
        full_name="Тест Сопровождение",
        role_slug=role,
    )


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> tuple[int, str]:
    resp = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={
            "name": _uniq("Проект"),
            "description": "Синтетический проект operations-тикета",
            "category": "it",
            "target_level": 9,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return body["id"], body.get("join_token") or ""


def _create_stage(client: TestClient, token: str, project_id: int) -> int:
    resp = client.post(
        f"/api/v1/projects/{project_id}/stages",
        headers=_auth(token),
        json={
            "title": _uniq("Этап"),
            "planned_start_date": date.today().isoformat(),
            "planned_end_date": (date.today() + timedelta(days=30)).isoformat(),
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ─── Unit: детерминированный расчёт (без БД) ────────────────────────────────

def test_is_overdue_boundaries() -> None:
    today = date(2026, 8, 10)
    # due_date == today → не просрочено
    assert not is_overdue(today, done=False, today=today)
    # вчера → просрочено
    assert is_overdue(today - timedelta(days=1), done=False, today=today)
    # завтра → не просрочено
    assert not is_overdue(today + timedelta(days=1), done=False, today=today)
    # None → не просрочено
    assert not is_overdue(None, done=False, today=today)
    # done → не просрочено (даже если дата в прошлом)
    assert not is_overdue(today - timedelta(days=5), done=True, today=today)


def test_compute_stage_status_priority() -> None:
    today = date(2026, 8, 10)
    # completed — приоритет
    done = StageSnapshot(status=STAGE_STATUS_COMPLETED)
    assert compute_stage_status(done, today) == STAGE_STATUS_COMPLETED
    # in_progress с просроченным плановым концом → статус in_progress,
    # просрочка отражается отдельным флагом (overdue), НЕ статусом
    late = StageSnapshot(
        status=STAGE_STATUS_IN_PROGRESS,
        planned_end=date(2026, 8, 1),
    )
    assert compute_stage_status(late, today) == STAGE_STATUS_IN_PROGRESS
    # не начат (planned) с плановым концом раньше сегодня → overdue
    not_started = StageSnapshot(
        status=STAGE_STATUS_PLANNED,
        planned_end=date(2026, 8, 1),
    )
    assert compute_stage_status(not_started, today) == "overdue"
    # in_progress без просрочки → in_progress
    ok = StageSnapshot(
        status=STAGE_STATUS_IN_PROGRESS,
        planned_end=date(2026, 9, 1),
    )
    assert compute_stage_status(ok, today) == STAGE_STATUS_IN_PROGRESS
    # planned без дат → planned
    assert compute_stage_status(StageSnapshot(), today) == STAGE_STATUS_PLANNED


def test_compute_progress_tasks_and_checkpoints() -> None:
    today = date(2026, 8, 10)
    tasks = [
        TaskSnapshot(status=TASK_STATUS_DONE, due_date=today),
        TaskSnapshot(status=TASK_STATUS_TODO, due_date=today),
    ]
    checkpoints = [
        CheckpointSnapshot(status=CHECKPOINT_STATUS_APPROVED, weight=2),
        CheckpointSnapshot(status=CHECKPOINT_STATUS_PENDING, weight=1),
    ]
    prog = compute_progress(
        StageSnapshot(status=STAGE_STATUS_IN_PROGRESS),
        tasks=tasks,
        checkpoints=checkpoints,
        today=today,
    )
    # задачи 50% (1/2) + КТ 50% (2/3) = 25 + 33.33 = 58.33%
    assert prog.progress_pct > 58.0 and prog.progress_pct < 59.0
    assert prog.tasks_total == 2 and prog.tasks_done == 1
    assert prog.tasks_overdue == 0
    assert prog.checkpoints_total == 2 and prog.checkpoints_done == 1
    assert prog.status == STAGE_STATUS_IN_PROGRESS
    assert not prog.overdue


def test_compute_progress_overdue_task() -> None:
    today = date(2026, 8, 10)
    tasks = [
        TaskSnapshot(status=TASK_STATUS_IN_PROGRESS, due_date=today - timedelta(days=1)),
        TaskSnapshot(status=TASK_STATUS_TODO, due_date=today),
    ]
    prog = compute_progress(
        StageSnapshot(status=STAGE_STATUS_IN_PROGRESS),
        tasks=tasks,
        checkpoints=[],
        today=today,
    )
    assert prog.tasks_overdue == 1
    assert prog.overdue
    assert prog.status == "overdue"


# ─── API: RBAC и workflow этапа ──────────────────────────────────────────────

def test_create_stage_owner_and_idor(client: TestClient) -> None:
    owner = _register(client)
    stranger = _register(client)
    pid, _jt = _create_project(client, owner["access_token"])

    # Владелец создаёт этап
    stage_id = _create_stage(client, owner["access_token"], pid)
    assert stage_id > 0

    # Чужой пользователь не видит этап (IDOR → 404)
    resp = client.get(
        f"/api/v1/stages/{stage_id}", headers=_auth(stranger["access_token"])
    )
    assert resp.status_code == 404, resp.text

    # Аноним → 401
    resp = client.get(f"/api/v1/stages/{stage_id}")
    assert resp.status_code == 401


def test_stage_tasks_rbac(client: TestClient) -> None:
    owner = _register(client)
    executor = _register(client, role="rd_executor")
    pid, _jt = _create_project(client, owner["access_token"])
    stage_id = _create_stage(client, owner["access_token"], pid)

    # Исполнитель вступает в проект по join-токену (заявка pending → approve владельцем)
    join_resp = client.post(
        "/api/v1/projects/join", headers=_auth(executor["access_token"]),
        json={"token": _jt, "role_in_project": "executor"},
    )
    assert join_resp.status_code == 200, join_resp.text
    assert join_resp.json()["status"] == "pending"

    requests = client.get(
        f"/api/v1/projects/{pid}/join-requests",
        headers=_auth(owner["access_token"]),
    ).json()
    member_id = next(r["user_id"] for r in requests if r["user_id"] == executor["user"]["id"])
    decide = client.post(
        f"/api/v1/projects/{pid}/join-requests/{member_id}/decide",
        headers=_auth(owner["access_token"]),
        json={"approve": True},
    )
    assert decide.status_code == 200, decide.text

    # Создание задачи: владелец, исполнитель = executor
    resp = client.post(
        f"/api/v1/stages/{stage_id}/tasks",
        headers=_auth(owner["access_token"]),
        json={
            "title": _uniq("Задача"),
            "assignee_id": executor["user"]["id"],
            "due_date": (date.today() - timedelta(days=1)).isoformat(),
        },
    )
    assert resp.status_code == 201, resp.text
    task_id = resp.json()["id"]

    # Чужой пользователь (не участник) не может менять чужую задачу (IDOR → 404)
    stranger = _register(client)
    resp = client.patch(
        f"/api/v1/stages/{stage_id}/tasks/{task_id}",
        headers=_auth(stranger["access_token"]),
        json={"status": TASK_STATUS_DONE},
    )
    assert resp.status_code == 404, resp.text

    # Исполнитель (участник проекта) может менять СВОЮ задачу (статус)
    resp = client.patch(
        f"/api/v1/stages/{stage_id}/tasks/{task_id}",
        headers=_auth(executor["access_token"]),
        json={"status": TASK_STATUS_DONE},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == TASK_STATUS_DONE

    # Аудит: task.created и task.completed (done) в истории этапа
    resp = client.get(
        f"/api/v1/stages/{stage_id}/history",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200
    actions = {h["action"] for h in resp.json()}
    assert "task.created" in actions
    assert "task.completed" in actions


def test_checkpoint_decide_and_audit(client: TestClient) -> None:
    owner = _register(client)
    staff = _register(client, role="cntr_manager")
    pid, _jt = _create_project(client, owner["access_token"])
    stage_id = _create_stage(client, owner["access_token"], pid)

    resp = client.post(
        f"/api/v1/stages/{stage_id}/checkpoints",
        headers=_auth(owner["access_token"]),
        json={"title": _uniq("Точка"), "due_date": date.today().isoformat(), "weight": 3},
    )
    assert resp.status_code == 201, resp.text
    cp_id = resp.json()["id"]
    assert resp.json()["status"] == CHECKPOINT_STATUS_PENDING

    # Решение (approve) принимает владелец или staff
    resp = client.patch(
        f"/api/v1/stages/{stage_id}/checkpoints/{cp_id}",
        headers=_auth(staff["access_token"]),
        json={"status": CHECKPOINT_STATUS_APPROVED, "decision": "Соответствует"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == CHECKPOINT_STATUS_APPROVED

    history = client.get(
        f"/api/v1/stages/{stage_id}/history",
        headers=_auth(owner["access_token"]),
    ).json()
    actions = {h["action"] for h in history}
    assert "checkpoint.created" in actions
    assert "checkpoint.decided" in actions


def test_evidence_versioned(client: TestClient) -> None:
    owner = _register(client)
    pid, _jt = _create_project(client, owner["access_token"])
    stage_id = _create_stage(client, owner["access_token"], pid)

    # Версионирование — по (stage, title): два доказательства с ОДИНАКОВЫМ
    # заголовком дают версии 1 и 2.
    title = _uniq("Доказательство")
    for i in (1, 2):
        resp = client.post(
            f"/api/v1/stages/{stage_id}/documents",
            headers=_auth(owner["access_token"]),
            json={"title": title, "content": f"Содержимое {i}"},
        )
        assert resp.status_code == 201, resp.text

    resp = client.get(
        f"/api/v1/stages/{stage_id}/documents",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200
    docs = resp.json()
    # Две загрузки с одинаковым заголовком → версии 1 и 2
    versions = [d["version"] for d in docs]
    assert sorted(versions) == [1, 2], versions
    assert all(d["scan_status"] in ("clean", "pending") for d in docs)


def test_export_scopes_and_idor(client: TestClient) -> None:
    owner = _register(client)
    executor = _register(client, role="rd_executor")
    staff = _register(client, role="cntr_manager")
    stranger = _register(client)

    pid, _jt = _create_project(client, owner["access_token"])
    stage_id = _create_stage(client, owner["access_token"], pid)
    client.post(
        f"/api/v1/stages/{stage_id}/tasks",
        headers=_auth(owner["access_token"]),
        json={"title": _uniq("Задача исполнителя"), "assignee_id": executor["user"]["id"]},
    )

    # Staff: полный экспорт (exporter.scope=staff, assignee_name есть у задач)
    resp = client.get(
        f"/api/v1/stages/{stage_id}/export", headers=_auth(staff["access_token"])
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["exporter"]["scope"] == "staff"
    assert any(t.get("assignee_name") for t in body["tasks"])

    # Владелец: scope=owner, все задачи, но без имён
    resp = client.get(
        f"/api/v1/stages/{stage_id}/export", headers=_auth(owner["access_token"])
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["exporter"]["scope"] == "owner"
    assert len(body["tasks"]) == 1
    assert all(t.get("assignee_name") is None for t in body["tasks"])

    # Чужой пользователь → IDOR 404
    resp = client.get(
        f"/api/v1/stages/{stage_id}/export", headers=_auth(stranger["access_token"])
    )
    assert resp.status_code == 404
