# Границы модулей — Технозрелость frontend унификация

> Скопировано из spec.md § Границы и швы. Единственный источник для под-агентов. Изменять только через спеку.

## Запуск и тесты

- **Стек:** Next.js 16 App Router, React 19, Tailwind v4, next-auth 5, TypeScript strict
- **Установка:** `cd technozrelost-frontend && npm install`
- **Запуск:** `npm run dev` (порт 3000, нужен API_URL_INTERNAL), `docker compose -f technozrelost-backend/infra/docker-compose.yml up -d pg-primary`
- **Тесты frontend:** `npm test` (node --test tests/*.test.mjs, 39 тестов), `npm run lint`, `npm run build` (при остановленном dev)
- **Тесты backend:** `cd technozrelost-backend && uv sync --extra dev && uv run pytest -q`
- **Линт:** `uv run ruff check app && uv run mypy app`
- **Не трогать:** `technozrelost-backend/app/db/models.py` схема, `src/middleware.ts` RBAC, `next.config.ts` rewrites/CSP без причины
- **Зависимость отсутствует →** вернуть `BLOCKED` с именем пакета, не устанавливать молча

## Границы, решённые в спецификации

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `dashboard-shell` | отображение ЛК 8 ролей | `RoleDashboardShell({role}) -> ReactNode` + `roleConfig[slug]` | маппинг role→stats/CTA, ROLES без эксперта |
| `project-card` | карточка УГТ, линия дробных секторов, чек-лист ГОСТ, действия, история | `ProjectCard({id})`, `UgtLine({current, docs})`, `Checklist({level})`, `ActionsPanel` | расчёт секторов = числу StageRequirement, права manager/admin/lead |
| `registry` | реестры проектов/орг/исполнителей, фильтры, избранное, пагинация keyset, realtime | `RegistryGrid({params})`, `useRegistry(params)`, `FilterBar`, `FavoriteStar`, `useRealtime()` | сериализация URL, дебаунс, SSE, GIN/trgm индексы |
| `matching` | отдельный режим подбора | `MatchingMode()`, `matchOrganizations(in)->out` обезличено | скоринг, LLM rerank, причины, обезличивание tuno |
| `docs` | документы проекта, загрузка, чек-лист шаблонов, ИИ-консультант узкий | `DocsPanel({projectId})`, `GostChecklist`, `AiDocConsultant`, `uploadFile()` | ClamAV 409/413, 25МБ, PDF/DOCX/XLSX/JPG/PNG |
| `notifications` | колокольчик + страница | `NotificationBell()`, `NotificationsPage()` | SSE, read mutation |
| `ui` | базовые компоненты | `Button, Card, Badge, Modal, Drawer, Tabs, ...` (24) | токены --tz-*, globals.css |
| `api-client` | единый fetch слой | `getProjects(token), getRegistry(params), getProject(id), ...` | Authorization, base URL, timeout |

## Швы для тестов

1. `api-client` — моки fetch
2. `project-card/UgtLine` — юнит секторов
3. `registry/useRegistry` — фильтры→URL→запрос

## Правила безопасности

- Обезличивание ПДн для LLM: только title/annotation/tags, contour tuno, без email/ФИО/организации/бюджета до решения ЦНТР. Логи обезличивания.
- fail-closed RBAC: отсутствие записи в ROLES → 403
- ClamAV fail-closed 409/413
