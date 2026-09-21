# 02 — Frontend inventory (static, local checkout f364388)

Источник: статический разбор `technozrelost-frontend/src`. Deployed-утверждения
только для landing `/` (EV-004: 200, 261896B). Остальное — static/local
(Решение 7); auth-gated runtime — `UNKNOWN` (R36).

## Landing-сегмент (`src/app/(landing)/`, публичный)

`/` (проверен EV-004), `about`, `customers`, `customers/[ogrn]`, `levels`,
`levels/[id]`, `methodology`, `news`, `news/[id]`, `nioktr`, `nioktr/[regNumber]`,
`performers`, `projects`, `projects/[id]`, `roadmap`. Публичный реестр читается
без Authorization через `fetchPublicRegistryPage` (`public-registry.ts`).

## Auth / общее

`login`, `register`, `join/[token]`, `forbidden`, `assessment/new`.
NextAuth Credentials → `POST /auth/login`, refresh за 5 мин до истечения.
Middleware fail-closed (нет записи в матрице → 403 `/forbidden`), CSP nonce.

## Dashboard-сегменты (`src/app/dashboard/`)

`/` (shell), `project/[id]`, `projects`, `profile`, `executors`, `matching`,
`technologies`, `nioktr`, `nioktr/[registration_number]`, `news`, `news/new`,
`news/[id]/edit`, `news/admin`, `notifications`, `organizations`,
`organizations/[ogrn]`, `ai-assistant`, `auditor`, `cntr_admin`, `cntr_manager`,
`gk_customer` (+`projects`, +`projects/new`), `investor`, `rd_executor`
(+`projects/new`), `regulating_organization`, `scientific_org` (+`projects/new`),
`serial_manufacturer` (+`projects/new`).

Примечание: сегменты `regulating_organization` и `ugt_expert` расходятся с
миграцией `0010` (см. inventory-backend) — оба присутствуют во фронтенде;
какой реально используется в production — `UNKNOWN` (нужен ролевой runtime).

## Компоненты и фичи (`src/components/`, `src/features/`, `src/lib/`)

- `src/components/ui/`: button/modal/toast/badge/card/tabs/pagination/progress/
  search/filter-panel/label/drawer/empty/tooltip/chip/avatar/error/file-upload/
  confirm/checkbox (~20 primitives).
- `src/features/`: `project/` (ActionsPanel, CanvasBlocks, HistoryPanel,
  UgtLine, KtPanel, ChecklistPanel, TeamPanel, GenerationPanel, DocsPanel,
  useAutosave, template), `registry/` (RegistryTable, RegistryCard, FilterBar,
  useRegistry, useRealtime, saved-filters), `matching/` (MatchCard,
  MatchingMode, llm), `docs/` (AiDocConsultant, GostChecklist, DocsPanel),
  `dashboard/` (RoleDashboardShell), `analytics/`, `notifications/`,
  `offline/` (`queue.ts`: действия без Authorization, токен инжектится при отправке).
- `src/lib/`: `landing-registry.ts` (`SHOWCASE_PAGE_SIZE=9`,
  `mergeRegistryPage/buildPublicRegistryQuery`), `public-api.ts`, `api-client.ts`
  (P2-заглушки 403), `translators.ts` (`translatorFor`), `roles/`, `release.ts`
  (`p2GatedMessage`), i18n `ru/en/zh` + next-intl (`messages/`).

## API-клиент и офлайн

- `fetchPublicRegistryPage` — без Authorization (landing).
- `getPublicRegistry`/matching в `api-client.ts` — P2-заглушки, 403.
- `sanitizeOfflineHeaders`/`syncOfflineQueue` — очередь без хранения токена.
- Локали: `ru/en/zh`; тесты `tests/*.test.mjs` (offline, landing-registry, locale).

## Состояния и доступность (для UX-отчёта, здесь только факт наличия)

Ролевые shell, forbidden-гейт, empty/loading/error-компоненты присутствуют
статически; визуальная проверка production — зона UX-отчёта (screenshots,
viewport 1920/768/375).
