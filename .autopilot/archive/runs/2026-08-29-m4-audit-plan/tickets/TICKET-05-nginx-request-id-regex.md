# TICKET-05: Nginx X-Request-ID regex map (M-01)

- **Спека:** SPEC-03
- **Проблемы:** M-01 (`nginx/nginx.prod.conf:19` `map $http_x_request_id $req_id` без regex)
- **Приоритет:** P1
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-01,03,06

## Проблема
`map $http_x_request_id $req_id { default $http_x_request_id; "" $request_id; }` → echo любого non-empty (`short`, `::::`) без `^[A-Za-z0-9._-]{8,64}$`. `main.py:188` уже генерирует 32hex для невалидных, но `access.log tz_main req_id=` vs `request_id_ctx` расходятся — трассировка обрывается.

## Требуемый результат
`map "~^[A-Za-z0-9._-]{8,64}$" $http_x_request_id` else `$request_id`, `proxy_set_header X-Request-ID $req_id`×3, `log_format tz_main` с `req_id`, `nginx -t` PASS.

## Объём работ
- `read infra/nginx/nginx.prod.conf:19`.
- Заменить:

```nginx
map $http_x_request_id $req_id {
    "~^[A-Za-z0-9._-]{8,64}$" $http_x_request_id;
    default                  $request_id;
}
```

(порядок: regex exact match приоритет, default → $request_id).

- Проверить `access_log /var/log/nginx/access.log tz_main` уже в `server 443`.
- `docker compose -f infra/docker-compose.prod.yml config | grep -A2 req_id`.

## Не входит
`main.py` логика, `CVD` (TICKET-06).

## Компоненты
- Файл: `technozrelost-backend/infra/nginx/nginx.prod.conf:19`

## План
1. `read nginx.prod.conf` → map.
2. Edit map regex.
3. `nginx -t` или `docker run --rm nginx:1.27-alpine nginx -t -c /etc/nginx/nginx.prod.conf` (если нет nginx).
4. `grep -c proxy_set_header\ X-Request-ID` 3.

## Пограничные случаи
- `X-Request-ID: ValidReqID_123` 13 → echo.
- `short` 5 → $request_id.
- без header → $request_id.

## Тесты
- `grep map.*req_id` + `grep proxy_set_header X-Request-ID`.

## Критерии приёмки
- [ ] `map` содержит `~^[A-Za-z0-9._-]{8,64}$`.
- [ ] `proxy_set_header X-Request-ID $req_id` ×3.
- [ ] `nginx -t` PASS.

## Команды проверки
- `grep -A2 "map.*req_id" technozrelost-backend/infra/nginx/nginx.prod.conf`
- `grep -c "proxy_set_header X-Request-ID" technozrelost-backend/infra/nginx/nginx.prod.conf`
- `docker compose -f technozrelost-backend/infra/docker-compose.prod.yml config 2>&1 | head -n 20`

## Риски
- `log_format main` duplicate — уже `tz_main` ок.
