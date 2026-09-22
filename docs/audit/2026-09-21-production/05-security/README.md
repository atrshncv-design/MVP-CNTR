# 05 — Application security и RBAC (ticket 05)

Static + test + read-only security-аудит локального checkout `f364388`
(EV-001) с низкоинтенсивными публичными пробами (EV-016, 2 одиночных GET,
без auth, без mutations). Код продукта, схема БД и production не менялись.
Секреты — только именами, значений нет. Оценки без production-доказательства
помечены static/local (Решение 7). Авторизованный runtime — `UNKNOWN` (R36).

- `security.md` — полный application-security checklist spec: покрыт или
  честно `UNKNOWN`; UI и backend authorization сверены; УГТ/верификационные
  гейты и invite-контур проверены static.
- `findings.json` — findings по схеме spec R26 (5 записей: SEC-01…SEC-05,
  каждая с обязательными полями `effort` и `risk`);
  kind не смешиваются; severity не завышены; дубли DB-01…DB-06 и
  CODE-01…CODE-06 не перевыставлены.
- Базовые доказательства: EV-001…EV-008 (зона ticket 01); DB-контур EV-014
  (R14 static) переиспользован, не продублирован. Новые факты этого тикета —
  EV-016…EV-018 ниже (файлы лежат в зоне тикета, слияние индекса — шаг
   оркестратора).

## Исполнение (R30/R31)

Тикет исполнен через адаптер autopilot-opencode моделью
`opencode-go/muse-spark-1.3-contributor`. Значения секретов и credentials не
читались и не сохранялись; в артефактах — только имена ключей.

## In-zone evidence (контракт: source, timestamp, target, command, exit, sanitized result)

- EV-016 — public security-headers probe: 2026-09-22T04:05:00Z, target
  `https://technozrelost.atrshnjc.beget.tech/`, команды `curl -m 15 -sS -D -
  -o /dev/null < /api/v1/health | / >` (exit 0; два одиночных GET, без auth,
  тела не сохранялись): оба 200; `Strict-Transport-Security
  max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy: camera=(),
  microphone=(), geolocation=()` на обоих; landing дополнительно несёт
  per-request `content-security-policy` с `nonce-*` + `strict-dynamic` и
  `__Host-`/`__Secure-` cookies (`HttpOnly; Secure; SameSite=Lax`).
  Stop-сигнал не сработал (5xx/unhealthy/mutation/чувствительный вывод — нет).
- EV-017 — static security inventory: 2026-09-22T04:07:00Z, local, `rg`/read
  по `app/core/security.py`, `app/core/deps.py`, `app/api/v1/auth.py`,
  `app/api/v1/users.py`, `app/api/v1/invites.py`, `app/api/v1/projects.py`,
  `app/services/file_storage.py`, `app/services/auth_throttle.py`,
  `app/main.py`, `infra/nginx/nginx.prod.conf`, `infra/docker-compose*.yml`,
  `technozrelost-frontend/src/{auth.config.ts,middleware.ts,lib/roles.ts,
  features/offline/queue.ts,next.config.ts}` (exit 0): полный разбор — в
  `security.md`; values `.env`/credentials/private keys не читались (запрет).
- EV-018 — acceptance verification, non-DB security set (local,
  2026-09-22T04:12:21Z, exit 0): `uv run pytest --noconftest
  tests/test_html_sanitizer.py tests/test_prod_guard.py tests/test_config.py
  tests/test_ci_gates.py tests/test_upload_hardening.py
  tests/test_error_catalog.py -q` → 32 passed; `uv run ruff check app tests
  infra/alerter scripts/udgu_ingest` → `All checks passed!`; `python3 -c
  json.load(findings.json)` → OK, 5 записей, поля `effort` и `risk` на месте.
  Тесты не удалялись и не ослаблялись (`--noconftest` обходит только
  session-фикстуру тестовой БД, сами тесты те же).
- EV-018b — DB-backed попытка (local, 2026-09-22T04:11:56Z): `uv run pytest
  tests/test_nginx_body_size.py tests/test_config.py tests/test_prod_guard.py
  -q` → 12 setup ERROR, все `psycopg.OperationalError: connection refused
  127.0.0.1:5432` (нет локальной test DB), продуктовых падений 0 —
  environment BLOCKED, унаследовано от CODE-03/EV-015, не регрессия и не
  acceptance suite.

## Покрытие application-security checklist spec (доказательно или UNKNOWN)

| Пункт | Статус |
|-------|--------|
| auth/session lifecycle, hashing, JWT rotation | покрыто static + EV-016 (cookies): bcrypt, HS256 access+refresh, atomic refresh + family-revoke, throttle 10/60с; logout без access-blocklist → SEC-05 (low, accepted tradeoff) |
| password policy, reset/recovery, MFA | покрыто static: min8/max128; self-service reset и MFA отсутствуют, сброс — ручной staff-only с отзывом сессий → SEC-04 (recommendation) |
| UI + backend authorization, escalation | покрыто static: `require_role`/`has_role`, allowlist саморегистрации, миграция 0033, middleware fail-closed матрица; runtime — UNKNOWN (R36) |
| IDOR/BOLA, ownership, invites, УГТ/верификация | покрыто static: `can_access_project` + 404-masking, `require_project_admin`, ручные staff/expert-гейты; runtime — UNKNOWN; изоляция строк — см. DB-02, не дублируется |
| CSRF/XSS/SSRF/injection, open redirect | покрыто static: Bearer-only (кук backend не ставит), nh3-allowlist, SSRF-гейт внешнего LLM, ORM-only SQL; deployed-эксплуатация не проверялась (fuzz запрещён) |
| uploads/path traversal | покрыто static: сигнатурный MIME, ClamAV fail-closed, UUID-ключи, 25М/32М лимиты |
| CORS/CSP/cookies/rate limits | покрыто static + EV-016: CSP nonce per-request, HSTS/nosniff/DENY-источник nginx, registry/auth зоны; CORS wildcard methods/headers → SEC-02 (low) |
| secrets, supply chain, containers, admin/debug/errors | частично: prod-guard + `${VAR}` + pip-audit/npm audit + каталог ошибок покрыты static; контейнеры без user/drop → SEC-01 (medium); /docs exposure static — UNKNOWN deployed → SEC-03 (low); values/effective grants — UNKNOWN (запрет) |

## Production-сопоставление (static local vs deployed)

- Деплоенные заголовки (EV-016) соответствуют коду: nginx HSTS/nosniff/
  SAMEORIGIN/Referrer/Permissions + frontend CSP nonce — цепочка закрыта
  end-to-end, дублей upstream нет (`proxy_hide_header`, static).
- Остальное — static/local: локальный HEAD `f364388` ≠ server HEAD `f06b15c`
  (EV-001/EV-002); любой вывод о deployed-коде за пределами EV-016 — UNKNOWN.
- Авторизованный production-runtime (роли, владение, приглашения, УГТ-гейты,
  файловые сценарии под разными ролями) — `UNKNOWN` до test accounts (R36);
  confidentiality-safe пробы без аккаунтов невозможны.

## UNKNOWN (честно недоступное)

1. Ролевой/авторизованный runtime production (все роли) — до test accounts.
2. Effective CORS origins / `pg_hba` / grants сверх табличных, содержимое
   дисков/снапшотов, at-rest шифрование (см. DB-04) — values запрещены.
3. Deployed-состояние `/docs`, effective rate-limit срабатывания, возраст
   ClamAV CVD на проде — вне low-rate read-only проб этого тикета.
4. AI-промпты/ответы с риском данных — зона AI-реестра, здесь не собирались.

Mutations: ни одной (ни одного POST/PUT/DELETE, ни одного payload).
LLM-вызовов: 0 (лимит 200 не тронут). ПДн/секретов/бизнес-строк в артефактах нет.
