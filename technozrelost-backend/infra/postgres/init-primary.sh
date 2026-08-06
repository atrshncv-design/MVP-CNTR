#!/bin/bash
# Инициализация primary: репликатор + слот стриминг-репликации.
# Параметры берутся из env (compose передаёт REPL_USER/REPL_PASSWORD/REPL_SLOT
# с дефолтами) — секреты только через env (тикет 18).
set -euo pipefail

REPL_USER="${REPL_USER:-replicator}"
REPL_PASSWORD="${REPL_PASSWORD:-replica_pass}"
REPL_SLOT="${REPL_SLOT:-tz_replica_slot}"

psql -v ON_ERROR_STOP=1 \
     -v repl_user="$REPL_USER" \
     -v repl_password="$REPL_PASSWORD" \
     -v repl_slot="$REPL_SLOT" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'repl_user') THEN
    EXECUTE format('CREATE ROLE %I WITH REPLICATION LOGIN PASSWORD %L', :'repl_user', :'repl_password');
  END IF;
END $$;

SELECT pg_create_physical_replication_slot(:'repl_slot')
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_replication_slots WHERE slot_name = :'repl_slot'
 );

-- Расширение pgvector включается в схеме public позже — отдельной миграцией БД.
EOSQL
