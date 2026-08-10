# Роль-доступ: базовая матрица девяти ролей и IDOR-аудит (тикет 03)

**Тикет:** 03 — Базовая матрица девяти ролей и IDOR (release-audit)
**Дата:** 10.08.2026
**Источник:** код backend `technozrelost-backend` (ветка `release/friday-rc`, HEAD `9e6cccc`), read-only; клон `/tmp/tz-release-audit/be-clone` (тот же HEAD).
**Метод:** статический анализ кода (endpoint → dependency → service), сопоставление с тестами; живой прогон — BLOCKED (docker DOWN).

---

## 1. Девять ролей (источник: `db/migrations/sql/0003_rbac.sql`; модель `app/db/models.py:66-84`)

| № | slug | Название | priority | Назначение |
|---|------|----------|----------|------------|
| 1 | `gk_customer` | ГосКомпания-заказчик | 0 | Самостоятельно при регистрации |
| 2 | `rd_executor` | R&D-исполнитель | 0 | Самостоятельно при регистрации |
| 3 | `scientific_org` | Научная организация | 2 (P2) | Самостоятельно при регистрации |
| 4 | `serial_manufacturer` | Серийный производитель | 0 | Самостоятельно при регистрации |
| 5 | `ugt_expert` | Эксперт УГТ | 0 | Самостоятельно при регистрации |
| 6 | `auditor` | Аудитор | 2 (P2) | Самостоятельно при регистрации |
| 7 | `investor` | Инвестор | 1 | Самостоятельно при регистрации |
| 8 | `cntr_admin` | Администратор ЦНТР | 0 | Только админ ЦНТР (`PATCH /users/{id}`, users.py:82-139; seed_admin.py) |
| 9 | `cntr_manager` | Менеджер ЦНТР | 1 | Только админ ЦНТР |

**Как назначаются роли:**
- **Регистрация** (`app/api/v1/auth.py:40-69`): `RegisterIn.role_slug` — любая роль из БД, **кроме** `CNTR_STAFF_SLUGS = ("cntr_admin", "cntr_manager")` (auth.py:42-46 → 403 «Роли работников ЦНТР назначаются администратором центра»). **Служебная роль самостоятельно НЕ назначается — ЗАКРЫТО.** Тест: `test_cntr_staff_role_cannot_be_self_registered[cntr_admin|cntr_manager]` (test_auth_smoke.py:111).
- **Админ ЦНТР** (`app/api/v1/users.py:82-139`, `require_role("cntr_admin")`): `PATCH /users/{id}` может заменить полный набор ролей любого пользователя (users.py:93-113), деактивировать (users.py:114-115). Ограничений на «последнего админа»/self-demote нет — наблюдение.
- **Первичная роль:** одна на пользователя (`user_roles_primary_uq`, 0003_rbac.sql; users.py:105-113 — первая в списке становится `is_primary=True`).
- Таблица `permissions`/`role_permissions` засеяна (0003_rbac.sql), но **в рантайме НЕ проверяется**: в коде нет `require_permission`/`has_permission` (grep по app/ — только модели). RBAC фактически реализован через `require_role` (deps.py:64-73), `has_role`/`is_cntr_staff` (deps.py:76-88) и бизнес-проверки владения. ⚠️ Design-gap: декларативная permission-модель — мёртвая схема.

## 2. Матрица «роль × раздел» (по коду)

Легенда: ✅ разрешено по коду · ⛔ запрещено по коду · ➖ не реализовано/нет endpoint · 🟡 частично (с условиями).

| Раздел | gk_customer | rd_executor | scientific_org | serial_manufacturer | ugt_expert | auditor | investor | cntr_manager | cntr_admin |
|---|---|---|---|---|---|---|---|---|---|
| **Проекты: создание** (POST /projects, POST /assessments) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Проекты: свои/участие** (GET /projects, GET /projects/{id}) | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ все | ✅ все |
| **Проекты: чужой (не участник)** | ⛔ 404 | ⛔ 404 | ⛔ 404 | ⛔ 404 | ⛔ 404 | ⛔ 404 | ⛔ 404 | ✅ | ✅ |
| **Проекты: publish/archive/delete** | 🟡 владелец/project_admin | 🟡 владелец | 🟡 владелец | 🟡 владелец | 🟡 владелец | 🟡 владелец | 🟡 владелец | ✅ staff | ✅ staff |
| **Проекты: договорные поля** (PATCH /legal) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| **Реестр проектов** (GET /projects/registry) | ✅ публичный (только is_public) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Документы: upload/download/list** | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ | ✅ |
| **Документы: генерация** (POST /generation) | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ | ✅ |
| **Документы: версии/cleanup** | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | ✅ | ✅ |
| **Реестры: НИОКТР/исполнители/технологии** | ✅ публичные | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Приглашения (создать/отозвать/передать)** | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 project_admin | 🟡 только если участник+admin | 🟡 |
| **Join-механика** (POST /projects/join, модерация) | ✅ по токену; модерация — приоритетный участник | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ приоритет/manager | ✅ |
| **Заявки N→N+1, комментарии, PDF-заключение** | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ | ✅ |
| **Менеджерские очереди** (GET/POST /manager/queue/*) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| **Задачи менеджера** (claim/reassign, /manager/tasks) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ claim | ✅ claim+reassign |
| **Уведомления** (GET /notifications, POST /{id}/read) | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои |
| **AI-чат (RAG)** (POST /chat) | ✅ (rate limit 429) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **RAG: загрузка шаблонов** (POST /rag/templates) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| **RAG: поиск** (POST /rag/search) | ✅ авторизованным | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Профиль** (GET/PATCH /users/me, пароль, организации) | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои | ✅ свои |
| **Администрирование** (GET /users, PATCH /users/{id}, GET /admin/audit) | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | 🟡 /users нет; audit нет | ✅ |
| **Аудит событий** (AuditTrailEntry append-only) | запись | запись | запись | запись | запись | запись | запись | запись | запись + чтение |
| **Спец-функции аудитора** (go/no-go КТ-1, ТЭО/Паспорт) | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ не реализовано (permission `audit.kt1.decide` есть в БД, endpoint отсутствует) | ➖ | ➖ | ➖ |
| **Спец-функции scientific_org** (Мини-ТЗ, витрина кейсов) | ➖ | ➖ | ➖ не реализовано (P2) | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| **Верифицирующие документы УГТ** (загрузка в проекте) | ✅ участник | ✅ участник | ✅ участник | ✅ участник | ✅ участник (по дизайну эксперт) | ✅ участник | ✅ участник | ✅ | ✅ |

Примечания:
- Создание проекта доступно **любой** авторизованной роли (в т.ч. investor/auditor) — `create_project` (projects.py:72-135) и `create_assessment` (assessments.py:146-162) ограничены только `CurrentUser`. Это шире, чем PRD-описание «ГосКомпания создаёт ПТЗ» — по коду ограничения нет.
- «Свои» проекты = `created_by == user.id` ИЛИ активный участник (`ProjectMember.status == "active"`) — projects.py:138-148, 158-172.
- Менеджер/админ видят все проекты (`project_list_stmt`, projects.py:140-141).

## 3. IDOR-аудит: endpoint с object-id → проверка владения

| Endpoint | Объект | Проверка владения/роли (файл:строка) | Вердикт | Тест |
|---|---|---|---|---|
| GET /projects/{project_id} | project | `require_project_access` → created_by / active member / staff → 404 (projects.py:158-179) | **ЗАКРЫТ** | test_outsider_gets_404_not_403 (test_rbac_projects.py:92) |
| PUT /projects/{id}/publish | project | require_project_access + project_admin/owner/staff → 403 (projects.py:264-289) | **ЗАКРЫТ** | test_publish_forbidden_for_outsider (test_publication_privacy.py:178) |
| DELETE /projects/{id} | project | require_project_access + только владелец → 403 (projects.py:317-327) | **ЗАКРЫТ** | test_verified_project_cannot_be_deleted_only_archived |
| POST /projects/{id}/archive | project | require_project_access + владелец → 403 (projects.py:348-355) | **ЗАКРЫТ** | test_verified_project_cannot_be_deleted_only_archived |
| GET /projects/{id}/export | project | require_project_access (projects.py:365-374) | **ЗАКРЫТ** | test_archive_audit_export (косвенно) |
| GET /projects | список | scoped: created_by/member; staff — все (projects.py:138-148) | **ЗАКРЫТ** | test_project_list_is_scoped (test_rbac_projects.py:113), test_project_scope.py |
| GET /projects/registry | project (публичный) | только `is_public=True` (projects.py:223-227); public by design | **ЗАКРЫТ** (не IDOR) | test_registry_shows_only_published (test_new_core.py:330) |
| POST /projects/{pid}/invites · GET · revoke · transfer-admin | invite/project | `require_project_admin` (invites.py:62-85) → 403 | **ЗАКРЫТ** | test_invite_rbac_non_admin_cannot_manage (test_invites.py:250), test_transfer_admin_moves_privilege |
| POST /invites/accept | invite token | токен `INV-…` secrets (invites.py:95); 404 не найден; revoked/expired/limit/allowed_roles (invites.py:133-149) | **ЗАКРЫТ** (token = capability) | test_single_invite_single_use_and_role_restriction, test_invite_expired, test_bulk_invite_limit_and_revoke |
| POST /projects/{pid}/invites/{iid}/revoke | invite | require_project_admin + `invite.project_id == project_id` (invites.py:186-189) | **ЗАКРЫТ** | test_bulk_invite_limit_and_revoke (косвенно) |
| PATCH /projects/{pid}/legal | project | `require_role("cntr_manager","cntr_admin")` (invites.py:31,224-229) | **ЗАКРЫТ** | test_legal_fields_only_manager (test_invites.py:283) |
| GET /projects/{pid}/requests | request | require_project_access (requests.py:58-63) | **ЗАКРЫТ** | test_comments_hidden_from_outsider (test_comments_pdf_retention.py:108) |
| GET/POST /projects/{pid}/requests/{rid}/comments | request | `_require_request_access`: project access + `req.project_id == project_id` → 404 (requests.py:37-44, 102-149) | **ЗАКРЫТ** | test_comments_hidden_from_outsider |
| GET /projects/{pid}/requests/{rid}/conclusion.pdf | request | `_require_request_access` + status approved/rejected (requests.py:152-162) | **ЗАКРЫТ** | test_conclusion_pdf_after_decision |
| DELETE /projects/{pid}/files/old-versions | docs | require_project_access + project_admin/staff/owner → 403 (requests.py:186-205) | **ЗАКРЫТ** | test_cleanup_forbidden_for_plain_member (test_comments_pdf_retention.py:234) |
| POST /projects/{pid}/files · GET /projects/{pid}/files | document | require_project_access (files.py:65-121) | **ЗАКРЫТ** | test_upload_requires_auth_and_membership (test_file_storage.py:162) |
| GET /files/{file_id}/download | document | `db.get(doc)` → `require_project_access(doc.project_id)` (files.py:124-131) | **ЗАКРЫТ** | test_download_and_list_restricted_to_participants (test_file_storage.py:145) |
| POST /files/{file_id}/rescan | document | то же (files.py:145-152) | **ЗАКРЫТ** | нет отдельного теста на rescan чужим ⚠️ |
| GET/POST /projects/{pid}/stage-requirements · stage-documents · stage-evaluate | project/stage | require_project_access (stages.py:150-163, 251+) | **ЗАКРЫТ** | test_new_core (этапы), test_requirement_sets |
| POST /assessments · GET /assessments/mine | assessment/project | только создатель: `Project.created_by == user.id` (assessments.py:343-352); переоценка → 403 (assessments.py:151-162) | **ЗАКРЫТ** | test_draft_invisible_to_others (test_new_core.py:96), test_assessment_403_after_real_project |
| GET/POST /manager/queue/drafts · /{pid}/decide | project (draft) | `ManagerUser = require_role("cntr_manager","cntr_admin")` (manager.py:39); статус draft → 404 (manager.py:110-116) | **ЗАКРЫТ** (служебная зона по роли) | test_manager_queues_require_manager_role (test_new_core.py:108) |
| GET/POST /manager/queue/promotions · /{rid}/decide | promotion request | ManagerUser (manager.py:237-243); N→N+1 проверки | **ЗАКРЫТ** | test_manager_queues_require_manager_role, test_promotion_* |
| POST /manager/tasks/{task_id}/claim | queue item | `ManagerOnly` (realtime.py:26, 175-181); claim_next_task SKIP LOCKED; чужой взятый task → 409, не найден → 404 | **ЗАКРЫТ** | test_only_one_manager_claims_task (test_realtime_notifications.py:142) |
| POST /manager/tasks/{task_id}/reassign | queue item | `require_role("cntr_admin")` (realtime.py:211-213); 404/409 | **ЗАКРЫТ** | test_admin_reassigns_task |
| POST /projects/join | join token | токен `TZ-XXXXXX` secrets (models.py:34-39); 404 недействителен (membership.py:113-117) | **ЗАКРЫТ** (token = capability) | test_invalid_token_rejected (test_join_mechanic.py:207) |
| GET /projects/{pid}/join-requests · /{mid}/decide · regenerate-token | member | `require_priority_access` (membership.py:83-92); member принадлежит проекту → 404 (membership.py:201-209) | **ЗАКРЫТ** | test_owner_approves_request, test_reject_sets_removed |
| PATCH /projects/{pid}/members/{uid}/priority | member | `ManagerUser = require_role("cntr_manager")` (membership.py:31, 259-276) | **ЗАКРЫТ** | test_non_manager_cannot_grant_priority (test_join_mechanic.py:258) |
| POST /notifications/{id}/read | notification | `note.user_id != user.id` → 404 (notifications.py:42-52) | **ЗАКРЫТ** | нет теста на чужое уведомление ⚠️ |
| GET /admin/audit | audit (глобальный) | `AdminOnly = require_role("cntr_admin")` (admin.py:14, 29-42) | **ЗАКРЫТ** | test_archive_audit_export (косвенно) |
| PATCH /users/{user_id} | user | `require_role("cntr_admin")` (users.py:32, 82-88) | **ЗАКРЫТ** | test_list_users_requires_admin (test_profile_admin.py:87), test_admin_updates_roles_and_deactivates |
| POST /generation | project | require_project_access (generation.py:26) | **ЗАКРЫТ** | test_generate_by_outsider_404 (test_document_generation.py:135) |
| POST /rag/templates | rag doc | явный allow-list cntr_admin/cntr_manager → 403 (rag.py:19-27) | **ЗАКРЫТ** | нет теста ⚠️ |
| GET /realtime/stream (SSE) | user (uid) | Bearer или `access_token` в query (realtime.py:55-75); чужой uid не принимается (uid из токена) | 🟡 закрыт по авторизации; **R3 из тикета 01: access_token в query — риск утечки в логах (medium)** | test_realtime_notifications (косвенно) |
| POST /chat | — | CurrentUser + rate limit 429 (chat.py:27-36) | не IDOR (нет object-id) | test_chat_requires_auth, test_ai_assistant |
| /users/me, /auth/me, /notifications | user | user из токена | не IDOR | test_auth_smoke |

**Итог IDOR-аудита:** проверено 33 endpoint с object-id → **31 ЗАКРЫТ** (по коду есть проверка владения/роли), **0 ОТКРЫТ**, **2 не проверяемо/частично** (SSE-токен в query — зафиксирован в тикете 01 R3; генерация документов — считается неготовой, тикет 01). Топ-риски: см. раздел 5.

## 4. Негативные сценарии и покрытие тестами

| Сценарий (требование тикета) | Ожидание | Тест (есть) | Покрытие |
|---|---|---|---|
| Чужой project_id (перебор ID) | 404, не 403 | `test_outsider_gets_404_not_403` (test_rbac_projects.py:92) | ✅ |
| Черновик чужого пользователя | не виден | `test_draft_invisible_to_others` (test_new_core.py:96) | ✅ |
| Загрузка/скачивание файлов чужого проекта | 403/404 | `test_upload_requires_auth_and_membership`, `test_download_and_list_restricted_to_participants` (test_file_storage.py:145,162) | ✅ |
| Скачивание файла по чужому file_id | 404 | (частично тем же тестом) | 🟡 нет прямого теста «чужой file_id» |
| Чужие комментарии/заявки | скрыты | `test_comments_hidden_from_outsider` (test_comments_pdf_retention.py:108) | ✅ |
| Генерация документа по чужому проекту | 404 | `test_generate_by_outsider_404` (test_document_generation.py:135) | ✅ |
| Чужой invite token / невалидный | 404/409 | `test_invalid_token_rejected` (join, test_join_mechanic.py:207); invite: expired/limit (test_invites.py:182,230) | 🟡 нет теста accept с невалидным INV-токеном |
| Недостаточная роль (403) | 403 | `test_manager_queues_require_manager_role`, `test_non_manager_cannot_grant_priority`, `test_invite_rbac_non_admin_cannot_manage`, `test_cleanup_forbidden_for_plain_member`, `test_list_users_requires_admin`, `test_publish_forbidden_for_outsider`, `test_legal_fields_only_manager` | ✅ |
| Без авторизации (401) | 401 | `test_unauthorized_request_rejected`, `test_create_project_requires_auth`, `test_chat_requires_auth`, `test_login_wrong_password_rejected`, `test_refresh_token_cannot_be_used_as_access` | ✅ |
| Self-assign служебной роли | 403 | `test_cntr_staff_role_cannot_be_self_registered[cntr_admin|cntr_manager]` (test_auth_smoke.py:111) | ✅ |
| Неизвестная роль при регистрации | 400 | `test_unknown_role_rejected` (test_auth_smoke.py:97) | ✅ |
| Rate limit AI | 429 | — | ❌ нет теста на 429 |
| Чужое уведомление (notification_id) | 404 | — | ❌ нет теста ⚠️ |
| rescan чужого файла | 404 | — | ❌ нет теста ⚠️ |
| Загрузка RAG-шаблона не-персоналом | 403 | — | ❌ нет теста ⚠️ |
| Контрольные точки: не-менеджер | 403 | `test_regular_user_cannot_decide_control_point` (test_control_points.py) | ✅ |
| Живой прогон всех негативных | зелёные | — | ❌ **BLOCKED** (docker DOWN) |

**Audit-механизм:** есть — `AuditTrailEntry` (append-only, models), пишется бизнес-логикой (project.created, publish, reject, promotion.approved, user.updated и т.д.), чтение — `GET /admin/audit` только cntr_admin (admin.py). Значимые попытки доступа (404/403 нарушителя) в audit **не** пишутся — audit покрывает успешные действия и решения, не попытки IDOR (наблюдение, medium-low).

## 5. Разрывы (gaps) с severity

| # | Разрыв | Severity | Действие |
|---|---|---|---|
| G1 | Permission-таблица (permissions/role_permissions) не проверяется в рантайме; RBAC — только require_role + бизнес-проверки | **Medium** (design gap) | fix (long-term): внедрить require_permission или удалить мёртвую схему; на baseline не блокирует — проверки владения есть везде |
| G2 | `access_token` в query-параметре SSE (/realtime/stream) — риск попадания в логи/историю | **Medium** (уже R3 тикета 01) | fix: перевести на cookie/EventSource-заголовки |
| G3 | Отсутствуют негативные тесты: notifications mark_read чужим, rescan чужого файла, invite accept с невалидным токеном, /rag/templates 403, chat 429 | **Low-Medium** | fix: добавить тесты (после поднятия БД) |
| G4 | Живой прогон негативных тестов невозможен (docker DOWN) | **BLOCKED** | владелец: `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica` → в клоне `/tmp/tz-release-audit/be-clone/technozrelost-backend`: `env -u PYTHONPATH uv run pytest` |
| G5 | Админ может назначить/снять любые роли без защиты «последнего админа» и self-demote | **Low** (доверенная роль) | fix (опционально): guard последнего активного cntr_admin |
| G6 | Создание проекта доступно всем 9 ролям (включая investor/auditor) — шире PRD | **Low** | hide/уточнение: оставить по коду или ограничить ролями-создателями |
| G7 | Спец-функции auditor (go/no-go КТ-1, ТЭО/Паспорт) и scientific_org (P2) не реализованы, хотя роли/разрешения в БД есть | **Medium** (уже R7 тикета 01) | hide: пометить «В разработке» в FE, не показывать мёртвые функции |
| G8 | Попытки IDOR (404/403) не логируются в audit | **Low-Medium** | fix (опционально): audit неудачных попыток доступа к чужим объектам |
| G9 | Генерация документов (POST /generation) считается неготовой по тикету 01 | **Medium** | hide (уже в тикете 01: GAP-DOC-1) |

## 6. Acceptance criteria тикета 03

| Критерий | Вердикт | Обоснование |
|---|---|---|
| 1. Создатель и принятый участник получают только предусмотренный проектный доступ | **PASS** | require_project_access (projects.py:158-179): created_by / активный участник / staff; список scoped (projects.py:138-148); принятый участник = status "active" (invites.py:151-170, membership.py:132-154) |
| 2. Перебор ID чужого проекта/файла/запроса/очереди → безопасный отказ | **PASS по коду + статическим тестам; живой прогон BLOCKED** | 31/33 endpoint закрыты (404/403); тесты перечислены в разделе 4; docker DOWN → живой прогон BLOCKED (G4) |
| 3. Служебная роль не назначается самостоятельно | **PASS** | auth.py:42-46 (403 для cntr_admin/cntr_manager); тест test_cntr_staff_role_cannot_be_self_registered |
| 4. Все отказы покрыты API-тестами, значимые попытки в audit | **PARTIAL** | audit-механизм есть (AuditTrailEntry + /admin/audit, из тикета 01); отказы покрыты частично — 4 пробела G3; живой прогон BLOCKED |

**Итог: 2×PASS, 1×PARTIAL, 1×BLOCKED (живой прогон).**
