#!/bin/sh
# Восстановление платформы «Технозрелость» из снапшота (тикет 20).
#
# Использование:
#   ./restore.sh <snapshot_dir>        — полное восстановление
#   RESTORE_SNAPSHOT=<dir> ./restore.sh
#
# Обязательный шаг — проверка контрольных сумм (sha256sum -c SHA256SUMS)
# ДО применения: при несовпадении скрипт останавливается и ничего не трогает.
#
# Восстанавливает:
#   1) PostgreSQL Primary — pg_restore --clean --if-exists (custom-формат);
#   2) MinIO — зеркалирование каталога minio/ обратно в бакет.
#
# Каталог pg_basebackup/ из того же снапшота сохраняется для PITR, но намеренно
# не копируется этим скриптом в живой PGDATA: physical restore выполняется на
# чистом кластере по процедуре P3 в RUNBOOK-DATA.md.
#
# Переменные окружения — как в backup.sh (POSTGRES_*, MINIO_*, PG_CONTAINER).
# Для неинтерактивного запуска: RESTORE_CONFIRM=1 (без подтверждения).
set -eu
umask 077

SNAPSHOT="${1:-${RESTORE_SNAPSHOT:-}}"
if [ -z "$SNAPSHOT" ]; then
  echo "Использование: $0 <snapshot_dir> (или RESTORE_SNAPSHOT=<dir>)" >&2
  exit 2
fi
if [ ! -f "$SNAPSHOT/SHA256SUMS" ]; then
  echo "[restore] ОШИБКА: $SNAPSHOT/SHA256SUMS не найден — это не снапшот" >&2
  exit 2
fi

DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-technoz}"
DB_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}"
DB_NAME="${POSTGRES_DB:-technozrelost}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-127.0.0.1:9000}"
MINIO_URL="${MINIO_URL:-http://$MINIO_ENDPOINT}"
MINIO_BUCKET="${MINIO_BUCKET:-technozrelost}"
MC_HOST_URL_SCRIPT="${MC_HOST_URL_SCRIPT:-$(dirname "$0")/mc-host-url.py}"

# R06i группа F (таск 16): восстановление только по полному снимку в пустую БД.
# Все проверки ниже — до любых изменений (fail-closed): при неполном или
# двусмысленном снимке и при непустой целевой БД скрипт падает до pg_restore
# и до зеркалирования MinIO, не оставляя чужих объектов.
require_empty_database() {
  # Пустая БД = нет пользовательских таблиц вне pg_catalog/information_schema.
  # Любая строка означает эволюционировавшую БД: restore отказался бы оставить
  # чужие объекты после pg_restore --clean, поэтому требуем пустоту заранее.
  empty_query="SELECT 1 FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') LIMIT 1;"
  if command -v psql >/dev/null 2>&1; then
    query_out="$(printf '%s\n' "$empty_query" | PGPASSWORD="$DB_PASSWORD" psql -X -w -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atq 2>/dev/null || true)"
    # Непроверяемая БД = непустая для fail-closed: без доказательства пустоты
    # восстановление запрещено, иначе чужие объекты останутся молча.
    if [ -z "${query_out:-}" ]; then
      # psql мог упасть (нет связи) либо БД действительно пуста. Различаем по
      # коду: повтор с проверкой доступности.
      if ! printf '%s\n' "$empty_query" | PGPASSWORD="$DB_PASSWORD" psql -X -w -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atq >/dev/null 2>&1; then
        echo "[restore] ОШИБКА: не могу проверить пустоту БД — restore запрещён" >&2
        return 1
      fi
      return 0
    fi
    if printf '%s' "$query_out" | grep -q "1"; then
      echo "[restore] ОШИБКА: целевая БД не пуста — restore только в пустую БД" >&2
      return 1
    fi
    return 0
  elif command -v docker >/dev/null 2>&1; then
    query_out="$(printf '%s\n' "$empty_query" | docker exec -i "${PG_CONTAINER:-tz-prod-db-primary}" sh -c 'PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}" psql -X -w -U "$1" -d "$2" -Atq' sh "$DB_USER" "$DB_NAME" 2>/dev/null || true)"
    if [ -z "${query_out:-}" ]; then
      if ! printf '%s\n' "$empty_query" | docker exec -i "${PG_CONTAINER:-tz-prod-db-primary}" sh -c 'PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}" psql -X -w -U "$1" -d "$2" -Atq' sh "$DB_USER" "$DB_NAME" >/dev/null 2>&1; then
        echo "[restore] ОШИБКА: не могу проверить пустоту БД — restore запрещён" >&2
        return 1
      fi
      return 0
    fi
    if printf '%s' "$query_out" | grep -q "1"; then
      echo "[restore] ОШИБКА: целевая БД не пуста — restore только в пустую БД" >&2
      return 1
    fi
    return 0
  else
    echo "[restore] ОШИБКА: psql и docker недоступны — не могу проверить пустоту БД" >&2
    return 1
  fi
}

if [ ! -d "$SNAPSHOT/minio" ]; then
  echo "[restore] ОШИБКА: $SNAPSHOT/minio не найден — exact MinIO restore невозможен" >&2
  exit 2
fi

# Полнота снимка до любых изменений: ровно один logical dump и physical base.
# Ноль дампов = неполный снимок (раньше молча пропускался); больше одного =
# двусмысленный снимок (раньше молча брался первый). Оба случая — отказ.
DUMP_COUNT="$(find "$SNAPSHOT" -maxdepth 1 -name 'pg_primary_*.dump' 2>/dev/null | wc -l | tr -d '[:space:]')"
case "$DUMP_COUNT" in
  ''|*[!0-9]*)
    echo "[restore] ОШИБКА: не могу подсчитать дампы снимка" >&2
    exit 2
    ;;
esac
if [ "$DUMP_COUNT" -eq 0 ]; then
  echo "[restore] ОШИБКА: неполный снимок — pg_primary_*.dump не найден" >&2
  exit 2
fi
if [ "$DUMP_COUNT" -gt 1 ]; then
  echo "[restore] ОШИБКА: двусмысленный снимок — найдено $DUMP_COUNT дампов pg_primary_*.dump" >&2
  exit 2
fi
if [ ! -s "$SNAPSHOT/pg_basebackup/PG_VERSION" ]; then
  echo "[restore] ОШИБКА: неполный снимок — pg_basebackup/PG_VERSION отсутствует" >&2
  exit 2
fi

# Пустота целевой БД — до контрольных сумм и до любых изменений.
if ! require_empty_database; then
  exit 2
fi

echo "[restore] снапшот: $SNAPSHOT"
echo "[restore] проверка контрольных сумм..."
if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$SNAPSHOT" && sha256sum -c SHA256SUMS )
else
  ( cd "$SNAPSHOT" && shasum -a 256 -c SHA256SUMS )
fi
echo "[restore] контрольные суммы OK."

echo "ВНИМАНИЕ: восстановление ПЕРЕЗАПИШЕТ текущие данные PostgreSQL и MinIO."
if [ "${RESTORE_CONFIRM:-0}" != "1" ]; then
  printf "Продолжить? [y/N] "
  read -r answer
  case "$answer" in
    y | Y | yes | Yes | YES) ;;
    *)
      echo "[restore] отменено."
      exit 1
      ;;
  esac
fi

# ── 1. PostgreSQL Primary ─────────────────────────────────────────────────────
# Снимок уже проверен выше: ровно один dump, поэтому head -1 детерминирован.
PG_FILE="$(find "$SNAPSHOT" -maxdepth 1 -name 'pg_primary_*.dump' 2>/dev/null | head -1 || true)"
if [ -z "$PG_FILE" ]; then
  echo "[restore] ОШИБКА: неполный снимок — pg_primary_*.dump исчез после проверки" >&2
  exit 2
fi
if [ -n "$PG_FILE" ]; then
  echo "[restore] PostgreSQL: восстанавливаю из $PG_FILE"
  if command -v pg_restore >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASSWORD" pg_restore --no-password --clean --if-exists \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$PG_FILE"
  elif command -v docker >/dev/null 2>&1; then
    echo "[restore] pg_restore не найден — использую docker exec ${PG_CONTAINER:-tz-prod-db-primary}"
    docker exec -i "${PG_CONTAINER:-tz-prod-db-primary}" \
      sh -c 'PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}" pg_restore --no-password --clean --if-exists -U "$1" -d "$2"' \
      sh "$DB_USER" "$DB_NAME" < "$PG_FILE"
  else
    echo "[restore] ОШИБКА: pg_restore и docker недоступны" >&2
    exit 1
  fi
  echo "[restore] PostgreSQL: готово"
else
  echo "[restore] ОШИБКА: неполный снимок — pg_primary_*.dump не найден" >&2
  exit 2
fi

# ── 2. MinIO ──────────────────────────────────────────────────────────────────
configure_mc_alias() {
  MC_ALIAS="${MC_ALIAS:-tzbackup}"
  case "$MC_ALIAS" in
    ''|*[!A-Za-z0-9_-]*)
      echo "[restore] ОШИБКА: недопустимое имя MC_ALIAS" >&2
      return 1
      ;;
  esac

  MC_HOST_VAR="MC_HOST_$MC_ALIAS"
  # MC_HOST_* передаёт credentials через окружение, а не через argv.
  if [ -n "$(printenv "$MC_HOST_VAR" 2>/dev/null || true)" ]; then
    return 0
  fi
  if command -v python >/dev/null 2>&1 && [ -f "$MC_HOST_URL_SCRIPT" ]; then
    MC_HOST_URL="$({
      MINIO_URL="$MINIO_URL" MINIO_ACCESS_KEY="$MINIO_ACCESS_KEY" \
        MINIO_SECRET_KEY="$MINIO_SECRET_KEY" python "$MC_HOST_URL_SCRIPT"
    })" || return 1
    [ -n "$MC_HOST_URL" ] || return 1
    export "$MC_HOST_VAR=$MC_HOST_URL"
    return 0
  fi

  # Legacy host-only fallback: production image has python; this branch is
  # только для ручного запуска с отдельно установленным mc.
  mc alias set "$MC_ALIAS" "$MINIO_URL" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" \
    >/dev/null 2>&1
}

restore_minio() {
  if command -v mc >/dev/null 2>&1; then
    configure_mc_alias || return 1
    mc mb --ignore-existing "$MC_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1
    mc ls "$MC_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1
    # --remove даёт exact semantics: объекты, которых нет в snapshot, удаляются.
    mc mirror --overwrite --remove "$SNAPSHOT/minio/" "$MC_ALIAS/$MINIO_BUCKET"
  elif command -v python >/dev/null 2>&1; then
    MINIO_ENDPOINT="$MINIO_ENDPOINT" MINIO_ACCESS_KEY="$MINIO_ACCESS_KEY" \
      MINIO_SECRET_KEY="$MINIO_SECRET_KEY" MINIO_BUCKET="$MINIO_BUCKET" \
      python - "$SNAPSHOT/minio" <<'PY'
import os
import sys
from pathlib import Path

from minio import Minio
from minio.error import S3Error

endpoint = os.environ.get("MINIO_ENDPOINT", "127.0.0.1:9000")
if "://" in endpoint:
    endpoint = endpoint.split("://", 1)[1]
client = Minio(
    endpoint,
    access_key=os.environ["MINIO_ACCESS_KEY"],
    secret_key=os.environ["MINIO_SECRET_KEY"],
    secure=(os.environ.get("MINIO_SECURE", "0") == "1"),
)
bucket = os.environ.get("MINIO_BUCKET", "technozrelost")
src = Path(sys.argv[1])
if not src.is_dir():
    raise RuntimeError("MinIO snapshot directory is missing")
if not client.bucket_exists(bucket):
    try:
        client.make_bucket(bucket)
    except S3Error as exc:
        if exc.code not in {"BucketAlreadyExists", "BucketAlreadyOwnedByYou"}:
            raise
if not client.bucket_exists(bucket):
    raise RuntimeError("MinIO bucket is not available after ensure")
count = 0
for obj in client.list_objects(bucket, recursive=True):
    client.remove_object(bucket, obj.object_name)
for path in sorted(src.rglob("*")):
    if not path.is_file():
        continue
    key = str(path.relative_to(src))
    with open(path, "rb") as fh:
        client.put_object(bucket, key, fh, length=path.stat().st_size)
    count += 1
print(f"[restore] minio: {count} объектов загружено")
PY
  else
    echo "[restore] ОШИБКА: mc и python недоступны — MinIO не восстановлен" >&2
    return 1
  fi
}
restore_minio
echo "[restore] MinIO: готово"

echo "[restore] готово."
