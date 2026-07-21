# STATUS / CURRENT STATE

**Текущая фаза:** Фаза 3 завершена ✅ (Шаги 3.1–3.4).

## Новый push-контракт (CLAUDE.md §6)
- Remote `origin` → `https://github.com/atrshncv-design/MVP-CNTR.git` задан.
- Все ветки `main`, `feat/frontend`, `feat/backend` отправляются на GitHub после каждого коммита.

## Что сделано (Фаза 1 — Инфраструктура) ✅
- **Шаг 1.1:** Git worktrees (Next.js 16.2.10 + FastAPI, uv).
- **Шаг 1.2:** PostgreSQL Primary/Replica + pgvector + schemas public/test + Serial/BigSerial + Hash/B-Tree/ivfflat.
- **Шаг 1.3:** NextAuth.js v5 + FastAPI JWT + Middleware RBAC.
- **Шаг 1.4:** RBAC: 9 ролей, permissions, users, user_roles; Alembic 0003.

## Что сделано (Фаза 2 — Адаптация MVP 0 + ЛК) ✅
- **Шаг 2.1–2.3:** Портированы УГТ-данные + опросник, УГТ-шкала, Wizard, дашборды ГК и R&D.

## Что сделано (Фаза 3 — Дашборд проекта + RAG + Генератор) ✅

### Шаг 3.1 (frontend): Дашборд проекта `/dashboard/project/[id]`
- Multi-role маршрут (все 9 ролей) в `ROUTE_ALLOWED_ROLES`.
- Radar УГТ (recharts), прогресс-бары 1–9, КТ-1 go/no-go, документы, команда, бюджет (RBAC), аудит.

### Шаг 3.2 (backend): API опросников
- 6 таблиц (projects, questionnaire_results, project_members, control_points, project_documents, audit_trail).
- `GET /api/v1/projects/{id}` (полный граф) + `POST /api/v1/projects/questionnaire` (upsert).
- Alembic 0004, ruff чисто.

### Шаг 3.3 (backend): RAG-пайплайн
- `app/core/embeddings.py` — детерминированная 1536-dim векторизация текста (feature hashing + SHA-256), без внешних зависимостей.
- `app/services/rag.py` — upsert документа с вычислением эмбеддинга; KNN-поиск через pgvector `<=>` (cosine distance).
- `app/api/v1/rag.py` — 3 эндпоинта:
  - `POST /api/v1/rag/templates` — загрузка шаблона с авто-эмбеддингом (только cntr_admin/cntr_manager)
  - `POST /api/v1/rag/search` — семантический поиск по тексту (doc_type/ugt_level фильтры)
  - `GET /api/v1/rag/templates` — список шаблонов
- `db/migrations/sql/0005_rag_metadata.sql` — добавил `template_metadata JSONB` в `rag_documents`.
- Alembic 0005.

### Шаг 3.4 (backend): Генератор документов (ИИ v0)
- `app/services/document_generator.py` — шаблонизатор `{{variable}}`:
  - Подстановка полей проекта (name, description, category, budget, target/current level).
  - Подстановка данных опросника (level_N_percentage, level_N_items).
  - Бюджетные расчёты (30%/40%/30% по этапам).
- `app/api/v1/generation.py` — `POST /api/v1/projects/{id}/generate/{doc_type}` (tz / passport / teo).
- `app/db/seed_templates.py` — 3 полноценных шаблона с переменными:
  - **Техническое задание (ТЗ)** — структура по ГОСТ, бюджет, перечень документации.
  - **Паспорт проекта** — УГТ-профиль по 9 уровням, команда, контрольные точки.
  - **Технико-экономическое обоснование (ТЭО)** — оценка затрат, риски, эффективность.

### Проверка
- Backend: `ruff check app/ db/` — чисто ✅.
- Frontend: `tsc --noEmit` ✅, `npm run lint` ✅, `npm run build` ✅ (21 роутов).
- Push: `feat/backend` (3484a24) + `feat/frontend` (eaa4077) отправлены в `origin`.

## Артефакты для проверки Functional Validator
- `POST /api/v1/rag/templates` — загрузить новый шаблон → авто-эмбеддинг
- `POST /api/v1/rag/search` — найти шаблоны по текстовому запросу
- `POST /api/v1/projects/{id}/generate/tz` — сгенерировать ТЗ по данным проекта
- `POST /api/v1/projects/{id}/generate/passport` — паспорт проекта
- `POST /api/v1/projects/{id}/generate/teo` — ТЭО
- `uv run python app/db/seed_templates.py` — засеять 3 шаблона в RAG-базу

## Следующая фаза: Фаза 4 (Plan.md)
- Шаг 4.1 — Реестр технологий и Каталог исполнителей.
- Шаг 4.2 — Чат-бот AI v0 на GigaChat API.
