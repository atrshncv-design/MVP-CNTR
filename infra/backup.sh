#!/bin/sh
# Резервное копирование платформы «Технозрелость» (тикет 20).
#
# Покрывает:
#   1) PostgreSQL Primary — pg_dump (custom format, сжатый), имя pg_primary_<TS>.dump;
#   2) MinIO — зеркалирование бакета в <BACKUP_DIR>/<TS>/minio/
#      (предпочитается `mc mirror`, иначе python-клиент minio из venv проекта);
#   3) контрольные суммы SHA256 всех файлов снапшота — SHA256SUMS;
#   4) ротация: хранятся BACKUP_KEEP последних снапшотов (по умолчанию 14).
#
# Переменные окружения:
#   POSTGRES_HOST/POSTGRES_PORT/POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB
#     — подключение к Primary (совпадает с env prod-compose; в контейнере
#       backend эти переменные уже заданы).
#   MINIO_ENDPOINT (или MINIO_URL с схемой), MINIO_ACCESS_KEY, MINIO_SECRET_KEY,
#   MINIO_BUCKET — объектное хранилище.
#   BACKUP_DIR — каталог снапшотов (по умолчанию /backups).
#   BACKUP_KEEP — сколько снапшотов хранить (по умолчанию 14).
#   BACKUP_STRICT_MINIO=1 — падать, если MinIO не скопирован (иначе только warning).
#   PG_CONTAINER — имя контейнера Primary для docker-фолбэка (по умолчанию tz-prod-db-primary).
#
# Скрипт работает и на хосте, и внутри backend-контейнера (вызов из
# backend-entrypoint.sh перед миграциями): pg_dump напрямую, либо через
# `docker exec` в контейнер Primary, если pg_dump в PATH нет.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT="$BACKUP_DIR/$TS"

DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-technoz}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"
DB_NAME="${POSTGRES_DB:-technozrelost}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-127.0.0.1:9000}"
MINIO_URL="${MINIO_URL:-http://$MINIO_ENDPOINT}"
MINIO_BUCKET="${MINIO_BUCKET:-technozrelost}"

mkdir -p "$SNAPSHOT/minio"

echo "[backup] снапшот: $SNAPSHOT"

# ── 1. PostgreSQL Primary ─────────────────────────────────────────────────────
dump_pg() {
  if command -v pg_dump >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
      -d "$DB_NAME" -Fc -f "$SNAPSHOT/pg_primary_$TS.dump"
  elif command -v docker >/dev/null 2>&1; then
    echo "[backup] pg_dump не найден — использую docker exec ${PG_CONTAINER:-tz-prod-db-primary}"
    docker exec -i "${PG_CONTAINER:-tz-prod-db-primary}" \
      pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" -Fc \
      > "$SNAPSHOT/pg_primary_$TS.dump"
  else
    echo "[backup] ОШИБКА: pg_dump и docker недоступны — бэкап БД невозможен" >&2
    return 1
  fi
}
dump_pg
echo "[backup] PostgreSQL: готово"

# ── 2. MinIO ──────────────────────────────────────────────────────────────────
backup_minio() {
  if command -v mc >/dev/null 2>&1; then
    MC_ALIAS="${MC_ALIAS:-tzbackup}"
    mc alias set "$MC_ALIAS" "$MINIO_URL" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1
    mc mirror --overwrite "$MC_ALIAS/$MINIO_BUCKET" "$SNAPSHOT/minio/"
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
dest = Path(sys.argv[1])
dest.mkdir(parents=True, exist_ok=True)
count = 0
for obj in client.list_objects(bucket, recursive=True):
    target = dest / obj.object_name
    target.parent.mkdir(parents=True, exist_ok=True)
    with client.get_object(bucket, obj.object_name) as resp, open(target, "wb") as fh:
        fh.write(resp.read())
    count += 1
print(f"[backup] minio: {count} объектов скопировано")
PY
  else
    echo "[backup] ВНИМАНИЕ: mc и python недоступны — MinIO не скопирован" >&2
    return 1
  fi
}
if backup_minio; then
  echo "[backup] MinIO: готово"
elif [ "${BACKUP_STRICT_MINIO:-0}" = "1" ]; then
  echo "[backup] ОШИБКА: MinIO не скопирован (BACKUP_STRICT_MINIO=1)" >&2
  exit 1
else
  echo "[backup] ПРОДОЛЖАЮ без MinIO (задайте BACKUP_STRICT_MINIO=1, чтобы падать)"
fi

# ── 3. Контрольные суммы ─────────────────────────────────────────────────────
(
  cd "$SNAPSHOT" || exit 1
  find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS
)
echo "[backup] SHA256SUMS: готово"

# ── 4. Ротация: оставить KEEP последних снапшотов ────────────────────────────
ls -1dt "$BACKUP_DIR"/20*/ 2>/dev/null | tail -n +"$((KEEP + 1))" |
  while read -r dir; do
    echo "[backup] ротация: удаляю $dir"
    rm -rf "$dir"
  done

echo "[backup] готово: $SNAPSHOT"
