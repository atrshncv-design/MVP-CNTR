# 03 — Hardcode / stubs / fallbacks / dead ends (доказанный список)

Метод: только static по EV-001 + runtime/import/scheduler-сигналы.
Правило: dead заявляется только при отсутствии импортов, регистрации,
джобов и внешних потребителей; иначе `alive` / `indeterminate`.

## Обязательные code-категории spec (контур «Код») — покрытие

Границы: см. `architecture.md`. Циклы: единственный app-цикл —
`_news_scheduler_loop` (60с, advisory lock 42, переживает рестарты).
Coupling (частично static, EV-001): доказанные cross-imports сервисов —
`news_scheduler→notifications`, `achievements→notifications`,
`ai_assistant→{ai_wiring, rag}`, `matching→ai_wiring`
(воспроизводимо из корня worktree: `rg -n '^from app\.services|^import app\.' technozrelost-backend/app/services/*.py`)
(проверено 2026-09-22: exit 0, 5 строк — 4 cross-import-факта выше);
импортных циклов этим способом не доказано и не опровергнуто → `UNKNOWN`
(автоматический cycle-detector в окружении отсутствует, ставить запрещено).
Unused dependencies → `UNKNOWN`: backend (`pyproject.toml`, 26 прямых
зависимостей) vs импорты и frontend (`package.json`: `next-intl` реально
импортируется из `src/lib/translators.ts`, остальное не сверено) полной
сверкой не доказаны; воспроизводимо (Python):
`rg --no-filename -N -o '^import [a-z0-9_]+|^from [a-z0-9_.]+' technozrelost-backend/app/ --glob '*.py' | sort -u`
(проверено 2026-09-22: exit 0, 104 уникальные головы импортов) —
сверить со списком `dependencies` в `pyproject.toml`;
воспроизводимо (frontend JS/TS):
`rg -n '^import .* from' technozrelost-frontend/src/ --glob '*.{ts,tsx}'`
(проверено 2026-09-22: exit 0, 1034 строки импортов) — сверить со списком
`dependencies` в `package.json`, и
`rg -l 'next-intl' technozrelost-frontend/src/` для фронта.
Дубли: семантическая duplication → `UNKNOWN` (clone-detector в окружении
отсутствует, ставить запрещено). Ниже — только инвентари имён определений,
не детектор клонов: совпадения имён не доказывают и не опровергают клоны,
тела функций и файлов не сравнивались. Python, repo-wide по `app/`:
`rg -n '^\s*(def|class) \w+' technozrelost-backend/app/ --glob '*.py'`
(проверено 2026-09-22: exit 0, 329 строк определений) и
`rg --no-filename -N -o '^\s*(def|class) [A-Za-z0-9_]+' technozrelost-backend/app/ --glob '*.py' | sort | uniq -c | sort -rn`
(топ: `def __init__` ×5, далее только ×2 — `reset`, `_project_out`,
`_doc_out`, `_card_out`, `_at_out`). Frontend JS/TS, repo-wide по `src/`
(имена экспортов; Python-паттерн `def/class` к TS неприменим):
`rg -n '^\s*export\s+(function|class|const|default)' technozrelost-frontend/src/ --glob '*.{ts,tsx}'`
(проверено 2026-09-22: exit 0, 572 строки) и
`rg --no-filename -N -o '^\s*export\s+(function|class|const)\s+[A-Za-z0-9_]+' technozrelost-frontend/src/ --glob '*.{ts,tsx}' | sort | uniq -c | sort -rn`
(топ: `export const dynamic` ×4 — конвенция route-сегментов Next.js, далее
только ×2). Граница: покрыты только имена верхнего уровня; дубли тел,
токен-клоны и семантические клоны не измерены → `UNKNOWN`.
Complexity (цикломатика по функциям): не измерена (radon/xenon не
установлены; ставить запрещено) → `UNKNOWN`; воспроизводимо после
подготовки окружения: `radon cc technozrelost-backend/app/ -s`.
Types: Ruff `E,F,I,UP,B,SIM` line-length 100 — pass (см. `gates.md`);
mypy — blocked локальным тулчейном, не кодом. Errors: каталог
`app/core/errors.py` (`X-Error-Code`, ru/en, только `raise_error`).
Suppressed exceptions: ~30 `except Exception` + `pass` (см. findings
CODE-01; пустых catch без комментария нет — каждый помечен `noqa`/причиной).
Retries: явных tenacity/backoff нет; таймауты: Redis socket 1с, ClamAV
connect/settimeout 2с, LLM 8.0с/queue 2.0с, семафор 4. Races: `threading.Lock`
в `metrics.py`, `asyncio.Semaphore` в `ai_assistant.py`, advisory lock 42,
атомарные `UPDATE ... WHERE` (refresh, news) — см. CODE-02. N+1: отдельных
`selectinload/joinedload`-нарушений статикой не доказано; доказанный инвентарь —
только `select()` в `app/services/rag.py`, `achievements.py` плюс параметризованный
`text()` там же (`rag.py:108,162,203`); отсутствие raw-SQL вне проверенных мест
не доказано → `UNKNOWN` (инъекции — зона security). Resources: `asyncio.to_thread`
для блокирующего IO (redis/minio/clamav), `asyncio.open_connection` для
ClamAV INSTREAM. Global mutable state: `ai_metrics.METRICS` dict +
`_lock`/`_LLM_SEMAPHORE` — см. CODE-02. Logs с данными: `logger.*password/token`
— ноль совпадений; `print(` — только `seed_*/prepare_*/reset_demo` (CLI/seed-зона,
не request-path). Test gaps/flakes/vacuous: см. `gates.md` + CODE-03/CODE-06.
Vulnerabilities: зона security-отчёта; здесь только швы (MIME-сигнатуры,
fail-closed ClamAV, allowlist саморегистрации, SSE-тикет вместо JWT в query).

## Hardcode (имена/дефолты, без values)

- `app/core/config.py:16,23,72,92,97` — dev-дефолты `0.0.0.0`,
  `127.0.0.1`, `http://localhost:3000`, `127.0.0.1:9000`, `127.0.0.1`
  (ClamAV host). Prod-guard отклоняет dev-дефолты секретов; сами хосты —
  finding CODE-04 (debt, не defect).
- `TZ-XXXXXX` в `schemas.py:247`, `errors.py:227-228`, `models.py:42`,
  `join-project-form.tsx:112` — формат join-токена, не секрет; консистентен.
- LLM caps `8.0/2.0/4`, SSE TTL 30с, registry-лимиты, файл 25МБ / тело 32m —
  именованные настройки, не магические числа в логике.

## Stubs / mocks / fallbacks (задекларированные, не скрытые)

- `p2GatedMessage` (`src/lib/release.ts:36` → `api-client.ts:679`):
  `getPublicRegistry`/matching отвечают 403-заглушкой; публичный реестр идёт
  через `fetchPublicRegistryPage`. Статус F-028 `STUB` (тикет 02).
- `SavedFilters` fallback (`features/registry/saved-filters/BLOCKED.md`):
  localStorage-фолбэк при отложенной backend-интеграции; F-033 `STUB`.
- `LLM_GATEWAY_ENABLED` default-off (F-030 `DISABLED`); ClamAV fail-closed;
  Redis in-memory fallback только dev/test (prod fail-fast);
  Replica fallback на Primary при `not_configured`.
- TODO/FIXME/HACK по `app/`: ноль маркеров (rg — пусто). Фронт-`placeholder*` —
  только i18n-ключи инпутов, не заглушки функций.

## Dead ends (тупики UX/API, static-кандидаты, runtime — UNKNOWN)

- P2-заглушки выше — единственный доказанный dead end для пользователя
  без P2-скоупа (403 с сообщением, не молчание). Остальные dead ends —
  зона UX-отчёта со screenshots (R16–R18), здесь не заявляются.

## Dead code: заявленного нет

- 26 `app.include_router` в `app/main.py:313-338` — все зарегистрированы (alive).
  Наивный `rg -c include_router` даёт 27 из-за комментария в строке 301;
  точная команда: `rg -c '^\s*app\.include_router' technozrelost-backend/app/main.py`.
- `if False / while False / assert False` — ноль (единственное `if 0 <= idx`
  в `matching.py:131` — range-check, не dead branch).
- `tuno`/`kaba` — ссылки в `chat.py`, `ai_assistant.py`, `rag.py`,
  `matching.py`, `api-client.ts`, `models.py`, `schemas.py`, `config.py` (alive).
- `questionnaire_results` — пишется/читается: `assessments.py` (5 мест),
  `projects.py` (6 мест), `manager.py:102`, модель `models.py:228` (alive).
- `SavedFilters`/`useSavedFilters` — 12 файлов (FilterBar, index, api-client,
  ru/en/zh, storage, hook, компонент, BLOCKED.md) (alive с fallback).
- `DELETE .../files/old-versions` (`requests.py:284`) — роутер + retention;
  клиентские вызовы не проверены → `indeterminate`, кандидат security/UX.
- Двойная линейка `questionnaire_results` + `assessment_*` — обе в моделях
  и миграциях; какая пишется в prod — нужен runtime → `indeterminate`,
  передано в отчёт по БД.
