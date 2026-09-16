#!/usr/bin/env bash
# Первичный выпуск TLS-сертификата через ACME для технического имени
# `<ipv4>.sslip.io` (таск 07, G40/G41: публичный MVP без покупки домена).
#
# Выполняется ОПЕРАТОРОМ НА СЕРВЕРЕ до первого ./deploy.sh (к живому серверу
# из worktree не подключаться — здесь только код). Standalone-режим: порт 80
# свободен, nginx ещё не поднят. Продление — infra/tls_renew.sh (webroot,
# без остановки nginx). Состояние ACME — в docker volume (ключи и аккаунты
# не попадают в git); в nginx/certs/ кладётся только копия пары для nginx.
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.production}"
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot:v2.11.0}"
CONF_VOLUME="${CERTBOT_CONF_VOLUME:-tz-prod-certbot-conf}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ОШИБКА: нет файла $ENV_FILE (PUBLIC_HOST, ACME_EMAIL)." >&2
  exit 1
fi

env_value() {
  local key="$1" line value
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  printf '%s' "$value"
}

PUBLIC_HOST="${PUBLIC_HOST:-$(env_value PUBLIC_HOST)}"
ACME_EMAIL="${ACME_EMAIL:-$(env_value ACME_EMAIL)}"

# Правило: разделители октетов единообразны — либо все точки, либо все дефисы (ERE без обратных ссылок).
_sslip_ok=0
if [[ "$PUBLIC_HOST" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}\.sslip\.io$ || "$PUBLIC_HOST" =~ ^[0-9]{1,3}(-[0-9]{1,3}){3}\.sslip\.io$ ]]; then
  _ip_part="${PUBLIC_HOST%.sslip.io}"
  _ip_part="${_ip_part//-/.}"
  IFS='.' read -r _o1 _o2 _o3 _o4 _rest <<< "$_ip_part"
  if [ -z "${_rest:-}" ]; then
    _sslip_ok=1
    for _octet in "$_o1" "$_o2" "$_o3" "$_o4"; do
      if [[ ! "$_octet" =~ ^[0-9]+$ ]] || (( 10#$_octet > 255 )); then
        _sslip_ok=0
        break
      fi
    done
  fi
fi
unset _ip_part _o1 _o2 _o3 _o4 _rest _octet
if [ "$_sslip_ok" != "1" ]; then
  echo "ОШИБКА: PUBLIC_HOST должен быть техническим именем <ipv4>.sslip.io." >&2
  unset _sslip_ok
  exit 1
fi
unset _sslip_ok
if [ -z "$ACME_EMAIL" ]; then
  echo "ОШИБКА: ACME_EMAIL пуст — нужен для уведомлений об экспирации." >&2
  exit 1
fi

STAGING_ARGS=()
if [ "${TLS_STAGING:-0}" = "1" ]; then
  STAGING_ARGS=(--staging)
  echo "ВНИМАНИЕ: TLS_STAGING=1 — тестовый сертификат (deploy-гейт его примет, браузеры нет)."
fi

docker volume create "$CONF_VOLUME" >/dev/null
docker run --rm \
  -p 80:80 \
  -v "$CONF_VOLUME:/etc/letsencrypt" \
  "$CERTBOT_IMAGE" certonly --standalone \
  -d "$PUBLIC_HOST" --email "$ACME_EMAIL" --agree-tos --non-interactive \
  "${STAGING_ARGS[@]}"

mkdir -p nginx/certs
docker run --rm \
  -v "$CONF_VOLUME:/etc/letsencrypt:ro" \
  -v "$PWD/nginx/certs:/out" \
  alpine:3.20 sh -c "cp /etc/letsencrypt/live/$PUBLIC_HOST/fullchain.pem /out/fullchain.pem && cp /etc/letsencrypt/live/$PUBLIC_HOST/privkey.pem /out/privkey.pem && chmod 644 /out/fullchain.pem && chmod 600 /out/privkey.pem"

echo "Сертификат для $PUBLIC_HOST установлен в nginx/certs/."
echo "Дальше: ./deploy.sh (TLS-гейт проверит SAN и годность до сборки)."
