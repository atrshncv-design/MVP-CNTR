#!/bin/sh
# Резервное копирование платформы «Технозрелость» (тикет 20).
#
# Покрывает:
#   1) PostgreSQL Primary — pg_dump (custom format, сжатый), имя pg_primary_<TS>.dump;
#   2) PostgreSQL Primary — физический pg_basebackup в
#      <BACKUP_DIR>/<TS>/pg_basebackup/ для PITR;
#   3) MinIO — зеркалирование бакета в <BACKUP_DIR>/<TS>/minio/
#      (предпочитается `mc mirror`, иначе python-клиент minio из venv проекта);
#   4) контрольные суммы SHA256 всех файлов снапшота — SHA256SUMS;
#   5) ротация: хранятся BACKUP_KEEP последних снапшотов (по умолчанию 14).
#
# Переменные окружения:
#   POSTGRES_HOST/POSTGRES_PORT/POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB
#     — подключение к Primary (совпадает с env prod-compose; в контейнере
#       backend эти переменные уже заданы).
#   REPL_USER/REPL_PASSWORD — учётные данные роли с атрибутом REPLICATION для
#     физического pg_basebackup; пароль обязателен, чтобы не допустить
#     «успешный» снапшот без пригодной для PITR базы.
#   MINIO_ENDPOINT (или MINIO_URL с схемой), MINIO_ACCESS_KEY, MINIO_SECRET_KEY,
#   MINIO_BUCKET — объектное хранилище.
#   BACKUP_DIR — каталог снапшотов (по умолчанию /backups).
#   BACKUP_KEEP — сколько снапшотов хранить (по умолчанию 14).
#   BACKUP_STRICT_MINIO=1 — падать, если MinIO не скопирован (значение по умолчанию);
#                          0 разрешён только для локальной диагностики.
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
#   RCLONE_CONFIG — необязательный путь к конфигурации rclone (в production
#     передаётся из read-only named volume).
#   RCLONE_GUARD_SCRIPT — путь к общему crypt-guard (по умолчанию
#     /app/infra/cron/check-rclone-crypt.sh).
#
# Скрипт работает и на хосте, и внутри backend-контейнера (вызов из
# backend-entrypoint.sh перед миграциями): pg_dump напрямую, либо через
# `docker exec` в контейнер Primary, если pg_dump в PATH нет.
set -eu
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP:-14}"
case "$KEEP" in
  ''|*[!0-9]*)
    echo "[backup] ОШИБКА: BACKUP_KEEP должен быть целым числом" >&2
    exit 2
    ;;
esac
if [ "$KEEP" -lt 1 ]; then
  echo "[backup] ОШИБКА: BACKUP_KEEP должен быть положительным" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
# mktemp атомарно резервирует каталог. Это исключает коллизию одинаковых
# секунд между двумя контейнерами и не позволяет EXIT trap удалить чужой dump.
SNAPSHOT="$(mktemp -d "$BACKUP_DIR/${TS}.XXXXXX")"
SNAPSHOT_NAME="${SNAPSHOT##*/}"
FRESHNESS_MARKER="${BACKUP_FRESHNESS_MARKER:-$BACKUP_DIR/.backup-freshness}"
OFFSITE_MARKER="${BACKUP_OFFSITE_MARKER:-$BACKUP_DIR/.offsite-status}"
OFFSITE_REMOTE="${BACKUP_OFFSITE_REMOTE:-}"
RCLONE_CONFIG="${RCLONE_CONFIG:-}"
RCLONE_GUARD_SCRIPT="${RCLONE_GUARD_SCRIPT:-/app/infra/cron/check-rclone-crypt.sh}"
MC_HOST_URL_SCRIPT="${MC_HOST_URL_SCRIPT:-$(dirname "$0")/mc-host-url.py}"

DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-technoz}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"
DB_NAME="${POSTGRES_DB:-technozrelost}"
REPL_USER="${REPL_USER:-replicator}"
REPL_PASSWORD="${REPL_PASSWORD:-}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-127.0.0.1:9000}"
MINIO_URL="${MINIO_URL:-http://$MINIO_ENDPOINT}"
MINIO_BUCKET="${MINIO_BUCKET:-technozrelost}"

mkdir -p "$SNAPSHOT/minio" "$SNAPSHOT/pg_basebackup" \
  "$(dirname "$FRESHNESS_MARKER")" "$(dirname "$OFFSITE_MARKER")"
chmod 700 "$SNAPSHOT" "$SNAPSHOT/minio" "$SNAPSHOT/pg_basebackup"

# Неудачный снапшот не оставляем: пустые каталоги без дампа маскируют
# отсутствие бэкапа и копятся в ротации.
BACKUP_OK=0
CHECKSUM_INPUT=""
ROTATION_LIST=""
ROTATION_SORTED=""
cleanup() {
  if [ -n "$CHECKSUM_INPUT" ]; then rm -f -- "$CHECKSUM_INPUT"; fi
  if [ -n "$ROTATION_LIST" ]; then rm -f -- "$ROTATION_LIST"; fi
  if [ -n "$ROTATION_SORTED" ]; then rm -f -- "$ROTATION_SORTED"; fi
  if [ "$BACKUP_OK" != 1 ]; then
    echo "[backup] откат: удаляю неполный снапшот $SNAPSHOT"
    rm -rf -- "$SNAPSHOT"
  fi
}
trap cleanup EXIT

echo "[backup] снапшот: $SNAPSHOT"

# ── 1. PostgreSQL Primary ─────────────────────────────────────────────────────
dump_pg() {
  if command -v pg_dump >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
      -d "$DB_NAME" -Fc -f "$SNAPSHOT/pg_primary_$SNAPSHOT_NAME.dump"
  elif command -v docker >/dev/null 2>&1; then
    echo "[backup] pg_dump не найден — использую docker exec ${PG_CONTAINER:-tz-prod-db-primary}"
    # Пароль уже находится в env целевого PostgreSQL-контейнера; не передаём
    # его через argv локального docker-клиента.
    docker exec -i "${PG_CONTAINER:-tz-prod-db-primary}" \
      sh -c 'PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}" pg_dump --no-password -h localhost -U "$1" -d "$2" -Fc' \
      sh "$DB_USER" "$DB_NAME" \
      > "$SNAPSHOT/pg_primary_$SNAPSHOT_NAME.dump"
  else
    echo "[backup] ОШИБКА: pg_dump и docker недоступны — бэкап БД невозможен" >&2
    return 1
  fi
}
dump_pg
echo "[backup] PostgreSQL: готово"

# Физическая база обязательна: один только pg_dump не даёт PITR. Ключ -X
# stream включает WAL, необходимый для восстановления согласованного снимка.
# -w запрещает интерактивный запрос пароля: таймер не должен зависать при
# неполной конфигурации или ошибке учётных данных.
basebackup_pg() {
  if ! command -v pg_basebackup >/dev/null 2>&1; then
    echo "[backup] ОШИБКА: pg_basebackup недоступен — физическая база для PITR не создана" >&2
    return 1
  fi
  if [ -z "$REPL_PASSWORD" ]; then
    echo "[backup] ОШИБКА: REPL_PASSWORD не задан — физическая база для PITR не создана" >&2
    return 1
  fi
  PGPASSWORD="$REPL_PASSWORD" pg_basebackup \
    -h "$DB_HOST" -p "$DB_PORT" -U "$REPL_USER" \
    -D "$SNAPSHOT/pg_basebackup" -Fp -X stream -P -w
}
basebackup_pg
echo "[backup] PostgreSQL physical base backup: готово"

# ── 3. MinIO ──────────────────────────────────────────────────────────────────
configure_mc_alias() {
  MC_ALIAS="${MC_ALIAS:-tzbackup}"
  case "$MC_ALIAS" in
    ''|*[!A-Za-z0-9_-]*)
      echo "[backup] ОШИБКА: недопустимое имя MC_ALIAS" >&2
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

  # Legacy host-only fallback: production image has python, so this branch is
  # только для ручного запуска с отдельно установленным mc.
  mc alias set "$MC_ALIAS" "$MINIO_URL" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" \
    >/dev/null 2>&1
}

backup_minio() {
  if command -v mc >/dev/null 2>&1; then
    configure_mc_alias || return 1
    # `mb --ignore-existing` одинаково безопасен для нового и уже созданного
    # бакета; отдельный `ls` подтверждает доступность перед зеркалированием.
    if ! mc mb --ignore-existing "$MC_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1; then
      return 1
    fi
    if ! mc ls "$MC_ALIAS/$MINIO_BUCKET" >/dev/null 2>&1; then
      return 1
    fi
    if ! mc mirror --overwrite "$MC_ALIAS/$MINIO_BUCKET" "$SNAPSHOT/minio/"; then
      return 1
    fi
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
dest = Path(sys.argv[1])
dest.mkdir(parents=True, exist_ok=True)
if not client.bucket_exists(bucket):
    try:
        client.make_bucket(bucket)
    except S3Error as exc:
        # Другой старт мог создать бакет между HEAD и PUT; это не ошибка,
        # но остальные ошибки MinIO должны прервать строгий бэкап.
        if exc.code not in {"BucketAlreadyExists", "BucketAlreadyOwnedByYou"}:
            raise
if not client.bucket_exists(bucket):
    raise RuntimeError("MinIO bucket is not available after ensure")
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
elif [ "${BACKUP_STRICT_MINIO:-1}" = "1" ]; then
  echo "[backup] ОШИБКА: MinIO не скопирован (BACKUP_STRICT_MINIO=1)" >&2
  exit 1
else
  echo "[backup] ПРОДОЛЖАЮ без MinIO (BACKUP_STRICT_MINIO=0 — только локальная диагностика)"
fi

# ── 4. Контрольные суммы ─────────────────────────────────────────────────────
# Прямой конвейер find | xargs: xargs порождает процесс через execvp и не может
# вызвать shell-функцию (под set -eu это роняло бэкап вместе со снапшотом).
# Переносимо: GNU coreutils sha256sum либо BSD shasum (macOS). Список файлов
# сохраняется отдельно и каждая ошибка find/xargs становится ошибкой снапшота;
# `: >` гарантирует создание SHA256SUMS даже для пустого снапшота.
CHECKSUM_INPUT="$(mktemp "${TMPDIR:-/tmp}/tz-backup-checksums.XXXXXX")"
(
  cd "$SNAPSHOT" || exit 1
  : > SHA256SUMS
  if ! find . -type f ! -name SHA256SUMS -print0 > "$CHECKSUM_INPUT"; then
    exit 1
  fi
  if [ -s "$CHECKSUM_INPUT" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      if ! xargs -0 sha256sum < "$CHECKSUM_INPUT" >> SHA256SUMS; then
        exit 1
      fi
    elif command -v shasum >/dev/null 2>&1; then
      if ! xargs -0 shasum -a 256 < "$CHECKSUM_INPUT" >> SHA256SUMS; then
        exit 1
      fi
    else
      echo "[backup] ОШИБКА: sha256sum/shasum недоступен" >&2
      exit 1
    fi
  fi
)
rm -f -- "$CHECKSUM_INPUT"
CHECKSUM_INPUT=""
chmod 600 "$SNAPSHOT/SHA256SUMS"
echo "[backup] SHA256SUMS: готово"

# ── 5. Offsite-копия через rclone (INF-04) ────────────────────────────────────
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
  marker_tmp="$(mktemp "${OFFSITE_MARKER}.XXXXXX")"
  if ! printf '%s %s %s\n' "$1" "$(iso_now)" "$2" > "$marker_tmp"; then
    rm -f -- "$marker_tmp"
    return 1
  fi
  chmod 600 "$marker_tmp"
  if ! mv -f "$marker_tmp" "$OFFSITE_MARKER"; then
    rm -f -- "$marker_tmp"
    return 1
  fi
  chmod 600 "$OFFSITE_MARKER"
}
rclone_exec() {
  if [ -n "$RCLONE_CONFIG" ]; then
    rclone --config "$RCLONE_CONFIG" "$@"
  else
    rclone "$@"
  fi
}

# Конфигурация rclone не выводится: достаточно извлечь из `config show` только
# тип remote. Прямой s3/sftp/etc. target запрещён, иначе offsite может принять
# незашифрованные данные. Дополнительно запрещаем crypt с отключённым
# шифрованием содержимого.
rclone_remote_is_crypt() {
  remote_name="${OFFSITE_REMOTE%%:*}"
  if [ -z "$remote_name" ] || [ "$remote_name" = "$OFFSITE_REMOTE" ]; then
    return 1
  fi

  # В production используется общий guard; fallback сохраняет возможность
  # запуска backup.sh на хосте с обычным расположением rclone-конфига.
  if [ -n "$RCLONE_CONFIG" ] && [ -f "$RCLONE_GUARD_SCRIPT" ]; then
    if sh "$RCLONE_GUARD_SCRIPT" "$OFFSITE_REMOTE"; then
      return 0
    fi
    return 1
  fi

  config_output="$(mktemp "${TMPDIR:-/tmp}/tz-rclone-config.XXXXXX")"
  if ! rclone_exec config show "$remote_name" >"$config_output" 2>/dev/null; then
    rm -f -- "$config_output"
    return 1
  fi
  remote_type="$(sed -n \
    's/^[[:space:]]*type[[:space:]]*=[[:space:]]*//p' "$config_output")" || {
    rm -f -- "$config_output"
    return 1
  }
  [ "$remote_type" = "crypt" ] || {
    rm -f -- "$config_output"
    return 1
  }

  no_data_encryption="$(awk '
    /^[[:space:]]*no_data_encryption[[:space:]]*=/ {
      sub(/^[^=]*=/, "")
      gsub(/[[:space:]]/, "")
      print tolower($0)
      exit
    }
  ' "$config_output")" || {
    rm -f -- "$config_output"
    return 1
  }
  rm -f -- "$config_output"
  case "$no_data_encryption" in
    true|1|yes|on) return 1 ;;
  esac
  return 0
}

if [ -z "$OFFSITE_REMOTE" ]; then
  echo "[backup] ВНИМАНИЕ: BACKUP_OFFSITE_REMOTE не задан — offsite-копия отключена (алертер: жёлтый)" >&2
  write_offsite_marker warn "target-not-configured"
elif ! command -v rclone >/dev/null 2>&1; then
  echo "[backup] ОШИБКА: rclone не найден, а BACKUP_OFFSITE_REMOTE задан — offsite не выполнен" >&2
  write_offsite_marker fail "rclone-missing"
elif ! rclone_remote_is_crypt; then
  echo "[backup] ОШИБКА: offsite target не является crypt remote — копирование запрещено" >&2
  write_offsite_marker fail "remote-not-crypt"
elif rclone_exec copy "$SNAPSHOT" "$OFFSITE_REMOTE/$SNAPSHOT_NAME"; then
  echo "[backup] offsite: зашифрованный снапшот скопирован"
  write_offsite_marker ok "copied"
else
  echo "[backup] ОШИБКА: rclone copy завершился неудачей — offsite не выполнен" >&2
  write_offsite_marker fail "copy-failed"
fi

# ── 6. Ротация: оставить KEEP последних снапшотов ────────────────────────────
ROTATION_LIST="$(mktemp "${TMPDIR:-/tmp}/tz-backup-rotation.XXXXXX")"
ROTATION_SORTED="$(mktemp "${TMPDIR:-/tmp}/tz-backup-rotation-sorted.XXXXXX")"
if ! ls -1dt "$BACKUP_DIR"/20*/ > "$ROTATION_LIST" 2>/dev/null; then
  echo "[backup] ОШИБКА: не удалось получить список снапшотов для ротации" >&2
  exit 1
fi
if ! sort -r "$ROTATION_LIST" > "$ROTATION_SORTED"; then
  echo "[backup] ОШИБКА: не удалось отсортировать список снапшотов" >&2
  exit 1
fi
snapshot_number=0
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  snapshot_number=$((snapshot_number + 1))
  if [ "$snapshot_number" -gt "$KEEP" ]; then
    echo "[backup] ротация: удаляю $dir"
    rm -rf -- "$dir"
  fi
done < "$ROTATION_SORTED"
rm -f -- "$ROTATION_LIST" "$ROTATION_SORTED"
ROTATION_LIST=""
ROTATION_SORTED=""

BACKUP_OK=1

# Маркер свежести — ПОСЛЕДНИЙ шаг, строго после всех стадий (дамп, MinIO,
# суммы, offsite, ротация): его наличие означает полный успех снапшота.
# Пишется только при BACKUP_OK=1: trap выше удалил бы снапшот при провале,
# и «свежий» маркер без снапшота обманул бы алертер.
freshness_tmp="$(mktemp "${FRESHNESS_MARKER}.XXXXXX")"
printf '%s\n' "$(iso_now)" > "$freshness_tmp"
chmod 600 "$freshness_tmp"
mv -f "$freshness_tmp" "$FRESHNESS_MARKER"
chmod 600 "$FRESHNESS_MARKER"
echo "[backup] готово: $SNAPSHOT (маркер: $FRESHNESS_MARKER)"
