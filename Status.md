# STATUS / CURRENT STATE

**Текущая фаза:** Фаза 2 выполнена (Шаги 2.1–2.2). ✅

## Новый push-контракт (CLAUDE.md §6)
- Remote `origin` → `https://github.com/atrshncv-design/MVP-CNTR.git` задан.
- Все ветки `main`, `feat/frontend`, `feat/backend` отправляются на GitHub после каждого коммита.

## Что сделано (Фаза 1 — Инфраструктура)
- **Шаг 1.1:** Git worktrees `feat/frontend` (Next.js 16.2.10) + `feat/backend` (FastAPI, uv).
- **Шаг 1.2:** PostgreSQL Primary `:5432` + Replica `:5433` + pgvector + схемы public/test + Serial/BigSerial + Hash/B-Tree/ivfflat.
- **Шаг 1.3:** NextAuth.js v5 + FastAPI JWT + Middleware RBAC + 9 dashboards + login/register/forbidden.
- **Шаг 1.4:** RBAC: 9 ролей, permissions, users, user_roles; Alembic migration 0003.
- Smoke-тесты: 8/8 пройдены. Backend ruff+mypy чисто. Frontend tsc+lint+build чисто.

## Что сделано (Фаза 2 — Адаптация MVP 0 + ЛК ГосКомпании)
### Шаг 2.1: Портирование бизнес-логики из MVP 0
- `src/lib/ugt-data.ts` — полные данные 9 уровней УГТ (критерии, KPI, риски, документы) + УГП/УГИ/УГС.
- `src/lib/questionnaire-data.ts` — полный опросник по ГОСТ Р 58048-2017 (9 уровней, ~350 вопросов с метками).
- Установлены npm-зависимости: `framer-motion`, `lucide-react`, `recharts`.

### Шаг 2.1: Компонент УГТ-шкалы
- `src/components/ugt-scale/ugt-scale-page-client.tsx` — 9 интерактивных карточек с анимацией (hero-секция, градиентная полоса, KPI-бейджи, hover-эффекты).
- Страница: `/dashboard/gk_customer/projects` (server component → client).

### Шаг 2.1: Опросник-вьюер (Wizard)
- `src/components/questionnaire/questionnaire-wizard-client.tsx` — full multi-step wizard:
  - **info**: форма проекта (название, описание, категория, целевой УГТ)
  - **9 шагов**: УГТ 1–9 с категорийными фильтрами (Научные/Технические/Организационные/Производственные), expandable-карточками с описанием каждого пункта
  - **results**: круговой прогресс, гистограмма/радар (recharts), разбивка по уровням, рекомендации для перехода на следующий УГТ
- Страница: `/dashboard/gk_customer/projects/new`

### Шаг 2.2: Дашборд ГосКомпании
- `/dashboard/gk_customer/page.tsx` — переработан в rich dashboard:
  - **Hero-секция** (тёмный градиент #0F172A) с приветствием
  - **«Создание проекта»** — виджет-карта (градиент #2E5BFF→#4A82FF) с ссылкой на УГТ-шкалу
  - **«Загрузка ТЗ»** — виджет-карта (градиент #FF7A2E→#FF9A5E)
  - **Статистика** — 4 инфо-блока (Активные проекты, На согласовании, Эксперты, Исполнители)

### Проверка сборки
- `tsc --noEmit`: чисто ✅
- `npm run lint` (eslint): чисто ✅
- `npm run build` (next build): чисто, все 19 роутов сгенерированы ✅
- Push на GitHub: `feat/frontend` `de672d4` отправлен

## Актуальные проблемы / Блокеры
- Нет. Все smoke-тесты Фазы 1 также проходят (инфраструктура не менялась).

### Шаг 2.3: ЛК Исполнителя (R&D)
- `/dashboard/rd_executor/page.tsx` — полноценный дашборд с тремя разделами:
  - **«Мои компетенции»**: карточка профиля организации (название, УГТ 3–6, тип, завершённые проекты) + 6 областей компетенций с тегами и уровнем УГТ (e.g. «Компьютерное зрение — УГТ 6»)
  - **«Доступные задачи»**: витрина 6 mock-проектов от ГосКомпаний (Росатом, РЖД, Газпром, Лукойл, ЦНТР) — карточки с УГТ-range, бюджетом, описанием, тегами, кнопкой «Откликнуться»
  - **«Шаблоны документов»**: 3 заглушки скачивания (ТЗ, ТЭО, Паспорт проекта) с иконками, форматом, размером

## Текущая фаза: Фаза 2 завершена ✅ (Шаги 2.1–2.3)

## Следующий шаг для агента
Фаза 3 (Plan.md):
- Шаг 3.1 — дашборд проекта с отражением прогресса УГТ (шкала 1–9).
- Шаг 3.2 — FastAPI эндпоинты для приёма JSON-данных опросников.
- Шаг 3.3 — RAG-пайплайн: загрузка шаблонов в pgvector.

## Артефакты для проверки Functional Validator
- Ветки на GitHub: `main`, `feat/frontend` (commit `de672d4`), `feat/backend`.
- После `npm run dev`: `/dashboard/gk_customer` → дашборд с виджетами; `/dashboard/gk_customer/projects` → шкала УГТ; `/dashboard/gk_customer/projects/new` → опросник.