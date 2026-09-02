# Спецификация: Унификация frontend — ЛК 8 ролей, реестры, карточка УГТ, matching

## Задача

Команда ЦНТР ведёт проекты по ГОСТ Р 58048-2017 в B2B/B2G-контуре. Сейчас frontend разрознен: 9 кабинетов-клонов с дублированным кодом, два принципа SSR/CSR, реестры по разным паттернам, карточка проекта 1194 строки с Radar вместо шкалы УГТ, matching отсутствует, документы дублируются, дизайн-документ синий а код красный. Пользователь (ГК-заказчик, МТК-исполнитель, ЦНТР-менеджер) не понимает, где его проекты, какие документы нужны для перехода УГТ, и как найти партнёра.

## Решение

Единое цифровое окно НТР: 8 унифицированных ЛК (gk_customer, rd_executor, scientific_org, serial_manufacturer, regulating_organization, auditor, investor, cntr_admin, cntr_manager — без эксперта), общий топбар+табы, карточка проекта с линейной шкалой УГТ (дробные сектора = документы ГОСТа) и чек-листом, реестры только карточки с расширенными фильтрами и realtime, отдельный режим matching (ИИ подбирает партнёров по чистым данным через ЦНТР), единая дизайн-система красная светлая.

## Пользовательские истории

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | R15 | Как ГК-заказчик, я захожу в свой ЛК, чтобы видеть свои проекты, УГТ и исполнителей | hero + 4 stats (проекты/активные/черновики/исполнители) + список ЦНТР-{id} загружается <1с |
| 2 | R15.1 | Как пользователь любой роли, я вижу 403 если лезу в чужой кабинет | `allowedRolesFor` fail-closed, rewrite /forbidden 403, тест routes-matrix |
| 3 | R15.2 | Как R&D/Научная, я вижу одинаковый ЛК исполнителя | один `RoleDashboardShell` с пропсом role, разница только лейбл/иконка |
| 4 | G05 | Как научная организация, я имею полный ЛК как R&D | тот же shell, не заглушка |
| 5 | G12 | Как любой пользователь, я могу «Создать заявку» или «Вступить по TZ-XXXXXX» с главной | две CTA на рабочем столе, токен TZ-XXXXXX валидируется |
| 6 | G08 | Как пользователь с 2 организациями, я вижу 8 проектов где участвую, не 300 всех | фильтр по membership, не по organization.projects_count |
| 7 | R24.1 | Как пользователь, я ставлю звёздочку в реестре и фильтрую «Избранное» | localStorage избранное, фильтр, персист |
| 8 | R18 | Как владелец проекта, я вижу единую карточку с 15 блоками канвы 5.5 | шапка название+УГТ-линия, ниже все 19 полей (на УГТ1 без архитектуры, УГТ9 + планы) |
| 9 | R18.1 | Как гость карточки, я вижу шапку как в примере 5.5 | тест ui-shell проверяет структуру |
| 10 | G18 | Как пользователь, я вижу линию УГТ с дробными секторами, сектор=документ | на УГТ N секторов = числу обязательных доков из ГОСТа, прогресс по --tz-ugt-N |
| 11 | G20 | Как исполнитель, я вижу чек-лист обязательных доков для перехода УГТ→УГТ+1 | StageRequirement.from_level→to_level, галочки, счётчик секторов |
| 12 | G20.1 | Как пользователь, я скачиваю шаблон документа для УГТ | кнопка «Скачать шаблон» per requirement |
| 13 | G29 | Как пользователь, я спрашиваю ИИ-консультанта только про документы УГТ | виджет в карточке, отвечает только по докам/шаблонам, без ПДн |
| 14 | G19 | Как не-владелец, я могу только загружать документы, не редактировать поля | поля disabled если status≠draft и не в {manager,admin,lead} |
| 15 | G22 | Как любой участник, я вижу историю изменений | AuditTrail лента, видна всем |
| 16 | G23 | Как пользователь, я вижу блок действий внизу, активный по правам | владелец/менеджер/админ — редактировать/публиковать/архив/экспорт/токен, остальные — загрузить+поделиться |
| 17 | G40 | Как автор черновика, я получаю автосохранение 30с и диалог при уходе | индикатор «Сохранено», beforeunload + модалка |
| 18 | R20 | Как серийный производитель, я вижу реестр технологий как проекты с УГТ 7+ | тот же registry с ugt_min=7, не отдельная таблица technologies |
| 19 | G14 | Как пользователь, я ставлю 1-5 тегов из 30+ справочника | мультитеги чипы, поиск по справочнику |
| 20 | R21.1 | Как пользователь, я фильтрую реестр по поиску+тегам+УГТ+статусу+региону+бюджету | чипы-фильтры, состояние в URL, дебаунс |
| 21 | G46 | Как пользователь, я вижу список отсортированным по дате обновления ↓ | default sort updated_at desc |
| 22 | G45 | Как пользователь, я подгружаю ещё 20 карточек кнопкой «Показать ещё» | лимит 20, keyset after_id |
| 23 | G55 | Как пользователь, я копирую URL с фильтрами и делюсь им | фильтры сериализуются в query |
| 24 | G41.1 | Как пользователь, я вижу скелетон при загрузке, empty с CTA, ошибку с Retry | tz-empty + skeleton + error state, тест |
| 25 | G49.1 | Как мобильный пользователь, я вижу 1 колонку и фильтры в drawer | grid-cols-1 + drawer, без горизонтального скролла |
| 26 | G56 | Как пользователь, я вижу обновление реестров в realtime при публикации | SSE/WS, без ручного обновления |
| 27 | R23 | Как любой пользователь, я открываю отдельный режим Matching | пункт «Подбор партнёра» в топбаре, доступен всем |
| 28 | G27 | Как пользователь, я выбираю свой проект или описываю идею текстом для подбора | два входа, форма + textarea |
| 29 | G28 | Как заявитель, я вижу топ≤5 карточек с причинами и жму «Предложить через ЦНТР» | причины из matching.py, кнопка → MatchRequest → Notification |
| 30 | G44 | Как пользователь, я вижу честно 0 если нет связей или «слабые — попробуйте иначе» | не показываем фиктивные 5 |
| 31 | G57 | Как ЦНТР, я уверен что LLM видит только чистые данные без ПДн | обезличивание title/annotation/теги, contour tuno, логи |
| 32 | R26.1 | Как пользователь, я вижу колокольчик + страницу /notifications с фильтрами | SSE + GET /notifications + read |
| 33 | G50 | Как аудитор, я ставлю Go/No-Go и при No-Go вижу бейдж «Возврат на УГТ N + причина» | PATCH control-point, бейдж review |
| 34 | G33.1 | Как cntr_admin, я вижу макс-аналитику по отраслям/муниципалитетам, manager — урезанную | воронка УГТ + отрасли + муниципалитеты |
| 35 | G38 | Как пользователь, я вижу бюджет проекта в реестре (всем) | budget выводится |
| 36 | G39 | Как пользователь, я только скачиваю документ, без превью | кнопка Скачать → /files/{id}/download |
| 37 | G53 | Как пользователь, я гружу только PDF/DOCX/XLSX/JPG/PNG до 25МБ | валидация + ClamAV fail-closed 409/413 |
| 38 | G43 | Как пользователь с истёкшей сессией, я вижу модалку и не теряю черновик | модалка + localStorage |
| 39 | G55.1 | Как пользователь, я вижу даты 31.03.2027 + тултип «2 дня назад» | format-date |
| 40 | R29 | Как пользователь, я знаю что статусов 7 (draft/auto_confirmed/published/active/completed/rejected/archived) | STATUS_LABELS унифицированы |
| 41 | G51 | Как пользователь, я вижу кнопки в шапке, без Cmd+K | quick actions в шапке, FAB только мобилка |
| 42 | G52 | Как пользователь, я навигируюсь клавиатурой с focus-visible кольцом | базовый focus, без AA-аудита |
| 43 | R32 | Как менеджер, я верифицирую организации/исполнителей в очереди | /profile-verification-queue, менеджер+админ |
| 44 | R01.1 | Как новый пользователь, я вижу пустой ЛК с объяснением что появится | empty state с CTA, не мок |
| 45 | R01.2 | Как пользователь, я вижу 403/forbidden при отсутствии прав на объект | rewrite 403, страница /forbidden |
| 46 | R01.3 | Как пользователь с медленным соединением, я вижу скелетон и могу Retry | skeleton + error + retry, не спиннер вечно |
| 47 | R01.4 | Как пользователь, я получаю понятную валидацию при неправильном вводе | текст ошибки, значение не теряется |
| 48 | A01 → R23 | Как инвестор, я фильтрую matching по региону/отрасли/УГТ перед запуском | доп. фильтры в режиме matching |

## Решения по реализации

**Стек:** Next.js 16 App Router + React 19 + Tailwind v4 (красный токен `--tz-*` из globals.css), next-auth 5, FastAPI остаётся без изменений кроме одного эндпоинта matching (если нужен). PostgreSQL 16 + pgvector, MinIO+ClamAV fail-closed.

**Модули:**
- `lib/types.ts` — единый источник Project/RegistryProject/Organization/Document типов, убирает 7 дублей (why: синхронизация схемы одним местом)
- `lib/api-client.ts` — единый клиент (getProjects, getRegistry, getProject, togglePublish, etc.) с Authorization, заменяет 30 сырых fetch (why: контракт FE-02, тест api-client)
- `lib/roles.ts` — остаётся, удалить эксперта, порядок сохранён
- `lib/filters.ts` — сериализация фильтров в URL + дебаунс hook useDebouncedValue
- `components/ui/*` — Button, Input, Select, Search, FileUpload, Modal, Drawer, Tabs, Card, Badge, Status, Progress, Empty, Error, Loading, Toast, Confirm, Pagination, FilterPanel — база из globals.css `.tz-*` (why: P0 унификация)
- `features/dashboard/RoleDashboardShell` — один shell с пропсами role→hero/stats/quickActions, 8 страниц тонкие обёртки (why: убрать 95% дублирование rd_executor/scientific_org)
- `features/project/ProjectCard` — разбиение монолита 1194 строк на Radar?→UgtLine, ChecklistPanel, DocsPanel, TeamPanel, ActionsPanel, HistoryPanel (why: переиспользование, тест seam)
- `features/registry/RegistryGrid` + `FilterBar` + `FavoriteStar` + `RealtimeHook`
- `features/matching/MatchingMode` — standalone страница /dashboard/matching
- `features/docs/GostChecklist` + `AiDocConsultant` (узкий)
- `features/notifications` — bell + page

**Схема данных (frontend типы):**
```ts
type ProjectCardOut = { id, name, description, tags: string[], target_level, current_level, preliminary_level, status, budget, organization, is_public, show_preliminary, created_by, updated_at, tags: string[] } // tags 1-5 вместо category
type RegistryParams = { search, tags[], ugt_min, ugt_max, status, region, budget_min, budget_max, after_id, limit=20 }
type MatchingIn = { title, annotation, sector?, ugt_level?, region?, competencies: string[] } // без ПДн
```

**Контракты API (существующие, без бэк-изменений кроме одного):**
- `GET /projects` (private, membership), `GET /projects/registry?ugt_min&tags&...` (ReadDB, is_public), `GET /projects/{id}`, `PUT /{id}/publish`, `POST /{id}/archive`, `GET /{id}/export`, `PATCH /control-points/{cp}`, `POST /files` multipart 25МБ 413 → 409 если scan pending, `GET /files/{id}/download` (только скачать), `GET /nioktr/organizations?limit=20&search`, `GET /executors/specialists`, `POST /match` (существует, добавить обезличивание), `GET /notifications`, `POST /notifications/{id}/read`, `GET /manager/queue/drafts`, `GET /admin/achievements/stats`. Новый если нужен: `GET /gost-requirements?level` — отдаёт список обязательных доков per УГТ (или берём из RAG).

**Внешние сервисы:** MinIO+ClamAV — без изменений, fail-closed сохранён. LLM — только чистые данные, contour tuno, без ПДн.

## Границы и швы

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `dashboard-shell` | отображение ЛК 8 ролей | `RoleDashboardShell({role}) -> ReactNode` | маппинг role→stats, ROLES константы |
| `project-card` | карточка УГТ, линия, чек-лист, действия | `ProjectCard({id})`, `UgtLine({current, docs})`, `Checklist({level})` | расчёт секторов, права редактирования |
| `registry` | реестры проектов/орг/технологий | `RegistryGrid({params})`, `useRegistry(params)`, `FavoriteStar` | пагинация keyset, фильтры URL, realtime SSE |
| `matching` | режим подбора партнёров | `MatchingMode()`, `matchOrganizations(in)->out` (обезличено) | скоринг, LLM rerank, причины |
| `docs` | документы, загрузка, чек-лист ГОСТ | `DocsPanel({projectId})`, `GostChecklist({level})`, `uploadFile()` | ClamAV статусы, шаблоны |
| `notifications` | колокольчик, страница, SSE | `NotificationBell()`, `NotificationsPage()` | SSE reconnection, read mutation |
| `ui` | базовые компоненты | `Button, Card, Badge, Modal...` | токены --tz-*, стили |
| `api-client` | единый fetch слой | `getProjects(token), getRegistry(params), ...` | Authorization, base URL, timeout |

**Швы для тестов (3):**
1. `api-client` — моки fetch, проверяют все вызовы без сети
2. `project-card/UgtLine` — юнит прогресса по числу доков
3. `registry/useRegistry` — фильтры → URL → запрос

Предпочитаем существующие `api-client` и `useRegistry` швы.

## Матрица ролей (требование R16)

| Роль | Цель | Доступные разделы | Доступные действия | Ограничения | Основной сценарий |
|---|---|---|---|---|---|
| gk_customer | Квалифицированный заказчик, контроль | ЛК заказчика, проекты, реестры (technologies/organizations/nioktr/executors), matching, notifications | создать проект/заявку, вступить по TZ, загрузить доки, читать аналитику | редактировать только свои проекты до верификации | создать заявку → мониторинг УГТ |
| rd_executor | МТК-исполнитель НИОКР | ЛК исполнителя, проекты, реестры, matching | создать проект, вступить по TZ, загрузка доков | нет доступа к админ-KPI | вступить → загрузить отчёт |
| scientific_org | НИР-контракты (клон R&D) | тот же что rd_executor | то же | тот же | то же |
| serial_manufacturer | Приёмка в серию УГТ7+ | ЛК производителя, реестр technologies ugt_min=7, проекты | создать проект, вступить, приёмка | только зрелые | выбрать технологию 7+ |
| regulating_organization | Верификация доков | ЛК регулятора, проекты, VerificationDocs | загрузка актов верификации, просмотр | не редактирует чужие поля | проверить КТ-доки |
| auditor | Контроль КТ-1 Go/No-Go | ЛК аудитора, проекты, control-points | Go/No-Go КТ-1 (P1), КТ1-4 в P2 | только решение по КТ | вынести решение |
| investor | Поиск активов | ЛК инвестора, реестры (только карточки, без вступления) | создать проект-карточку (доки заполнят другие), фильтровать | нет JoinProjectForm в P1 | найти актив → создать карточку |
| cntr_admin | Техуправление | Админ-дашборд макс аналитика, users, audit | RBAC, логи, биллинг-заглушка | видит всё | управлять RBAC |
| cntr_manager | Оркестрация | Менеджер-дашборд урезанный + очереди verification | модерация draft/promotion, верификация орг/исполнителей | не видит отрасли/муниципалитеты | модерировать очередь |

Без эксперта (убрано G04). 8 активных ролей.

## Модель сущностей (требование R17 — 23 сущности)

**Ядро:** `User(id, email, full_name, organization, is_active)` — глобальная роль из `user_roles_tbl.is_primary`; `Organization(id, ogrn, name, org_type, region, competencies JSONB, projects_count)` — только верифицированные на платформе (G15), не внешние НИОКТР; `Project(id, name, tags[1-5], target_level, current_level, preliminary_level, status 7, budget, is_public, join_token TZ-XXXXXX, legal_* , created_by)` — реестр технологий = `projects where is_public && current_level>=7` (G13); `ProjectMember(project_id, user_id, role_in_project, is_priority, is_project_admin)` — проектная роль из invite-токена может отличаться от глобальной (G07).

**Компетенции/технологии:** `Competency` — элемент `Organization.competencies` + `UserProfile.skills`; `Technology` — не отдельная таблица в P1, а проекция `Project`; `Document(ProjectDocument id, storage_key, sha256, scan_status, version, doc_type)` + `VerificationDocument` + `StageRequirement(from_level,to_level,title)` — объединены в один `DocsPanel` (G16); `UGT level` — шкала 1-9 ГОСТ, дробные сектора = числу StageRequirement per уровень.

**Процесс:** `ControlPoint(project_id, title, point_type gate/milestone, status, decision)` — КТ-1..4; `PromotionRequest` — заявка на повышение УГТ; `RequestComment` — комментарии; `AuditTrailEntry(project_id,user_id,action,details)` — история всем видна (G22); `Notification(user_id,type,title,payload,is_read)`+`NotificationOutbox` — SSE.

**Реестры:** `Registry = view over Project/Organization/NioktrCard/UserProfile` с `RegistryRecord` (публичные поля). Отдельные реестры `документов/компетенций/запросов/партнёров/результатов` — не отдельные страницы в P1: документы — внутри карточки, компетенции — поле организации, запросы/партнёры — через matching + membership, результаты — достижения. Отложены в P2 как отдельные реестры (см. Вне рамок).

**Matching:** `MatchRequest(title, annotation, sector, ugt_level, region, competencies)` → `MatchCandidate(org, score, reasons[])` топ≤5 через ЦНТР.

**Fold карточки:** выше первого экрана — шапка (название + УГТ-линия + статус + ID mono + теги 1-5) + чек-лист прогресса (4 сектора). Остальные 15 блоков ниже скролла (см. историю 8).

## Состояния (требование R08)

Диаграмма 7 статусов: `draft → auto_confirmed → published → active → completed` линейно, ответвления `→ rejected` (из draft/auto_confirmed/published/active с причиной) и `→ archived` (из любого). Hard-gate возврат: `rejected` с `rejection_reason` + бейдж «Возврат на УГТ N — причина» (G50), в истории стрелка назад. Переходы: `manager` подтверждает draft→auto_confirmed, владелец/lead публикует published, `auditor` Go/No-Go на КТ, `active→completed` — менеджер/админ.

## Roadmap P0-P3 (требования R29,R11,R12)

- **P0 фундамент (01):** типы, api-client, ui 24, STATUS dedup, filters URL — без него остальное дублируется.
- **P1 ядро (02,03,04,07,08-часть):** 8 ЛК shell, карточка 15 блоков + UgtLine + чек-лист, реестры карточки + realtime + избранное + URL-шаринг, уведомления+сессия, урезанная аналитика. Критерий: 8 ЛК без 403, карточка с линией, реестры с фильтрами, тесты 39/39 зелёные.
- **P2 важное (05,06,08-продолж):** matching ≤5 через ЦНТР обезличенно, шаблоны доков, ИИ-консультант узкий, экспорт CSV, сохранённые фильтры server, расширенная аналитика отрасли/муниципалитеты, КТ 1-4 для аудитора.
- **P3 последующее:** тёмная тема, offline-очередь, WCAG AA аудит, Cmd+K, таблица-вид.

## Вне рамок

| Требование | Почему не сейчас |
|---|---|
| R реестр документов отдельный | P1 — внутри карточки DocsPanel, отдельный реестр P2 |
| R реестр компетенций отдельный | P1 — поле Organization.competencies, отдельный P2 |
| R реестр запросов/партнёров/результатов отдельный | P1 — через matching/membership/achievements, отдельные P2 |
| R42 экспорт CSV/Excel, массовые действия | P2, по интервью «пока без экспорта» G42 |
| R фильтры сохранённые (server) | P2, P1 — URL-шаринг G55 |
| R Cmd+K, FAB везде | P2, P1 — кнопки в шапке G51 |
| R Тёмная тема | P3, P1 — только светлая G48 |
| R Preview документов в браузере | не делаем, только скачать G39 |
| R Таблица-вид реестров | не делаем, только карточки G33 |
| R 152-ФЗ сертификация | логическое разделение schemas, без ФСТЭК |
| R Offline-очередь | P3, P1 — скелетон+retry G41 |
| R WCAG AA аудит | P1 — базовый focus G52 |

## Открытые места

Нет placeholder — все факты из интервью закрыты. 8 ролей, 30+ тегов, ГОСТ-доки — берём из RAG/файлов ГОСТов; если файл ГОСТа отсутствует — берём `StageRequirement` таблицу.

## Покрытие манифеста

| Требование | Раздел |
|---|---|
| R01-R14 (доработка + согласование) | Задача, Решение, истории 44-48 |
| R15-R16 (роли, матрица) | §1.1, истории 1-6 |
| R17 (единая модель) | §2.1, типы |
| R18-R19 (карточка адаптивная) | §1.3, истории 8-17 |
| R20-R22 (реестры, стандарт) | §1.4, истории 18-26 |
| R23 (matching) | §1.5, истории 27-31 |
| R24 (ЛК структура) | §1.1, история 6 |
| R25 (дизайн-система) | §2.5, модули ui |
| R26 (UX состояния) | §2.6, истории 24,38,46 |
| R27-R28 (API карта) | §2.7, Решения |
| R29 (приоритеты P0-P3) | §4 |
| R30-R34 (правила) | Задача, Решение |
| G01-G58 | истории 1-43, Решения |

