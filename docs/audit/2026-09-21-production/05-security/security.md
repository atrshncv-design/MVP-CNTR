# 05 — Security report: application security и RBAC (static/test/read-only)

Источник: локальный checkout `f364388` (EV-001); production-факты — только
EV-004 (базовые пробы) и EV-016 (заголовки, 2026-09-22T04:05:00Z). Всё остальное —
static/local (Решение 7). Fuzzing, destructive payloads, credential read и
production mutations не выполнялись (запрет тикета).

## 1. Auth / session lifecycle

- Хэширование: bcrypt `CryptContext` (`app/core/security.py:14-22`).
- JWT HS256: access (`create_access_token`, `sub/exp/type/jti`, extra roles)
  и refresh (`create_refresh_token`), decode — `security.py:25-50`; хранение
  refresh только SHA-256-хэшем (`hash_token`, `security.py:53-55`).
- Register `POST 201` (`app/api/v1/auth.py:44-87`): throttle, allowlist
  `SELF_REGISTER_ALLOWED_SLUGS` (`gk_customer`, `rd_executor`,
  `scientific_org`, `serial_manufacturer`; `deps.py:164-171`), иначе
  `AUTH_UNKNOWN_ROLE` / `AUTH_PRIVILEGED_ROLE_FORBIDDEN`; `IntegrityError` →
  `AUTH_EMAIL_EXISTS`. Привилегии — только через `PATCH /users/{id}`
  персоналом; миграция `0033` отозвала ранее самозарегистрированные (static,
  цепочка EV-010).
- Login (`auth.py:90-109`): `is_blocked` → `AUTH_LOGIN_LIMIT`, verify в
  threadpool → `AUTH_INVALID`, проверка `is_active`.
- Refresh-ротация (`auth.py:112-176`): атомарный
  `UPDATE … WHERE token_hash AND revoked_at IS NULL AND expires_at >= now()
  RETURNING`; повторное использование отозванного — отзыв всего семейства
  (`401`). Logout (`auth.py:179-191`) идемпотентен, отзывает refresh;
  access живёт до expiry (без blocklist) → SEC-05.
- Throttle (`app/services/auth_throttle.py`): 10 попыток / 60 с / cap 5000,
  ключ `SHA256(lower(email)):host`, IP из `X-Real-IP → последний XFF →
  client.host`; Redis fixed-window с LRU-fallback.
- HMAC-атрибуция «поделился» (`security.py:58-97`): отдельный ключ из
  `jwt_secret` (HKDF-подобный вывод), привязка к проекту, TTL 30 дней,
  `compare_digest`.

## 2. Password policy / reset / MFA

- Политика: `min_length=8, max_length=128` (`app/schemas.py:17,57,79`);
  сложности/истории нет (соответствует NIST-подходу, не finding).
- Смена — со старым паролем (`users.py:89-91`); сброс — только персоналом
  `POST /users/{id}/reset-password` (`users.py:235-250`): новый пароль задаёт
  сотрудник, все сессии цели отзываются, событие `user.password.reset` в
  аудите. Self-service/forgot/email-контура нет; `totp/otp/mfa/2fa` — 0
  совпадений по `app/` → SEC-04 (recommendation, решение владельца).

## 3. UI + backend authorization (сверка)

- Backend: `require_role(*slugs)` (allow ∪ superuser, иначе `AUTH_FORBIDDEN`;
  `deps.py:128-137`), `has_role` (`deps.py:140-145`), `CNTR_STAFF =
  (cntr_admin, cntr_manager)`; `PRIVILEGED_*` — 6 слагов (`deps.py:156-163`).
  Точечные гейты: `AdminOnly` (`admin.py:18`), `ManagerOnly`
  (`realtime.py:37`, `invites.py:32`), inline `require_role(cntr_admin)`
  (`realtime.py:374`), `Admin/Staff` в `users.py:50,53`.
- Frontend (`middleware.ts` + `lib/roles.ts`): `auth()`-обёртка; `RefreshAccessTokenError`
  редиректит только с protected/auth-маршрутов; `/login,/register` —
  залогиненных уводят на ролевой dashboard; `/dashboard*` без сессии →
  `/login?callbackUrl`; fail-closed — нет записи в `ROUTE_ALLOWED_ROLES` /
  нет пересечения → rewrite `/forbidden` 403. Матрица префиксов с regex-escape.
- Offline-очередь (`features/offline/queue.ts`): `Authorization` санитизируется
  при записи (`sanitizeOfflineHeaders`), токен инжектится только в момент
  отправки (`syncOfflineQueue`), персиста секрета нет.
- NextAuth Credentials (`auth.config.ts`): `POST /auth/login` → mapping
  `access/refresh/roles`; refresh за 5 мин до истечения (`REFRESH_BEFORE_MS`),
  окно `accessTokenExpires = now+55 мин`; ошибка refresh — `token.error`.

## 4. Ownership / invites / IDOR-BOLA / ручные гейты

- Проекты (`projects.py:158-206`): листинг staff/superuser — всё, остальные —
  `created_by OR active-member`; `can_access_project` + `require_project_access`
  с 404-маскировкой; мутации — владелец-or-staff (`:433,457`).
- Приглашения (`invites.py:32-176`): создание — `cntr_manager/cntr_admin`;
  `require_project_admin` (админ проекта OR legacy-создатель при
  `admin_count==0`); токен `INV-+secrets.token_urlsafe(16)`; claim атомарный
  (`used_count<max_uses AND revoked IS NULL AND (expires NULL OR >=now)`).
- Точечно: `news.py:177,365` (автор OR `cntr_admin`), `membership.py:98,114`
  (owner/staff/sharer). Сырой SQL с интерполяцией — 0 (ORM-only, см. EV-012);
  `text()` — только константы/параметры. Строковая изоляция — application-level
  (RLS нет → DB-02, здесь не дублируется). Ролевой runtime — UNKNOWN (R36).

## 5. OWASP-классы

- **XSS:** `nh3.clean`-allowlist на записи (`services/html_sanitizer.py:18,66-68`;
  рендер новостей через санитизированный HTML); `escape_label_value` +
  `route="unmatched"` в метриках (кардинальность ограничена).
- **CSRF/cookies:** backend stateless Bearer-only, `Set-Cookie` в `app/` — 0;
  сессионные куки ставит только frontend-NextAuth и они же зафиксированы
  deployed (EV-016): `__Host-/__Secure-`, `HttpOnly; Secure; SameSite=Lax`.
- **SSRF:** исходящий трафик — только `httpx` к `LLM_API_BASE`
  (`ai_assistant.py:228-233,267`, таймауты/лимиты), гейт по умолчанию закрыт
  (`LLM_GATEWAY_ENABLED=false`), allowlist-фильтр `ensure_allowed_for_external`.
- **Open redirect:** `RedirectResponse`/open-redirect в `app/` — 0; `:80` →
  `https-301` (nginx).
- **Uploads/path traversal** (`file_storage.py`): сигнатурный MIME
  (pdf/docx/xlsx/png/jpeg; OOXML требует `[Content_Types].xml` + `word|xl/`),
  ClamAV INSTREAM fail-closed (`clean|infected|error`), UUID-ключи
  `projects|news/{id}/{hex}.{ext}`, чанковое чтение с лимитом, 25М файл /
  32М тело (`config.py:103-106`, `main.py:123-175`, nginx `client_max_body_size
  32m` — паритет с `test_nginx_body_size`), закрытый бакет MinIO + best-effort
  versioning. Fail-closed download (`files.py:147-150`).
- **Brute-force/rate:** auth-throttle (выше) + `enforce_registry_limit`
  (anon `registry_anon_limit` / auth `registry_auth_limit`, окно, LRU-cap;
  `nioktr.py:68-120`, defaults `config.py:60-66`) + nginx-зоны `auth 10r/s`,
  `registry 100r/s` (`nginx.prod.conf:11-12,150-179`). SSE-ticket одноразовый,
  TTL 30 с, `SET NX EX`/`GETDEL`, токен в query → `400 SSE_TOKEN_IN_URL`,
  чужой/used/expired → `401` (`realtime.py:45-72,156-174`); SSE-лог без query
  (`$uri`).
- **CORS** (`main.py:292-298`, `config.py:72,142-144`): origins — список из
  именованного ключа (+ `API_URL_INTERNAL`-rewrite на фронте без localhost
  fallback в prod); но `allow_methods=["*"]` + `allow_headers=["*"]` при
  `allow_credentials=True` → SEC-02 (low).
- **CSP/заголовки:** frontend строит CSP per-request nonce (`middleware.ts:16-31`,
  `next.config.ts:23-42`: `default 'self'`, `script 'nonce-*' 'strict-dynamic'`,
  `frame-ancestors 'none'`, `object 'none'`, `upgrade-insecure-requests`);
  nginx — авторитетный источник HSTS/nosniff/SAMEORIGIN/Referrer/Permissions с
  `proxy_hide_header`-дедупом (`nginx.prod.conf:117-127`); backend ставит
  подмножество (`main.py:178-186`). Deployed-подтверждено EV-016.

## 6. Secrets / supply chain / containers / admin-debug-errors

- Secrets (только имена): `JWT_SECRET`, `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY`,
  `REDIS_URL`, `LLM_API_KEY` и др. (`— .env.example`, `infra/.env.production.example`);
  prod-guard отклоняет dev-дефолты/пустоты и пустой `REDIS_URL`
  (`config.py:108-140`); prod-compose — только `${VAR}` без дефолтов;
  `deploy.sh:298-310` — генерация/требование сильных. Effective values —
  UNKNOWN (запрет) — честно, не finding.
- Supply chain: `pip-audit==2.9.0` + `npm audit --audit-level=high` в CI
  (`.github/workflows/ci.yml:64-65,100-101`) — покрыто static; версий
  уязвимостей в этом тикете не разбирали (зона без изменений кода).
- Containers: `user:`/`read_only`/`cap_drop`/`security_opt` — 0 совпадений в
  обоих compose (работа от default root, writable) → SEC-01 (medium).
- Admin/debug/errors: каталог `X-Error-Code` + ru/en (`errors.py`), `500`
  generic + `request_id`, локализованные `422` (`main.py:178-282`); `reload`
  только dev (`main.py:356`); OpenAPI-документация кодом не отключена
  (комментарий `main.py:340` видит `/docs`) → deployed-состояние UNKNOWN →
  SEC-03 (low, проверить read-only пробой в operations-зоне).

## 7. Что осталось UNKNOWN (R36 и запреты)

Ролевой runtime всех матричных маршрутов, поведение под разными ролями
(владение/приглашения/УГТ-гейты/файлы/SSE/AI), effective CORS origins и grants,
at-rest шифрование, deployed `/docs` и CVD-возраст на проде. Ни один вывод
отчёта не выдан за deployed без EV-016/EV-004.
