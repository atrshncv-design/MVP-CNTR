#!/usr/bin/env bash
# Обновление TLS-сертификата без провала readiness (таск 07, G41).
#
#   ./tls_renew.sh --dry-run   проверка обновления без изменений сертификата
#   ./tls_renew.sh             webroot-обновление + reload nginx при смене пары
#
# Webroot-режим: nginx уже поднят и отдаёт /.well-known/acme-challenge/ из
# certbot/www, остановка не нужна. nginx перезагружается (reload, не restart)
# только если пара реально сменилась; затем TLS-гейт и верифицированный
# readiness-проб без отключения проверки сертификата. Для cron на сервере:
# `0 4 * * * cd <repo>/technozrelost-backend/infra && ./tls_renew.sh`.
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot:v2.11.0}"
CONF_VOLUME="${CERTBOT_CONF_VOLUME:-tz-prod-certbot-conf}"

env_value() {
  local key="$1" line value
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  printf '%s' "$value"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "ОШИБКА: нет файла $ENV_FILE." >&2
  exit 1
fi
PUBLIC_HOST="${PUBLIC_HOST:-$(env_value PUBLIC_HOST)}"
if [ -z "$PUBLIC_HOST" ]; then
  echo "ОШИБКА: PUBLIC_HOST пуст." >&2
  exit 1
fi

certbot_run() {
  docker run --rm \
    -v "$CONF_VOLUME:/etc/letsencrypt" \
    -v "$PWD/certbot/www:/var/www/certbot" \
    "$CERTBOT_IMAGE" "$@"
}

if [ "${1:-}" = "--dry-run" ]; then
  if [ "$#" -gt 1 ]; then
    echo "Использование: ./tls_renew.sh [--dry-run]" >&2
    exit 2
  fi
  # Dry-run не трогает сертификат и не перезагружает nginx (приёмка таска 07).
  certbot_run renew --dry-run
  echo "Dry-run обновления успешен; сертификат и nginx не изменены."
  exit 0
fi
if [ "$#" -gt 0 ]; then
  echo "Использование: ./tls_renew.sh [--dry-run]" >&2
  exit 2
fi

mkdir -p certbot/www nginx/certs
before="$(sha256sum nginx/certs/fullchain.pem 2>/dev/null | cut -d' ' -f1 || true)"
certbot_run renew --authenticator webroot --webroot-path /var/www/certbot --non-interactive
docker run --rm \
  -v "$CONF_VOLUME:/etc/letsencrypt:ro" \
  -v "$PWD/nginx/certs:/out" \
  alpine:3.20 sh -c "cp /etc/letsencrypt/live/$PUBLIC_HOST/fullchain.pem /out/fullchain.pem && cp /etc/letsencrypt/live/$PUBLIC_HOST/privkey.pem /out/privkey.pem && chmod 644 /out/fullchain.pem && chmod 600 /out/privkey.pem"
after="$(sha256sum nginx/certs/fullchain.pem | cut -d' ' -f1)"

export PUBLIC_HOST
export NEXTAUTH_URL="$(env_value NEXTAUTH_URL)"
export CORS_ORIGINS="$(env_value CORS_ORIGINS)"
if [ "$before" != "$after" ]; then
  echo "Сертификат обновлён — перезагружаю nginx (reload без разрыва соединений)..."
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T nginx nginx -s reload
else
  echo "Сертификат не изменился — reload не нужен."
fi
if ! python3 ./tls_deploy_gate.py; then
  echo "ОШИБКА: обновлённый сертификат не прошёл TLS-гейт." >&2
  exit 1
fi
if ! curl -fsS --max-time 10 -o /dev/null "https://$PUBLIC_HOST/api/v1/ready"; then
  echo "ОШИБКА: readiness не отвечает по верифицированному HTTPS после обновления." >&2
  exit 1
fi
echo "TLS обновлён: nginx перезагружен, readiness в норме."
