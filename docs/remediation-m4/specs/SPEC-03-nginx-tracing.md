# SPEC-03: Nginx сквозная трассировка X-Request-ID (M-01)

## Контекст
`technozrelost-backend/infra/nginx/nginx.prod.conf:19` — `map $http_x_request_id $req_id { default $http_x_request_id; "" $request_id; }` → echo любого non-empty `X-Request-ID` без валидации `^[A-Za-z0-9._-]{8,64}$`. `app/main.py:188` уже валидирует `re.fullmatch` и генерирует `uuid4().hex` для невалидных, но `nginx` прокидывает `short`, `::::`, или даже `a+b` в `proxy_set_header X-Request-ID $req_id` — корреляция `access.log tz_main req_id=` vs `request_id_ctx` в `logging_config.py` расходится. Аудит M-01. Затронуты `infra/nginx/nginx.prod.conf` (http map + `log_format tz_main` + 3 `proxy_set_header`), `app/main.py` (не менять).

Текущее неправильно: `curl -H X-Request-ID:short https://prod/api/v1/health` → `access.log req_id=short` но `backend` log `request_id=32hex` — трассировка обрывается.

## Цель
`X-Request-ID` сквозной: валидные `^[A-Za-z0-9._-]{8,64}$` echo, иначе `$request_id` (32 hex).

## Не входит
Изменение `main.py` логики (уже FIFO), `auth_throttle` (SPEC-04), `CVD` (SPEC-04).

## Функциональные требования
- `FR-01` `GET /api/v1/health` с `X-Request-ID: ValidReqID_123` (13 chars, matches) → `nginx` `proxy_set_header X-Request-ID ValidReqID_123`, `access.log` `req_id=ValidReqID_123`, backend `request_id_ctx` тот же.
- `FR-02` `X-Request-ID: short` (5) → `nginx` шлёт `$request_id` (32 hex), не `short`; `access.log` содержит 32 hex, `backend` тот же.
- `FR-03` `X-Request-ID: a\r\nX:1` — `nginx` HTTP не пропустит CRLF, но `map` с regex отбросит, шлёт `$request_id`.
- `FR-04` `log_format tz_main` содержит `req_id=$req_id upstream_x_request_id="$http_x_request_id" request_id="$request_id"` и `access_log /var/log/nginx/access.log tz_main` в `server 443`.

## Нефункциональные
- Совместимость: `nginx -t` PASS, `log_format main` не дублируется (`tz_main` уже).
- Производительность: `map regex` один `~` — negligible.

## Техническое решение
- `infra/nginx/nginx.prod.conf` top http: заменить

```nginx
map $http_x_request_id $req_id {
    default $http_x_request_id;
    ""      $request_id;
}
```

на

```nginx
map $http_x_request_id $req_id {
    "~^[A-Za-z0-9._-]{8,64}$" $http_x_request_id;
    default                  $request_id;
}
```

(порядок: regex exact match приоритет, иначе default). Проверить `nginx -T` и `docker compose -f infra/docker-compose.prod.yml config`.

- 3 `proxy_set_header X-Request-ID $req_id` уже есть — не дублировать, проверить `location /api/v1/`, `/api/v1/auth/`, `/`.
- `log_format tz_main` уже, `access_log` уже в `server 443` — не трогать, только `map` изменение.

## Сценарии
- **Given** `curl -H X-Request-ID:ValidReqID_123 https://prod/api/v1/health` **When** запрос **Then** `resp.headers x-request-id=ValidReqID_123`, `access.log` `req_id=ValidReqID_123`.
- **Given** `curl -H X-Request-ID:short` **When** **Then** `resp.headers x-request-id=32hex`, `access.log req_id=32hex`.
- **Given** без `X-Request-ID` **When** **Then** оба `req_id=32hex`, `$request_id` сгенерен nginx.

## Безопасность
- Regex предотвращает log injection через `X-Request-ID`.

## Тестирование
- `grep -c "map.*req_id" nginx.prod.conf` 1, `grep -c "proxy_set_header X-Request-ID" nginx.prod.conf` 3.
- `nginx -t` (или `docker run --rm nginx:1.27-alpine nginx -t -c /etc/nginx/nginx.prod.conf` если локально нет).

## Критерии приёмки
- [ ] `map` содержит `~^[A-Za-z0-9._-]{8,64}$`.
- [ ] `proxy_set_header X-Request-ID $req_id` ×3.
- [ ] `nginx -t` PASS, `access_log tz_main` присутствует.

## Definition of Done
FR, `nginx -t` PASS, `ruff/mypy` untouched, доки, нет TODO.
