# Справочник агента по проекту

Этот файл читается по необходимости. Краткие обязательные правила находятся в
корневом `AGENTS.md`; текущее направление работ — в `docs/Plan.md`.

## Ключевые файлы

- Backend: `technozrelost-backend/app/main.py`, `app/core/config.py`,
  `app/core/database.py`, `app/core/errors.py`.
- API: `app/api/v1/auth.py`, `nioktr.py`, `executors.py`, `realtime.py`,
  `health.py`, `files.py`, `metrics.py`.
- Сервисы: `app/services/metrics.py`, `ai_assistant.py`, `matching.py`,
  `file_storage.py`; embeddings — `app/core/embeddings.py`.
- Frontend: `technozrelost-frontend/src/lib/api-client.ts`, `public-api.ts`,
  `landing-registry.ts`, `translators.ts`; offline — `src/features/offline/queue.ts`.
- Инфраструктура: `technozrelost-backend/infra/`; CI — `.github/workflows/ci.yml`.

## Архитектурные границы

- Browser → nginx → Next.js/FastAPI; запись идёт в Primary, чтение допускает Replica.
- JWT HS256 + NextAuth Credentials; ошибки API выдаются через каталог `errors.py`.
- SSE использует одноразовый ticket, а не JWT в query string.
- Файлы проверяются по сигнатуре и ClamAV, затем сохраняются в закрытом MinIO.
- Production readiness учитывает PostgreSQL, Redis, MinIO и ClamAV.
- Метрики используют bounded route templates и никогда не содержат сырой path.
- AI получает недоверенный контекст только через `wrap_untrusted`; внешние вызовы
  ограничены timeout и concurrency.

## Проверки

- Backend: `cd technozrelost-backend && uv run pytest -q`.
- Backend lint: `cd technozrelost-backend && uv run ruff check app tests infra/alerter scripts/udgu_ingest`.
- Frontend: `cd technozrelost-frontend && npm test && npm run build`.
- Не запускать голый `uv sync`: он удаляет dev-зависимости. Использовать `uv sync --extra dev`.
- Не перезапускать занятые demo-порты `3000` и `8000`, контейнеры и миграции без
  явной необходимости; для БД использовать только тестовую схему.

## Архивы

- Завершённые прогоны: `.autopilot/archive/runs/`.
- Исторические документы: `docs/archive/`.
- Архивные зоны исключены из обычного поиска; читать их следует только по явному пути.
