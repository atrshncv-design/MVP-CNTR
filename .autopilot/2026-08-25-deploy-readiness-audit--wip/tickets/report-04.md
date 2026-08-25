# Report 04 — Безопасность бэкенда (R05)

База: `autopilot/deploy-readiness-code` @ babc9b9. Зона: `technozrelost-backend/app` + `tests`. Коммитов нет.

## Реестр находок

Формат: `{id, область, файл:строка, severity, описание, действие}`.

| id | файл:строка | severity | описание | действие |
|---|---|---|---|---|
| F04-01 | app/api/v1/auth.py:76 | высоко | Брутфорс `/auth/login`: одинаковое сообщение было, лимита попыток не было | исправлено — `app/services/auth_throttle.py`: 10 неудач за 60с на пару (email-хеш+IP) → 429; успех сбрасывает счётчик; тесты `test_auth_throttle.py` |
| F04-02 | app/api/v1/files.py:81 | средне | Файл читался в память целиком (`await file.read()`) до проверки размера → DoS большим телом | исправлено — `read_upload_limited()`: чтение порциями, обрыв на 25МБ → 413; тесты `test_upload_hardening.py` |
| F04-03 | app/api/v1/files.py:132 | средне | ClamAV fail-open: при недоступности clamd (`scan_status=error`, как и `pending`) файл оставался скачиваемым | исправлено — fail-closed: скачивание только `clean`, иначе 409; тесты `test_scan_failclosed.py` |
| F04-04 | app/main.py:38 | средне | Не было глобального лимита тела запроса | исправлено — middleware по Content-Length > 32МБ (`max_request_body_mb`) → 413 до обработчика; тесты `test_body_limit.py` |
| F04-05 | app/core/config.py:66 | средне | В production стартовал бы с дефолтным `JWT_SECRET` (известная константа) | исправлено — model_validator: `APP_ENV=production` + пустой/дефолтный секрет → отказ старта; тесты `test_prod_guard.py` |
| F04-06 | app/main.py:52 | низко | Отсутствовали базовые security-заголовки | исправлено — middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`; тест `test_security_headers.py` |
| F04-07 | app/services/ai_assistant.py:29 | низко | LLM-вызов: таймаут 60с и fallback есть, retry-политики нет | рекомендация — 1–2 повторa с backoff при 5xx/сетевых ошибках |
| F04-08 | app/main.py:46 | низко | `/docs`, `/redoc`, `/openapi.json` доступны анонимно | рекомендация — в проде `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)` при `app_env=production` |
| F04-09 | app/services/auth_throttle.py | низко | In-memory лимитеры (auth_throttle, ai_metrics) не разделяются между воркерами uvicorn | рекомендация — Redis-бэкенд при переходе к нескольким воркерам/репликам |
| F04-10 | app/api/v1/realtime.py:50 | низко | SSE принимает `access_token` query-параметром (ограничение EventSource): токен в URL может попасть в чужие прокси-логи; собственные логи маскирует `redact()` | рекомендация — короткоживущий одноразовый ticket-токен для SSE |

## Проверено — чисто

- **JWT/python-jose 3.5.0**: алгоритм зафиксирован (`HS256`, decode c явным списком — `none`/алгоритм-конфузия исключены); access 60мин / refresh 14д; refresh ротация + отзыв + хеш SHA-256 в БД.
- **passlib/bcrypt**: без ослаблений (дефолтные rounds=12, deprecated="auto").
- **Инъекции**: ORM повсеместно; сырой SQL только в `notifications.claim_next_task` (bound-параметр), `rag` (bound-параметры), `realtime` (статический SELECT), `health` (`SELECT 1`). `eval/exec/pickle/subprocess/os.system` — отсутствуют.
- **Файлы**: MIME по сигнатуре (не по Content-Type), имена UUID (path traversal исключён), лимит 25МБ, ClamAV INSTREAM, infected не отдаётся.
- **Неверный логин**: единое сообщение «Неверный email или пароль» (перечисление пользователей затруднено); теперь ещё и троттлинг.
- **DEBUG**: uvicorn reload только `app_env=dev`; stack traces наружу не уходят (JSON-логи, redact секретов/Bearer/email).
- **LLM**: ключ только в заголовке исходящего запроса, не логируется; недоступность провайдера → метрика ошибки + RAG-fallback, платформа не падает.
- **Зависимости**: `pip-audit -l` (вся env с dev-экстрами) → **No known vulnerabilities found**. Обновлений не требуется.
- **CORS**: явный список origin из `CORS_ORIGINS` (не `*`), credentials включён.

## Матрица «эндпоинт × роль»

Роли (9): `gk_customer`, `rd_executor`, `scientific_org`, `serial_manufacturer`, `ugt_expert`, `auditor`, `investor`, `cntr_admin`, `cntr_manager`. Обозначения: **А** = аноним, **Л** = любой аутентифицированный, staff = cntr_manager/cntr_admin, владелец = создатель или активный участник проекта (чужим — **404**, не 403: не раскрываем существование). Суперпользователь проходит все проверки ролей.

| Эндпоинт (группа) | Аноним | Любая роль | Ограничение роли |
|---|---|---|---|
| POST /auth/register, /login, /refresh | ✅ публично | — | register запрещает staff-роли (403); login: троттлинг 429 |
| GET /health, /ready, /metrics | ✅ публично | — | по дизайну (без ПДн/секретов) |
| GET /projects/registry, /executors, /nioktr* | ✅ публично | — | опциональная аутентификация |
| GET /assessments/template | ✅ публично | — | справочник ГОСТ |
| GET /auth/me; PATCH /users/me; POST /users/me/password | ❌ 401 | ✅ Л | только свой профиль/пароль |
| POST /projects; POST /assessments; GET /assessments/mine | ❌ 401 | ✅ Л | свои записи |
| /profile*, /orgs* (свои) | ❌ 401 | ✅ Л | свой профиль/свои организации |
| POST /chat (+429 AI-лимит), GET /chat/metrics/ai | ❌ 401 | ✅ Л | — |
| /rag/templates (GET/POST), /rag/search; GET /technologies | ❌ 401 | ✅ Л | — |
| /notifications (list/read/stream) | ❌ 401 | ✅ Л | только свои уведомления |
| GET/PATCH /projects/{id}, files, requests*, comments, conclusion.pdf, generate/*, control-points, export, questionnaire | ❌ 401 | участник | владелец/активный участник/staff; чужой → 404 |
| DELETE /projects/{id}, publish, archive | ❌ 401 | владелец/staff | чужой → 404 |
| /invites create/list/revoke, transfer-admin | ❌ 401 | project_admin | полномочие внутри проекта; accept — любой Л |
| PATCH /projects/{id}/legal | ❌ 401 | — | только cntr_manager/cntr_admin (403) |
| membership: priority patch | ❌ 401 | — | только cntr_manager (403) |
| /manager/queue/*, /manager/tasks/*, emit | ❌ 401 | — | cntr_manager/cntr_admin (403) |
| /manager/profiles/*, /manager/orgs/* | ❌ 401 | — | cntr_manager/cntr_admin (403) |
| GET /users, PATCH /users/{id} | ❌ 401 | — | только cntr_admin (403) |
| GET /admin/audit | ❌ 401 | — | только cntr_admin (403) |

Регресс-тесты критичных запретов: `test_rbac_projects.py` (чужой 404, список скоупится, аноним 401), `test_manager_verification.py`, `test_profile_admin.py`, `test_publication_privacy.py`, новые сьюты фиксов выше.

## Приёмка

- [x] Таблица «эндпоинт × роль» — выше
- [x] Каждая уязвимость исправлена (с регресс-тестом) ИЛИ в реестре с severity/планом
- [x] Backend pytest зелёные: **205 passed** (до таска 191)
- [x] Отчёт по зависимостям: pip-audit чисто, устранять нечего
- [x] За пределами зоны ничего не тронуто; значения `.env*` не копировались (только имена)

## Оговорки

- Транзиентная проблема среды: диск Docker VM заполнялся во время прогонов (DiskFull), чинился очисткой build-cache/образов; финальный полный прогон зелёный. Роль replicator на primary — зона таска 05, не тронута.
- Изменены коды ошибок в двух местах (oversize upload 422→413; download error/pending 200→409) — существующие тесты обновлены намеренно.
