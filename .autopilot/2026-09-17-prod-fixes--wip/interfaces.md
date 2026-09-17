# Границы и швы — пакет доделок продакшена (прогон 2026-09-17)

## Границы, решённые в спецификации (копия раздела «Границы и швы»)

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `registry-ui` | публичные витрины и деталки | страницы `/projects /performers /customers /nioktr` + деталки | склейку страниц, клиентский фильтр |
| `registry-api` | публичные данные реестров | `GET /projects/registry /executors/* /nioktr*` + поиск | лимиты, сортировку по умолчанию |
| `project-create` | создание и публикация | `POST /projects`, `PUT /publish` | анкету УГТ, контрольные точки |
| `matching` | подбор исполнителей | `POST /match` | скоринг, LLM-реранк |
| `generation` | документы из шаблонов | `POST /projects/{id}/generate/{doc}` | подстановку, хранение черновиков |
| `achievements` | каталог и выдача | `GET /achievements/catalog /mine`, хуки выдачи | правила триггеров, отзыв |

Швы для тестов: публичные HTTP-ручки реестров, `POST /match`, генерация
через API, выдача медалей через события.

## Правила прогона (проект уже на проде)

- Стек: Next.js 16 (App Router) + FastAPI + PostgreSQL 16/pgvector. Проверки:
  backend `cd technozrelost-backend && uv run pytest -q` (полный — только
  в одиночку, общая тестовая БД; обычно достаточно файлов таска),
  frontend `cd technozrelost-frontend && npm test && npm run build`.
  Линт backend: `uv run ruff check app tests`.
- Работа в ветке `autopilot/m0-security-hardening`, push каждого коммита
  в `origin https://github.com/atrshncv-design/MVP-CNTR.git`. Ветку `main`
  не трогать. Выкладку на сервер делает оркестратор — таски только код.
- P2-флаги лежат в `technozrelost-frontend/src/lib/release.ts`; заглушки
  API-клиента (`p2GatedMessage`, 403) — в `src/lib/api-client.ts`.
- Секреты — только именами (`TELEGRAM_BOT_TOKEN`, `LLM_API_KEY`,
  `OPENCODE_API_KEY`), значений нигде не писать.
- Нет зависимости — вернуть `BLOCKED: <имя>` + причина, молча не ставить.
- Ошибки только через каталог `raise_error`, тексты из словарей, не склейка.
- Папка `Доступы сервер центр mvp/` и исходные PDF — не коммитить, не читать.
