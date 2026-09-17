#!/usr/bin/env bash
# Деплой платформы «Технозрелость» одной командой.
# Требования: Linux + Docker + Docker Compose. Запускать из infra/.
set -euo pipefail

# REPAIR 2026-09-17 (redirect-reload): юнит-тест сорсит файл, чтобы проверить
# reload-логику моками без docker. При source только определяем функции ниже,
# top-level выполнение (cd, проверки, диспетчер) пропускается флагом.
# Bash 3.2-совместимо (macOS): только [ ], без ассоциативных массивов.
if [[ "${BASH_SOURCE[0]:-}" != "${0}" ]]; then
  TZ_DEPLOY_SOURCED=1
else
  TZ_DEPLOY_SOURCED=0
fi

if [ "${TZ_DEPLOY_SOURCED}" -eq 0 ]; then
  cd "$(dirname "$0")"
fi

# shellcheck source=host_names.sh
. ./host_names.sh

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT_SECONDS:-300}"
# P1 (таск 01): одноузловой контур — ровно один backend. Гейт по-прежнему
# считает здоровые контейнеры backend явно, а не довольствуется их наличием.
BACKEND_EXPECTED_REPLICAS="${BACKEND_EXPECTED_REPLICAS:-1}"
BACKEND_IMAGE="technozrelost-backend"
FRONTEND_IMAGE="technozrelost-frontend"
HEALTH_SERVICES=(db minio clamav redis backend backup-timer wal-offsite alerter frontend nginx prometheus grafana)

usage() {
  cat <<'EOF'
Использование:
  ./deploy.sh                 собрать и выкатить текущий git SHA
  ./deploy.sh rollback TAG    вручную выкатить сохранённый TAG (например previous)
  ./deploy.sh check-env       проверить/генерировать секреты окружения без выкладки
  ./deploy.sh --help          показать помощь без изменения конфигурации

Переменные оператора: ENV_FILE, DEPLOY_HEALTH_TIMEOUT_SECONDS, BACKEND_EXPECTED_REPLICAS.
EOF
}

# R06i группа F: --help чистый — без требования ENV_FILE и без изменения
# конфигурации (раньше prepare_environment мутировал файл даже на --help).
# При source (TZ_DEPLOY_SOURCED=1) пропускаем — только определения функций.
if [ "${TZ_DEPLOY_SOURCED}" -eq 0 ]; then
  case "${1:-deploy}" in
    -h|--help)
      if [ "$#" -gt 1 ]; then
        usage >&2
        exit 2
      fi
      usage
      exit 0
      ;;
  esac
fi

if [ "${TZ_DEPLOY_SOURCED}" -eq 0 ] && [ ! -f "$ENV_FILE" ]; then
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

require_public_host() {
  # Таск 07 (G40/G41 + R08): публичный контур — техническое имя
  # <ipv4>.sslip.io ИЛИ собственный домен; localhost отклоняется здесь,
  # а не в проде. LEGACY_PUBLIC_HOST (опционально) — старое имя
  # переходного периода: 301 на новое, формат так же строг.
  PUBLIC_HOST="$(effective_env_value PUBLIC_HOST)"
  host_require_valid "PUBLIC_HOST" "$PUBLIC_HOST" || return 1
  LEGACY_PUBLIC_HOST="$(effective_env_value LEGACY_PUBLIC_HOST)"
  if [ -n "$LEGACY_PUBLIC_HOST" ]; then
    host_require_valid "LEGACY_PUBLIC_HOST" "$LEGACY_PUBLIC_HOST" || return 1
    if [ "$(_host_lower "$LEGACY_PUBLIC_HOST")" = "$(_host_lower "$PUBLIC_HOST")" ]; then
      echo "ОШИБКА: LEGACY_PUBLIC_HOST совпадает с PUBLIC_HOST." >&2
      return 1
    fi
  fi
  export PUBLIC_HOST LEGACY_PUBLIC_HOST
}

render_legacy_redirect() {
  # Таск 07 (R08): nginx-инклуд 301 legacy→canonical из env, без правок кода.
  # Идёт после TLS-гейта (имена уже строгие); рендер проверяет снова.
  if ! ./render_legacy_redirect.sh; then
    echo "ОШИБКА: не сформирован 301-редирект со старого имени." >&2
    return 1
  fi
}

redirect_file_hash() {
  # sha256 от redirect.conf для детекта «файл изменился → reload».
  # Файла нет (первый рендер) — sentinel 'missing', не пустота.
  local file="${1:-${LEGACY_REDIRECT_OUT:-nginx/legacy/redirect.conf}}"
  if [ -f "$file" ]; then
    sha256sum "$file" | cut -d' ' -f1
  else
    printf 'missing'
  fi
}

reload_nginx_if_redirect_changed() {
  # REPAIR 2026-09-17: bind-mount ./nginx/legacy виден в бегущем nginx сразу,
  # но процесс держит старый конфиг в памяти. Образ nginx — pinned
  # (nginx:1.27-alpine, не IMAGE_TAG), поэтому `compose up` контейнер не
  # пересоздаёт и 301 со старого имени не применяется до ручного reload —
  # именно так редирект «не работал» после зелёного деплоя. Сравниваем hash
  # до/после рендера: изменился → `compose exec -T nginx nginx -s reload`
  # (без разрыва соединений, как в tls_renew.sh); неуспех — fail-closed (1),
  # вызывающий код делает rollback/fail. Не изменился → 0 без вызова docker.
  # $1 — hash до рендера; $2 — файл (дефолт из LEGACY_REDIRECT_OUT).
  # Секретов нет (только публичные имена в конфиге) — значения не печатаем.
  local before_hash="${1:-missing}"
  local file="${2:-${LEGACY_REDIRECT_OUT:-nginx/legacy/redirect.conf}}"
  local after_hash
  after_hash="$(redirect_file_hash "$file")"
  if [ "$before_hash" = "$after_hash" ]; then
    echo "301-редирект не изменился — reload nginx не нужен ($file)."
    return 0
  fi
  echo "301-редирект изменился — перезагружаю nginx (reload без разрыва соединений)..."
  if ! compose exec -T nginx nginx -s reload; then
    echo "ОШИБКА: nginx не перезагрузил 301-редирект — на диске новый, в памяти старый." >&2
    return 1
  fi
}

run_routing_gate() {
  # REPAIR 2026-09-17: гейт маршрутизации ДО переключения — ловит 301-петлю
  # (legacy-блок первым на порту + основные без default_server: неизвестное
  # SNI/Host, включая новое каноническое имя, уходило в legacy-301 на само
  # себя). Проверяет склейку целиком (nginx.prod.conf + сгенерированный
  # legacy-файл) в обоих порядках инклудов. Секреты не читает и не печатает
  # (только публичные имена DNS). Вызывается в deploy И rollback: откат идёт
  # тем же путём, а конфиг на диске уже новый — без гейта петля прошла бы.
  if ! PUBLIC_HOST="$PUBLIC_HOST" LEGACY_PUBLIC_HOST="${LEGACY_PUBLIC_HOST:-}" \
    NGINX_PROD_CONF="${NGINX_PROD_CONF:-nginx/nginx.prod.conf}" \
    LEGACY_REDIRECT_FILE="${LEGACY_REDIRECT_OUT:-nginx/legacy/redirect.conf}" \
    python3 ./nginx_routing_gate.py; then
    echo "ОШИБКА: маршрутизация nginx ведёт в 301-петлю — выкладка остановлена до переключения." >&2
    return 1
  fi
}

run_tls_gate() {
  # Таск 07 (G40/G41): строгий TLS-гейт ДО сборки — localhost/HTTP-URL,
  # SAN-несоответствие и скорая экспирация роняют деплой вместо молчаливого
  # самоподписанного fallback. Лимиты и preflight таска 04 не трогаем.
  local nextauth cors tls_cert tls_key tls_min_validity legacy
  nextauth="$(effective_env_value NEXTAUTH_URL)"
  cors="$(effective_env_value CORS_ORIGINS)"
  legacy="$(effective_env_value LEGACY_PUBLIC_HOST)"
  tls_cert="$(effective_env_value TLS_CERT_FILE)"
  tls_key="$(effective_env_value TLS_KEY_FILE)"
  tls_min_validity="$(effective_env_value TLS_MIN_VALIDITY_DAYS)"
  # Экспорт только заданных оператором значений: пустые не затирают дефолты
  # гейта (nginx/certs, 14 дней; отсутствие LEGACY = редирект выключен),
  # заданные доходят до гейта как есть.
  if [ -n "$legacy" ]; then export LEGACY_PUBLIC_HOST="$legacy"; fi
  if [ -n "$tls_cert" ]; then export TLS_CERT_FILE="$tls_cert"; fi
  if [ -n "$tls_key" ]; then export TLS_KEY_FILE="$tls_key"; fi
  if [ -n "$tls_min_validity" ]; then export TLS_MIN_VALIDITY_DAYS="$tls_min_validity"; fi
  PUBLIC_HOST="$PUBLIC_HOST" NEXTAUTH_URL="$nextauth" CORS_ORIGINS="$cors" \
    python3 ./tls_deploy_gate.py || return 1
}

prepare_environment() {
  # Сохраняем прежнюю генерацию секретов, но не перезаписываем уже заданный
  # JWT/NEXTAUTH_SECRET, если заглушка есть только у второго ключа.
  ensure_generated_secret JWT_SECRET
  ensure_generated_secret NEXTAUTH_SECRET
  ensure_generated_secret REDIS_PASSWORD
  require_strong_auth_secret JWT_SECRET
  require_strong_auth_secret NEXTAUTH_SECRET
  require_production_secret POSTGRES_PASSWORD
  require_production_secret MINIO_SECRET_KEY
  require_production_secret REDIS_PASSWORD
  require_grafana_password
  require_replication_password

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
  # Таск 07 (G41): финальный health-гейт идёт по верифицированному HTTPS
  # публичного хоста — без отключения проверки сертификата (-k запрещён).
  # Успех доказывает сразу три приёмки: имя резолвится, цепочка доверенная,
  # readiness отвечает.
  curl -fsS --max-time 5 -o /dev/null "https://$PUBLIC_HOST/api/v1/ready"
}

validate_replicas() {
  case "$BACKEND_EXPECTED_REPLICAS" in
    ''|*[!0-9]*)
      echo "ОШИБКА: BACKEND_EXPECTED_REPLICAS должен быть целым числом." >&2
      return 1
      ;;
  esac
  if [ "$BACKEND_EXPECTED_REPLICAS" -lt 1 ]; then
    echo "ОШИБКА: BACKEND_EXPECTED_REPLICAS должен быть положительным." >&2
    return 1
  fi
}

wait_for_healthy() {
  local deadline now service ids id status all_healthy backend_ids backend_healthy
  validate_replicas || return 1
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
    # Гейт считает backend отдельно: ноль healthy при ожидании одного роняет гейт.
    backend_ids="$(compose ps -q backend 2>/dev/null || true)"
    backend_healthy=0
    for id in $backend_ids; do
      status="$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || true)"
      if [ "$status" = "healthy" ]; then
        backend_healthy=$((backend_healthy + 1))
      fi
    done
    if [ "$backend_healthy" -ne "$BACKEND_EXPECTED_REPLICAS" ]; then
      all_healthy=0
    fi
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
  # --remove-orphans: откат тоже не оставляет orphan-контейнеров (P1).
  if ! compose up -d --no-build --remove-orphans; then
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

run_preflight() {
  # P1 (таск 04): ресурсный гейт ДО сборки и миграций — слабая машина
  # отклоняется до любых изменений. Без демона Docker, без секретов в выводе.
  if ! python3 ./preflight.py; then
    echo "ОШИБКА: preflight не пройден — машина слабее цели 6 vCPU / 11 ГиБ / 150 ГБ либо превышен бюджет 8 ГиБ." >&2
    return 1
  fi
}

# Юнит-тест сорсит файл ради reload-функций — диспетчер ниже только при запуске.
if [ "${TZ_DEPLOY_SOURCED:-0}" -eq 1 ]; then
  return 0 2>/dev/null || exit 0
fi

case "${1:-deploy}" in
  deploy)
    if [ "$#" -gt 1 ]; then
      usage >&2
      exit 2
    fi
    prepare_environment
    require_public_host
    validate_timeout
    validate_replicas
    run_preflight
    run_tls_gate
    LEGACY_REDIRECT_BEFORE="$(redirect_file_hash "${LEGACY_REDIRECT_OUT:-nginx/legacy/redirect.conf}")"
    render_legacy_redirect
    run_routing_gate
    IMAGE_TAG="$(git rev-parse --short=12 HEAD 2>/dev/null)" || {
      echo "ОШИБКА: не удалось определить git SHA для image tag." >&2
      exit 1
    }
    validate_tag "$IMAGE_TAG"
    export IMAGE_TAG
    save_previous_images

    mkdir -p nginx/certs certbot/www nginx/legacy

    echo "Собираю и поднимаю стек с image tag $IMAGE_TAG..."
    # P1: --remove-orphans убирает контейнеры удалённых сервисов (db-replica),
    # чтобы обновление не оставляло orphan-контейнеров Replica.
    if ! compose up -d --build --remove-orphans; then
      echo "ОШИБКА: выкладка не запустилась, выполняю rollback previous." >&2
      automatic_rollback || true
      exit 1
    fi
    if ! wait_for_healthy; then
      echo "ОШИБКА: выкладка не прошла health-gate, выполняю rollback previous." >&2
      automatic_rollback || true
      exit 1
    fi
    if ! reload_nginx_if_redirect_changed "$LEGACY_REDIRECT_BEFORE" "${LEGACY_REDIRECT_OUT:-nginx/legacy/redirect.conf}"; then
      echo "ОШИБКА: выкладка не применила 301-редирект в running nginx, выполняю rollback previous." >&2
      automatic_rollback || true
      exit 1
    fi
    echo "Выкладка $IMAGE_TAG прошла health-gate."
    echo "Проверка: curl https://$PUBLIC_HOST/api/v1/health"
    echo "Сертификат: выпуск — ./tls_issue.sh, продление — ./tls_renew.sh."
    ;;
  rollback)
    if [ "$#" -ne 2 ]; then
      usage >&2
      exit 2
    fi
    prepare_environment
    require_public_host
    validate_timeout
    validate_replicas
    run_preflight
    run_tls_gate
    LEGACY_REDIRECT_BEFORE="$(redirect_file_hash "${LEGACY_REDIRECT_OUT:-nginx/legacy/redirect.conf}")"
    render_legacy_redirect
    run_routing_gate
    rollback_to_tag "$2"
    if ! reload_nginx_if_redirect_changed "$LEGACY_REDIRECT_BEFORE" "${LEGACY_REDIRECT_OUT:-nginx/legacy/redirect.conf}"; then
      echo "ОШИБКА: rollback не применил 301-редирект в running nginx." >&2
      exit 1
    fi
    ;;
  check-env)
    if [ "$#" -ne 1 ]; then
      usage >&2
      exit 2
    fi
    validate_timeout
    validate_replicas
    prepare_environment
    echo "Окружение проверено: секреты на месте."
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
