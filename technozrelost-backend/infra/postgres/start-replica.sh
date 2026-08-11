#!/bin/bash
# Запуск read-replica: первый старт делает pg_basebackup от primary,
# затем поднимает PostgreSQL в режиме hot standby.
set -euo pipefail

export PGPASSWORD="${REPL_PASSWORD}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[replica] PGDATA пуст — выполняю pg_basebackup от ${PGPRIMARY_HOST}..."
  chmod 700 "$PGDATA"
  pg_basebackup \
    -h "${PGPRIMARY_HOST}" \
    -U "${REPL_USER:-replicator}" \
    -D "$PGDATA" \
    -Fp -Xs -P -R -v
  echo "[replica] basebackup завершён."
fi

# -R создаёт standby.signal и primary_conninfo. Запускаем postgres.
exec docker-entrypoint.sh postgres