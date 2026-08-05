#!/bin/sh
# Входная точка backend-контейнера (production-контур, тикет 18).
#   1) ждёт Primary (asyncpg), 2) применяет миграции под pg advisory lock
#      (несколько реплик backend не дерутся за alembic), 3) запускает uvicorn.
# App-слой stateless: один uvicorn-воркер на контейнер, масштабирование —
# репликами сервиса backend (deploy.replicas в docker-compose.prod.yml).
set -eu

export DB_HOST="${POSTGRES_HOST:-db}"
export DB_PORT="${POSTGRES_PORT:-5432}"
export DB_USER="${POSTGRES_USER:-technoz}"
export DB_PASSWORD="${POSTGRES_PASSWORD:-}"
export DB_NAME="${POSTGRES_DB:-technozrelost}"

echo "[entrypoint] ожидание Primary ${DB_HOST}:${DB_PORT}..."
i=0
until python - <<'PY'
import asyncio
import os
import sys

import asyncpg


async def main() -> int:
    try:
        conn = await asyncpg.connect(
            host=os.environ["DB_HOST"],
            port=int(os.environ["DB_PORT"]),
            user=os.environ["DB_USER"],
            password=os.environ.get("DB_PASSWORD", ""),
            database=os.environ["DB_NAME"],
            timeout=3,
        )
        await conn.close()
    except Exception:
        return 1
    return 0


sys.exit(asyncio.run(main()))
PY
do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[entrypoint] Primary недоступен после 60 попыток" >&2
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] Primary готов."

echo "[entrypoint] применяю миграции (advisory lock)..."
# BACKUP_BEFORE_MIGRATIONS=1 (env, default в prod-compose) — перед alembic
# выполняется infra/backup.sh (тикет 20). Бэкап делается ПОД advisory lock:
# при N репликах backend его выполнит только та реплика, что выиграла lock.
python - <<'PY'
import asyncio
import os
import sys

import asyncpg

MIGRATION_LOCK = 732018  # произвольный id; общий для всех реплик backend


async def run(cmd: list[str]) -> int:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    out, _ = await proc.communicate()
    if out:
        print(out.decode(errors="replace"), end="")
    return proc.returncode or 0


async def main() -> int:
    conn = await asyncpg.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        user=os.environ["DB_USER"],
        password=os.environ.get("DB_PASSWORD", ""),
        database=os.environ["DB_NAME"],
        timeout=10,
    )
    try:
        await conn.execute("SELECT pg_advisory_lock($1)", MIGRATION_LOCK)
    except Exception as exc:  # noqa: BLE001
        print(f"[entrypoint] не удалось взять advisory lock: {exc}", file=sys.stderr)
        await conn.close()
        return 1
    try:
        if os.environ.get("BACKUP_BEFORE_MIGRATIONS", "0") == "1":
            print("[entrypoint] резервное копирование перед миграциями...")
            backup_rc = await run(["/app/backup.sh"])
            if backup_rc != 0:
                print("[entrypoint] backup.sh завершился с ошибкой — миграции не применяю", file=sys.stderr)
                return backup_rc
        rc = await run(["alembic", "upgrade", "head"])
        if rc != 0:
            return rc
    finally:
        await conn.execute("SELECT pg_advisory_unlock($1)", MIGRATION_LOCK)
        await conn.close()
    return 0


sys.exit(asyncio.run(main()))
PY
echo "[entrypoint] миграции применены."

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
