# TICKET-09: Nginx X-Request-ID forwarding (M-05)

- **Спека:** SPEC-05
- **Проблемы:** M-05 (nginx не форвардит `X-Request-ID`)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** TICKET-03 (async throttle, но можно параллельно)
- **Можно параллельно с:** TICKET-06,07,08,11

## Проблема
`P-10` `RequestIDMiddleware` генерирует `X-Request-ID` в API, но `nginx/nginx.prod.conf:1` не `proxy_set_header X-Request-ID` → сквозная трассировка `nginx→API→БД` обрывается, `logging_config.py:19` `request_id_ctx` в nginx логах нет корреляции.

## Требуемый результат
`nginx` прокидывает `X-Request-ID`: если клиент прислал валидный → echo, иначе генерирует `$request_id` и ставит `proxy_set_header X-Request-ID $req_id`; `access_log` содержит `req_id`.

## Объём работ
- `infra/nginx/nginx.prod.conf` top: `map $http_x_request_id $req_id { default $http_x_request_id; "" $request_id; }` (или `map` с regex валидацией `[A-Za-z0-9._-]{8,64}`).
- В каждом `location proxy_pass` (`/api/v1/auth/`, `/api/v1/`, `/`) добавить `proxy_set_header X-Request-ID $req_id;`.
- `log_format main '$remote_addr - $req_id ... $http_x_request_id'` + `access_log /var/log/nginx/access.log main`.

## Не входит
Async throttle (TICKET-03), CSP (TICKET-12).

## Компоненты
- Файл: `infra/nginx/nginx.prod.conf`

## План
1. `read nginx.prod.conf`.
2. Добавить `map` и `proxy_set_header` в 3 location.
3. `nginx -t` внутри `nginx:1.27-alpine` контейнера.
4. `docker compose config` не ломает.

## Пограничные случаи
- `X-Request-ID` с CRLF — `map` не фильтрует, но `backend` уже фильтрует (TICKET-02) → echo invalid → backend генерирует новый — ок.
- `$request_id` — nginx генерирует 32 hex (модуль `ngx_http_core_module`).

## Тесты
- `test_nginx_request_id_forward` — `grep -c "proxy_set_header X-Request-ID" nginx.prod.conf` ==3.
- Ручной `curl -H "X-Request-ID: myid12345" https://prod/api/v1/health -i` → `X-Request-ID: myid12345` в ответе и в `access.log`.

## Критерии приёмки
- [ ] `map` + 3 `proxy_set_header`.
- [ ] `nginx -t` pass.
- [ ] `grep` 3 headers.

## Команды проверки
- `docker run --rm -v $(pwd)/infra/nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro nginx:1.27-alpine nginx -t`
- `grep -n "X-Request-ID" infra/nginx/nginx.prod.conf`

## Риски
- `map` вне `http` контекста → `nginx -t` fail — положить в `http` include (в `nginx.prod.conf` уже `http` via `conf.d`, `map` должен быть в `http`).
