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

REPL_USER="${REPL_USER:-replicator}"
REPL_PASSWORD="${REPL_PASSWORD:?REPL_PASSWORD обязателен}"
REPL_SLOT="${REPL_SLOT:-tz_replica_slot}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER обязателен}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB обязателен}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}"
REPLICATION_READY_FILE="${REPLICATION_READY_FILE:-/tmp/technozrelost-replication-ready}"

if [[ "$REPL_PASSWORD" == *$'\n'* || "$REPL_PASSWORD" == *$'\r'* ]]; then
  echo "ОШИБКА: REPL_PASSWORD не должен содержать перевод строки" >&2
  exit 2
fi

case "$REPL_USER" in
  ''|*[!A-Za-z0-9_]* )
    echo "ОШИБКА: REPL_USER должен состоять только из букв, цифр и _" >&2
    exit 2
    ;;
esac
case "$REPL_SLOT" in
  ''|*[!A-Za-z0-9._-]* )
    echo "ОШИБКА: недопустимое имя REPL_SLOT" >&2
    exit 2
    ;;
esac

# Не допускаем healthy до окончания ротации credential на существующем томе.
# Файл не содержит секрета и сбрасывается при каждом старте primary.
rm -f "$REPLICATION_READY_FILE"
export REPL_PASSWORD

{
  cat <<'EOSQL'
\getenv repl_password REPL_PASSWORD
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
} | PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 \
       -v "repl_user=$REPL_USER" \
       -v "repl_slot=$REPL_SLOT" \
       --username "$POSTGRES_USER" \
       --dbname "$POSTGRES_DB" \
       --no-password

# Подключение с credential репликации доказывает, что primary записал ровно
# тот пароль, который передаётся replica через её passfile.
PGPASSWORD="$REPL_PASSWORD" psql -X -w -q \
  --username "$REPL_USER" \
  --dbname "$POSTGRES_DB" \
  --command 'SELECT 1' \
  --no-password >/dev/null

umask 077
: > "$REPLICATION_READY_FILE"
