"""Тикет 22 Friday RC: black-box E2E — один проект последовательно УГТ 1→9.

Проводит один проект через полный путь: опросник 1–9 (preliminary 9, cap УГТ 2)
→ менеджерское подтверждение → заявки N→N+1 (загрузка clean-документов,
автотриггер, approve менеджера) вплоть до УГТ 9. Включает reject/fix/resubmit
на промежуточном уровне и проверку, что выше УГТ 9 заявок нет.

LLM и ClamAV в тестах стабируются (ask_llm → SUCCESS, сканер → clean) —
тест проверяет продуктовый контур, а не внешние сервисы.
"""

from __future__ import annotations

import io
import uuid
from contextlib import contextmanager

from fastapi.testclient import TestClient
from httpx import Response

from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n% sample\n%%EOF\n"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(client, email=_email("e2e"), full_name="E2E", role_slug=role)
    return data["access_token"], data["user"]["id"]


async def _fake_ok_llm(system: str, user_msg: str) -> str:  # noqa: ARG001
    return "SUCCESS\nSUMMARY: Комплект достаточен\n"


@contextmanager
def _mock_llm_ok():
    from app.api.v1 import stages as stages_module

    original = stages_module.ask_llm
    stages_module.ask_llm = _fake_ok_llm  # type: ignore[assignment]
    try:
        yield
    finally:
        stages_module.ask_llm = original


@contextmanager
def _mock_scanner():
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


def _upload(
    client: TestClient,
    token: str,
    project_id: int,
    requirement_id: int,
    title: str,
    data: bytes = PDF_BYTES,
) -> Response:
    return client.post(
        f"/api/v1/projects/{project_id}/stage-document-file",
        headers=_auth(token),
        data={"stage_requirement_id": str(requirement_id), "title": title},
        files={"file": (title, io.BytesIO(data), "application/pdf")},
    )


def _promote_to(
    client: TestClient,
    gk: str,
    mgr: str,
    project_id: int,
    target: int,
    *,
    reject_once: bool = False,
) -> None:
    """Проводит проект с текущего уровня до target через заявки N→N+1."""
    for level in range(2, target):  # текущий уровень = level, апрув до level+1
        reqs = client.get(
            f"/api/v1/projects/{project_id}/stage-requirements", headers=_auth(gk)
        ).json()
        stage = next(r for r in reqs if r["from_level"] == level)
        rid = stage["id"]

        up = _upload(client, gk, project_id, rid, f"Комплект-{level}.pdf")
        assert up.status_code == 201, up.text
        body = up.json()
        assert body["request_id"] is not None
        assert body["request_status"] == "pending_manager", body

        request_id = body["request_id"]

        if reject_once and level == 3:
            # reject/fix/resubmit: отклоняем, загружаем изменённый комплект,
            # повторная заявка (guard дублей 409 обходится новым контентом)
            rejected = client.post(
                f"/api/v1/manager/queue/promotions/{request_id}/decide",
                headers=_auth(mgr),
                json={"approve": False, "reason": "Документы неполные"},
            )
            assert rejected.status_code == 200, rejected.text
            assert rejected.json()["status"] == "rejected"

            up2 = _upload(
                client, gk, project_id, rid, f"Комплект-{level}-v2.pdf", PDF_BYTES + b"v2"
            )
            assert up2.status_code == 201, up2.text
            assert up2.json()["request_id"] is not None
            assert up2.json()["request_status"] == "pending_manager", up2.text
            request_id = up2.json()["request_id"]
            reject_once = False

        decided = client.post(
            f"/api/v1/manager/queue/promotions/{request_id}/decide",
            headers=_auth(mgr),
            json={"approve": True},
        )
        assert decided.status_code == 200, decided.text

        card = client.get(f"/api/v1/projects/{project_id}", headers=_auth(gk)).json()
        current = card["project"]["current_level"]
        assert current == level + 1, f"ожидали УГТ {level + 1}, получили {current}"


def test_full_ugt_journey_1_to_9(client: TestClient) -> None:
    """Один проект последовательно УГТ 1→9 (тикет 22, black-box E2E)."""
    with _mock_llm_ok(), _mock_scanner():
        gk_token, _ = _register(client)
        mgr_token, _ = _register(client, "cntr_manager")

        # 1. Опросник 1–9 → preliminary 9, официальный cap УГТ 2, draft
        created = client.post(
            "/api/v1/assessments",
            headers=_auth(gk_token),
            json={
                "name": "E2E путь 1→9",
                "questionnaire_results": [
                    {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                    for i in range(1, 10)
                ],
            },
        )
        assert created.status_code == 201, created.text
        pid = created.json()["id"]
        assert created.json()["preliminary_level"] == 9
        assert created.json()["current_level"] == 2  # cap
        assert created.json()["status"] == "draft"

        # 2. Менеджер подтверждает первичный уровень
        decided = client.post(
            f"/api/v1/manager/queue/drafts/{pid}/decide",
            headers=_auth(mgr_token),
            json={"approve": True, "level": 2},
        )
        assert decided.status_code == 200, decided.text
        assert decided.json()["status"] == "published"

        # 3. Повышения 2→3 … 8→9 (с reject/fix/resubmit на уровне 3)
        _promote_to(client, gk_token, mgr_token, pid, 9, reject_once=True)

        # 4. Финальный уровень 9; выше 9 заявок быть не должно
        card = client.get(f"/api/v1/projects/{pid}", headers=_auth(gk_token)).json()
        assert card["project"]["current_level"] == 9
        assert card["project"]["status"] in ("published", "completed")

        reqs = client.get(
            f"/api/v1/projects/{pid}/stage-requirements", headers=_auth(gk_token)
        )
        # на УГТ 9 требований нет — этап завершён (409)
        assert reqs.status_code == 409, reqs.text

        # 5. Экспорт доступен владельцу
        exported = client.get(f"/api/v1/projects/{pid}/export", headers=_auth(gk_token))
        assert exported.status_code == 200, exported.text
        exported_data = exported.json()
        assert isinstance(exported_data, dict), (
            f"экспорт должен быть JSON-объектом: {type(exported_data)}"
        )
        assert exported_data["project"]["current_level"] == 9
