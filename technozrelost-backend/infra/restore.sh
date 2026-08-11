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
# Переменные окружения — как в backup.sh (POSTGRES_*, MINIO_*, PG_CONTAINER).
# Для неинтерактивного запуска: RESTORE_CONFIRM=1 (без подтверждения).
set -eu

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
DB_PASSWORD="${POSTGRES_PASSWORD:-}"
DB_NAME="${POSTGRES_DB:-technozrelost}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-127.0.0.1:9000}"
MINIO_URL="${MINIO_URL:-http://$MINIO_ENDPOINT}"
MINIO_BUCKET="${MINIO_BUCKET:-technozrelost}"

echo "[restore] снапшот: $SNAPSHOT"
echo "[restore] проверка контрольных сумм (sha256sum -c)..."
( cd "$SNAPSHOT" && sha256sum -c SHA256SUMS )
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
PG_FILE="$(find "$SNAPSHOT" -maxdepth 1 -name 'pg_primary_*.dump' 2>/dev/null | head -1 || true)"
if [ -n "$PG_FILE" ]; then
  echo "[restore] PostgreSQL: восстанавливаю из $PG_FILE"
  if command -v pg_restore >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASSWORD" pg_restore --clean --if-exists \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$PG_FILE"
  elif command -v docker >/dev/null 2>&1; then
    echo "[restore] pg_restore не найден — использую docker exec ${PG_CONTAINER:-tz-prod-db-primary}"
    cat "$PG_FILE" | docker exec -i "${PG_CONTAINER:-tz-prod-db-primary}" \
      pg_restore --clean --if-exists -U "$DB_USER" -d "$DB_NAME"
  else
    echo "[restore] ОШИБКА: pg_restore и docker недоступны" >&2
    exit 1
  fi
  echo "[restore] PostgreSQL: готово"
else
  echo "[restore] PG-дамп не найден — пропускаю PostgreSQL"
fi

# ── 2. MinIO ──────────────────────────────────────────────────────────────────
restore_minio() {
  if command -v mc >/dev/null 2>&1; then
    MC_ALIAS="${MC_ALIAS:-tzbackup}"
    mc alias set "$MC_ALIAS" "$MINIO_URL" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1
    mc mirror --overwrite "$SNAPSHOT/minio/" "$MC_ALIAS/$MINIO_BUCKET"
  elif command -v python >/dev/null 2>&1; then
    MINIO_ENDPOINT="$MINIO_ENDPOINT" MINIO_ACCESS_KEY="$MINIO_ACCESS_KEY" \
      MINIO_SECRET_KEY="$MINIO_SECRET_KEY" MINIO_BUCKET="$MINIO_BUCKET" \
      python - "$SNAPSHOT/minio" <<'PY'
import os
import sys
from pathlib import Path

from minio import Minio

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
count = 0
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
if [ -d "$SNAPSHOT/minio" ]; then
  restore_minio
  echo "[restore] MinIO: готово"
else
  echo "[restore] каталог minio/ отсутствует — пропускаю MinIO"
fi

echo "[restore] готово."
