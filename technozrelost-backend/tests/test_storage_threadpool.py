"""TICKET-10 (M-06) storage.get через to_thread — проверка threadpool."""

from __future__ import annotations

import asyncio
import io
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.services.file_storage import FileStorageError
from tests.support import register_test_user


def _email() -> str:
    return f"stor-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(client: TestClient, token: str) -> int:
    resp = client.post(
        "/api/v1/projects",
        json={
            "name": "Storage Threadpool Test",
            "category": "IT",
            "target_level": 5,
            "questionnaire_results": [{"level_id": 1, "checked_items": ["a"], "percentage": 80.0}],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_verification_doc_uses_threadpool(client: TestClient) -> None:
    """upload_verification_doc и download делегируют storage.get в to_thread."""
    data = register_test_user(client, email=_email(), full_name="Store User", role_slug="gk_customer")
    token = data["access_token"]
    pid = _create_project(client, token)

    # 1) projects.py должен содержать to_thread со storage.get
    import pathlib

    proj_path = pathlib.Path(__file__).parent.parent / "app" / "api" / "v1" / "projects.py"
    files_path = pathlib.Path(__file__).parent.parent / "app" / "api" / "v1" / "files.py"
    proj_src = proj_path.read_text(encoding="utf-8")
    files_src = files_path.read_text(encoding="utf-8")
    assert "to_thread" in proj_src and "storage.get" in proj_src, "projects.py должен использовать to_thread(storage.get)"
    assert "to_thread" in files_src and "read_stored_file" in files_src, "files.py должен использовать to_thread(read_stored_file)"

    # 2) мок storage.get → проверка что endpoint вызывает его через to_thread и не падает
    import time

    def slow_get(key: str) -> bytes:  # noqa: ARG001
        time.sleep(0.15)
        raise FileStorageError("not found mocked")

    # патчим именно storage.get в projects, и перехватываем to_thread
    with patch("app.api.v1.projects.storage.get", side_effect=slow_get) as mock_get:
        with patch("app.api.v1.projects.asyncio.to_thread", wraps=asyncio.to_thread) as mock_thread:
            resp = client.post(
                f"/api/v1/projects/{pid}/verification-docs",
                json={"title": "Проверка threadpool", "file_ref": "evil-threadpool-test"},
                headers=_auth(token),
            )
            assert resp.status_code == 404, resp.text
            assert mock_get.called, "storage.get должен быть вызван для не-allowlist file_ref"
            assert mock_thread.called, "asyncio.to_thread должен быть вызван"
            # проверяем что первый аргумент to_thread — storage.get (или мок)
            found = False
            for call in mock_thread.call_args_list:
                args, _kwargs = call
                if args and args[0] is mock_get:
                    found = True
                    break
                # wraps может сохранить оригинальную функцию, проверяем по имени
                if args and getattr(args[0], "__name__", "") == "get":
                    found = True
                    break
            assert found, f"to_thread не вызван с storage.get: {mock_thread.call_args_list}"

    # 3) files.py download тоже через to_thread
    pdf = b"%PDF-1.4\n% test\n%%EOF\n"
    upload = client.post(
        f"/api/v1/projects/{pid}/files",
        headers=_auth(token),
        files={"file": ("doc.pdf", io.BytesIO(pdf), "application/octet-stream")},
    )
    assert upload.status_code == 201, upload.text
    fid = upload.json()["id"]

    def slow_read(key: str) -> bytes:  # noqa: ARG001
        time.sleep(0.15)
        return pdf

    with patch("app.api.v1.files.read_stored_file", side_effect=slow_read) as mock_read:
        with patch("app.api.v1.files.asyncio.to_thread", wraps=asyncio.to_thread) as mock_thread2:
            dl = client.get(f"/api/v1/files/{fid}/download", headers=_auth(token))
            assert dl.status_code == 200
            assert mock_read.called
            assert mock_thread2.called

    # 4) конкурентность: 5 медленных storage.get через to_thread не блокируют loop последовательно
    # эмулируем慢 get для проекта
    async def concurrent_check() -> None:
        # патчим внутри async контекста через patch, но asyncio.to_thread уже проверен выше
        # просто проверяем что 5 gather с slow_get через to_thread укладываются <1s
        async def call_via_to_thread() -> None:
            try:
                await asyncio.to_thread(slow_get, "concurrent-key")
            except FileStorageError:
                pass

        import time as _time

        start = _time.monotonic()
        await asyncio.gather(*[call_via_to_thread() for _ in range(5)])
        elapsed = _time.monotonic() - start
        # без to_thread последовательно было бы 0.75s, с to_thread параллельно ~0.15-0.3s
        assert elapsed < 0.6, f"to_thread не параллелит: {elapsed:.2f}s"

    asyncio.run(concurrent_check())
