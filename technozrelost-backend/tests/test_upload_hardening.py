"""Хардненинг загрузки файлов: обрыв чтения сверх лимита до записи в хранилище."""

from __future__ import annotations

import asyncio

import pytest

from app.services import file_storage


class _FakeUpload:
    """Заглушка UploadFile: отдаёт данные порциями, как Starlette."""

    def __init__(self, data: bytes, chunk_size: int = 1024 * 1024) -> None:
        self._data = data
        self._chunk_size = chunk_size

    async def read(self, size: int = -1) -> bytes:
        if size == -1 or size >= len(self._data):
            data, self._data = self._data, b""
            return data
        data, self._data = self._data[:size], self._data[size:]
        return data


def test_read_limited_stops_at_max_bytes() -> None:
    payload = b"x" * (file_storage.MAX_FILE_SIZE + 1)

    with pytest.raises(file_storage.FileSizeExceeded):
        asyncio.run(file_storage.read_upload_limited(_FakeUpload(payload)))


def test_read_limited_passes_file_under_limit() -> None:
    payload = b"%PDF-1.4 small"

    data = asyncio.run(
        file_storage.read_upload_limited(_FakeUpload(payload, chunk_size=4))
    )
    assert data == payload


def test_store_rejects_oversized_bytes() -> None:
    with pytest.raises(ValueError, match="лимит"):
        file_storage.store_project_file(1, "big.bin", b"0" * (file_storage.MAX_FILE_SIZE + 1))
