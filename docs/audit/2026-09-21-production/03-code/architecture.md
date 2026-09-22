# 03 — Architecture / data-flow map (static, EV-001 + EV-003/EV-004)

Честность: структура — static по локальному checkout `f364388` (EV-001);
deployed-факты — только EV-003/EV-004. Server-линия `f06b15c` пофайлово
не диффалась (см. 02-features), поэтому deployed-привязки ниже — только
health/ready/landing/metrics и 12 healthy контейнеров.

## Входные точки

- Edge: nginx `:443` → `frontend:3000` / `backend:8000` (EV-003/EV-007,
  compose `technozrelost-prod`, 12 сервисов `restart: unless-stopped`).
- Доказанные публичные без auth (static по типу зависимости; EV-004 частично):
  `GET /api/v1/health`, `GET /api/v1/ready`, `GET /api/v1/metrics`;
  `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` (без
  `CurrentUser`; `POST /auth/logout` и `GET /auth/me` — только с JWT);
  `GET /projects/registry`, `GET /projects/registry/{project_id}`
  (`ReadCurrentUserOptional`); все четыре `GET /nioktr…` (`""`,
  `/organizations`, `/organizations/{ogrn}`, `/{registration_number}`) и
  все три `GET /executors…` (`""`, `/specialists`, `/organizations`)
  (`ReadCurrentUserOptional` + `enforce_registry_limit`); `GET /news`
  (только published), `GET /news/categories`, `GET /news/{news_id}`
  (черновики — только автор/staff); landing `/`. Остальное проверенное
  требует JWT (HS256, NextAuth Credentials на фронте). `GET /technologies`
  — НЕ публичный (`user: CurrentUser`, `technologies.py:21`).
- App-композиция: `technozrelost-backend/app/main.py` (строки 313–338):
  ровно 26 `app.include_router` под `/api/v1`. Наивный
  `rg -c include_router` даёт 27 — строка 301 это комментарий
  («…ПОСЛЕ всех include_router»); точная команда:
  `rg -c '^\s*app\.include_router' technozrelost-backend/app/main.py` → 26.
- Frontend App Router: `(landing)/`, `assessment/`, `dashboard/`,
  `login/`, `register/`, `join/`, `forbidden/`, `api/` (см. `src/app/`).

## Потоки данных

- Запись: browser → nginx → backend → Primary (`get_db`);
  чтение: Replica (`get_read_db`) с fallback на Primary; replica
  `not_configured` в production (EV-004) — факт для operations-отчёта.
- Auth: `POST /auth/register` (allowlist непривилегированных, иначе 403),
  `POST /auth/login` (Redis-троттлинг с in-memory fallback),
  атомарный refresh `UPDATE ... WHERE revoked_at IS NULL AND expires_at >= now()`.
- Registry: `enforce_registry_limit` (`nioktr.py`): anon/auth лимиты, окно,
  LRU; nginx-зоны registry 100r/s + auth 10r/s.
- Realtime: `POST /notifications/sse-ticket` → одноразовый ticket TTL 30с →
  `GET /notifications/stream?ticket=`; Redis pubsub + in-memory fallback;
  JWT в query запрещён; nginx пишет SSE отдельным логом без query.
- Files: сигнатурный MIME (pdf/docx/xlsx/png/jpeg), 25МБ, UUID-имена,
  закрытый бакет MinIO + ClamAV INSTREAM fail-closed
  (`app/services/file_storage.py`).
- AI/RAG (static; eval — зона AI-отчёта): `POST /chat`, `/chat/tuno`,
  `/chat/kaba`, `POST /match`, `POST /rag/search`,
  `POST /projects/{id}/generate/{doc_type}`; `wrap_untrusted` +
  `UNTRUSTED_BEGIN/END`; семантика офлайн 1536
  (`EMBEDDING_MODEL=semantic-ru-v2`); LLM caps
  `TIMEOUT 8.0с / QUEUE_TIMEOUT 2.0с / MAX_CONCURRENCY 4` + семафор
  (`app/services/ai_assistant.py`).
- Фон: только `_news_scheduler_loop` (`app/main.py`, 60с,
  `pg_try_advisory_lock(42)`, атомарный publish); Celery/ARQ нет.
  Infra-таймеры (backup-timer, wal-offsite) — зона operations.
- Observe: метки `(method,route,status)`, несопоставленное →
  `route="unmatched"` bounded (`app/services/metrics.py`); тело 32m,
  файл 25МБ.

## Границы (из interfaces.md, соблюдены)

- `evidence`: протокол + выдержки; санитайзинг и сырые логи спрятаны.
- `feature-matrix`: CSV со схемой spec; черновик спрятан (тикет 02).
- `findings`: JSON со схемой R26; рабочие заметки спрятаны (этот тикет).
- `ai-registry`: JSON-реестр по схеме spec; prompts/responses спрятаны.
- `report`: Markdown со ссылками на IDs; транскрипты спрятаны.

DB-контур (таблицы/миграции/индексы/RLS, `Serial`/`Hash`/`B-Tree`) и
application-security — зоны отчётов по БД и security; здесь доказан только
точечный инвентарь (`select()` + `text()` в `app/services/rag.py`,
`select()` в `achievements.py`), остальное по ORM/raw-SQL → `UNKNOWN`.
