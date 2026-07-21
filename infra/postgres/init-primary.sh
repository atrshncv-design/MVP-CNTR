#!/bin/bash
# Инициализация primary: репликатор + слот стриминг-репликации.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') THEN
    CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replica_pass';
  END IF;
END $$;

SELECT pg_create_physical_replication_slot('tz_replica_slot')
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_replication_slots WHERE slot_name = 'tz_replica_slot'
 );

-- Расширение pgvector включается в схеме public позже — отдельной миграцией БД.
EOSQL