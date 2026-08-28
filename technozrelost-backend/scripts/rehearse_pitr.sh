#!/bin/bash
# Репетиция PITR на чистых одноразовых контейнерах (INF-02, таск 04).
#
# Сценарий: поднять временный Primary с архивацией WAL -> снять base-backup
# ПУСТОЙ таблицы -> вставить контрольную строку ДО цели -> зафиксировать
# целевое время -> вставить строку ПОСЛЕ цели -> «погибель» Primary ->
# восстановить копию доигрыванием WAL до целевого времени -> убедиться,
# что строка ДО восстановлена ИЗ АРХИВА WAL (её нет в базовой копии),
# а строка ПОСЛЕ отсутствует. Base-backup обязан предшествовать вставкам:
# иначе целевая точка лежит «внутри» базовой копии и доигрывать нечего.
#
# Прод-контейнеры не затрагиваются: всё живёт в отдельной docker-сети без
# проброшенных портов, образ тот же, что в dev/prod-compose
# (pgvector/pgvector:0.8.0-pg16), настройки архивации идентичны
# postgres/postgresql-pitr.conf — то есть репетируется именно прод-конфиг.
#
# Использование:
#   bash technozrelost-backend/scripts/rehearse_pitr.sh
# Полный вывод сохраняется в technozrelost-backend/reports/pitr-rehearsal-2026-08-26.txt
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="${REPORT:-$ROOT/reports/pitr-rehearsal-2026-08-26.txt}"
IMAGE="pgvector/pgvector:0.8.0-pg16"
NET="pitr-rehearse-$$_$RANDOM"
PRIMARY="pitr-rehearse-primary"
RESTORED="pitr-rehearse-restored"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/tz-pitr.XXXXXX")"
ARCHIVE="$WORK/walarchive"
SUCCESS=0

log() { echo "[pitr] $(date -u +%H:%M:%S) $*"; }

cleanup() {
  # При провале контейнеры НЕ удаляем: их docker logs — главный источник
  # диагностики (почему recovery не дошёл до цели).
  if [ "$SUCCESS" = 1 ]; then
    docker rm -f "$PRIMARY" "$RESTORED" >/dev/null 2>&1 || true
    rm -rf "$WORK"
  else
    log "ПРОВАЛ: контейнеры $PRIMARY/$RESTORED и каталог $WORK сохранены для разбора (docker logs)"
    docker network rm "$NET" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

psql_primary() { docker exec "$PRIMARY" psql -U tzrehearse -d tzrehearse -X -Atq -v ON_ERROR_STOP=1 -c "$1"; }
psql_restored() { docker exec "$RESTORED" psql -U tzrehearse -d tzrehearse -X -Atq -v ON_ERROR_STOP=1 -c "$1"; }

wait_ready() {
  local c="$1" i=0
  until docker exec "$c" pg_isready -U tzrehearse -d tzrehearse >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge 120 ]; then echo "[pitr] ОШИБКА: $c не готов после 120 попыток" >&2; return 1; fi
    sleep 1
  done
}

main() {
  command -v docker >/dev/null 2>&1 || { echo "[pitr] ОШИБКА: docker недоступен" >&2; return 1; }
  mkdir -p "$ARCHIVE"

  log "== Шаг 1: временный Primary с прод-настройками архивации =="
  docker network create "$NET" >/dev/null
  # Настройки совпадают с infra/postgres/postgresql-pitr.conf (INF-02/03):
  # archive_timeout=60s, max_slot_wal_keep_size=15GB, отдельный каталог архива.
  docker run -d --name "$PRIMARY" --network "$NET" \
    -e POSTGRES_USER=tzrehearse -e POSTGRES_PASSWORD=tzrehearse -e POSTGRES_DB=tzrehearse \
    -v "$ARCHIVE":/walarchive \
    "$IMAGE" postgres \
    -c archive_mode=on \
    -c "archive_command=test -f /walarchive/%f || (cp %p /walarchive/.%f.tmp && mv /walarchive/.%f.tmp /walarchive/%f)" \
    -c archive_timeout=60s \
    -c max_slot_wal_keep_size=15GB >/dev/null
  wait_ready "$PRIMARY"

  log "== Шаг 2: base-backup ПУСТОЙ таблицы (вставки будут восстановлены из WAL) =="
  psql_primary "CREATE TABLE pitr_check(id int primary key, label text)"
  docker exec -e PGPASSWORD=tzrehearse "$PRIMARY" \
    pg_basebackup -h localhost -U tzrehearse -D /tmp/basebk -Fp -X stream >/dev/null
  rm -rf "$WORK/base"
  docker cp "$PRIMARY":/tmp/basebk "$WORK/base" >/dev/null

  log "== Шаг 3: контрольные вставки и целевая точка времени =="
  psql_primary "INSERT INTO pitr_check VALUES (1, 'контрольная-строка-ДО-цели')"
  sleep 2
  local target
  target="$(psql_primary "SELECT clock_timestamp()")"
  log "целевое время восстановления (между вставками): $target"
  psql_primary "INSERT INTO pitr_check VALUES (2, 'контрольная-строка-ПОСЛЕ-цели')"

  log "== Шаг 4: гарантированная архивация сегмента со второй вставкой =="
  local seg
  seg="$(psql_primary "SELECT pg_walfile_name(pg_current_wal_lsn())")"
  psql_primary "SELECT pg_switch_wal()" >/dev/null
  local i=0
  until [ -f "$ARCHIVE/$seg" ]; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then echo "[pitr] ОШИБКА: сегмент $seg не заархивирован за 60 c" >&2; return 1; fi
    sleep 1
  done
  log "архив WAL: $(ls "$ARCHIVE" | wc -l | tr -d ' ') сегмент(ов), ключевой: $seg"

  log "== Шаг 5: гибель Primary =="
  docker stop "$PRIMARY" >/dev/null

  log "== Шаг 6: восстановление копии доигрыванием WAL до цели (PITR) =="
  {
    echo ""
    echo "restore_command = 'cp /walarchive/%f %p'"
    echo "recovery_target_time = '$target'"
    echo "recovery_target_action = 'promote'"
  } >>"$WORK/base/postgresql.conf"
  touch "$WORK/base/recovery.signal"
  docker create --name "$RESTORED" --network "$NET" \
    -v "$ARCHIVE":/walarchive:ro \
    -e POSTGRES_PASSWORD=tzrehearse "$IMAGE" >/dev/null
  docker cp "$WORK/base/." "$RESTORED":/var/lib/postgresql/data >/dev/null
  docker start "$RESTORED" >/dev/null
  # Ждём именно PROMOTE, а не просто готовности: в read-only состоянии
  # восстановления pg_isready отвечает успехом ещё до достижения цели.
  local j=0
  until [ "$(psql_restored "SELECT pg_is_in_recovery()")" = "f" ] 2>/dev/null; do
    j=$((j + 1))
    if [ "$j" -ge 120 ]; then echo "[pitr] ОШИБКА: восстановленный кластер не вышел из recovery за 120 c" >&2; return 1; fi
    sleep 1
  done
  log "восстановленный кластер поднялся и выведен из recovery"

  log "== Шаг 7: сверка контрольных строк =="
  local total before after
  total="$(psql_restored "SELECT count(*) FROM pitr_check")"
  before="$(psql_restored "SELECT label FROM pitr_check WHERE id = 1")"
  after="$(psql_restored "SELECT count(*) FROM pitr_check WHERE id = 2")"
  echo ""
  echo "───── ИТОГ ──────────────────────────────────────────────────────"
  echo "целевое время:            $target"
  echo "строк восстановлено:      $total (ожидается 1)"
  echo "строка ДО цели (id=1):    '$before' (ожидается присутствует)"
  echo "строка ПОСЛЕ цели (id=2): $after шт. (ожидается 0)"

  if [ "$total" = "1" ] && [ "$after" = "0" ] && [ "$before" = "контрольная-строка-ДО-цели" ]; then
    echo "РЕЗУЛЬТАТ: PASS — PITR подтверждён (потеря ограничена целевой точкой)"
    SUCCESS=1
  else
    echo "РЕЗУЛЬТАТ: FAIL — состояние после восстановления не соответствует цели"
    return 1
  fi
}

mkdir -p "$(dirname "$REPORT")"
exec > >(tee "$REPORT") 2>&1
main
