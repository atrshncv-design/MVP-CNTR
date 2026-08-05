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
python - <<'PY'
import asyncio
import os
import sys

import asyncpg

MIGRATION_LOCK = 732018  # произвольный id; общий для всех реплик backend


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
        proc = await asyncio.create_subprocess_exec(
            "alembic",
            "upgrade",
            "head",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        out, _ = await proc.communicate()
        if proc.returncode != 0:
            print(out.decode(errors="replace"), file=sys.stderr)
            return proc.returncode
    finally:
        await conn.execute("SELECT pg_advisory_unlock($1)", MIGRATION_LOCK)
        await conn.close()
    return 0


sys.exit(asyncio.run(main()))
PY
echo "[entrypoint] миграции применены."

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
