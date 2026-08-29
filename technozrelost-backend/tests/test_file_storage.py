"""Тикет 06 Friday RC: безопасное файловое хранилище.

Покрытие: допустимые форматы (PDF/DOCX/XLSX/PNG/JPEG) до 25 МБ; фактический
MIME по сигнатуре (не Content-Type); внутренние имена не раскрывают
пользовательские; версии документов; статус скана; RBAC/IDOR (скачивание и
список только участникам); файл не получает публичный URL.
"""

from __future__ import annotations

import io
import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n% sample pdf\n%%EOF\n"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
EXE_BYTES = b"MZ\x90\x00" + b"\x00" * 64


def _make_docx_bytes() -> bytes:
    """Минимальный валидный OOXML docx: ZIP с [Content_Types].xml + word/document.xml (N-11)."""
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>',
        )
        zf.writestr("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
    return buf.getvalue()


def _make_fake_zip_without_content_types() -> bytes:
    """ZIP без [Content_Types].xml — должен быть отклонён как невалидный OOXML (N-11)."""
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", "<fake/>")
    return buf.getvalue()


DOCX_BYTES = _make_docx_bytes()
FAKE_ZIP_BYTES = _make_fake_zip_without_content_types()


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(client, email=_email("file"), full_name="Файловый", role_slug=role)
    return data["access_token"], data["user"]["id"]


def _create_project(client: TestClient, token: str) -> int:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={
            "name": "Проект-файлы",
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["Идея"], "percentage": 100.0}
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _upload(client: TestClient, token: str, project_id: int, data: bytes, name: str):
    return client.post(
        f"/api/v1/projects/{project_id}/files",
        headers=_auth(token),
        files={"file": (name, io.BytesIO(data), "application/octet-stream")},
    )


# ── Форматы и лимиты ─────────────────────────────────────────────────────────


def test_upload_allowed_formats(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)

    for data, name, expected_mime in [
        (PDF_BYTES, "doc.pdf", "application/pdf"),
        (PNG_BYTES, "image.png", "image/png"),
        (
            DOCX_BYTES,
            "doc.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
    ]:
        response = _upload(client, token, project_id, data, name)
        assert response.status_code == 201, (name, response.text)
        body = response.json()
        assert body["mime_type"] == expected_mime, name
        assert body["scan_status"] == "clean"
        assert body["sha256"] is not None
        # внутреннее имя не раскрывает пользовательское
        assert body["file_name"] == name


def test_upload_rejects_wrong_mime_signature(client: TestClient) -> None:
    """Content-Type говорит image/png, сигнатура — исполняемый файл."""
    token, _ = _register(client)
    project_id = _create_project(client, token)

    response = client.post(
        f"/api/v1/projects/{project_id}/files",
        headers=_auth(token),
        files={"file": ("fake.png", io.BytesIO(EXE_BYTES), "image/png")},
    )
    assert response.status_code == 422


def test_upload_rejects_oversize(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)

    big = b"%PDF-1.4\n" + b"x" * (26 * 1024 * 1024)
    response = _upload(client, token, project_id, big, "big.pdf")
    # Таск 04: чтение обрывается на лимите — 413 (было: полный read → 422)
    assert response.status_code == 413


# ── Версионирование ──────────────────────────────────────────────────────────


def test_upload_versions_same_title(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)

    first = _upload(client, token, project_id, PDF_BYTES, "doc.pdf")
    assert first.json()["version"] == 1

    second = _upload(client, token, project_id, PDF_BYTES + b"\n% v2", "doc.pdf")
    assert second.status_code == 201
    assert second.json()["version"] == 2
    assert second.json()["sha256"] != first.json()["sha256"]

    listing = client.get(
        f"/api/v1/projects/{project_id}/files", headers=_auth(token)
    )
    assert listing.status_code == 200
    versions = [d["version"] for d in listing.json()]
    assert sorted(versions) == [1, 2]


# ── Скачивание и права ───────────────────────────────────────────────────────


def test_download_returns_content(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload(client, token, project_id, PDF_BYTES, "doc.pdf").json()["id"]

    download = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert download.status_code == 200
    assert download.content == PDF_BYTES
    assert "application/pdf" in download.headers["content-type"]


def test_download_and_list_restricted_to_participants(client: TestClient) -> None:
    owner_token, _ = _register(client)
    outsider_token, _ = _register(client, "investor")
    project_id = _create_project(client, owner_token)
    file_id = _upload(client, owner_token, project_id, PDF_BYTES, "doc.pdf").json()["id"]

    hidden_list = client.get(
        f"/api/v1/projects/{project_id}/files", headers=_auth(outsider_token)
    )
    assert hidden_list.status_code == 404  # проект не существует для постороннего

    hidden_download = client.get(
        f"/api/v1/files/{file_id}/download", headers=_auth(outsider_token)
    )
    assert hidden_download.status_code == 404


def test_upload_requires_auth_and_membership(client: TestClient) -> None:
    anonymous = client.post(
        "/api/v1/projects/1/files",
        files={"file": ("doc.pdf", io.BytesIO(PDF_BYTES), "application/pdf")},
    )
    assert anonymous.status_code == 401

    token, _ = _register(client)
    project_id = _create_project(client, token)
    outsider_token, _ = _register(client, "rd_executor")
    denied = _upload(client, outsider_token, project_id, PDF_BYTES, "doc.pdf")
    assert denied.status_code == 404


def test_no_public_minio_url_in_metadata(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    body = _upload(client, token, project_id, PDF_BYTES, "doc.pdf").json()

    assert "storage_key" not in body
    assert "http" not in body["mime_type"]
    # в карточке проекта нет публичного URL файла
    card = client.get(f"/api/v1/projects/{project_id}", headers=_auth(token))
    assert card.status_code == 200
    assert "minio" not in card.text


def test_upload_rejects_zip_without_content_types(client: TestClient) -> None:
    """N-11: ZIP без [Content_Types].xml отклоняется как невалидный OOXML."""
    token, _ = _register(client)
    project_id = _create_project(client, token)
    response = _upload(client, token, project_id, FAKE_ZIP_BYTES, "fake.docx")
    assert response.status_code == 422
