#!/usr/bin/env python3
"""Периодический алертер production-контура без хранения секретов в коде."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import os
import shutil
import socket
import time
from collections.abc import Callable, Iterable, Sequence
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LOGGER = logging.getLogger("technozrelost.alerter")

OK = "ok"
WARNING = "warning"
CRITICAL = "critical"


@dataclass(frozen=True)
class CheckResult:
    name: str
    state: str
    detail: str


@dataclass(frozen=True)
class AlertState:
    active: bool = False
    notification_sent: bool = False


@dataclass(frozen=True)
class AlerterConfig:
    readiness_url: str
    primary_host: str
    primary_port: int
    replica_host: str
    replica_port: int
    database: str
    database_user: str
    database_password: str
    replication_slot: str
    freshness_marker: Path
    max_backup_age_hours: float
    offsite_marker: Path
    disk_paths: tuple[Path, ...]
    disk_warn_percent: float
    disk_critical_percent: float
    slot_lag_warn_bytes: int
    slot_lag_critical_bytes: int
    replica_lag_critical_bytes: int
    state_file: Path
    interval_seconds: int
    probe_timeout_seconds: float
    telegram_bot_token: str
    telegram_chat_id: str
    minio_health_url: str = "http://minio:9000/minio/health/live"
    clamav_host: str = "clamav"
    clamav_port: int = 3310
    wal_offsite_marker: Path = Path("/backups/.wal-offsite-status")
    wal_offsite_max_age_seconds: float = 300.0

    @classmethod
    def from_env(cls) -> AlerterConfig:
        disk_warn_percent = _env_percent("ALERTER_DISK_WARN_PERCENT", 80.0)
        disk_critical_percent = _env_percent("ALERTER_DISK_CRITICAL_PERCENT", 90.0)
        if disk_warn_percent > disk_critical_percent:
            raise ValueError("ALERTER_DISK_WARN_PERCENT must not exceed critical")
        return cls(
            readiness_url=os.getenv(
                "ALERTER_READINESS_URL", "http://backend:8000/api/v1/ready"
            ),
            primary_host=os.getenv("POSTGRES_HOST", "db"),
            primary_port=_env_int("POSTGRES_PORT", 5432),
            replica_host=os.getenv("POSTGRES_REPLICA_HOST", "db-replica"),
            replica_port=_env_int("POSTGRES_REPLICA_PORT", 5432),
            database=os.getenv("POSTGRES_DB", "technozrelost"),
            database_user=os.getenv("POSTGRES_USER", "technoz"),
            database_password=os.getenv("POSTGRES_PASSWORD", ""),
            replication_slot=os.getenv("REPL_SLOT", "tz_replica_slot"),
            freshness_marker=Path(
                os.getenv("BACKUP_FRESHNESS_MARKER", "/backups/.backup-freshness")
            ),
            max_backup_age_hours=_env_float("BACKUP_MAX_AGE_HOURS", 25.0),
            offsite_marker=Path(
                os.getenv("BACKUP_OFFSITE_MARKER", "/backups/.offsite-status")
            ),
            disk_paths=_env_paths(
                "ALERTER_DISK_PATHS", "/backups,/wal-archive"
            ),
            disk_warn_percent=disk_warn_percent,
            disk_critical_percent=disk_critical_percent,
            slot_lag_warn_bytes=_env_int(
                "ALERTER_SLOT_LAG_WARN_BYTES", 12 * 1024 * 1024 * 1024
            ),
            slot_lag_critical_bytes=_env_int(
                "ALERTER_SLOT_LAG_CRITICAL_BYTES", 15 * 1024 * 1024 * 1024
            ),
            replica_lag_critical_bytes=_env_int(
                "ALERTER_REPLICA_LAG_CRITICAL_BYTES", 5 * 1024 * 1024 * 1024
            ),
            state_file=Path(
                os.getenv("ALERTER_STATE_FILE", "/state/alerter-state.json")
            ),
            interval_seconds=_env_int("ALERTER_INTERVAL_SECONDS", 60),
            probe_timeout_seconds=_env_float("ALERTER_PROBE_TIMEOUT_SECONDS", 5.0),
            telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", "").strip(),
            telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID", "").strip(),
            minio_health_url=os.getenv(
                "ALERTER_MINIO_HEALTH_URL", "http://minio:9000/minio/health/live"
            ),
            clamav_host=os.getenv("ALERTER_CLAMAV_HOST", "clamav"),
            clamav_port=_env_int("ALERTER_CLAMAV_PORT", 3310),
            wal_offsite_marker=Path(
                os.getenv("WAL_OFFSITE_MARKER", "/backups/.wal-offsite-status")
            ),
            wal_offsite_max_age_seconds=_env_float("WAL_OFFSITE_MAX_AGE_SECONDS", 300.0),
        )


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return int(value)


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    parsed = float(value)
    if not math.isfinite(parsed):
        raise ValueError(f"{name} must be finite")
    return parsed


def _env_percent(name: str, default: float) -> float:
    parsed = _env_float(name, default)
    if not 0.0 <= parsed <= 100.0:
        raise ValueError(f"{name} must be between 0 and 100")
    return parsed


def _env_paths(name: str, default: str) -> tuple[Path, ...]:
    raw = os.getenv(name, default)
    paths = tuple(Path(item.strip()) for item in raw.split(",") if item.strip())
    return paths or (Path("/"),)


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("timestamp has no timezone")
    return value.astimezone(UTC)


def parse_iso_timestamp(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    return _utc(datetime.fromisoformat(normalized))


def _read_marker_line(path: Path) -> str:
    with path.open("r", encoding="ascii") as marker:
        line = marker.readline(256).strip()
    if not line:
        raise ValueError("marker is empty")
    return line


def check_backup_freshness(
    marker: Path | str,
    max_age_hours: float,
    now: datetime | None = None,
) -> CheckResult:
    path = Path(marker)
    try:
        timestamp = parse_iso_timestamp(_read_marker_line(path))
    except (OSError, UnicodeError, ValueError):
        return CheckResult("backup_freshness", CRITICAL, "marker missing or invalid")

    if not math.isfinite(max_age_hours) or max_age_hours < 0:
        return CheckResult("backup_freshness", CRITICAL, "invalid age threshold")
    current = _utc(now or datetime.now(UTC))
    age_seconds = (current - timestamp).total_seconds()
    if age_seconds < 0:
        return CheckResult("backup_freshness", CRITICAL, "timestamp in future")
    age_hours = age_seconds / 3600
    if age_hours > max_age_hours:
        return CheckResult(
            "backup_freshness",
            CRITICAL,
            f"age={age_hours:.1f}h exceeds {max_age_hours:.1f}h",
        )
    return CheckResult("backup_freshness", OK, f"age={age_hours:.1f}h")


def _check_offsite(
    marker: Path | str,
    *,
    name: str = "offsite",
    max_age_seconds: float | None = None,
    now: datetime | None = None,
) -> CheckResult:
    try:
        parts = _read_marker_line(Path(marker)).split(maxsplit=2)
        if len(parts) < 3 or parts[0] not in {"ok", "warn", "fail"}:
            raise ValueError("invalid offsite marker")
        timestamp = parse_iso_timestamp(parts[1])
    except (OSError, UnicodeError, ValueError):
        return CheckResult(name, CRITICAL, "marker missing or invalid")

    current = _utc(now or datetime.now(UTC))
    age_seconds = (current - timestamp).total_seconds()
    if age_seconds < 0:
        return CheckResult(name, CRITICAL, "timestamp in future")

    status = parts[0]
    if status == "fail":
        return CheckResult(name, CRITICAL, "status=fail")
    if status == "warn":
        return CheckResult(name, WARNING, "status=warn")
    if max_age_seconds is None:
        return CheckResult(name, OK, "status=ok")
    if not math.isfinite(max_age_seconds) or max_age_seconds < 0:
        return CheckResult(name, CRITICAL, "invalid age threshold")
    if age_seconds > max_age_seconds:
        return CheckResult(
            name,
            CRITICAL,
            f"age={age_seconds:.0f}s exceeds {max_age_seconds:.0f}s",
        )
    return CheckResult(name, OK, f"status=ok age={age_seconds:.0f}s")


def check_offsite(marker: Path | str, now: datetime | None = None) -> CheckResult:
    return _check_offsite(marker, now=now)


def check_wal_offsite(
    marker: Path | str,
    max_age_seconds: float = 300.0,
    now: datetime | None = None,
) -> CheckResult:
    """Проверяет, что непрерывная offsite-синхронизация WAL не устарела."""
    return _check_offsite(
        marker,
        name="wal_offsite",
        max_age_seconds=max_age_seconds,
        now=now,
    )


def check_disk_usage(
    paths: Iterable[Path | str],
    warn_percent: float = 80.0,
    critical_percent: float = 90.0,
    usage: Callable[[str], Any] = shutil.disk_usage,
) -> CheckResult:
    path_list = tuple(Path(path) for path in paths)
    if (
        not path_list
        or not math.isfinite(warn_percent)
        or not math.isfinite(critical_percent)
        or not 0.0 <= warn_percent <= critical_percent <= 100.0
    ):
        return CheckResult("disk", CRITICAL, "invalid disk threshold configuration")

    usages: list[tuple[Path, float]] = []
    for path in path_list:
        try:
            stat = usage(str(path))
            percent = (stat.used / stat.total * 100) if stat.total else 100.0
            if not math.isfinite(percent):
                return CheckResult("disk", CRITICAL, f"path={path} unavailable")
        except (OSError, ValueError, ZeroDivisionError):
            return CheckResult("disk", CRITICAL, f"path={path} unavailable")
        usages.append((path, percent))

    highest = max(percent for _, percent in usages)
    detail = ", ".join(f"{path}={percent:.1f}%" for path, percent in usages)
    if highest >= critical_percent:
        return CheckResult("disk", CRITICAL, detail)
    if highest >= warn_percent:
        return CheckResult("disk", WARNING, detail)
    return CheckResult("disk", OK, detail)


def _check_http_endpoint(
    name: str,
    url: str,
    timeout_seconds: float = 5.0,
    opener: Callable[..., Any] = urlopen,
) -> CheckResult:
    try:
        request = Request(url, method="GET")
        response = opener(request, timeout=timeout_seconds)
        try:
            status_value = getattr(response, "status", None)
            if status_value is None:
                status_value = response.getcode()
            status = int(status_value)
        finally:
            close = getattr(response, "close", None)
            if close is not None:
                with suppress(Exception):
                    close()
    except HTTPError as exc:
        return CheckResult(name, CRITICAL, f"http_status={exc.code}")
    except (AttributeError, OSError, URLError, TimeoutError, ValueError):
        return CheckResult(name, CRITICAL, "endpoint unavailable")

    if status != 200:
        return CheckResult(name, CRITICAL, f"http_status={status}")
    return CheckResult(name, OK, "http_status=200")


def check_readiness(
    url: str,
    timeout_seconds: float = 5.0,
    opener: Callable[..., Any] = urlopen,
) -> CheckResult:
    return _check_http_endpoint("readiness", url, timeout_seconds, opener)


def check_minio_health(
    url: str,
    timeout_seconds: float = 5.0,
    opener: Callable[..., Any] = urlopen,
) -> CheckResult:
    """Проверяет health endpoint MinIO без передачи ключей доступа."""
    return _check_http_endpoint("minio_health", url, timeout_seconds, opener)


def check_clamav_availability(
    host: str,
    port: int,
    timeout_seconds: float = 5.0,
    connector: Callable[..., Any] = socket.create_connection,
) -> CheckResult:
    """Проверяет clamd безопасным PING/PONG TCP-запросом."""
    connection: Any = None
    try:
        connection = connector((host, port), timeout=timeout_seconds)
        connection.sendall(b"PING\n")
        response = connection.recv(16)
    except (AttributeError, OSError, TimeoutError, ValueError):
        return CheckResult("clamav_availability", CRITICAL, "endpoint unavailable")
    finally:
        if connection is not None:
            close = getattr(connection, "close", None)
            if close is not None:
                with suppress(Exception):
                    close()

    if not isinstance(response, bytes) or response.strip() != b"PONG":
        return CheckResult("clamav_availability", CRITICAL, "unexpected response")
    return CheckResult("clamav_availability", OK, "response=PONG")


def check_clamav_cvd_age(
    host: str,
    port: int,
    max_age_seconds: float = 7 * 24 * 3600,
    timeout_seconds: float = 5.0,
    connector: Callable[..., Any] = socket.create_connection,
    now: datetime | None = None,
) -> CheckResult:
    """INF-18: проверяет свежесть CVD-баз ClamAV через VERSION.

    VERSION возвращает строку вида ``ClamAV 1.4.1/27200/Sun Sep 15 02:00:02 2024``.
    Если возраст превышает max_age_seconds — critical. Фолбэк на файловый
    mtime невозможен из контейнера alerter без общего тома, поэтому сетевая
    проверка — единственная. При недоступности clamd — critical (fail-closed).
    """
    import re

    connection: Any = None
    try:
        connection = connector((host, port), timeout=timeout_seconds)
        connection.sendall(b"VERSION\n")
        # VERSION ответ может быть длиннее PONG, читаем до 4К
        connection.settimeout(timeout_seconds)  # type: ignore[attr-defined]
        data = connection.recv(4096)
    except (AttributeError, OSError, TimeoutError, ValueError):
        return CheckResult("clamav_cvd_age", CRITICAL, "endpoint unavailable")
    finally:
        if connection is not None:
            close = getattr(connection, "close", None)
            if close is not None:
                with suppress(Exception):
                    close()
    try:
        text = data.decode(errors="replace").strip()  # type: ignore[union-attr]
        # Ищем дату после второго '/'
        m = re.search(r"/\s*([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}.*?20\d{2})", text)
        if not m:
            return CheckResult("clamav_cvd_age", CRITICAL, "version parse failed")
        date_str = m.group(1).strip()
        parsed: datetime | None = None
        for fmt in ("%a %b %d %H:%M:%S %Y", "%a %b %d %H:%M:%S %Z %Y"):
            try:
                parsed = datetime.strptime(date_str, fmt).replace(tzinfo=UTC)
                break
            except ValueError:
                continue
        if parsed is None:
            return CheckResult("clamav_cvd_age", CRITICAL, "version parse failed")
        current = _utc(now or datetime.now(UTC))
        age_seconds = (current - parsed).total_seconds()
        if age_seconds < 0:
            return CheckResult("clamav_cvd_age", CRITICAL, "timestamp in future")
        if age_seconds > max_age_seconds:
            return CheckResult(
                "clamav_cvd_age",
                CRITICAL,
                f"age={age_seconds:.0f}s exceeds {max_age_seconds:.0f}s",
            )
        return CheckResult("clamav_cvd_age", OK, f"age={age_seconds:.0f}s")
    except Exception:  # noqa: BLE001
        return CheckResult("clamav_cvd_age", CRITICAL, "version parse failed")


async def check_replica_and_slot(config: AlerterConfig) -> list[CheckResult]:
    """Проверяет отдельным соединением реплику и слот на Primary."""
    try:
        import asyncpg
    except ImportError:
        return [
            CheckResult("replica", CRITICAL, "database driver unavailable"),
            CheckResult("replication_slot", CRITICAL, "database driver unavailable"),
        ]

    primary: Any = None
    replica: Any = None
    slot_row: Any = None
    stream_row: Any = None
    primary_ok = True
    try:
        primary = await asyncpg.connect(
            host=config.primary_host,
            port=config.primary_port,
            user=config.database_user,
            password=config.database_password,
            database=config.database,
            timeout=config.probe_timeout_seconds,
        )
        slot_row = await primary.fetchrow(
            """
            SELECT active, wal_status,
                   COALESCE(
                       pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn), 0
                   )::bigint AS retained_bytes
            FROM pg_replication_slots
            WHERE slot_name = $1
            """,
            config.replication_slot,
        )
        # В pg_stat_replication нет slot_name; в текущем контуре единственная
        # строка соответствует подключённой физической реплике.
        stream_row = await primary.fetchrow(
            """
            SELECT state,
                   COALESCE(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn), 0)
                   ::bigint AS lag_bytes,
                   (replay_lsn IS NOT NULL) AS replay_available
            FROM pg_stat_replication
            ORDER BY backend_start DESC
            LIMIT 1
            """
        )
    except Exception:  # Ошибки БД намеренно не попадают в логи.
        primary_ok = False
    finally:
        if primary is not None:
            await _close_connection(primary)

    in_recovery: Any = None
    receiver_status: Any = None
    try:
        replica = await asyncpg.connect(
            host=config.replica_host,
            port=config.replica_port,
            user=config.database_user,
            password=config.database_password,
            database=config.database,
            timeout=config.probe_timeout_seconds,
        )
        in_recovery = await replica.fetchval("SELECT pg_is_in_recovery()")
        receiver_status = await replica.fetchval(
            "SELECT status FROM pg_stat_wal_receiver LIMIT 1"
        )
    except Exception:
        in_recovery = None
        receiver_status = None
    finally:
        if replica is not None:
            await _close_connection(replica)

    if in_recovery is True and receiver_status == "streaming":
        replica_result = CheckResult("replica", OK, "connected, in recovery and streaming")
    elif in_recovery is False:
        replica_result = CheckResult("replica", CRITICAL, "connected but not in recovery")
    elif in_recovery is True:
        replica_result = CheckResult("replica", CRITICAL, "receiver is not streaming")
    else:
        replica_result = CheckResult("replica", CRITICAL, "connection unavailable")

    if not primary_ok or slot_row is None:
        slot_result = CheckResult("replication_slot", CRITICAL, "slot unavailable")
        lag_result = CheckResult("replica_lag", CRITICAL, "primary statistics unavailable")
        return [replica_result, slot_result, lag_result]

    wal_status = str(_row_value(slot_row, "wal_status", "unknown"))
    active = bool(_row_value(slot_row, "active", False))
    retained_bytes = int(_row_value(slot_row, "retained_bytes", 0) or 0)
    slot_detail = f"wal_status={wal_status} retained_bytes={retained_bytes}"
    if wal_status in {"lost", "unreserved"} or retained_bytes >= config.slot_lag_critical_bytes:
        slot_result = CheckResult("replication_slot", CRITICAL, slot_detail)
    elif not active or wal_status == "extended" or retained_bytes >= config.slot_lag_warn_bytes:
        slot_result = CheckResult("replication_slot", WARNING, slot_detail)
    else:
        slot_result = CheckResult("replication_slot", OK, slot_detail)

    if stream_row is None:
        lag_result = CheckResult("replica_lag", CRITICAL, "streaming connection absent")
    else:
        stream_state = str(_row_value(stream_row, "state", "unknown"))
        lag_bytes = int(_row_value(stream_row, "lag_bytes", 0) or 0)
        replay_available = bool(_row_value(stream_row, "replay_available", True))
        lag_detail = f"state={stream_state} replay_lag_bytes={lag_bytes}"
        if (
            stream_state != "streaming"
            or not replay_available
            or lag_bytes >= config.replica_lag_critical_bytes
        ):
            lag_result = CheckResult("replica_lag", CRITICAL, lag_detail)
        else:
            lag_result = CheckResult("replica_lag", OK, lag_detail)
    return [replica_result, slot_result, lag_result]


async def _close_connection(connection: Any) -> None:
    with suppress(Exception):
        await connection.close()


def _row_value(row: Any, key: str, default: Any) -> Any:
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return default


def aggregate_state(checks: Sequence[CheckResult]) -> str:
    if any(check.state == CRITICAL for check in checks):
        return CRITICAL
    if any(check.state == WARNING for check in checks):
        return WARNING
    return OK


def notification_event(previous: AlertState, current_state: str) -> str | None:
    if current_state != OK and not previous.active:
        return "alert"
    if current_state == OK and previous.active and previous.notification_sent:
        return "recovery"
    return None


def format_message(checks: Sequence[CheckResult], recovery: bool = False) -> str:
    if recovery:
        return "[RECOVERY] technozrelost: all monitored checks are healthy"
    state = aggregate_state(checks).upper()
    lines = [f"[ALERT] technozrelost: {state}"]
    lines.extend(
        f"{check.name}: {check.state} ({check.detail})"
        for check in checks
        if check.state != OK
    )
    return "\n".join(lines)


def process_checks(
    checks: Sequence[CheckResult],
    previous: AlertState,
    telegram_configured: bool,
    send: Callable[[str], bool] | None = None,
) -> tuple[AlertState, str | None]:
    """Возвращает новое состояние и событие, не повторяя активную аварию."""
    current_state = aggregate_state(checks)
    event = notification_event(previous, current_state)
    next_state = previous

    if current_state != OK:
        next_state = AlertState(active=True, notification_sent=previous.notification_sent)
        if previous.active and not previous.notification_sent and telegram_configured:
            event = "alert"
        if (
            event == "alert"
            and telegram_configured
            and send is not None
            and send(format_message(checks))
        ):
            next_state = AlertState(active=True, notification_sent=True)
        return next_state, event

    if previous.active:
        if previous.notification_sent and telegram_configured and send is not None:
            event = "recovery"
            if send(format_message(checks, recovery=True)):
                return AlertState(), event
            return previous, event
        return AlertState(), None
    return AlertState(), None


def load_state(path: Path) -> AlertState:
    try:
        data = json.loads(path.read_text(encoding="ascii"))
    except FileNotFoundError:
        return AlertState()
    except (OSError, UnicodeError, ValueError, TypeError):
        LOGGER.warning("alerter state is unreadable; starting without active incident")
        return AlertState()
    return AlertState(
        active=bool(data.get("active", False)),
        notification_sent=bool(data.get("notification_sent", False)),
    )


def save_state(path: Path, state: AlertState) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(
            {
                "active": state.active,
                "notification_sent": state.notification_sent,
            },
            sort_keys=True,
        )
        + "\n",
        encoding="ascii",
    )
    os.replace(temporary, path)


def send_telegram(
    token: str,
    chat_id: str,
    message: str,
    timeout_seconds: float = 5.0,
    opener: Callable[..., Any] = urlopen,
) -> bool:
    if not token or not chat_id:
        return False
    request = Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=urlencode({"chat_id": chat_id, "text": message}).encode("utf-8"),
        method="POST",
    )
    try:
        response = opener(request, timeout=timeout_seconds)
        try:
            status_value = getattr(response, "status", None)
            if status_value is None:
                status_value = response.getcode()
            status = int(status_value)
            body = response.read()
        finally:
            close = getattr(response, "close", None)
            if close is not None:
                close()
        if not 200 <= status < 300:
            return False
        return bool(json.loads(body).get("ok", False))
    except (AttributeError, HTTPError, OSError, TypeError, URLError, TimeoutError, ValueError):
        LOGGER.warning("Telegram notification failed")
        return False


async def collect_checks(config: AlerterConfig) -> list[CheckResult]:
    readiness_task = asyncio.to_thread(
        check_readiness,
        config.readiness_url,
        config.probe_timeout_seconds,
    )
    minio_task = asyncio.to_thread(
        check_minio_health,
        config.minio_health_url,
        config.probe_timeout_seconds,
    )
    clamav_task = asyncio.to_thread(
        check_clamav_availability,
        config.clamav_host,
        config.clamav_port,
        config.probe_timeout_seconds,
    )
    cvd_task = asyncio.to_thread(
        check_clamav_cvd_age,
        config.clamav_host,
        config.clamav_port,
        7 * 24 * 3600,
        config.probe_timeout_seconds,
    )
    replication_task = check_replica_and_slot(config)
    readiness, minio, clamav, cvd_age, replication = await asyncio.gather(
        readiness_task,
        minio_task,
        clamav_task,
        cvd_task,
        replication_task,
    )
    return [
        readiness,
        minio,
        clamav,
        cvd_age,
        *replication,
        check_backup_freshness(
            config.freshness_marker,
            config.max_backup_age_hours,
        ),
        check_offsite(config.offsite_marker),
        check_wal_offsite(
            config.wal_offsite_marker,
            config.wal_offsite_max_age_seconds,
        ),
        check_disk_usage(
            config.disk_paths,
            config.disk_warn_percent,
            config.disk_critical_percent,
        ),
    ]


async def run_once(config: AlerterConfig) -> list[CheckResult]:
    checks = await collect_checks(config)
    previous = load_state(config.state_file)
    configured = bool(config.telegram_bot_token and config.telegram_chat_id)
    if not configured:
        LOGGER.warning(
            "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID are empty; notifications disabled"
        )

    sender: Callable[[str], bool] | None = None
    if configured:
        sender = lambda message: send_telegram(  # noqa: E731
            config.telegram_bot_token,
            config.telegram_chat_id,
            message,
            config.probe_timeout_seconds,
        )
    next_state, event = process_checks(checks, previous, configured, sender)
    save_state(config.state_file, next_state)
    if event is not None:
        LOGGER.info("notification event: %s", event)
    for check in checks:
        if check.state != OK:
            LOGGER.warning("check %s: %s (%s)", check.name, check.state, check.detail)
    return checks


def self_check() -> None:
    healthy = [CheckResult("test", OK, "ok")]
    broken = [CheckResult("test", CRITICAL, "broken")]
    assert aggregate_state(healthy) == OK
    assert aggregate_state(broken) == CRITICAL
    assert notification_event(AlertState(), CRITICAL) == "alert"
    assert notification_event(AlertState(active=True, notification_sent=True), OK) == "recovery"
    LOGGER.info("alerter self-check: ok")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="run one probe cycle")
    parser.add_argument("--self-check", action="store_true", help="run checks without network")
    args = parser.parse_args()
    logging.basicConfig(level=os.getenv("ALERTER_LOG_LEVEL", "INFO"))

    if args.self_check:
        self_check()
        return 0

    try:
        config = AlerterConfig.from_env()
    except (TypeError, ValueError) as exc:
        LOGGER.error("invalid alerter configuration: %s", type(exc).__name__)
        return 2

    while True:
        try:
            asyncio.run(run_once(config))
        except Exception:  # cycle errors must not reveal env values in logs
            LOGGER.exception("alerter cycle failed")
        if args.once:
            return 0
        time.sleep(config.interval_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
