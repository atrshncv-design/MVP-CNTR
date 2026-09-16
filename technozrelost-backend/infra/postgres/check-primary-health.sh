#!/bin/bash
# Проверяет доступность primary и завершённую ротацию credential.
# P1 (таск 01): проверка физического слота — только при непустом REPL_SLOT
# (HA-контур). На одноузловом контуре REPL_SLOT пуст и слот не проверяется.
# SQL идёт через stdin: psql подставляет переменную только при таком разборе.
set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER обязателен}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB обязателен}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}"
REPL_SLOT="${REPL_SLOT:-}"
REPLICATION_READY_FILE="${REPLICATION_READY_FILE:-/tmp/technozrelost-replication-ready}"

# Не позволяем значению окружения превращаться в дополнительные параметры
# psql или в другой идентификатор слота.
case "$REPL_SLOT" in
  '')
    # P1: слота нет — пропускаем проверку слота.
    ;;
  *[!A-Za-z0-9._-]*)
    echo "[primary] ОШИБКА: недопустимое имя REPL_SLOT" >&2
    exit 2
    ;;
esac

PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -q \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB"

[ -f "$REPLICATION_READY_FILE" ]

if [ -z "$REPL_SLOT" ]; then
  exit 0
fi

result="$({
  printf '%s\n' \
    "SELECT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = :'slot');"
} | PGPASSWORD="$POSTGRES_PASSWORD" psql -X -w \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -v "slot=$REPL_SLOT" \
  -Atq)"

[ "$result" = "t" ]
