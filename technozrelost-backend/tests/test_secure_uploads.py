"""Тикет 02 security-infrastructure: карантин, signed access, независимая проверка типа.

Покрытие:
- malicious fixtures: wrong extension↔mime, oversize, executable/archive/macro → 422;
- карантин-гейт: pending/error/infected → download 409, clean → 200;
- signed-url: выдача только для clean, скачивание по подписи, истёкшая/невалидная
  подпись → 410/403, IDOR чужого файла → 404/403, токен для другого файла → 403;
- rescan обновляет гейт (в т.ч. → infected), versioning сохраняется.
"""

from __future__ import annotations

import io
import os
import time
import uuid
import zipfile

import psycopg
from fastapi.testclient import TestClient

from app.services.file_storage import SCAN_STATUSES
from app.services.signed_url import create_signed_token
from tests.support import register_test_user

PDF_BYTES = b"%PDF-1.4\n% sample pdf\n%%EOF\n"
EXE_BYTES = b"MZ\x90\x00" + b"\x00" * 64
DOCX_BYTES = b"PK\x03\x04" + b"\x00" * 64


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> tuple[str, int]:
    data = register_test_user(client, email=_email("sec"), full_name="Безопасный", role_slug=role)
    return data["access_token"], data["user"]["id"]


def _create_project(client: TestClient, token: str) -> int:
    response = client.post(
        "/api/v1/assessments",
        headers=_auth(token),
        json={
            "name": "Проект-сек",
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


def _db() -> psycopg.Connection:
    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )


def _set_scan_status(file_id: int, scan_status: str) -> None:
    """Прямое изменение вердикта скана (симуляция ClamAV/очереди в тесте)."""
    with _db() as conn:
        conn.execute(
            "UPDATE public.project_documents SET scan_status = %s WHERE id = %s",
            (scan_status, file_id),
        )


def _zip_bytes(*names: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in names:
            archive.writestr(name, b"fixture-content")
    return buffer.getvalue()


ZIP_ARCHIVE = _zip_bytes("readme.txt")
DOCX_LIKE = _zip_bytes("[Content_Types].xml", "word/document.xml")
MACRO_DOCX = _zip_bytes("[Content_Types].xml", "word/document.xml", "word/vbaProject.bin")


# ── Набор значений scan_status ───────────────────────────────────────────────


def test_scan_status_value_set() -> None:
    """Единый набор значений карантина: pending/clean/infected/error."""
    assert {"pending", "clean", "infected", "error"} == SCAN_STATUSES


# ── Malicious fixtures: независимая проверка типа ────────────────────────────


def test_upload_rejects_forbidden_extension(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)

    for name in ("evil.exe", "evil.dll", "evil.so", "arch.zip", "arch.rar", "macro.docm"):
        response = _upload(client, token, project_id, PDF_BYTES, name)
        assert response.status_code == 422, (name, response.text)


def test_upload_rejects_extension_mime_mismatch(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)

    # PDF-сигнатура под расширением PNG
    assert _upload(client, token, project_id, PDF_BYTES, "image.png").status_code == 422
    # DOCX-сигнатура под расширением PDF
    assert _upload(client, token, project_id, DOCX_BYTES, "doc.pdf").status_code == 422


def test_upload_rejects_executable_signature(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)

    # MZ-сигнатура (exe) под безобидным именем и Content-Type
    response = client.post(
        f"/api/v1/projects/{project_id}/files",
        headers=_auth(token),
        files={"file": ("doc.pdf", io.BytesIO(EXE_BYTES), "application/pdf")},
    )
    assert response.status_code == 422


def test_upload_rejects_oversize(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)

    big = b"%PDF-1.4\n" + b"x" * (26 * 1024 * 1024)
    response = _upload(client, token, project_id, big, "big.pdf")
    assert response.status_code == 422


def test_upload_rejects_zip_archive(client: TestClient) -> None:
    """Валидный ZIP-архив отклоняется: и по расширению, и по содержимому."""
    token, _ = _register(client)
    project_id = _create_project(client, token)

    # .zip — запрещённое расширение
    assert _upload(client, token, project_id, ZIP_ARCHIVE, "arch.zip").status_code == 422
    # валидный ZIP под именем .docx — не OOXML-контейнер ([Content_Types].xml отсутствует)
    response = _upload(client, token, project_id, ZIP_ARCHIVE, "doc.docx")
    assert response.status_code == 422
    assert "архив" in response.text.lower()


def test_upload_rejects_macro_content(client: TestClient) -> None:
    """OOXML с vbaProject.bin — macro-enabled (docm/xlsm/pptm) → 422."""
    token, _ = _register(client)
    project_id = _create_project(client, token)

    response = _upload(client, token, project_id, MACRO_DOCX, "doc.docx")
    assert response.status_code == 422
    assert "макро" in response.text.lower()


def test_upload_accepts_valid_ooxml(client: TestClient) -> None:
    """Настоящий OOXML-контейнер ([Content_Types].xml) принимается."""
    token, _ = _register(client)
    project_id = _create_project(client, token)

    response = _upload(client, token, project_id, DOCX_LIKE, "doc.docx")
    assert response.status_code == 201, response.text
    assert (
        response.json()["mime_type"]
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


# ── Карантин-гейт: download ──────────────────────────────────────────────────


def _upload_clean(client: TestClient, token: str, project_id: int) -> int:
    response = _upload(client, token, project_id, PDF_BYTES, "doc.pdf")
    assert response.status_code == 201, response.text
    assert response.json()["scan_status"] == "clean"
    return response.json()["id"]


def test_download_blocked_while_pending(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)
    _set_scan_status(file_id, "pending")

    response = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert response.status_code == 409
    assert "проверк" in response.text.lower()


def test_download_blocked_on_scan_error(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)
    _set_scan_status(file_id, "error")

    response = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert response.status_code == 409
    assert "проверк" in response.text.lower()


def test_download_blocked_infected(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)
    _set_scan_status(file_id, "infected")

    response = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert response.status_code == 409
    assert "заблокирован" in response.text.lower()


def test_download_clean_ok(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)

    response = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert response.status_code == 200
    assert response.content == PDF_BYTES


# ── Signed access ────────────────────────────────────────────────────────────


def test_signed_url_issued_and_downloadable(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)

    issued = client.get(f"/api/v1/files/{file_id}/signed-url", headers=_auth(token))
    assert issued.status_code == 200, issued.text
    body = issued.json()
    assert body["file_id"] == file_id
    assert "/download?token=" in body["url"]
    assert body["expires_at"]

    download = client.get(body["url"], headers=_auth(token))
    assert download.status_code == 200
    assert download.content == PDF_BYTES


def test_signed_url_not_issued_for_non_clean(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)
    _set_scan_status(file_id, "pending")

    response = client.get(f"/api/v1/files/{file_id}/signed-url", headers=_auth(token))
    assert response.status_code == 409


def test_signed_url_expired_token(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)

    expired = create_signed_token(file_id, now=int(time.time()) - 3600)
    response = client.get(
        f"/api/v1/files/{file_id}/download",
        headers=_auth(token),
        params={"token": expired.token},
    )
    assert response.status_code == 410


def test_signed_url_invalid_signature(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)

    valid = create_signed_token(file_id)
    tampered = valid.token[:-1] + ("0" if valid.token[-1] != "0" else "1")
    response = client.get(
        f"/api/v1/files/{file_id}/download",
        headers=_auth(token),
        params={"token": tampered},
    )
    assert response.status_code == 403


def test_signed_url_token_bound_to_file(client: TestClient) -> None:
    """Токен для файла A не работает для файла B (привязка к file_id)."""
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_a = _upload_clean(client, token, project_id)
    file_b = _upload(client, token, project_id, PDF_BYTES + b"\n% v2", "doc.pdf").json()["id"]

    token_a = create_signed_token(file_a)
    response = client.get(
        f"/api/v1/files/{file_b}/download",
        headers=_auth(token),
        params={"token": token_a.token},
    )
    assert response.status_code == 403


def test_signed_url_idor_outsider(client: TestClient) -> None:
    """Чужой пользователь: ни выдача ссылки, ни скачивание по чужой подписи."""
    owner_token, _ = _register(client)
    outsider_token, _ = _register(client, "investor")
    project_id = _create_project(client, owner_token)
    file_id = _upload_clean(client, owner_token, project_id)

    issued = client.get(f"/api/v1/files/{file_id}/signed-url", headers=_auth(outsider_token))
    assert issued.status_code == 404

    owner_signed = create_signed_token(file_id)
    download = client.get(
        f"/api/v1/files/{file_id}/download",
        headers=_auth(outsider_token),
        params={"token": owner_signed.token},
    )
    assert download.status_code == 404


# ── Rescan и versioning ──────────────────────────────────────────────────────


def test_rescan_clears_pending_gate(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)
    _set_scan_status(file_id, "pending")
    assert (
        client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token)).status_code
        == 409
    )

    rescan = client.post(f"/api/v1/files/{file_id}/rescan", headers=_auth(token))
    assert rescan.status_code == 200
    assert rescan.json()["scan_status"] == "clean"

    download = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert download.status_code == 200


def test_rescan_can_flag_infected(client: TestClient, monkeypatch) -> None:
    """Rescan с вердиктом ClamAV «infected» обновляет гейт → download 409."""
    async def fake_scan(data: bytes) -> tuple[str, str]:
        return ("infected", "Eicar-Test-Signature FOUND")

    token, _ = _register(client)
    project_id = _create_project(client, token)
    file_id = _upload_clean(client, token, project_id)

    # Подмена вердикта ClamAV — только после загрузки (upload уже прошёл clean)
    monkeypatch.setattr("app.services.file_storage.scanner.scan", fake_scan)

    rescan = client.post(f"/api/v1/files/{file_id}/rescan", headers=_auth(token))
    assert rescan.status_code == 200
    assert rescan.json()["scan_status"] == "infected"

    download = client.get(f"/api/v1/files/{file_id}/download", headers=_auth(token))
    assert download.status_code == 409
    assert "заблокирован" in download.text.lower()


def test_versioning_preserved_on_rescan(client: TestClient) -> None:
    token, _ = _register(client)
    project_id = _create_project(client, token)
    first = _upload(client, token, project_id, PDF_BYTES, "doc.pdf").json()
    assert first["version"] == 1

    _set_scan_status(first["id"], "pending")
    rescan = client.post(f"/api/v1/files/{first['id']}/rescan", headers=_auth(token))
    assert rescan.status_code == 200
    assert rescan.json()["scan_status"] == "clean"
    assert rescan.json()["version"] == 1

    second = _upload(client, token, project_id, PDF_BYTES + b"\n% v2", "doc.pdf").json()
    assert second["version"] == 2

    listing = client.get(f"/api/v1/projects/{project_id}/files", headers=_auth(token))
    assert listing.status_code == 200
    versions = sorted(d["version"] for d in listing.json())
    assert versions == [1, 2]
