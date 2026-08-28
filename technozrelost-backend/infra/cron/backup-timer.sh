#!/bin/sh
# Ежедневный таймер backup.sh (INF-01) — замена cron для прод-стека.
#
# Почему цикл со sleep, а не демон crond: работает в любом контейнере без
# дополнительных пакетов, реагирует на docker stop (sleep чанками по <=60 c),
# и не требует отдельного образа — таск 05 подключает его sidecar-сервисом
# с тем же образом backend (см. RUNBOOK-DATA.md).
#
# Переменные окружения:
#   BACKUP_SCRIPT — путь к backup.sh (по умолчанию /app/infra/backup.sh);
#   BACKUP_LOCK_SCRIPT — общий runner advisory lock (по умолчанию
#                        /app/infra/backup-lock.py);
#   BACKUP_AT     — время ежедневного запуска "ЧЧ:ММ" в TZ контейнера
#                   (по умолчанию 03:15; в compose задаём TZ=UTC явно);
#   BACKUP_TIMER_RUN_ONCE=1 — выполнить backup.sh немедленно один раз и выйти
#                   (smoke-проверка проводки таймера, не для прода).
#   BACKUP_TIMER_SELF_CHECK=1 — проверить границу target без ожидания и бэкапа.
set -eu

BACKUP_SCRIPT="${BACKUP_SCRIPT:-/app/infra/backup.sh}"
BACKUP_LOCK_SCRIPT="${BACKUP_LOCK_SCRIPT:-/app/infra/backup-lock.py}"
BACKUP_AT="${BACKUP_AT:-03:15}"

log() { echo "[backup-timer] $(date -u +%Y-%m-%dT%H:%M:%S%z) $*"; }

# Валидация формата времени на старте: опечатка в env не должна проявиться
# через сутки молчаливого пропуска бэкапа.
case "$BACKUP_AT" in
  [01][0-9]:[0-5][0-9]|2[0-3]:[0-5][0-9]) ;;
  *) echo "[backup-timer] ОШИБКА: BACKUP_AT='$BACKUP_AT' — ожидается ЧЧ:ММ" >&2; exit 2 ;;
esac
HH=${BACKUP_AT%%:*}
MM=${BACKUP_AT##*:}

# Epoch «сегодня в HH:MM» по локальному времени контейнера. GNU date и BSD
# date имеют разные флаги парсинга (-d против -j -f), поэтому ветвление
# по наличию BSD-флага: прод живёт в Linux (GNU), macOS разработчика — BSD.
epoch_today_hhmm() {
  if date -j +%s >/dev/null 2>&1; then
    date -j -f "%Y%m%d%H%M%S" "$(date +%Y%m%d)$HH$MM"00 +%s
  else
    date -d "$(date +%Y-%m-%d) $HH:$MM" +%s
  fi
}

next_target() {
  now=$(date +%s)
  target=$(epoch_today_hhmm)
  # Уже прошло время запуска сегодня — цель переносится на завтра.
  if [ "$target" -le "$now" ]; then
    target=$((target + 86400))
  fi
  printf '%s\n' "$target"
}

require_backup_script() {
  if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "[backup-timer] ОШИБКА: $BACKUP_SCRIPT не найден (проверь mount и BACKUP_SCRIPT)" >&2
    exit 2
  fi
  if [ ! -f "$BACKUP_LOCK_SCRIPT" ]; then
    echo "[backup-timer] ОШИБКА: $BACKUP_LOCK_SCRIPT не найден — backup без lock запрещён" >&2
    exit 2
  fi
  if ! command -v python >/dev/null 2>&1; then
    echo "[backup-timer] ОШИБКА: python не найден — backup без lock запрещён" >&2
    exit 2
  fi
}

wait_until_target() {
  target="$1"
  while :; do
    now=$(date +%s)
    remaining=$((target - now))
    if [ "$remaining" -le 0 ]; then
      return 0
    fi

    # Короткий sleep сохраняет быструю обработку SIGTERM от docker stop.
    if [ "$remaining" -lt 60 ]; then chunk=$remaining; else chunk=60; fi
    sleep "$chunk"
  done
}

if [ "${BACKUP_TIMER_RUN_ONCE:-0}" = "1" ]; then
  require_backup_script
  log "RUN_ONCE: выполняю backup под advisory lock"
  exec python "$BACKUP_LOCK_SCRIPT" "$BACKUP_SCRIPT"
fi

if [ "${BACKUP_TIMER_SELF_CHECK:-0}" = "1" ]; then
  require_backup_script
  target=$(next_target)
  now=$(date +%s)
  if [ "$target" -le "$now" ]; then
    echo "[backup-timer] ОШИБКА: self-check вычислил target не в будущем" >&2
    exit 1
  fi
  printf '%s\n' "[backup-timer] self-check: script exists; next target=$target"
  exit 0
fi

require_backup_script

log "планировщик запущен: ежедневно в $BACKUP_AT ($TZ), скрипт: $BACKUP_SCRIPT"

while :; do
  now=$(date +%s)
  target=$(next_target)
  remaining=$((target - now))
  log "до следующего запуска ${remaining} c"
  # Цель зафиксирована до ожидания: на границе суток нельзя переносить её
  # на завтра, иначе backup.sh никогда не будет вызван.
  wait_until_target "$target"
  # Провал бэкапа не убивает планировщик: следующая попытка — завтра,
  # авария фиксируется отсутствием свежего маркера (контракт алертера).
  if python "$BACKUP_LOCK_SCRIPT" "$BACKUP_SCRIPT"; then
    log "бэкап выполнен успешно"
  else
    log "ОШИБКА: backup runner завершился с ненулевым кодом" >&2
  fi
done
