#!/bin/bash
# Идемпотентное обеспечение стриминг-репликации на primary (аудит-тикет 05).
# Гарантирует: роль REPL_USER с актуальным паролем (ротация применяется при
# каждом запуске) и физический слот REPL_SLOT.
# Вызывается из двух мест:
#   - initdb.d/10-init.sh (первый запуск на пустом томе);
#   - start-primary.sh (каждый запуск на существующем томе — раньше здесь
#     роль не создавалась вообще: initdb.d выполняется только на пустом томе).
# Интерполяция psql-переменных — вне доллар-кавычек (\gexec вместо DO $$),
# поэтому скрипт не зависит от особенностей подстановки внутри $$-блоков.
set -euo pipefail

psql -v ON_ERROR_STOP=1 \
     -v repl_user="${REPL_USER:-replicator}" \
     -v repl_password="${REPL_PASSWORD:-replica_pass}" \
     -v repl_slot="${REPL_SLOT:-tz_replica_slot}" \
     --username "${POSTGRES_USER:?POSTGRES_USER обязателен}" \
     --dbname "${POSTGRES_DB:?POSTGRES_DB обязателен}" <<'EOSQL'
-- Роль репликации: создаём, если нет...
SELECT format('CREATE ROLE %I WITH REPLICATION LOGIN PASSWORD %L',
              :'repl_user', :'repl_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'repl_user') \gexec
-- ...и обновляем пароль, если есть (идемпотентная ротация).
SELECT format('ALTER ROLE %I WITH REPLICATION LOGIN PASSWORD %L',
              :'repl_user', :'repl_password')
 WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'repl_user') \gexec

-- Физический слот: создаём, если нет.
SELECT pg_create_physical_replication_slot(:'repl_slot')
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_replication_slots WHERE slot_name = :'repl_slot'
 );
EOSQL
