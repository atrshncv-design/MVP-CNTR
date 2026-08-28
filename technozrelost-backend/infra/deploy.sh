#!/usr/bin/env bash
# Деплой платформы «Технозрелость» одной командой.
# Требования: Linux + Docker + Docker Compose. Запускать из infra/.
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT_SECONDS:-300}"
BACKEND_IMAGE="technozrelost-backend"
FRONTEND_IMAGE="technozrelost-frontend"
HEALTH_SERVICES=(db db-replica minio clamav redis backend backup-timer wal-offsite alerter frontend nginx prometheus grafana)

usage() {
  cat <<'EOF'
Использование:
  ./deploy.sh                 собрать и выкатить текущий git SHA
  ./deploy.sh rollback TAG    вручную выкатить сохранённый TAG (например previous)

Переменные оператора: ENV_FILE, DEPLOY_HEALTH_TIMEOUT_SECONDS.
EOF
}

if [ ! -f "$ENV_FILE" ]; then
  echo "Нет файла $ENV_FILE. Создайте его из .env.production.example:"
  echo "  cp .env.production.example $ENV_FILE"
  echo "и заполните значения (JWT_SECRET, NEXTAUTH_SECRET, LLM_API_KEY...)."
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

env_value() {
  local key="$1"
  local line value
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  case "$value" in
    "\""*"\"") value="${value:1:${#value}-2}" ;;
    "'"*"'") value="${value:1:${#value}-2}" ;;
  esac
  printf '%s' "$value"
}

effective_env_value() {
  local key="$1"
  if [ "${!key+x}" = x ]; then
    printf '%s' "${!key}"
  else
    env_value "$key"
  fi
}

gen_secret() {
  # 32 случайных байта дают 256 бит энтропии; hex безопасен для .env без
  # дополнительного экранирования.
  openssl rand -hex 32
}

replace_env_value() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak -e "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

ensure_generated_secret() {
  local key="$1"
  local value
  value="$(env_value "$key")"
  case "$value" in
    ""|change_me*) replace_env_value "$key" "$(gen_secret)" ;;
  esac
}

require_grafana_password() {
  local value
  value="$(effective_env_value GRAFANA_ADMIN_PASSWORD)"
  case "$value" in
    ""|admin|password|default|change_me*|changeme*)
      echo "ОШИБКА: GRAFANA_ADMIN_PASSWORD должен быть задан и не может быть значением по умолчанию."
      return 1
      ;;
  esac
}

require_replication_password() {
  local value
  value="$(effective_env_value REPL_PASSWORD)"
  case "$value" in
    ""|replica_pass|password|default|change_me*|changeme*)
      echo "ОШИБКА: REPL_PASSWORD должен быть задан и не может быть значением по умолчанию."
      return 1
      ;;
  esac
}

is_known_default_secret() {
  local value
  value="$(printf '%s' "$1" | LC_ALL=C tr '[:upper:]' '[:lower:]')"
  case "$value" in
    ""|admin|change_me*|changeme*|change-it*|default|example|minioadmin|\
    minioadmin123|password|postgres|replica_pass|secret|test)
      return 0
      ;;
  esac
  return 1
}

require_production_secret() {
  local key="$1"
  local value
  value="$(effective_env_value "$key")"
  if is_known_default_secret "$value"; then
    echo "ОШИБКА: $key должен быть задан и не может быть пустым или значением по умолчанию." >&2
    return 1
  fi
}

require_strong_auth_secret() {
  local key="$1"
  local value unique_characters
  value="$(effective_env_value "$key")"

  if is_known_default_secret "$value"; then
    echo "ОШИБКА: $key должен быть задан и не может быть пустым или значением по умолчанию." >&2
    return 1
  fi
  if [ "${#value}" -lt 32 ]; then
    echo "ОШИБКА: $key должен содержать не менее 32 символов случайного значения." >&2
    return 1
  fi
  case "$value" in
    *[[:space:]]*)
      echo "ОШИБКА: $key не должен содержать пробельные символы." >&2
      return 1
      ;;
  esac
  unique_characters="$(printf '%s' "$value" | LC_ALL=C fold -w 1 | LC_ALL=C sort -u | wc -l | tr -d '[:space:]')"
  if [ "$unique_characters" -lt 8 ]; then
    echo "ОШИБКА: $key должен быть криптографически случайным значением." >&2
    return 1
  fi
}

warn_placeholder() {
  local key="$1"
  local value
  value="$(env_value "$key")"
  case "$value" in
    ""|change_me*)
      echo "ВНИМАНИЕ: $key оставлен заглушкой — перед production-деплоем заполните реальным значением."
      ;;
  esac
}

prepare_environment() {
  # Сохраняем прежнюю генерацию секретов, но не перезаписываем уже заданный
  # JWT/NEXTAUTH_SECRET, если заглушка есть только у второго ключа.
  ensure_generated_secret JWT_SECRET
  ensure_generated_secret NEXTAUTH_SECRET
  require_strong_auth_secret JWT_SECRET
  require_strong_auth_secret NEXTAUTH_SECRET
  require_production_secret POSTGRES_PASSWORD
  require_production_secret MINIO_SECRET_KEY
  require_grafana_password
  require_replication_password

  warn_placeholder NEXTAUTH_URL
  warn_placeholder CORS_ORIGINS
  if [ -z "$(env_value LLM_API_KEY)" ]; then
    echo "ИНФОРМАЦИЯ: LLM_API_KEY пуст — AI-функции будут недоступны (не блокирует запуск)."
  fi
}

validate_tag() {
  local tag="$1"
  if [[ ! "$tag" =~ ^[[:alnum:]_.-]+$ ]]; then
    echo "ОШИБКА: недопустимый image tag." >&2
    return 1
  fi
}

first_container_for() {
  local service="$1"
  local ids id
  ids="$(compose ps -q "$service" 2>/dev/null || true)"
  for id in $ids; do
    printf '%s' "$id"
    return 0
  done
  return 1
}

save_running_image() {
  local service="$1"
  local image="$2"
  local container current_image
  container="$(first_container_for "$service" || true)"
  if [ -z "$container" ]; then
    return 1
  fi
  current_image="$(docker inspect -f '{{.Config.Image}}' "$container" 2>/dev/null || true)"
  if [ -z "$current_image" ] || ! docker image inspect "$current_image" >/dev/null 2>&1; then
    return 1
  fi
  docker image tag "$current_image" "$image:previous"
}

previous_images_exist() {
  docker image inspect "$BACKEND_IMAGE:previous" >/dev/null 2>&1 \
    && docker image inspect "$FRONTEND_IMAGE:previous" >/dev/null 2>&1
}

save_previous_images() {
  local saved_backend=0
  local saved_frontend=0
  if save_running_image backend "$BACKEND_IMAGE"; then saved_backend=1; fi
  if save_running_image frontend "$FRONTEND_IMAGE"; then saved_frontend=1; fi
  if [ "$saved_backend" -eq 1 ] && [ "$saved_frontend" -eq 1 ]; then
    echo "Предыдущие backend/frontend образы сохранены под тегом previous."
  elif previous_images_exist; then
    echo "Использую ранее сохранённые previous образы для возможного отката."
  else
    echo "Предыдущие образы не найдены: автоматический откат доступен только после первой успешной выкладки."
  fi
}

readiness_ok() {
  curl -kfsS --max-time 5 -o /dev/null https://localhost/api/v1/ready
}

wait_for_healthy() {
  local deadline now service ids id status all_healthy
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))
  while :; do
    all_healthy=1
    for service in "${HEALTH_SERVICES[@]}"; do
      ids="$(compose ps -q "$service" 2>/dev/null || true)"
      if [ -z "$ids" ]; then
        all_healthy=0
        continue
      fi
      for id in $ids; do
        status="$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || true)"
        if [ "$status" != "healthy" ]; then
          all_healthy=0
        fi
      done
    done
    if [ "$all_healthy" -eq 1 ] && readiness_ok; then
      return 0
    fi
    now="$(date +%s)"
    if [ "$now" -ge "$deadline" ]; then
      echo "ОШИБКА: health-gate не пройден за ${HEALTH_TIMEOUT_SECONDS}с." >&2
      return 1
    fi
    sleep 2
  done
}

rollback_to_tag() {
  local tag="$1"
  validate_tag "$tag"
  if ! docker image inspect "$BACKEND_IMAGE:$tag" >/dev/null 2>&1 \
    || ! docker image inspect "$FRONTEND_IMAGE:$tag" >/dev/null 2>&1; then
    echo "ОШИБКА: образы для rollback '$tag' не найдены локально." >&2
    return 1
  fi
  export IMAGE_TAG="$tag"
  echo "Откатываю стек на образы с тегом $tag..."
  if ! compose up -d --no-build; then
    echo "ОШИБКА: Compose не смог поднять rollback '$tag'." >&2
    return 1
  fi
  if ! wait_for_healthy; then
    echo "ОШИБКА: rollback '$tag' не прошёл health-gate." >&2
    return 1
  fi
  echo "Rollback '$tag' прошёл health-gate."
}

automatic_rollback() {
  if ! previous_images_exist; then
    echo "ОШИБКА: previous образы отсутствуют, автоматический rollback невозможен." >&2
    return 1
  fi
  rollback_to_tag previous
}

validate_timeout() {
  case "$HEALTH_TIMEOUT_SECONDS" in
    ''|*[!0-9]*)
      echo "ОШИБКА: DEPLOY_HEALTH_TIMEOUT_SECONDS должен быть целым числом." >&2
      return 1
      ;;
  esac
  if [ "$HEALTH_TIMEOUT_SECONDS" -lt 1 ]; then
    echo "ОШИБКА: DEPLOY_HEALTH_TIMEOUT_SECONDS должен быть положительным." >&2
    return 1
  fi
}

prepare_environment

case "${1:-deploy}" in
  deploy)
    if [ "$#" -gt 1 ]; then
      usage >&2
      exit 2
    fi
    validate_timeout
    IMAGE_TAG="$(git rev-parse --short=12 HEAD 2>/dev/null)" || {
      echo "ОШИБКА: не удалось определить git SHA для image tag." >&2
      exit 1
    }
    validate_tag "$IMAGE_TAG"
    export IMAGE_TAG
    save_previous_images

    mkdir -p nginx/certs
    if [ ! -f nginx/certs/fullchain.pem ]; then
      echo "ИНФОРМАЦИЯ: генерирую самоподписанный сертификат (замените на Let's Encrypt)."
      openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout nginx/certs/privkey.pem -out nginx/certs/fullchain.pem \
        -subj "/CN=technozrelost" >/dev/null 2>&1
    fi

    echo "Собираю и поднимаю стек с image tag $IMAGE_TAG..."
    if ! compose up -d --build; then
      echo "ОШИБКА: выкладка не запустилась, выполняю rollback previous." >&2
      automatic_rollback || true
      exit 1
    fi
    if ! wait_for_healthy; then
      echo "ОШИБКА: выкладка не прошла health-gate, выполняю rollback previous." >&2
      automatic_rollback || true
      exit 1
    fi
    echo "Выкладка $IMAGE_TAG прошла health-gate."
    echo "Проверка: curl -sk https://localhost/api/v1/health"
    echo "Для настоящего HTTPS замените сертификаты в infra/nginx/certs/."
    ;;
  rollback)
    if [ "$#" -ne 2 ]; then
      usage >&2
      exit 2
    fi
    validate_timeout
    rollback_to_tag "$2"
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
