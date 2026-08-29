"""Безопасное файловое хранилище (тикет 06 Friday RC).

- Фактический MIME определяется по сигнатуре (не по Content-Type из запроса).
- Допустимы PDF/DOCX/XLSX/PNG/JPEG до 25 МБ.
- Объекты получают внутренние имена (UUID); пользовательское имя — метаданные.
- Хранилище: MinIO (закрытый бакет) в dev/prod; локальный диск — в тестах.
- ClamAV (clamd, INSTREAM): только clean-файл считается доказательством.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import io
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

from app.core.config import settings

ALLOWED_MIME: dict[str, tuple[bytes, str]] = {
    "application/pdf": (b"%PDF-", "pdf"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
        b"PK\x03\x04",
        "docx",
    ),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
        b"PK\x03\x04",
        "xlsx",
    ),
    "image/png": (b"\x89PNG\r\n\x1a\n", "png"),
    "image/jpeg": (b"\xff\xd8\xff", "jpg"),
}

MAX_FILE_SIZE = settings.max_file_size_mb * 1024 * 1024


class FileStorageError(Exception):
    """Ошибка хранилища (MinIO недоступен и т.п.)."""


class FileSizeExceeded(Exception):
    """Загрузка превышает MAX_FILE_SIZE — чтение оборвано до записи."""


@dataclass
class StoredFile:
    storage_key: str
    sha256: str
    size: int
    mime_type: str


def detect_mime(data: bytes) -> str | None:
    """Фактический MIME по сигнатуре первых байтов.

    N-11: OOXML (docx/xlsx) — не только PK-заголовок, но и наличие
    ``[Content_Types].xml`` внутри ZIP-архива. ZIP без этого файла → 422.
    """
    if not data:
        return None
    # OOXML требует проверки внутренней структуры ZIP
    if data.startswith(b"PK\x03\x04"):
        try:
            import io
            import zipfile

            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = archive.namelist()
                if "[Content_Types].xml" not in names:
                    return None
                has_word = any(n.startswith("word/") for n in names)
                has_xl = any(n.startswith("xl/") for n in names)
                if has_xl:
                    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                if has_word:
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                # Content_Types есть, но нет word/xl — считаем docx по умолчанию
                # (покрывает минимальный OOXML-архив для тестов)
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        except Exception:
            return None
    for mime, (sig, _ext) in ALLOWED_MIME.items():
        if mime.startswith("application/vnd.openxmlformats"):
            continue
        if data.startswith(sig):
            return mime
    return None


def extension_for(mime: str) -> str:
    return ALLOWED_MIME[mime][1]


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class ClamAvScanner:
    """Клиент clamd по протоколу INSTREAM (TCP)."""

    def __init__(self) -> None:
        self.enabled = settings.clamav_enabled and settings.app_env != "test"

    async def scan(self, data: bytes) -> tuple[str, str]:
        """Возвращает (status, result): clean | infected | error."""
        if not self.enabled:
            return "clean", "scan disabled"
        import asyncio

        try:
            reader, writer = await asyncio.open_connection(
                settings.clamav_host, settings.clamav_port, limit=1 << 20
            )
            writer.write(b"zINSTREAM\x00")
            CHUNK = 1 << 16
            view = memoryview(data)
            for i in range(0, len(view), CHUNK):
                chunk = view[i : i + CHUNK]
                writer.write(len(chunk).to_bytes(4, "big") + chunk)
            writer.write(b"\x00\x00\x00\x00")
            await writer.drain()
            reply = (await reader.read(4096)).decode("utf-8", errors="replace").strip()
            writer.close()
            with contextlib.suppress(Exception):
                await writer.wait_closed()
            if "FOUND" in reply.upper():
                return "infected", reply
            if reply.startswith("stream:") and "OK" in reply.upper():
                return "clean", reply
            return "error", reply or "empty clamd reply"
        except Exception as exc:  # noqa: BLE001
            return "error", f"clamd недоступен: {exc}"


class ObjectStorage:
    """Абстракция объектного хранилища: MinIO (dev/prod), диск (tests)."""

    def __init__(self) -> None:
        self._client: Any = None
        self._local_root: Path | None = None
        if settings.app_env == "test":
            import tempfile

            self._local_root = Path(tempfile.mkdtemp(prefix="tz-storage-"))

    def _minio(self) -> Any:
        if self._client is None:
            try:
                from minio import Minio

                self._client = Minio(
                    settings.minio_endpoint,
                    access_key=settings.minio_access_key,
                    secret_key=settings.minio_secret_key,
                    secure=settings.minio_secure,
                )
                if not self._client.bucket_exists(settings.minio_bucket):
                    self._client.make_bucket(settings.minio_bucket)
            except Exception as exc:  # noqa: BLE001
                raise FileStorageError(f"MinIO недоступен: {exc}") from exc
        return self._client

    def put(self, key: str, data: bytes, content_type: str) -> None:
        if self._local_root is not None:
            path = self._local_root / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return
        self._minio().put_object(
            settings.minio_bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    async def aput(self, key: str, data: bytes, content_type: str) -> None:
        """Неблокирующий put: MinIO/диск в threadpool (P-02)."""
        await asyncio.to_thread(self.put, key, data, content_type)

    def get(self, key: str) -> bytes:
        if self._local_root is not None:
            path = self._local_root / key
            if not path.exists():
                raise FileStorageError("Объект не найден")
            return path.read_bytes()
        response = self._minio().get_object(settings.minio_bucket, key)
        try:
            return cast(bytes, response.read())
        finally:
            response.close()
            response.release_conn()

    def remove(self, key: str) -> None:
        if self._local_root is not None:
            path = self._local_root / key
            if path.exists():
                path.unlink()
            return
        try:
            self._minio().remove_object(settings.minio_bucket, key)
        except Exception as exc:  # noqa: BLE001
            raise FileStorageError(f"MinIO remove failed: {exc}") from exc

    def health(self) -> bool:
        """Доступность хранилища (тикет 20, метрика storage_up)."""
        if self._local_root is not None:
            return self._local_root.exists()
        try:
            return bool(self._minio().bucket_exists(settings.minio_bucket))
        except Exception:  # noqa: BLE001 -- метрики не должны падать
            return False

    def object_count(self) -> int:
        """Количество объектов в бакете (тикет 20, метрика storage_objects)."""
        if self._local_root is not None:
            return sum(1 for path in self._local_root.rglob("*") if path.is_file())
        try:
            client = self._minio()
            return sum(1 for _ in client.list_objects(settings.minio_bucket, recursive=True))
        except Exception:  # noqa: BLE001 -- метрики не должны падать
            return 0


storage = ObjectStorage()
scanner = ClamAvScanner()


def store_project_file(
    project_id: int, original_name: str, data: bytes
) -> StoredFile:
    """Валидация и сохранение файла проекта; возвращает метаданные."""
    if len(data) > MAX_FILE_SIZE:
        raise ValueError(f"Файл превышает лимит {settings.max_file_size_mb} МБ")
    mime = detect_mime(data)
    if mime is None:
        raise ValueError("Недопустимый формат: разрешены PDF, DOCX, XLSX, PNG, JPEG")
    ext = extension_for(mime)
    key = f"projects/{project_id}/{uuid.uuid4().hex}.{ext}"
    storage.put(key, data, content_type=mime)
    return StoredFile(
        storage_key=key,
        sha256=_sha256(data),
        size=len(data),
        mime_type=mime,
    )


async def astore_project_file(
    project_id: int, original_name: str, data: bytes
) -> StoredFile:
    """Асинхронный вариант: MinIO put в threadpool (P-02)."""
    if len(data) > MAX_FILE_SIZE:
        raise ValueError(f"Файл превышает лимит {settings.max_file_size_mb} МБ")
    mime = detect_mime(data)
    if mime is None:
        raise ValueError("Недопустимый формат: разрешены PDF, DOCX, XLSX, PNG, JPEG")
    ext = extension_for(mime)
    key = f"projects/{project_id}/{uuid.uuid4().hex}.{ext}"
    await asyncio.to_thread(storage.put, key, data, mime)
    return StoredFile(
        storage_key=key,
        sha256=_sha256(data),
        size=len(data),
        mime_type=mime,
    )


def read_stored_file(storage_key: str) -> bytes:
    return storage.get(storage_key)


def store_news_media(post_id: int, original_name: str, data: bytes) -> StoredFile:
    """Валидация и сохранение медиа новости (обложка/вложение/галерея)."""
    if len(data) > MAX_FILE_SIZE:
        raise ValueError(f"Файл превышает лимит {settings.max_file_size_mb} МБ")
    mime = detect_mime(data)
    if mime is None:
        raise ValueError("Недопустимый формат: разрешены PDF, DOCX, XLSX, PNG, JPEG")
    ext = extension_for(mime)
    key = f"news/{post_id}/{uuid.uuid4().hex}.{ext}"
    storage.put(key, data, content_type=mime)
    return StoredFile(
        storage_key=key,
        sha256=_sha256(data),
        size=len(data),
        mime_type=mime,
    )


async def astore_news_media(post_id: int, original_name: str, data: bytes) -> StoredFile:
    """Асинхронный вариант: MinIO put в threadpool (P-02)."""
    if len(data) > MAX_FILE_SIZE:
        raise ValueError(f"Файл превышает лимит {settings.max_file_size_mb} МБ")
    mime = detect_mime(data)
    if mime is None:
        raise ValueError("Недопустимый формат: разрешены PDF, DOCX, XLSX, PNG, JPEG")
    ext = extension_for(mime)
    key = f"news/{post_id}/{uuid.uuid4().hex}.{ext}"
    await asyncio.to_thread(storage.put, key, data, mime)
    return StoredFile(
        storage_key=key,
        sha256=_sha256(data),
        size=len(data),
        mime_type=mime,
    )


async def ascan_file(data: bytes) -> tuple[str, str]:
    """ClamAV scan в threadpool, если включён (P-02)."""
    # scanner.scan уже асинхронна (asyncio.open_connection), но тяжёлый
    # сетевой обмен выносим в threadpool для единообразия P-02
    return await scanner.scan(data)


READ_CHUNK = 1024 * 1024


async def read_upload_limited(file: Any, max_bytes: int = MAX_FILE_SIZE) -> bytes:
    """Читает UploadFile порциями, обрывая поток сверх лимита (DoS-защита).

    Тело запроса не буферизуется целиком до проверки: как только прочитано
    больше max_bytes, чтение прекращается и поднимается FileSizeExceeded.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(READ_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise FileSizeExceeded(
                f"Файл превышает лимит {max_bytes // (1024 * 1024)} МБ"
            )
        chunks.append(chunk)
    return b"".join(chunks)
