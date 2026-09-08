# Границы — из спецификации (копия раздела «Границы и швы», не редизайн)

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `auth` | регистрация, refresh-ротация, троттлинг входа | `POST /auth/*` | хранилище попыток, семейство токенов |
| `registry` | публичные реестры и их лимиты | `GET /nioktr/*`, `GET /executors/*`, `GET /projects/registry` | классификацию anon/auth, счётчики |
| `realtime` | ticket и SSE-поток | `POST /notifications/sse-ticket -> {ticket}`, `GET /notifications/stream?ticket=` | pubsub-транспорт, очереди fallback |
| `files` | загрузка, MIME, скан, скачивание | `POST /projects/{id}/files`, `GET /files/{id}/download` | ключи объектов, ответы ClamAV |
| `ai` | чат, RAG, matching, stage-оценка | `POST /chat/*`, `POST /rag/search`, `POST /match` | промпты, провайдер, очередь |
| `frontend-auth` | токены в браузере, offline-очередь | очередь без секретов, инъекция токена в момент отправки | сессия NextAuth |
| `landing` | витрина | страница на живых данных реестра | demo-заглушку (удалить) |
| `infra-backup` | бэкап перед миграциями | fail-closed гейт «бэкап готов → мигрируем» | lock-идентификаторы |
| `infra-observe` | метрики, алерты, прокси, пробы | `/metrics`, `/ready`, правила nginx | кардинальность, тексты алертов |
| `db` | миграции и целостность | линейные ревизии с upgrade/downgrade | SQL-диалект |

Швы для тестов — публичная HTTP-граница API плюс существующие гейты (`pytest`,
`npm test`, линт, сборки). Идеал — один шов: поведение проверяется через HTTP.

## Правила прогона (не выводятся из кода)

- Стек: Python FastAPI + Next.js + PostgreSQL/pgvector + MinIO/ClamAV/Redis/nginx.
- Команды: `uv run ruff check app tests infra/alerter scripts/udgu_ingest`,
  `uv run pytest -q` (только на изолированном стенде с тестовой БД),
  `npm run lint && npm test && npm run build` из `technozrelost-frontend/`.
- Не трогать без явной нужды: прод-сиды, `infra/docker-compose.prod.yml` вне своего таска.
- Зависимость отсутствует в окружении → `BLOCKED: <имя>` + причина, молча не ставить.
- Секреты — только именами в `.env.example`, никогда значениями в код/коммиты/логи.
- Работа — в изолированном worktree, ветку `main` не ломать.
