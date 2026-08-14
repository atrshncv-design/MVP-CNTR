"""Безопасное файловое хранилище (тикеты 06 Friday RC, 04 security-audit).

- Фактический MIME определяется по сигнатуре (не по Content-Type из запроса).
- Допустимы PDF/DOCX/XLSX/PNG/JPEG до 25 МБ.
- DOCX/XLSX дополнительно проходят структурную OOXML-валидацию (тикет 04):
  валидный ZIP с [Content_Types].xml и корневым членом — не только сигнатура
  ``PK\\x03\\x04`` (защита от polyglot/фейковых ZIP и zip-bomb).
- Upload читается потоково с bounded size (тикет 04): в памяти никогда не
  оказывается больше MAX_FILE_SIZE + один чанк.
- Объекты получают внутренние имена (UUID); пользовательское имя — метаданные.
- Хранилище: MinIO (закрытый бакет) в dev/prod; локальный диск — в тестах.
- ClamAV (clamd, INSTREAM): только clean-файл считается доказательством.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import threading
import time
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import UploadFile

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

# Тикет 07 (security-audit): TTL кэша счётчика объектов (сек). Метрика
# storage_objects — gauge, допустима небольшая задержка отражения изменений.
OBJECT_COUNT_CACHE_TTL = 60.0

# ── Тикет 04 (security-audit): лимиты и хуки ─────────────────────────────────
# Bounded streaming upload: читаем чанками, никогда не держим в памяти больше
# MAX_FILE_SIZE + один чанк. Oversize отклоняется до удержания полного payload.
UPLOAD_CHUNK_SIZE = 256 * 1024

# OOXML-структура: члены читаем ТОЛЬКО с лимитом (защита от zip-bomb).
# [Content_Types].xml и корневой XML-член в реальных документах малы;
# потолки заведомо выше легитимных значений и не меняют политику хранения.
MAX_OOXML_MEMBER_SIZE = 16 * 1024 * 1024  # лимит распаковки одного члена
MAX_OOXML_TOTAL_SIZE = 8 * MAX_FILE_SIZE  # суммарный несжатый объём архива

# Корневые члены OOXML-пакетов (обязательны вместе с [Content_Types].xml).
_OOXML_REQUIRED_MEMBERS: dict[str, str] = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
        "word/document.xml"
    ),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
        "xl/workbook.xml"
    ),
}

# Quotas/retention hooks (тикет 04): явные точки расширения БЕЗ изменения
# бизнес-политики хранения. Лимит по умолчанию (settings.max_files_per_project
# = 1000) заведомо не ограничивает существующие сценарии; retention реализован
# эндпоинтом cleanup_old_versions (app/api/v1/requests.py) и настраивается
# через file_retention_days.


class FileStorageError(Exception):
    """Ошибка хранилища (MinIO недоступен и т.п.)."""


@dataclass
class StoredFile:
    storage_key: str
    sha256: str
    size: int
    mime_type: str


def detect_mime(data: bytes) -> str | None:
    """Фактический MIME по сигнатуре первых байтов."""
    if not data:
        return None
    for mime, (sig, _ext) in ALLOWED_MIME.items():
        if data.startswith(sig):
            return mime
    return None


def extension_for(mime: str) -> str:
    return ALLOWED_MIME[mime][1]


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ── Тикет 04: quotas/retention hooks ─────────────────────────────────────────


def quota_hook(project_id: int, current_count: int) -> None:
    """Мягкая квота файлов проекта (тикет 04).

    Хук-точка расширения: бизнес-политика хранения НЕ меняется — лимит по
    умолчанию (max_files_per_project=1000) заведомо выше реальных сценариев,
    а ужесточение делается только через env/настройки.
    """
    limit = settings.max_files_per_project
    if limit and current_count >= limit:
        raise ValueError(
            f"Превышена квота файлов проекта {project_id}: не более {limit} файлов"
        )


# ── Тикет 04: bounded streaming upload ───────────────────────────────────────


async def read_upload_bounded(
    file: UploadFile, max_bytes: int = MAX_FILE_SIZE
) -> bytes:
    """Потоковое чтение upload с жёстким лимитом.

    - Content-Length (если присутствует) проверяется ДО чтения тела —
      oversize отклоняется, не читая ни байта.
    - Иначе тело читается чанками; при превышении лимита чтение прерывается,
      в памяти никогда не оказывается больше max_bytes + один чанк
      (независимо от фактического размера payload).
    - При превышении — ValueError (эндпоинт конвертирует в 422).
    """
    content_length = file.headers.get("content-length")
    if content_length:
        try:
            declared = int(content_length)
        except (TypeError, ValueError):
            declared = None  # битый заголовок — полагаемся на потоковое чтение
        if declared is not None and declared > max_bytes:
            raise ValueError(f"Файл превышает лимит {settings.max_file_size_mb} МБ")
    buf = bytearray()
    while True:
        chunk = await file.read(UPLOAD_CHUNK_SIZE)
        if not chunk:
            break
        if len(buf) + len(chunk) > max_bytes:
            raise ValueError(f"Файл превышает лимит {settings.max_file_size_mb} МБ")
        buf.extend(chunk)
    return bytes(buf)


# ── Тикет 04: OOXML-структурная валидация ────────────────────────────────────


def _validate_ooxml_structure(data: bytes) -> str:
    """Структурная валидация DOCX/XLSX; возвращает точный MIME пакета.

    ZIP-сигнатура не различает DOCX и XLSX (обе начинаются с ``PK\\x03\\x04``),
    поэтому тип определяется по членам архива:
    - ``[Content_Types].xml`` обязателен;
    - ``word/document.xml`` → DOCX, ``xl/workbook.xml`` → XLSX.

    Дополнительно (защита от polyglot/zip-bomb, тикет 04):
    - валидный ZIP обязателен (EOCD) — отсекается фейковый ``PK\\x03\\x04``
      с мусором вместо центрального каталога;
    - суммарный несжатый объём ограничен, члены читаются ТОЛЬКО с лимитом —
      ничего не распаковывается целиком.

    При любой нестыковке — ValueError («Недопустимый формат DOCX/XLSX»).
    """
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise ValueError("Недопустимый формат DOCX/XLSX: повреждённый ZIP-архив")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = archive.infolist()
            if sum(info.file_size for info in infos) > MAX_OOXML_TOTAL_SIZE:
                raise ValueError(
                    "Недопустимый формат DOCX/XLSX: аномальный несжатый объём "
                    "(zip-bomb)"
                )
            names = {info.filename for info in infos}
            if "[Content_Types].xml" not in names:
                raise ValueError(
                    "Недопустимый формат DOCX/XLSX: отсутствует [Content_Types].xml"
                )
            root_member = None
            mime = None
            for mime_candidate, root in _OOXML_REQUIRED_MEMBERS.items():
                if root in names:
                    root_member = root
                    mime = mime_candidate
                    break
            if root_member is None:
                raise ValueError(
                    "Недопустимый формат DOCX/XLSX: нет корневого члена "
                    "(word/document.xml или xl/workbook.xml)"
                )
            for member in ("[Content_Types].xml", root_member):
                info = archive.getinfo(member)
                if info.file_size > MAX_OOXML_MEMBER_SIZE:
                    raise ValueError(
                        f"Недопустимый формат DOCX/XLSX: член {member} слишком велик"
                    )
                payload = archive.read(member)
                if not payload.lstrip().startswith((b"<?xml", b"<")):
                    raise ValueError(
                        f"Недопустимый формат DOCX/XLSX: член {member} не XML"
                    )
            return mime  # type: ignore[return-value]
    except ValueError:
        raise
    except zipfile.BadZipFile as exc:
        raise ValueError("Недопустимый формат DOCX/XLSX: повреждённый ZIP-архив") from exc
    except Exception as exc:  # noqa: BLE001 -- любой сбой декомпрессии = не OOXML
        raise ValueError("Недопустимый формат DOCX/XLSX") from exc


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
        # Тикет 07: кэш счётчика объектов (метрика storage_objects) — см.
        # object_count(). per-process; при 2+ репликах backend gauge может
        # слегка расходиться с реальностью (допустимо для метрики).
        self._count_cache: int | None = None
        self._count_cached_at: float = 0.0
        self._count_lock = threading.Lock()

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
            self._invalidate_count_cache()
            return
        self._minio().put_object(
            settings.minio_bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        self._invalidate_count_cache()

    def get(self, key: str) -> bytes:
        if self._local_root is not None:
            path = self._local_root / key
            if not path.exists():
                raise FileStorageError("Объект не найден")
            return path.read_bytes()
        response = self._minio().get_object(settings.minio_bucket, key)
        try:
            return bytes(response.read())
        finally:
            response.close()
            response.release_conn()

    def remove(self, key: str) -> None:
        if self._local_root is not None:
            path = self._local_root / key
            if path.exists():
                path.unlink()
            self._invalidate_count_cache()
            return
        try:
            self._minio().remove_object(settings.minio_bucket, key)
            self._invalidate_count_cache()
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
        """Количество объектов в бакете (тикет 20, метрика storage_objects).

        Тикет 07 (security-remediation-audit): кешированный счётчик с TTL
        (OBJECT_COUNT_CACHE_TTL, 60с) — НЕ перечисляет бакет
        (``client.list_objects``, O(N)) на каждый scrape. Инвалидируется при
        put/remove (кэш свежее TTL), иначе протухает по TTL. Кэш per-process:
        при 2+ репликах backend gauge может слегка расходиться с реальностью —
        допустимо для метрики; при необходимости точности — общий кэш (Redis).
        Ошибки MinIO не роняют метрику (возвращается 0, как и раньше).
        """
        now = time.monotonic()
        with self._count_lock:
            if (
                self._count_cache is not None
                and now - self._count_cached_at < OBJECT_COUNT_CACHE_TTL
            ):
                return self._count_cache
        try:
            if self._local_root is not None:
                count = sum(
                    1 for path in self._local_root.rglob("*") if path.is_file()
                )
            else:
                client = self._minio()
                count = sum(
                    1
                    for _ in client.list_objects(
                        settings.minio_bucket, recursive=True
                    )
                )
        except Exception:  # noqa: BLE001 -- метрики не должны падать
            return 0
        with self._count_lock:
            self._count_cache = count
            self._count_cached_at = now
        return count

    def _invalidate_count_cache(self) -> None:
        """Сбрасывает кэш счётчика (вызывается при put/remove)."""
        with self._count_lock:
            self._count_cache = None
            self._count_cached_at = 0.0


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
    # Тикет 04: DOCX/XLSX — структурная OOXML-валидация (не только сигнатура
    # ZIP); уточняет точный MIME (docx/xlsx), отсекая полиглоты и zip-bomb.
    if mime in _OOXML_REQUIRED_MEMBERS:
        mime = _validate_ooxml_structure(data)
    ext = extension_for(mime)
    key = f"projects/{project_id}/{uuid.uuid4().hex}.{ext}"
    storage.put(key, data, content_type=mime)
    return StoredFile(
        storage_key=key,
        sha256=_sha256(data),
        size=len(data),
        mime_type=mime,
    )


def read_stored_file(storage_key: str) -> bytes:
    return storage.get(storage_key)


def store_news_media(post_id: int, original_name: str, data: bytes) -> StoredFile:
    """Валидация и сохранение медиа новости (тикет 05).

    Та же политика, что и для файлов проекта: сигнатурный MIME
    (не Content-Type из запроса), лимит 25 МБ, OOXML-структурная проверка
    DOCX/XLSX. Ключ: ``news/{post_id}/{uuid}.{ext}``.
    """
    if len(data) > MAX_FILE_SIZE:
        raise ValueError(f"Файл превышает лимит {settings.max_file_size_mb} МБ")
    mime = detect_mime(data)
    if mime is None:
        raise ValueError("Недопустимый формат: разрешены PDF, DOCX, XLSX, PNG, JPEG")
    if mime in _OOXML_REQUIRED_MEMBERS:
        mime = _validate_ooxml_structure(data)
    ext = extension_for(mime)
    key = f"news/{post_id}/{uuid.uuid4().hex}.{ext}"
    storage.put(key, data, content_type=mime)
    return StoredFile(
        storage_key=key,
        sha256=_sha256(data),
        size=len(data),
        mime_type=mime,
    )
