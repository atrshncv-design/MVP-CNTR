"""Тикет 07 Friday RC: универсальные комплекты и автозаявка.

Покрытие: файловая загрузка документов этапа (clean → автозаявка, infected →
без заявки); триггер не зависит от автора последнего документа; заявка хранит
неизменяемый снимок версий документов; неизменённый отклонённый комплект не
создаёт дубликат (US 56); версия справочника template_version.
"""

from __future__ import annotations

import io
import uuid

import psycopg
from fastapi.testclient import TestClient

from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n% sample\n%%EOF\n"

DB_DSN = "host=127.0.0.1 port=5432 user=technoz password=change_me dbname=technozrelost_test"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(client, email=_email("bundle"), full_name="Комплект", role_slug=role)
    return data["access_token"], data["user"]["id"]


def _published_project(client: TestClient, owner_token: str, mgr_token: str) -> tuple[int, str]:
    """Проект preliminary 3 → подтверждён менеджером на УГТ 2 → published."""
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(owner_token),
        json={
            "name": "Проект-комплект",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    created = response.json()
    project_id = created["id"]
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


def _upload_file(
    client: TestClient,
    token: str,
    project_id: int,
    requirement_id: int,
    data: bytes = PDF_BYTES,
    name: str = "doc.pdf",
) -> object:
    return client.post(
        f"/api/v1/projects/{project_id}/stage-document-file",
        headers=_auth(token),
        data={"stage_requirement_id": str(requirement_id), "title": name},
        files={"file": (name, io.BytesIO(data), "application/pdf")},
    )


async def _fake_ok_llm(system: str, user_msg: str) -> str:  # noqa: ARG001
    return "SUCCESS\nSUMMARY: Комплект достаточен\n"


def _mock_llm_ok():
    """Подмена ask_llm на успешный ответ (LLM недоступна в тестах)."""
    from app.api.v1 import stages as stages_module

    original = stages_module.ask_llm
    stages_module.ask_llm = _fake_ok_llm  # type: ignore[assignment]
    try:
        yield
    finally:
        stages_module.ask_llm = original
_mock_llm_ok = __import__("contextlib").contextmanager(_mock_llm_ok)


def _mock_scanner(client_fixture: TestClient, result: tuple[str, str]):
    """Подмена сканера в модуле stages на время теста."""
    from app.api.v1 import stages as stages_module

    class FakeScanner:
        def __init__(self) -> None:
            self.calls = 0

        async def scan(self, data: bytes) -> tuple[str, str]:  # noqa: ARG002
            self.calls += 1
            return result

    fake = FakeScanner()
    original = stages_module.scanner
    stages_module.scanner = fake  # type: ignore[assignment]
    try:
        yield fake
    finally:
        stages_module.scanner = original
_mock_scanner = __import__("contextlib").contextmanager(_mock_scanner)


# ── Файловая загрузка и автозаявка ───────────────────────────────────────────


def test_clean_file_triggers_application(client: TestClient) -> None:
    with _mock_llm_ok():
        _clean_flow(client)


def _clean_flow(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, join_token = _published_project(client, owner_token, mgr_token)
    reqs = _requirements(client, owner_token, project_id)
    assert len(reqs) >= 1

    up = _upload_file(client, owner_token, project_id, reqs[0]["id"])
    assert up.status_code == 201, up.text
    body = up.json()
    assert body["request_id"] is not None
    assert body["request_status"] == "pending_manager"


def test_infected_file_not_counted_no_application(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, join_token = _published_project(client, owner_token, mgr_token)
    reqs = _requirements(client, owner_token, project_id)

    with _mock_scanner(client, ("infected", "stream: EICAR FOUND")) as fake:
        up = _upload_file(client, owner_token, project_id, reqs[0]["id"], name="evil.pdf")
        assert up.status_code == 201, up.text
        body = up.json()
        assert body["scan_status"] == "infected"
        assert body["request_id"] is None
        assert fake.calls == 1

    # в комплект документ не засчитан
    reqs2 = _requirements(client, owner_token, project_id)
    assert all(r["uploaded"] is False for r in reqs2)


# ── Снимок версий и защита от дубликатов ─────────────────────────────────────


def test_request_snapshot_stores_document_versions(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, join_token = _published_project(client, owner_token, mgr_token)
    reqs = _requirements(client, owner_token, project_id)

    up = _upload_file(client, owner_token, project_id, reqs[0]["id"], name="doc.pdf")
    request_id = up.json()["request_id"]

    conn = psycopg.connect(DB_DSN, autocommit=True)
    try:
        rows = conn.execute(
            "SELECT document_version FROM public.promotion_request_documents "
            "WHERE promotion_request_id = %s",
            (request_id,),
        ).fetchall()
    finally:
        conn.close()
    assert rows, "снимок версий не создан"
    assert [r[0] for r in rows] == [1]


def test_rejected_unchanged_bundle_no_duplicate(client: TestClient) -> None:
    with _mock_llm_ok():
        _reject_flow(client)


def _reject_flow(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, join_token = _published_project(client, owner_token, mgr_token)
    reqs = _requirements(client, owner_token, project_id)

    up = _upload_file(client, owner_token, project_id, reqs[0]["id"], name="doc.pdf")
    request_id = up.json()["request_id"]

    reject = client.post(
        f"/api/v1/manager/queue/promotions/{request_id}/decide",
        headers=_auth(mgr_token),
        json={"approve": False, "reason": "Недостаточно доказательств"},
    )
    assert reject.status_code == 200, reject.text

    # тот же комплект → 409
    retry = _upload_file(client, owner_token, project_id, reqs[0]["id"], name="doc.pdf")
    assert retry.status_code == 409, retry.text

    # изменённый комплект → новая заявка
    changed = _upload_file(
        client, owner_token, project_id, reqs[0]["id"],
        data=PDF_BYTES + b"\n% changed", name="doc.pdf",
    )
    assert changed.status_code == 201, changed.text
    assert changed.json()["request_id"] != request_id


def test_trigger_independent_of_document_author(client: TestClient) -> None:
    """Последний обязательный документ загружает участник — заявка создаётся."""
    with _mock_llm_ok():
        _author_flow(client)


def _author_flow(client: TestClient) -> None:
    owner_token, owner_id = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, join_token = _published_project(client, owner_token, mgr_token)

    member_token, _ = _register(client)
    joined = client.post(
        "/api/v1/projects/join",
        headers=_auth(member_token),
        json={"token": join_token, "role_in_project": "participant"},
    )
    assert joined.status_code == 200, joined.text
    assert joined.json()["status"] == "pending"
    # владелец одобряет вступление → участник активен
    requests = client.get(
        f"/api/v1/projects/{project_id}/join-requests", headers=_auth(owner_token)
    )
    assert requests.status_code == 200, requests.text
    member_id = requests.json()[0]["id"]
    approved = client.post(
        f"/api/v1/projects/{project_id}/join-requests/{member_id}/decide",
        headers=_auth(owner_token),
        json={"approve": True},
    )
    assert approved.status_code == 200, approved.text

    reqs = _requirements(client, owner_token, project_id)
    up = _upload_file(client, member_token, project_id, reqs[0]["id"], name="doc.pdf")
    assert up.status_code == 201, up.text
    assert up.json()["request_id"] is not None
    assert owner_id is not None


# ── Версия справочника ───────────────────────────────────────────────────────


def test_template_version_present(client: TestClient) -> None:
    owner_token, _ = _register(client)
    mgr_token, _ = _register(client, "cntr_manager")
    project_id, join_token = _published_project(client, owner_token, mgr_token)
    reqs = _requirements(client, owner_token, project_id)
    assert all(r["template_version"] == "v1" for r in reqs)
