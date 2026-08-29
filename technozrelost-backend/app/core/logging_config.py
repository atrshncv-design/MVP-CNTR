"""Структурированные JSON-логи без секретов (тикет 20).

- `setup_logging()` — один StreamHandler (JSON) на root-логгер и логгеры uvicorn.
- `redact()` — маскирует значения по ключам password/token/email/secret,
  Authorization-заголовки и e-mail-адреса в ЛЮБОЙ строке лога.
- `JsonFormatter` — каждая строка лога = один JSON-объект; uvicorn-access
  логи попадают в тот же формат (тела запросов uvicorn не логирует; query-
  параметры вроде ?access_token=... маскируются redact()).
"""

from __future__ import annotations

import json
import logging
import re
from contextvars import ContextVar
from datetime import UTC, datetime

from app.core.config import settings

# P-10: корреляционный идентификатор запроса для сквозной трассировки
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)

# Ключи, значения которых маскируются в тексте лога (регистронезависимо).
# group(1) — ключ, group(2) — разделитель, group(3) — значение.
_SECRET_KEY_RE = re.compile(
    r"(?i)\b(access[_-]?token|refresh[_-]?token|token|password|passwd|pwd|"
    r"secret|api[_-]?key|authorization)\b([\"'\s=:]+)([^\s,}\"']+)"
)
# Authorization-заголовок целиком (Bearer + токен) — одна замена
_AUTH_HEADER_RE = re.compile(
    r"(?i)\b(authorization\s*[:=]\s*)(?:bearer\s+)?[A-Za-z0-9._~+/=-]+"
)
_BEARER_RE = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

_STANDARD_RECORD_ATTRS = frozenset(
    {
        "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
        "created", "msecs", "relativeCreated", "thread", "threadName",
        "processName", "process", "taskName", "message",
    }
)


def redact(text: str) -> str:
    """Маскирует секреты и персональные данные в произвольной строке лога.

    Порядок важен: сначала Bearer-токены (иначе "Authorization: Bearer <jwt>"
    маскирует только слово Bearer, оставляя сам токен), затем key=value по
    ключам password/token/email/secret, затем e-mail адреса.
    """
    text = _AUTH_HEADER_RE.sub(r"\1***", text)
    text = _BEARER_RE.sub("Bearer ***", text)
    text = _SECRET_KEY_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}***", text)
    text = _EMAIL_RE.sub("***@***", text)
    return text


class JsonFormatter(logging.Formatter):
    """Одна JSON-строка на запись лога; message и exc проходят через redact()."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact(record.getMessage()),
        }
        # P-10: прокидываем X-Request-ID в каждую строку лога, если установлен
        req_id = request_id_ctx.get()
        if req_id:
            payload["request_id"] = req_id
        elif hasattr(record, "request_id"):
            payload["request_id"] = record.request_id  # noqa: B009
        if record.exc_info:
            payload["exc"] = redact(self.formatException(record.exc_info))
        for key, value in record.__dict__.items():
            if key in _STANDARD_RECORD_ATTRS or key.startswith("_"):
                continue
            try:
                json.dumps(value)
            except (TypeError, ValueError):
                continue
            payload[key] = value
        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging(level: str | None = None) -> None:
    """Настраивает JSON-логирование на root + логгеры uvicorn.

    Вызывается при импорте app.main ДО старта uvicorn: даже если uvicorn затем
    применит свой dictConfig, наш обработчик на root-логгере остаётся, а
    обработчики uvicorn-логгеров мы перезаписываем здесь (после старта uvicorn
    повторная настройка не выполняется).
    """
    effective_level = level or settings.log_level or "INFO"
    root = logging.getLogger()
    root.setLevel(effective_level)

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    loggers = [logging.getLogger(name) for name in ("uvicorn", "uvicorn.error", "uvicorn.access")]
    for logger in (root, *loggers):
        for existing in list(logger.handlers):
            logger.removeHandler(existing)
        logger.addHandler(handler)
        logger.setLevel(effective_level)
        logger.propagate = False
