# SPEC-05: Наблюдаемость, кэширование и заголовки (M-03, M-05, L-03, L-06, I-03)

## Контекст
M-03: `achievements.py:75`/`news.py:327` ETag без `Vary`/`private` — публичный кэш может отдать чужое; инвалидация по `updated_at` не срабатывает если `sort_order` меняется без `updated_at`. M-05: `nginx/nginx.prod.conf:1` не форвардит `X-Request-ID` → сквозная трассировка `P-10` обрывается. L-03: дублирование `CVD_MAX_AGE_SECONDS 7d` в `file_storage.py:44` и `alerter.py:384` (magic). L-06: `technologies` каталог без ETag (пропуск P-09). I-03: `file_storage.py:67` versioning best-effort без init job. Затронуты `app/api/v1/achievements.py`, `news.py`, `technologies.py`, `infra/nginx/nginx.prod.conf`, `app/core/config.py`, `app/services/file_storage.py`, `infra/alerter/alerter.py`, `app/core/logging_config.py`.

## Цель
ETag кэш корректен (`Vary`, `private` где нужно, инвалидация), `X-Request-ID` сквозь nginx, CVD константа единая, `technologies` кэширован, versioning метрика reliable.

## Не входит
Scheduler (SPEC-07), CSP (SPEC-06), Redis async (SPEC-02).

## Функциональные требования
- `FR-01` `GET /achievements/catalog` и `/news/categories` → `ETag: W/"<md5>"`, `Cache-Control: public, max-age=300` (уже) + `Vary: Accept-Encoding`. Если `Authorization` header присутствует → `Cache-Control: private, max-age=300` (не отдавать публичному кэшу). `If-None-Match` → 304 как сейчас.
- `FR-02` `GET /technologies` (каталог 66 медалей уже, но `technologies` отдельный) — добавить тот же ETag 300s (если эндпоинт есть) или `Document` если нет — не создавать новый, только если существует `GET /technologies` (проверить `technologies.py`).
- `FR-03` `nginx` → `proxy_set_header X-Request-ID $req_id` где `$req_id = $http_x_request_id` если прислан валидный, иначе `$request_id` (`map`). `log_format` включает `$http_x_request_id` и `$request_id`.
- `FR-04` `CVD_MAX_AGE_SECONDS` единая константа в `app/core/config.py` (`cvd_max_age_seconds: int = 604800`) или `settings`, обе `file_storage.py` и `alerter.py` читают оттуда (или `settings`).
- `FR-05` `ETag` payload включает `sort_order` и `updated_at` (уже `id:slug:updated_at`, но `sort_order` уже в `achievements` На самом деле `achievements.py:75` `id:slug:updated_at` без `sort_order` — добавить `sort_order`).

## Нефункциональные
- Производительность: `Vary` не увеличивает latency, `technologies` кэш снижает DB `select` на 66 строк × RPS.
- Надёжность: `CVD` константа — один источник.

## Техническое решение
- `achievements.py:75` `etag_payload = "|".join(f"{a.id}:{a.slug}:{a.sort_order}:{a.updated_at.isoformat()...}"` + `response.headers["Vary"]="Accept-Encoding"` + `if request.headers.get("authorization"): cache="private, max-age=300" else "public..."`.
- `technologies.py` — аналогично, если роут существует.
- `nginx/nginx.prod.conf` top: `map $http_x_request_id $req_id { default $http_x_request_id; "" $request_id; }` + в каждом `location proxy_set_header X-Request-ID $req_id;` + `log_format main '... req_id=$req_id upstream=$http_x_request_id'`.
- `config.py` добавить `cvd_max_age_seconds: int = 7*24*3600` → `file_storage.py:44` `CVD_MAX_AGE_SECONDS = settings.cvd_max_age_seconds`, `alerter.py:384` `max_age_seconds = settings.cvd_max_age_seconds` (но alerter вне app — читать env `CVD_MAX_AGE_SECONDS` или дублировать константу в `alerter.py` и тесте).
- Versioning: `file_storage.py:67` уже best-effort, добавить `logger.info("bucket versioning enabled")` после успеха, не менять init job (P3).

## Сценарии
- **Given** `GET /achievements/catalog` anon, **When** второй `GET` с `If-None-Match` = `ETag`, **Then** 304, `Vary` присутствует.
- **Given** `GET` с `Authorization: Bearer ...`, **When** ответ, **Then** `Cache-Control: private`.
- **Given** `POST /technologies` меняет `sort_order` без `updated_at` (если баг), **When** `GET`, **Then** `ETag` меняется (из-за `sort_order` в payload) → не 304.
- **Given** `curl -H "X-Request-ID: myid12345" https://prod/api/v1/health`, **When** `nginx access.log`, **Then** `myid12345` в логе, `backend` log `request_id=myid12345`.

## Безопасность
- `Vary` + `private` предотвращает кэш-poisoning.

## Тестирование
- Unit: `test_catalog_vary_and_private`, `test_technologies_etag` (если есть), `test_nginx_request_id_forward` (grep config).
- Integration: `test_cvd_const_single_source` (grep).

## Критерии приёмки
- [ ] `Vary` header на `catalog/categories`.
- [ ] `private` когда `Authorization` present.
- [ ] `nginx.conf` `proxy_set_header X-Request-ID`.
- [ ] `CVD` константа единая (grep один источник).
- [ ] `ruff/mypy` pass.

## DoD
FR, тесты, `nginx -t` pass, `pytest` green, доки.
