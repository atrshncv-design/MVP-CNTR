# STATUS / CURRENT STATE

**MVP v2 ЗАВЕРШЁН ✅ (Фазы 1–4)**

## Push-контракт
- Remote `origin` → `https://github.com/atrshncv-design/MVP-CNTR.git`
- `main` (dd91a07), `feat/frontend` (e8805f2), `feat/backend` (298b24f) — все отправлены.

---

## Фаза 1 — Инфраструктура ✅
- **Шаг 1.1:** Git worktrees (Next.js 16 + FastAPI, uv)
- **Шаг 1.2:** PostgreSQL Primary/Replica + pgvector + схемы public/test
- **Шаг 1.3:** NextAuth.js v5 + FastAPI JWT + middleware RBAC
- **Шаг 1.4:** RBAC: 9 ролей, permissions, users, user_roles (Alembic 0003)

## Фаза 2 — Адаптация MVP 0 + ЛК ✅
- **Шаг 2.1–2.3:** УГТ-данные, опросник ~350 вопросов, Wizard, УГТ-шкала, дашборды ГК и R&D

## Фаза 3 — Дашборд проекта + RAG + Генератор ✅
- **Шаг 3.1:** `/dashboard/project/[id]` — радар УГТ, прогресс-бары, КТ, документы, команда, бюджет (RBAC), аудит
- **Шаг 3.2:** 6 таблиц (projects, questionnaire_results, project_members, control_points, project_documents, audit_trail); `GET /api/v1/projects/{id}` + `POST /api/v1/projects/questionnaire`
- **Шаг 3.3:** RAG-пайплайн: hash-based embedding (1536-dim), KNN-поиск pgvector `<=>`, `POST /api/v1/rag/templates`, `POST /api/v1/rag/search`
- **Шаг 3.4:** Генератор документов: `POST /api/v1/projects/{id}/generate/{tz|passport|teo}`, шаблоны с `{{variable}}`, seed-скрипт

## Фаза 4 — Реестры + AI-ассистент ✅

### Шаг 4.1 (Fullstack): Реестры
**Backend:**
- `GET /api/v1/executors` — каталог исполнителей (rd_executor, scientific_org, serial_manufacturer) с фильтром по роли и количеством проектов
- `GET /api/v1/technologies` — реестр проектов с фильтрацией по статусу, категории, уровню УГТ

**Frontend:**
- `/dashboard/executors` — сетка карточек исполнителей с поиском и фильтром по ролям
- `/dashboard/technologies` — сетка карточек технологий с прогресс-барами УГТ, фильтрами по статусу/категории

### Шаг 4.2 (Fullstack): AI-ассистент
**Backend:**
- `POST /api/v1/chat` — принимает вопрос, делает семантический поиск по RAG-базе, возвращает ответ
- `app/services/gigachat.py` — обёртка GigaChat API (OAuth + completion) с graceful fallback при отсутствии ключа
- `app/services/ai_assistant.py` — построитель RAG-контекста + оркестратор чата
- `GIGACHAT_CREDENTIALS` в `app/core/config.py` (добавить в `.env` для включения GigaChat)

**Frontend:**
- `/dashboard/ai-assistant` — интерфейс чата с пузырьками сообщений, отображением источников из RAG, индикатором загрузки

### Валидация
- Backend: `ruff check app/` — чисто ✅
- Frontend: `tsc --noEmit` чисто ✅, `eslint` чисто ✅, `next build` чисто ✅ (22 роута)

---

## Итоговая архитектура MVP v2

```
Frontend (Next.js 16, App Router, 22 роута)
├── /dashboard/gk_customer          — ЛК ГосКомпании
├── /dashboard/rd_executor          — ЛК R&D-исполнителя
├── /dashboard/scientific_org       — ЛК Научной организации
├── /dashboard/serial_manufacturer  — ЛК Производителя
├── /dashboard/ugt_expert           — ЛК Эксперта УГТ
├── /dashboard/auditor              — ЛК Аудитора
├── /dashboard/investor             — ЛК Инвестора
├── /dashboard/cntr_admin           — ЛК Админа ЦНТР
├── /dashboard/cntr_manager         — ЛК Менеджера ЦНТР
├── /dashboard/gk_customer/projects — УГТ-шкала
├── /dashboard/gk_customer/projects/new — Опросник
├── /dashboard/project/[id]         — Дашборд проекта
├── /dashboard/executors            — Каталог исполнителей
├── /dashboard/technologies         — Реестр технологий
├── /dashboard/ai-assistant         — AI-ассистент
├── /login, /register, /forbidden
└── Middleware RBAC (все 9 ролей)

Backend (FastAPI, 15+ эндпоинтов)
├── POST /api/v1/auth/register
├── POST /api/v1/auth/login
├── GET  /api/v1/auth/me
├── GET  /api/v1/health
├── GET  /api/v1/projects/{id}
├── POST /api/v1/projects/questionnaire
├── POST /api/v1/projects/{id}/generate/{doc_type}
├── POST /api/v1/rag/templates
├── POST /api/v1/rag/search
├── GET  /api/v1/rag/templates
├── GET  /api/v1/executors
├── GET  /api/v1/technologies
└── POST /api/v1/chat

Database (PostgreSQL + pgvector)
├── public.users, roles, permissions, user_roles, role_permissions
├── public.projects, questionnaire_results, project_members
├── public.control_points, project_documents, audit_trail
└── public.rag_documents (pgvector, ivfflat index)
```

## Следующие шаги (пост-MVP)
- Загрузка настоящих документов/шаблонов в RAG (через `POST /api/v1/rag/templates`)
- Подключение GigaChat (установить `GIGACHAT_CREDENTIALS` в `.env`)
- Populate БД реальными пользователями и проектами
- Unit-тесты / интеграционные тесты
- CI/CD pipelines
