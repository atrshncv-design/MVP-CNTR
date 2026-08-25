#!/bin/bash
# Первый init primary (официальный entrypoint выполняет initdb.d только на
# ПУСТОМ томе). Логика общая с повторными стартами — в ensure-replication.sh.
set -euo pipefail
exec /usr/local/bin/ensure-replication.sh
