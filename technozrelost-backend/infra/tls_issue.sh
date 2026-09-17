#!/usr/bin/env bash
# Первичный выпуск TLS-сертификата через ACME (таск 07, G40/G41 + R08).
# PUBLIC_HOST — техническое имя `<ipv4>.sslip.io` ИЛИ собственный домен
# (проверка формата — infra/host_names.sh, оба типа строгие).
# Переезд на свой домен (R08: репутационные фильтры мобильных операторов
# к wildcard-DNS): сертификат выпускается ТЕМ ЖЕ процессом на новое имя;
# старое имя из LEGACY_PUBLIC_HOST (опционально) добавляется вторым SAN,
# чтобы 301 со старого по HTTPS не упирался в чужой сертификат.
# vash-domen.ru — плейсхолдер из документации, выпуск на него запрещён.
#
# Выполняется ОПЕРАТОРОМ НА СЕРВЕРЕ до первого ./deploy.sh (к живому серверу
# из worktree не подключаться — здесь только код). Standalone-режим: порт 80
# свободен, nginx ещё не поднят. Продление — infra/tls_renew.sh (webroot,
# без остановки nginx). Состояние ACME — в docker volume (ключи и аккаунты
# не попадают в git); в nginx/certs/ кладётся только копия пары для nginx.
set -euo pipefail

cd "$(dirname "$0")"

# shellcheck source=host_names.sh
. ./host_names.sh

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
LEGACY_PUBLIC_HOST="${LEGACY_PUBLIC_HOST:-$(env_value LEGACY_PUBLIC_HOST)}"

host_require_valid "PUBLIC_HOST" "$PUBLIC_HOST" || exit 1
if [ -n "$LEGACY_PUBLIC_HOST" ]; then
  host_require_valid "LEGACY_PUBLIC_HOST" "$LEGACY_PUBLIC_HOST" || exit 1
  if [ "$(_host_lower "$LEGACY_PUBLIC_HOST")" = "$(_host_lower "$PUBLIC_HOST")" ]; then
    echo "ОШИБКА: LEGACY_PUBLIC_HOST совпадает с PUBLIC_HOST." >&2
    exit 1
  fi
fi
ACME_EMAIL="${ACME_EMAIL:-$(env_value ACME_EMAIL)}"
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
# Старое имя (если задано) — вторым SAN того же сертификата: 301 со старого
# по HTTPS иначе упрётся в чужой SAN. Массив всегда непуст (минимум -d нового),
# поэтому раскрытие безопасно и под set -u на старых bash.
CERT_DOMAINS=(-d "$PUBLIC_HOST")
if [ -n "$LEGACY_PUBLIC_HOST" ]; then
  CERT_DOMAINS+=(-d "$LEGACY_PUBLIC_HOST")
fi
docker run --rm \
  -p 80:80 \
  -v "$CONF_VOLUME:/etc/letsencrypt" \
  "$CERTBOT_IMAGE" certonly --standalone \
  "${CERT_DOMAINS[@]}" --email "$ACME_EMAIL" --agree-tos --non-interactive \
  "${STAGING_ARGS[@]}"

mkdir -p nginx/certs
docker run --rm \
  -v "$CONF_VOLUME:/etc/letsencrypt:ro" \
  -v "$PWD/nginx/certs:/out" \
  alpine:3.20 sh -c "cp /etc/letsencrypt/live/$PUBLIC_HOST/fullchain.pem /out/fullchain.pem && cp /etc/letsencrypt/live/$PUBLIC_HOST/privkey.pem /out/privkey.pem && chmod 644 /out/fullchain.pem && chmod 600 /out/privkey.pem"

echo "Сертификат для $PUBLIC_HOST установлен в nginx/certs/."
echo "Дальше: ./deploy.sh (TLS-гейт проверит SAN и годность до сборки)."
