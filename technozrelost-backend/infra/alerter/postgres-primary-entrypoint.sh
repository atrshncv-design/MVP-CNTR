#!/usr/bin/env bash
# Production-entrypoint Primary с подключённым профилем WAL/PITR.
# Штатный start-primary.sh фиксирует config_file и потому не принимает
# дополнительные параметры Compose; здесь сохраняется его жизненный цикл,
# но оба конфигурационных файла объединяются через include.
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER обязателен}"
export POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB обязателен}"

COMBINED_CONFIG=/tmp/postgresql-production.conf
{
  printf "include = '/etc/postgresql/postgresql.conf'\n"
  printf "include = '/etc/postgresql/postgresql-pitr.conf'\n"
} > "$COMBINED_CONFIG"

ARGS=(postgres -c "config_file=$COMBINED_CONFIG")

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
