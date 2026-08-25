"""Fail-closed антивирус: скачивание разрешено только clean-файлам (R05.3)."""

from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.db.models import ProjectDocument
from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n% fail-closed probe\n"


def _email() -> str:
    return f"fc-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _upload_doc(client: TestClient, token: str) -> int:
    created = client.post(
        "/api/v1/projects",
        json={"name": "FC", "description": "", "category": "IT", "target_level": 5,
              "questionnaire_results": []},
        headers=_auth(token),
    )
    project_id = created.json()["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/files",
        files={"file": ("probe.pdf", PDF_BYTES, "application/pdf")},
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _set_scan_status(file_id: int, status_value: str) -> None:
    async def _set() -> None:
        async with SessionLocal() as db:
            doc = await db.get(ProjectDocument, file_id)
            assert doc is not None
            doc.scan_status = status_value
            await db.commit()

    asyncio.run(_set())


def test_download_blocked_when_scan_error(client: TestClient) -> None:
    data = register_test_user(client, email=_email(), full_name="FC", role_slug="gk_customer")
    file_id = _upload_doc(client, data["access_token"])
    _set_scan_status(file_id, "error")

    response = client.get(
        f"/api/v1/files/{file_id}/download", headers=_auth(data["access_token"])
    )
    assert response.status_code == 409


def test_download_allowed_for_clean(client: TestClient) -> None:
    data = register_test_user(client, email=_email(), full_name="FC", role_slug="gk_customer")
    file_id = _upload_doc(client, data["access_token"])

    response = client.get(
        f"/api/v1/files/{file_id}/download", headers=_auth(data["access_token"])
    )
    assert response.status_code == 200
