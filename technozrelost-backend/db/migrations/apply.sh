#!/usr/bin/env bash
# Применяет SQL-миграции напрямую через psql (без Alembic).
# Используется для CI/ручного аудита. Источник истины в рантайме — Alembic.
set -euo pipefail

DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-technoz}"
DB_NAME="${POSTGRES_DB:-technozrelost}"
SQL_DIR="$(cd "$(dirname "$0")/sql" && pwd)"

export PGPASSWORD="${POSTGRES_PASSWORD:-change_me}"

for f in "$SQL_DIR"/*.sql; do
  name="$(basename "$f")"
  echo "[apply] $name"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$f"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "INSERT INTO public.db_migration_log (filename) VALUES ('$name') ON CONFLICT DO NOTHING;"
done
echo "[apply] done"