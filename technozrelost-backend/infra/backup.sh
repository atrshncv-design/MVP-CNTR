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
# Маркеры для алертера (контракт interfaces.md, тикет INF-01/INF-04):
#   BACKUP_FRESHNESS_MARKER — путь файла; после ПОЛНОГО успеха сюда пишется
#     одна строка ISO-8601 UTC с офсетом (напр. 2026-08-26T03:15:02+00:00).
#     Отсутствие файла или возраст сверх порога алертера = авария.
#     По умолчанию <BACKUP_DIR>/.backup-freshness.
#   BACKUP_OFFSITE_MARKER — путь файла статуса offsite-шага: "<status> <ISO>"
#     одной строкой, status ∈ ok | warn | fail:
#       ok   — архив скопирован на удалённый таргет;
#       warn — таргет не настроен (BACKUP_OFFSITE_REMOTE пуст) — жёлтый;
#       fail — rclone недоступен или копирование упало — красный.
#     По умолчанию <BACKUP_DIR>/.offsite-status.
#
# Скрипт работает и на хосте, и внутри backend-контейнера (вызов из
# backend-entrypoint.sh перед миграциями): pg_dump напрямую, либо через
# `docker exec` в контейнер Primary, если pg_dump в PATH нет.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT="$BACKUP_DIR/$TS"
FRESHNESS_MARKER="${BACKUP_FRESHNESS_MARKER:-$BACKUP_DIR/.backup-freshness}"
OFFSITE_MARKER="${BACKUP_OFFSITE_MARKER:-$BACKUP_DIR/.offsite-status}"
OFFSITE_REMOTE="${BACKUP_OFFSITE_REMOTE:-}"

DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-technoz}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"
DB_NAME="${POSTGRES_DB:-technozrelost}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-127.0.0.1:9000}"
MINIO_URL="${MINIO_URL:-http://$MINIO_ENDPOINT}"
MINIO_BUCKET="${MINIO_BUCKET:-technozrelost}"

mkdir -p "$SNAPSHOT/minio"

# Неудачный снапшот не оставляем: пустые каталоги без дампа маскируют
# отсутствие бэкапа и копятся в ротации.
BACKUP_OK=0
trap '[ "$BACKUP_OK" = 1 ] || { echo "[backup] откат: удаляю неполный снапшот $SNAPSHOT"; rm -rf "$SNAPSHOT"; }' EXIT

echo "[backup] снапшот: $SNAPSHOT"

# ── 1. PostgreSQL Primary ─────────────────────────────────────────────────────
dump_pg() {
  if command -v pg_dump >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
      -d "$DB_NAME" -Fc -f "$SNAPSHOT/pg_primary_$TS.dump"
  elif command -v docker >/dev/null 2>&1; then
    echo "[backup] pg_dump не найден — использую docker exec ${PG_CONTAINER:-tz-prod-db-primary}"
    docker exec -i -e PGPASSWORD="$DB_PASSWORD" "${PG_CONTAINER:-tz-prod-db-primary}" \
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
# Прямой конвейер find | xargs: xargs порождает процесс через execvp и не может
# вызвать shell-функцию (под set -eu это роняло бэкап вместе со снапшотом).
# Переносимо: GNU coreutils sha256sum либо BSD shasum (macOS). GNU xargs на
# пустом вводе запускает команду без аргументов — хешер читает stdin и висит
# на tty (BSD молча проходит), поэтому список проверяется на непустоту до xargs;
# `: >` гарантирует создание SHA256SUMS даже для пустого снапшота.
(
  cd "$SNAPSHOT" || exit 1
  : > SHA256SUMS
  if [ -n "$(find . -type f ! -name SHA256SUMS -print)" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      find . -type f ! -name SHA256SUMS -print0 | xargs -0 sha256sum >> SHA256SUMS
    else
      find . -type f ! -name SHA256SUMS -print0 | xargs -0 shasum -a 256 >> SHA256SUMS
    fi
  fi
)
echo "[backup] SHA256SUMS: готово"

# ── 4. Offsite-копия через rclone (INF-04) ────────────────────────────────────
# Необязательный шаг: выбор хранилища за заказчиком, поэтому пустой таргет —
# не ошибка бэкапа (warn), а вот падение копирования при настроенном таргете —
# fail. Локальный снапшот к этому моменту валиден и checksummed, поэтому
# неудача offsite не роняет backup.sh целиком.
iso_now() {
  # %z даёт смещение без двоеточия (+0000) на GNU и BSD; каноничная форма
  # с двоеточием удобнее алертеру и человеку.
  date -u +%Y-%m-%dT%H:%M:%S%z | sed -e 's/\([+-][0-9][0-9]\)\([0-9][0-9]\)$/\1:\2/'
}
write_offsite_marker() {
  printf '%s %s %s\n' "$1" "$(iso_now)" "$2" > "$OFFSITE_MARKER"
}
if [ -z "$OFFSITE_REMOTE" ]; then
  echo "[backup] ВНИМАНИЕ: BACKUP_OFFSITE_REMOTE не задан — offsite-копия отключена (алертер: жёлтый)" >&2
  write_offsite_marker warn "target-not-configured"
elif ! command -v rclone >/dev/null 2>&1; then
  echo "[backup] ОШИБКА: rclone не найден, а BACKUP_OFFSITE_REMOTE задан — offsite не выполнен" >&2
  write_offsite_marker fail "rclone-missing"
elif rclone copy "$SNAPSHOT" "$OFFSITE_REMOTE/$TS"; then
  echo "[backup] offsite: снапшот скопирован на $OFFSITE_REMOTE/$TS"
  write_offsite_marker ok "copied"
else
  echo "[backup] ОШИБКА: rclone copy завершился неудачей — offsite не выполнен" >&2
  write_offsite_marker fail "copy-failed"
fi

# ── 5. Ротация: оставить KEEP последних снапшотов ────────────────────────────
ls -1dt "$BACKUP_DIR"/20*/ 2>/dev/null | tail -n +"$((KEEP + 1))" |
  while read -r dir; do
    echo "[backup] ротация: удаляю $dir"
    rm -rf "$dir"
  done

BACKUP_OK=1

# Маркер свежести — ПОСЛЕДНИЙ шаг, строго после всех стадий (дамп, MinIO,
# суммы, offsite, ротация): его наличие означает полный успех снапшота.
# Пишется только при BACKUP_OK=1: trap выше удалил бы снапшот при провале,
# и «свежий» маркер без снапшота обманул бы алертер.
printf '%s\n' "$(iso_now)" > "$FRESHNESS_MARKER"
echo "[backup] готово: $SNAPSHOT (маркер: $FRESHNESS_MARKER)"
