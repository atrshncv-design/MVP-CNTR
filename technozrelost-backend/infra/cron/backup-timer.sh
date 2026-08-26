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
#   BACKUP_AT     — время ежедневного запуска "ЧЧ:ММ" в TZ контейнера
#                   (по умолчанию 03:15; в compose задаём TZ=UTC явно);
#   BACKUP_TIMER_RUN_ONCE=1 — выполнить backup.sh немедленно один раз и выйти
#                   (smoke-проверка проводки таймера, не для прода).
set -eu

BACKUP_SCRIPT="${BACKUP_SCRIPT:-/app/infra/backup.sh}"
BACKUP_AT="${BACKUP_AT:-03:15}"

log() { echo "[backup-timer] $(date -u +%Y-%m-%dT%H:%M:%S%z) $*"; }

# Валидация формата времени на старте: опечатка в env не должна проявиться
# через сутки молчаливого пропуска бэкапа.
case "$BACKUP_AT" in
  [0-2][0-9]:[0-5][0-9]) ;;
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

if [ "${BACKUP_TIMER_RUN_ONCE:-0}" = "1" ]; then
  log "RUN_ONCE: выполняю $BACKUP_SCRIPT немедленно"
  exec sh "$BACKUP_SCRIPT"
fi

if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "[backup-timer] ОШИБКА: $BACKUP_SCRIPT не найден (проверь mount и BACKUP_SCRIPT)" >&2
  exit 2
fi

log "планировщик запущен: ежедневно в $BACKUP_AT ($TZ), скрипт: $BACKUP_SCRIPT"

while :; do
  now=$(date +%s)
  target=$(epoch_today_hhmm)
  # Уже прошло время запуска сегодня — цель переносится на завтра.
  if [ "$target" -le "$now" ]; then
    target=$((target + 86400))
  fi
  remaining=$((target - now))
  log "до следующего запуска ${remaining} c"
  # Sleep короткими чанками: SIGTERM от docker stop прерывает sleep и цикл
  # завершается за секунды, а не через многочасовой сон.
  while [ "$remaining" -gt 0 ]; do
    # Тернарный оператор в $(( )) не входит в POSIX sh — не рискуем.
    if [ "$remaining" -lt 60 ]; then chunk=$remaining; else chunk=60; fi
    sleep "$chunk"
    now=$(date +%s)
    target=$(epoch_today_hhmm)
    if [ "$target" -le "$now" ]; then
      target=$((target + 86400))
    fi
    remaining=$((target - now))
  done
  # Провал бэкапа не убивает планировщик: следующая попытка — завтра,
  # авария фиксируется отсутствием свежего маркера (контракт алертера).
  if sh "$BACKUP_SCRIPT"; then
    log "бэкап выполнен успешно"
  else
    log "ОШИБКА: backup.sh завершился с ненулевым кодом" >&2
  fi
done
