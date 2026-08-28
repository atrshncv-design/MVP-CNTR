#!/bin/bash
# Запуск read-replica: первый старт делает pg_basebackup от primary,
# затем поднимает PostgreSQL в режиме hot standby.
set -euo pipefail
umask 077

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PGPRIMARY_HOST="${PGPRIMARY_HOST:?PGPRIMARY_HOST обязателен}"
PGPRIMARY_PORT="${PGPRIMARY_PORT:-5432}"
REPL_USER="${REPL_USER:-replicator}"
REPL_PASSWORD="${REPL_PASSWORD:?REPL_PASSWORD обязателен}"
REPL_SLOT="${REPL_SLOT:-tz_replica_slot}"

# В production primary — имя сервиса Compose. Ограничение формата не даёт
# превратить значения окружения в дополнительные параметры libpq/config.
case "$PGPRIMARY_HOST" in
  ''|*[!A-Za-z0-9._-]*)
    echo "[replica] ОШИБКА: недопустимое имя PGPRIMARY_HOST" >&2
    exit 2
    ;;
esac
case "$PGPRIMARY_PORT" in
  ''|*[!0-9]*)
    echo "[replica] ОШИБКА: PGPRIMARY_PORT должен быть числом" >&2
    exit 2
    ;;
esac
if [ "$PGPRIMARY_PORT" -lt 1 ] || [ "$PGPRIMARY_PORT" -gt 65535 ]; then
  echo "[replica] ОШИБКА: PGPRIMARY_PORT вне диапазона" >&2
  exit 2
fi
case "$REPL_USER" in
  ''|*[!A-Za-z0-9._-]*)
    echo "[replica] ОШИБКА: недопустимое имя REPL_USER" >&2
    exit 2
    ;;
esac
case "$REPL_SLOT" in
  ''|*[!A-Za-z0-9._-]*)
    echo "[replica] ОШИБКА: недопустимое имя REPL_SLOT" >&2
    exit 2
    ;;
esac
if [[ "$REPL_PASSWORD" == *$'\n'* || "$REPL_PASSWORD" == *$'\r'* ]]; then
  echo "[replica] ОШИБКА: REPL_PASSWORD не должен содержать перевод строки" >&2
  exit 2
fi

mkdir -p "$PGDATA"
chmod 700 "$PGDATA"

# Пароль хранится только в runtime-файле с mode 0600. Он не попадает ни в
# argv, ни в primary_conninfo; это также позволяет пережить credential rotation.
PASSFILE="${REPLICATION_PASSFILE:-/var/lib/postgresql/.pgpass}"
PASSFILE_DIR="$(dirname "$PASSFILE")"
mkdir -p "$PASSFILE_DIR"
chmod 700 "$PASSFILE_DIR"
escaped_password="$(printf '%s' "$REPL_PASSWORD" | sed -e 's/\\/\\\\/g' -e 's/:/\\:/g')"
temporary_passfile="$(mktemp "${PASSFILE}.XXXXXX")"
printf '*:%s:*:%s:%s\n' "$PGPRIMARY_PORT" "$REPL_USER" "$escaped_password" > "$temporary_passfile"
chown postgres:postgres "$temporary_passfile"
chmod 600 "$temporary_passfile"
mv -f "$temporary_passfile" "$PASSFILE"
export PGPASSFILE="$PASSFILE"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[replica] PGDATA пуст — выполняю pg_basebackup от ${PGPRIMARY_HOST}..."
  pg_basebackup \
    -h "${PGPRIMARY_HOST}" \
    -p "$PGPRIMARY_PORT" \
    -U "${REPL_USER:-replicator}" \
    -D "$PGDATA" \
    -Fp -Xs -P -R -S "$REPL_SLOT" -v -w
  chown -R postgres:postgres "$PGDATA"
  echo "[replica] basebackup завершён."
fi

# -R создаёт standby.signal только на первом basebackup. Для старого PGDATA
# гарантируем тот же state явно и передаём актуальные параметры последними
# -c, поэтому устаревший postgresql.auto.conf не может победить их при restart.
# HBA монтируется отдельно: иначе после basebackup replica унаследовала бы
# data-dir HBA от initdb, а не ограниченный production/dev policy-файл.
touch "$PGDATA/standby.signal"
chown postgres:postgres "$PGDATA/standby.signal"
chmod 600 "$PGDATA/standby.signal"
PRIMARY_CONNINFO="host=$PGPRIMARY_HOST port=$PGPRIMARY_PORT user=$REPL_USER passfile=$PASSFILE application_name=$REPL_SLOT"
exec docker-entrypoint.sh postgres \
  -c "hba_file=/etc/postgresql/pg_hba.conf" \
  -c "primary_conninfo=$PRIMARY_CONNINFO" \
  -c "primary_slot_name=$REPL_SLOT"
