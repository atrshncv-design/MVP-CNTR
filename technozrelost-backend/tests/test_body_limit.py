"""Глобальный лимит тела запроса (R05.5/R16): oversize → 413 на любом пути."""

from __future__ import annotations

import io
import uuid
from collections.abc import Iterator

from fastapi.testclient import TestClient


def _email() -> str:
    return f"body-{uuid.uuid4().hex[:8]}@example.com"


def test_oversized_body_rejected_with_413(client: TestClient, monkeypatch) -> None:
    import app.main as main_mod

    monkeypatch.setattr(main_mod, "max_request_body_bytes", 128)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": _email(), "password": "x" * 512},
    )
    assert response.status_code == 413


def test_normal_body_passes_through(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": _email(), "password": "no-such-user"},
    )
    assert response.status_code == 401


def test_chunked_oversize_rejected_without_content_length(
    client: TestClient, monkeypatch
) -> None:
    """R16: запрос без Content-Length (chunked) не обходит лимит."""
    import app.main as main_mod

    monkeypatch.setattr(main_mod, "max_request_body_bytes", 128)

    def chunks() -> Iterator[bytes]:
        yield b'{"password": "'
        yield b"x" * 512
        yield b'"}'

    response = client.post(
        "/api/v1/auth/login",
        content=chunks(),  # type: ignore[arg-type]
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413


def _published_project(client: TestClient, owner_token: str, mgr_token: str) -> int:
    """Минимальный путь до published-проекта (как в test_requirement_sets)."""
    response = client.post(
        "/api/v1/assessments",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "Проект лимита загрузки",
            "questionnaire_results": [
                {"level_id": i, "checked_items": [f"Р{i}"], "percentage": 100.0}
                for i in (1, 2, 3)
            ],
        },
    )
    assert response.status_code == 201, response.text
    project_id = response.json()["id"]
    decide = client.post(
        f"/api/v1/manager/queue/drafts/{project_id}/decide",
        headers={"Authorization": f"Bearer {mgr_token}"},
        json={"approve": True, "level": 2},
    )
    assert decide.status_code == 200, decide.text
    return project_id


def test_stage_document_file_over_limit_returns_413(client: TestClient) -> None:
    """R16: stage-document-file использует общий лимитированный читатель."""
    from app.services import file_storage
    from tests.support import register_test_user

    owner = register_test_user(
        client,
        email=_email(),
        full_name="Владелец лимита",
        role_slug="gk_customer",
    )
    manager = register_test_user(
        client,
        email=_email(),
        full_name="Менеджер",
        role_slug="cntr_manager",
    )
    project_id = _published_project(
        client, owner["access_token"], manager["access_token"]
    )
    requirements = client.get(
        f"/api/v1/projects/{project_id}/stage-requirements",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
    ).json()
    assert requirements, "у опубликованного проекта есть требования этапа"

    oversized = b"x" * (file_storage.MAX_FILE_SIZE + 1)
    response = client.post(
        f"/api/v1/projects/{project_id}/stage-document-file",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
        data={"stage_requirement_id": str(requirements[0]["id"]), "title": "big.pdf"},
        files={"file": ("big.pdf", io.BytesIO(oversized), "application/pdf")},
    )
    assert response.status_code == 413
