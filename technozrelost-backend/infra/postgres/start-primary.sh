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
ARGS=(postgres -c config_file=/etc/postgresql/postgresql.conf)

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  exec docker-entrypoint.sh "${ARGS[@]}"
fi

docker-entrypoint.sh "${ARGS[@]}" &
PG_PID=$!
trap 'kill -TERM "$PG_PID" 2>/dev/null || true' TERM INT

echo "[primary] существующий том: ожидаю готовности PostgreSQL..."
i=0
until pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
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
