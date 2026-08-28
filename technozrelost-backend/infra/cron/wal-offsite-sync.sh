#!/bin/sh
# Непрерывно отправляет локальный WAL-архив на тот же crypt remote, что и
# ежедневные снапшоты. Отдельный sidecar не добавляет rclone в PostgreSQL.
set -eu

WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/wal-archive}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
OFFSITE_REMOTE="${BACKUP_OFFSITE_REMOTE:-}"
RCLONE_CONFIG="${RCLONE_CONFIG:-}"
WAL_OFFSITE_MARKER="${WAL_OFFSITE_MARKER:-$BACKUP_DIR/.wal-offsite-status}"
INTERVAL="${WAL_OFFSITE_INTERVAL_SECONDS:-60}"
KEEP_DAYS="${WAL_ARCHIVE_KEEP_DAYS-7}"
CHECK_RCLONE_SCRIPT="${CHECK_RCLONE_SCRIPT:-/app/infra/cron/check-rclone-crypt.sh}"

case "$INTERVAL" in
  ''|*[!0-9]*)
    echo "[wal-offsite] ОШИБКА: WAL_OFFSITE_INTERVAL_SECONDS должен быть целым числом" >&2
    exit 2
    ;;
esac
if [ "$INTERVAL" -lt 1 ]; then
  echo "[wal-offsite] ОШИБКА: интервал должен быть положительным" >&2
  exit 2
fi

case "$KEEP_DAYS" in
  ''|*[!0-9]*)
    echo "[wal-offsite] ОШИБКА: WAL_ARCHIVE_KEEP_DAYS должен быть целым числом" >&2
    exit 2
    ;;
esac
if [ "$KEEP_DAYS" -lt 1 ]; then
  echo "[wal-offsite] ОШИБКА: WAL_ARCHIVE_KEEP_DAYS должен быть положительным" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR" "$(dirname "$WAL_OFFSITE_MARKER")"

iso_now() {
  date -u +%Y-%m-%dT%H:%M:%S%z | sed -e 's/\([+-][0-9][0-9]\)\([0-9][0-9]\)$/\1:\2/'
}

write_status() {
  temporary="$(mktemp "${WAL_OFFSITE_MARKER}.XXXXXX")"
  if ! printf '%s %s %s\n' "$1" "$(iso_now)" "$2" > "$temporary"; then
    rm -f -- "$temporary"
    return 1
  fi
  chmod 600 "$temporary"
  if ! mv -f "$temporary" "$WAL_OFFSITE_MARKER"; then
    rm -f -- "$temporary"
    return 1
  fi
  chmod 600 "$WAL_OFFSITE_MARKER"
}

rclone_exec() {
  if [ -n "$RCLONE_CONFIG" ]; then
    rclone --config "$RCLONE_CONFIG" "$@"
  else
    rclone "$@"
  fi
}

cleanup_old_wal() {
  # -mtime +N с N=KEEP_DAYS-1 удаляет только файлы не моложе полного окна
  # хранения. Сегменты WAL и history-файлы завершены archive_command, а
  # временные и частичные файлы намеренно остаются нетронутыми.
  [ -d "$WAL_ARCHIVE_DIR" ] || return 0
  find "$WAL_ARCHIVE_DIR" -maxdepth 1 -type f \
    \( \
      \( -name '????????????????????????' ! -name '*[!0-9A-Fa-f]*' \) \
      -o \
      \( -name '????????.history' ! -name '*[!0-9A-Fa-f].history' \) \
    \) \
    -mtime "+$((KEEP_DAYS - 1))" -exec rm -f -- {} +
}

complete_archive_files() {
  # rclone получает только завершённые объекты, а не весь каталог archive.
  # Это не даёт случайно отправить скрытые, временные или частичные файлы.
  (
    cd "$WAL_ARCHIVE_DIR"
    find . -maxdepth 1 -type f \
      \( \
        \( -name '????????????????????????' ! -name '*[!0-9A-Fa-f]*' \) \
        -o \
        \( -name '????????.history' ! -name '*[!0-9A-Fa-f].history' \) \
      \) \
      -exec sh -c 'for path do printf "%s\\n" "${path#./}"; done' sh {} +
  )
}

sync_once() {
  if [ -z "$OFFSITE_REMOTE" ]; then
    # Offsite может быть ещё не выбран заказчиком, но локальный архив всё
    # равно не должен расти бесконечно. При этом удаляем только завершённые
    # WAL-сегменты: .tmp/.partial и другие частичные файлы оставляем.
    if ! cleanup_old_wal; then
      write_status fail "retention-failed"
      return 1
    fi
    write_status warn "target-not-configured"
    return 0
  fi
  if [ ! -d "$WAL_ARCHIVE_DIR" ]; then
    write_status fail "wal-directory-missing"
    return 1
  fi
  if ! sh "$CHECK_RCLONE_SCRIPT" "$OFFSITE_REMOTE"; then
    write_status fail "remote-not-crypt"
    return 1
  fi
  file_list="$(mktemp "$BACKUP_DIR/.wal-offsite-files.XXXXXX")"
  if ! complete_archive_files > "$file_list"; then
    rm -f -- "$file_list"
    write_status fail "wal-scan-failed"
    return 1
  fi
  if [ ! -s "$file_list" ]; then
    rm -f -- "$file_list"
    write_status warn "no-wal"
    return 0
  fi
  if rclone_exec copy --files-from "$file_list" \
      "$WAL_ARCHIVE_DIR" "$OFFSITE_REMOTE/wal-archive"; then
    rm -f -- "$file_list"
    if cleanup_old_wal; then
      write_status ok "copied"
      return 0
    fi
    write_status fail "retention-failed"
    return 1
  fi
  rm -f -- "$file_list"
  write_status fail "copy-failed"
  return 1
}

if [ "${WAL_OFFSITE_RUN_ONCE:-0}" = "1" ]; then
  sync_once
  exit 0
fi

echo "[wal-offsite] запущен: интервал ${INTERVAL}с, источник $WAL_ARCHIVE_DIR"
while :; do
  if sync_once; then
    echo "[wal-offsite] синхронизация завершена"
  else
    echo "[wal-offsite] ОШИБКА: синхронизация не выполнена" >&2
  fi
  sleep "$INTERVAL"
done
