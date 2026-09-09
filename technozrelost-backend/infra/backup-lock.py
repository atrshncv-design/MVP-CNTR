#!/usr/bin/env python3
"""Запускает backup под общей PostgreSQL advisory lock.

Вызовы pre-migration и backup-timer используют один и тот же try-lock: второй
запуск не ждёт освобождения lock и потому не превращается в последовательный
дубликат снапшота. Для pre-migration дополнительно сохраняется marker image run,
чтобы реплика, которая стартовала позже, не повторила backup первой реплики.

Коды возврата (контракт fail-closed, история 17):
  0 — готово: снапшот создан либо pre-migration дедуп (маркер доказывает,
      что backup для этого image run уже выполнен первой репликой);
  3 — занято: другой бэкап удерживает advisory lock; pre-migration обязан
      блокировать миграции, а не трактовать занятость как готовность;
  1 — ошибка: БД/ lock/ дочерний backup.sh упал либо маркер не опубликован;
  2 — usage: нет скрипта, нет файла, недопустимый BACKUP_RUN_ID.

Ручной бэкап по ранбуку (P1) всегда делает новый снимок: вызов
`backup-lock.py --manual <скрипт>` (или `BACKUP_FORCE=1`) обходит оба
deploy-маркера (BACKUP_RUN_ID и BACKUP_SKIP_IF_MARKER_AFTER_NS) и не трогает
pre-migration маркер, но по-прежнему требует свободный lock (занято → 3).
"""

from __future__ import annotations

import asyncio
import os
import sys
from contextlib import suppress
from pathlib import Path
from tempfile import NamedTemporaryFile

BACKUP_LOCK_ID = 732019
RUN_ID_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_USAGE = 2
EXIT_BUSY = 3

MANUAL_FLAGS = frozenset({"--manual", "--force", "-f"})


def is_manual_mode(argv: list[str]) -> bool:
    if os.getenv("BACKUP_FORCE", "0") == "1":
        return True
    if os.getenv("BACKUP_MANUAL", "0") == "1":
        return True
    return any(arg in MANUAL_FLAGS for arg in argv[1:])


def split_manual_args(argv: list[str]) -> tuple[bool, list[str]]:
    manual = is_manual_mode(argv)
    rest = [arg for arg in argv[1:] if arg not in MANUAL_FLAGS]
    return manual, rest


def marker_written_after_start() -> bool:
    raw_threshold = os.getenv("BACKUP_SKIP_IF_MARKER_AFTER_NS", "").strip()
    if not raw_threshold:
        return False
    try:
        threshold = int(raw_threshold)
    except ValueError:
        print("[backup-lock] invalid marker threshold", file=sys.stderr)
        return False

    marker = Path(os.getenv("BACKUP_FRESHNESS_MARKER", "/backups/.backup-freshness"))
    try:
        return marker.stat().st_mtime_ns >= threshold
    except FileNotFoundError:
        return False
    except OSError:
        return False


def migration_backup_already_done() -> bool:
    run_id = os.getenv("BACKUP_RUN_ID", "").strip()
    if not run_id:
        return False
    marker = Path(
        os.getenv("BACKUP_PRE_MIGRATION_MARKER", "/backups/.pre-migration-backup")
    )
    try:
        return marker.read_text(encoding="ascii").strip() == run_id
    except FileNotFoundError:
        return False
    except (OSError, UnicodeError):
        return False


def mark_migration_backup_done() -> bool:
    run_id = os.getenv("BACKUP_RUN_ID", "").strip()
    if not run_id:
        return True
    marker = Path(
        os.getenv("BACKUP_PRE_MIGRATION_MARKER", "/backups/.pre-migration-backup")
    )
    temporary_name: str | None = None
    try:
        marker.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(
            mode="w",
            encoding="ascii",
            dir=marker.parent,
            prefix=f".{marker.name}.",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            temporary.write(f"{run_id}\n")
        os.chmod(temporary_name, 0o600)
        os.replace(temporary_name, marker)
        os.chmod(marker, 0o600)
    except OSError:
        if temporary_name is not None:
            with suppress(OSError):
                os.unlink(temporary_name)
        return False
    return True


async def main(argv: list[str]) -> int:
    manual, rest = split_manual_args(argv)
    if not rest:
        print("usage: backup-lock.py [--manual] <backup-script> [args...]", file=sys.stderr)
        return EXIT_USAGE

    for arg in rest[:1]:
        if arg.startswith("-") and arg not in MANUAL_FLAGS:
            print(f"[backup-lock] unknown option: {arg}", file=sys.stderr)
            return EXIT_USAGE

    script = Path(rest[0])
    script_args = rest[1:]
    if not script.is_file():
        print(f"[backup-lock] script not found: {script}", file=sys.stderr)
        return EXIT_USAGE
    run_id = os.getenv("BACKUP_RUN_ID", "").strip()
    if run_id and any(character not in RUN_ID_CHARS for character in run_id):
        print("[backup-lock] invalid backup run id", file=sys.stderr)
        return EXIT_USAGE

    try:
        import asyncpg
    except ImportError:
        print("[backup-lock] asyncpg is unavailable; backup is not run unlocked", file=sys.stderr)
        return EXIT_ERROR

    try:
        connection = await asyncpg.connect(
            host=os.getenv("POSTGRES_HOST", "db"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            user=os.getenv("POSTGRES_USER", "technoz"),
            password=os.getenv("POSTGRES_PASSWORD", ""),
            database=os.getenv("POSTGRES_DB", "technozrelost"),
            timeout=float(os.getenv("BACKUP_LOCK_TIMEOUT_SECONDS", "10")),
        )
    except Exception:  # noqa: BLE001 - do not expose connection details or env values
        print("[backup-lock] database lock connection failed", file=sys.stderr)
        return EXIT_ERROR

    acquired = False
    try:
        try:
            acquired = bool(
                await connection.fetchval("SELECT pg_try_advisory_lock($1)", BACKUP_LOCK_ID)
            )
        except Exception:  # noqa: BLE001 - database errors must not reveal env values
            print("[backup-lock] advisory lock failed", file=sys.stderr)
            return EXIT_ERROR

        if not acquired:
            print(
                "[backup-lock] another backup is running; "
                "fail-closed: migrations blocked (exit 3)",
                file=sys.stderr,
            )
            return EXIT_BUSY
        if not manual:
            if migration_backup_already_done():
                print("[backup-lock] pre-migration backup already completed for this image; skip")
                return EXIT_OK
            if marker_written_after_start():
                print("[backup-lock] pre-migration backup already completed; skip")
                return EXIT_OK

        child_env = os.environ.copy()
        child_env["BACKUP_LOCK_HELD"] = "1"
        try:
            process = await asyncio.create_subprocess_exec(
                "/bin/sh",
                str(script),
                *script_args,
                env=child_env,
            )
            return_code = await process.wait()
        except OSError:
            print("[backup-lock] backup process failed to start", file=sys.stderr)
            return EXIT_ERROR
        if return_code == 0 and not manual and not mark_migration_backup_done():
            print("[backup-lock] could not publish backup run marker", file=sys.stderr)
            return EXIT_ERROR
        return return_code
    finally:
        if acquired:
            with suppress(Exception):
                await connection.execute("SELECT pg_advisory_unlock($1)", BACKUP_LOCK_ID)
        with suppress(Exception):
            await connection.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv)))
