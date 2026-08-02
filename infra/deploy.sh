#!/usr/bin/env bash
# Деплой платформы «Технозрелость» одной командой.
# Требования: Linux + Docker + Docker Compose. Запускать из infra/.
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.production}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Нет файла $ENV_FILE. Создайте его из .env.production.example:"
  echo "   cp .env.production.example $ENV_FILE"
  echo "   и заполните значения (JWT_SECRET, NEXTAUTH_SECRET, LLM_API_KEY…)."
  exit 1
fi

# ── Секреты: генерируем, если не заданы ─────────────────────────────────────
gen_secret() { head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 48; }

if grep -qE '^(JWT_SECRET|NEXTAUTH_SECRET)=change_me' "$ENV_FILE"; then
  echo "ℹ️  Генерирую JWT_SECRET/NEXTAUTH_SECRET…"
  sed -i.bak \
    -e "s/^JWT_SECRET=change_me.*/JWT_SECRET=$(gen_secret)/" \
    -e "s/^NEXTAUTH_SECRET=change_me.*/NEXTAUTH_SECRET=$(gen_secret)/" \
    "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
fi

# ── Сертификаты: самоподписанные, если ещё нет ───────────────────────────────
mkdir -p nginx/certs
if [ ! -f nginx/certs/fullchain.pem ]; then
  echo "ℹ️  Генерирую самоподписанный сертификат (замените на Let's Encrypt)…"
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout nginx/certs/privkey.pem -out nginx/certs/fullchain.pem \
    -subj "/CN=technozrelost" >/dev/null 2>&1
fi

# ── Сборка и запуск ──────────────────────────────────────────────────────────
echo "🚀 Собираю и поднимаю стек…"
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml up -d --build

echo "✅ Готово. Проверка:"
echo "   curl -s http://localhost/api/v1/health"
echo "   curl -sk https://localhost/api/v1/health"
echo "ℹ️  Для настоящего HTTPS: выпустите сертификат Let's Encrypt и"
echo "   положите в infra/nginx/certs/, затем docker compose restart nginx."
