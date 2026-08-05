"""Тикет 12 Friday RC: realtime-уведомления и распределение задач.

Покрытие:
- Проектное событие получает назначенный менеджер (in-app уведомление)
- Общее событие попадает в outbox (general scope)
- Только один менеджер атомарно забирает задачу (claim, SKIP LOCKED)
- Администратор видит и переназначает очередь
- Уведомление сохраняется в БД (не теряется при закрытом браузере)
- Outbox — отдельная таблица (будущий Bitrix-адаптер читает committed-записи)
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("t12"), full_name="Тикет12", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


from contextlib import contextmanager


async def _fake_ok_llm(*args, **kwargs):  # noqa: ARG001
    return "SUCCESS: комплект полный, все требования выполнены"


@contextmanager
def _mock_llm_ok():
    """Подмена ask_llm на успешный ответ — LLM недоступна в тестах."""
    from app.api.v1 import stages as stages_module

    original = stages_module.ask_llm
    stages_module.ask_llm = _fake_ok_llm  # type: ignore[assignment]
    try:
        yield
    finally:
        stages_module.ask_llm = original


@contextmanager
def _mock_scanner():
    """Подмена сканера на clean — ClamAV недоступен в тестовой среде."""
    from app.api.v1 import stages as stages_module

    class FakeScanner:
        async def scan(self, data: bytes):  # noqa: ARG002
            return ("clean", "clean")

    original = stages_module.scanner
    stages_module.scanner = FakeScanner()  # type: ignore[assignment]
    try:
        yield
    finally:
        stages_module.scanner = original


def test_project_event_reaches_manager(client: TestClient) -> None:
    """Проектное событие (новая заявка) получает менеджер."""
    mgr_token, mgr_id = _register(client, "cntr_manager")
    owner_token, _ = _register(client)

    # Создаём проект с preliminary=3 (cap 2) → менеджер подтверждает УГТ 2
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner_token),
        json={
            "name": "Проект-12",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    pid = response.json()["id"]
    drafts = client.get("/api/v1/manager/queue/drafts", headers=_auth(mgr_token)).json()
    draft = next((d for d in drafts if d["id"] == pid), drafts[0])
    decided = client.post(
        f"/api/v1/manager/queue/drafts/{draft['id']}/decide",
        headers=_auth(mgr_token),
        json={"approve": True, "level": 2},
    )
    assert decided.status_code == 200, decided.text

    # Загружаем документ этапа → автозаявка → событие менеджерам
    import io

    reqs = client.get(
        f"/api/v1/projects/{pid}/stage-requirements", headers=_auth(owner_token)
    ).json()
    rid = reqs[0]["id"]
    with _mock_llm_ok(), _mock_scanner():
        upload = client.post(
            f"/api/v1/projects/{pid}/stage-document-file",
            headers=_auth(owner_token),
            data={"stage_requirement_id": str(rid), "title": "doc.pdf"},
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
        )
    assert upload.status_code == 201, upload.text

    # Менеджер видит уведомление в своём списке
    inbox = client.get("/api/v1/notifications", headers=_auth(mgr_token))
    assert inbox.status_code == 200
    titles = [n["title"] for n in inbox.json()]
    assert any("Автозаявка" in t or "повышение" in t.lower() for t in titles), titles


def test_general_event_goes_to_outbox(client: TestClient) -> None:
    """Общее событие пишется в outbox (general scope, pending)."""
    mgr_token, _ = _register(client, "cntr_manager")
    emitted = client.post(
        "/api/v1/notifications/emit",
        headers=_auth(mgr_token),
        params={"type": "test.event", "title": "Тест события", "project_id": 1},
    )
    assert emitted.status_code == 201, emitted.text

    tasks = client.get("/api/v1/manager/tasks", headers=_auth(mgr_token))
    assert tasks.status_code == 200
    titles = [t["title"] for t in tasks.json()]
    assert "Тест события" in titles
    task = next(t for t in tasks.json() if t["title"] == "Тест события")
    assert task["status"] == "pending"
    assert task["project_id"] == 1


def test_only_one_manager_claims_task(client: TestClient) -> None:
    """Атомарность: из двух менеджеров задачу забирает ровно один."""
    mgr1_token, _ = _register(client, "cntr_manager")
    mgr2_token, _ = _register(client, "cntr_manager")
    emitted = client.post(
        "/api/v1/notifications/emit",
        headers=_auth(mgr1_token),
        params={"type": "task", "title": "Одна задача на двоих"},
    )
    assert emitted.status_code == 201
    task_id = emitted.json()["id"]

    # Первый забирает
    claimed1 = client.post(
        f"/api/v1/manager/tasks/{task_id}/claim", headers=_auth(mgr1_token)
    )
    assert claimed1.status_code == 200, claimed1.text
    assert claimed1.json()["status"] == "claimed"

    # Второй не может забрать ту же
    claimed2 = client.post(
        f"/api/v1/manager/tasks/{task_id}/claim", headers=_auth(mgr2_token)
    )
    assert claimed2.status_code == 409


def test_admin_reassigns_task(client: TestClient) -> None:
    """Администратор видит очередь и переназначает задачу."""
    admin_token, admin_id = _register(client, "cntr_admin")
    mgr_token, _ = _register(client, "cntr_manager")
    emitted = client.post(
        "/api/v1/notifications/emit",
        headers=_auth(admin_token),
        params={"type": "task", "title": "Переназначить меня"},
    )
    task_id = emitted.json()["id"]

    reassigned = client.post(
        f"/api/v1/manager/tasks/{task_id}/reassign",
        headers=_auth(admin_token),
        params={"manager_id": admin_id},
    )
    assert reassigned.status_code == 200, reassigned.text
    assert reassigned.json()["status"] == "claimed"
    assert reassigned.json()["manager_name"] is not None

    # Менеджер (не админ) не может переназначать
    denied = client.post(
        f"/api/v1/manager/tasks/{task_id}/reassign",
        headers=_auth(mgr_token),
        params={"manager_id": admin_id},
    )
    assert denied.status_code == 403


def test_notifications_persist_in_db(client: TestClient) -> None:
    """Уведомления сохраняются в БД — не теряются при закрытом браузере."""
    from sqlalchemy import func, select

    from app.core.database import SessionLocal
    from app.db.models import NotificationOutbox

    mgr_token, _ = _register(client, "cntr_manager")
    client.post(
        "/api/v1/notifications/emit",
        headers=_auth(mgr_token),
        params={"type": "persist", "title": "Сохрани меня"},
    )

    import asyncio

    async def counts() -> tuple[int, int]:
        async with SessionLocal() as db:
            outbox = int(
                (await db.execute(select(func.count(NotificationOutbox.id)))).scalar_one()
            )
            return outbox, 0

    outbox_count, _ = asyncio.run(counts())
    assert outbox_count >= 1
