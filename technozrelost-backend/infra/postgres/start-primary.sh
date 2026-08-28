#!/bin/bash
# Точка входа primary (аудит-тикет 05): единый путь для пустого и существующего тома.
#   пустой том       — официальный entrypoint делает initdb + initdb.d/*.sh
#                      (там 10-init.sh вызовет ensure-replication.sh);
#   существующий том — старт в фоне, ожидание готовности, затем идемпотентный
#                      ensure-replication.sh: роль replicator и слот создаются,
#                      даже если том создан до появления init-скрипта.
# SIGTERM пробрасывается в postgres — корректный останов без SIGKILL.
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER обязателен}"
export POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB обязателен}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}"
export PGPASSWORD="$POSTGRES_PASSWORD"
export REPLICATION_READY_FILE="${REPLICATION_READY_FILE:-/tmp/technozrelost-replication-ready}"
rm -f "$REPLICATION_READY_FILE"
ARGS=(postgres -c config_file=/etc/postgresql/postgresql.conf)

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  exec docker-entrypoint.sh "${ARGS[@]}"
fi

docker-entrypoint.sh "${ARGS[@]}" &
PG_PID=$!
trap 'kill -TERM "$PG_PID" 2>/dev/null || true' TERM INT

echo "[primary] существующий том: ожидаю готовности PostgreSQL..."
i=0
until PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  && PGPASSWORD="$POSTGRES_PASSWORD" psql -X -w -qAt -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" -c 'SELECT 1' >/dev/null 2>&1; do
  i=$((i + 1))
  if ! kill -0 "$PG_PID" 2>/dev/null; then
    echo "[primary] postgres завершился во время старта" >&2
    exit 1
  fi
  if [ "$i" -ge 60 ]; then
    echo "[primary] PostgreSQL не готов после 60 попыток" >&2
    exit 1
  fi
  sleep 1
done

/usr/local/bin/ensure-replication.sh

wait "$PG_PID"
