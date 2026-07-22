# Plan.md  

> **Recovery note (2026-07-22):** the completion marks below are historical
> assertions from the previous agent, not accepted validation evidence. The
> recovery audit found mock frontend data, a formerly static readiness probe,
> and insufficient contract coverage. Each item must be re-verified before it
> can be used as a release claim.

# DELIVERY PLAN: рабочий MVP v2 к 31 августа 2026

## 1. Определение результата

К 31 августа должна быть развёрнута проверяемая B2B/B2G-платформа, в которой
пользователь проходит не набор демонстрационных экранов, а сквозной процесс:

1. регистрируется и входит через NextAuth;
2. получает одну из 9 ролей и видит только разрешённые данные;
3. создаёт проект и сохраняет опросник УГТ в PostgreSQL;
4. ведёт проект от исходного УГТ через контрольную точку, документы, участников,
   риски, сроки и бюджет;
5. находит исполнителя или технологию в реестре;
6. формирует проектные документы и получает RAG-ответ с проверяемыми источниками;
7. оставляет полный audit trail действий.

P2-роли (научная организация и аудитор) могут иметь ограниченный сценарий, но
каждое ограничение должно быть явно маркировано. Mock/fallback/TODO нельзя
выдавать за готовую функцию. Сертификация ФСТЭК, УКЭП, ЕСИА, публичный API,
нативное мобильное приложение и full-feature AI остаются за пределами MVP v2.

## 2. Правила исполнения

- Один вертикальный срез = отдельный worktree/ветка, тесты, Checker-review,
  Human Check, запись доказательств в `Status.md`, commit и обязательный push.
- На одну задачу — не более 25 Ralph-итераций. Повтор одной причины падения три
  раза означает остановку и эскалацию Functional Validator.
- TDD: сначала воспроизводящий тест (RED), затем минимальная реализация (GREEN),
  затем рефакторинг. Исторические чекбоксы не являются доказательством.
- Graphify query/review-delta выполняется до архитектурных изменений и после
  них; Headroom используется для ограниченных логов и атомарной памяти.
- Любой новый UI проходит Huashu-gate: три направления → выбор Functional
  Validator → реализация. Визуальный язык MVP 0 является референсом, который
  нужно сохранить и систематизировать в `DESIGN.md`.
- Anima применяется только при наличии выбранного макета и токена; отсутствие
  токена не блокирует ручную реализацию утверждённого интерфейса.

## 2.1. Мощность, критический путь и cut line

До 31 августа доступно около 28 рабочих дней. План исполним только при модели
`2 Maker-потока + 1 независимый Checker`: один Maker ведёт domain/backend/data,
второй — frontend/E2E, Checker не пишет production-код. Валовая ёмкость — 56
Maker-дней; 40 распределены по пакетам, 16 (29%) зарезервированы на интеграцию,
неопределённость, дефекты и UAT.

| Пакет | Оценка, Maker-дней | Зависимость |
| --- | ---: | --- |
| UX shell + API client | 4 | утверждённый UI direction |
| Auth/RBAC + audit | 4 | схемы/permissions |
| State machine Блоков 1–2 | 7 | RBAC, process contract |
| Опросник/УГТ/КТ | 4 | state machine |
| Document workflow + 3–5 templates | 4 | шаблоны и access matrix |
| Реестры | 3 | реальные datasets |
| RAG + AI Maker/Checker + redaction/limits/Redis | 8 | corpus, реестры, document contracts |
| CI, security, observability, UAT | 6 | все P0 slices |
| **Итого** | **40** | критический путь: RBAC → state machine → documents → AI |

Если работает только один Maker-поток, полный MVP v2 получает `NO-GO`. Допустим
отдельно названный **Core Pilot v1** объёмом 22 Maker-дня: auth/RBAC (4), полный
state machine Блоков 1–2 (7), опросник/УГТ/КТ-1 (4), только ТЗ/Паспорт/ТЭО (3),
CI/security/UAT (4). Он использует существующий UI без редизайна и не заявляет
полный набор документов, реестры, AI или выполнение полного MVP v2. Нельзя сокращать
безопасность, тесты или возвратные сценарии ради сохранения витрины.

## 2.2. P0 traceability matrix

Перед реализацией каждый ряд разворачивается в отдельный контракт с точными
route/table names; ниже — обязательная карта результата.

| Tier | P0-процесс | Экран | API | Хранение | Permission | Доказательство |
| --- | --- | --- | --- | --- | --- | --- |
| Core+Full | Identity/RBAC | login, register, admin users | auth/me/roles | users, roles, permissions, user_roles | self/admin + deny-by-default | auth E2E + 9-role allow/deny matrix |
| Core+Full | Блок 1, этапы 1–7 | project workspace/intake | projects/transitions | projects, stage_events, participants | customer, CNTR manager, admin | 7-step happy path + invalid transition tests |
| Core+Full | Expert group + ТЗ | experts, requirements, approvals | participants/documents/approve | project_members, documents, approvals | manager, customer, assigned expert | reject/approve ТЗ E2E |
| Core+Full | Финансирование | project finance | funding-sources/budget | funding_sources, budget_entries | customer, manager, admin; scoped read | 7-source validation + plan/fact tests |
| Core+Full | Блок 2, элементы 1–8 | execution timeline | projects/transitions/control-points | stage_events, control_points, verification | assigned participants by stage | 8-element happy path + role matrix |
| Core+Full | УГТ/опросник | questionnaire + UGT dashboard | questionnaire/assessment | questionnaire_results, ugt_assessments | customer/editor, expert/verifier | draft resume + server calculation tests |
| Full | 3–5 ключевых документов | document workspace | templates/documents/versions/accept | templates, documents, versions, approvals | per-type access matrix | golden files + forbidden access tests для каждого типа |
| Full | Реестры | technologies/executors | registries/search | technologies, executors, competencies | authenticated/read; admin/write | filters/pagination/data provenance E2E |
| Full | AI Maker–Checker | assistant + review result | rag/search/chat/document-review | rag_documents, ai_runs, review_findings | project-scoped; admin audit | groundedness, redaction, budget and rejection tests |
| Core+Full | Audit | admin/project history | audit/events | append-only audit_trail | admin + project-scoped read | immutability/access/retention tests |

## 2.3. Process state machine

State machine является backend source of truth. UI не может менять этап
напрямую. Обязательные состояния:

- Блок 1: `INTAKE → EXPERT_GROUP → DRAFT_TZ → APPROVED_TZ_ROADMAP →
  PASSPORT_TEO → FUNDING → INTERNAL_AGREEMENT`.
- Блок 2: `DEVELOPMENT_START → UGT4_LAB → UGT5_6_FIELD → UGT7_OPERATIONAL →
  UGT8_QUALIFICATION → UGT9_PRODUCTION → ACCEPTANCE → REVENUE_FOLLOWUP`.
- Возвраты: `REJECT_TZ` возвращает в `DRAFT_TZ`; `NO_GO_AUDIT` возвращает в
  `PASSPORT_TEO`; `FAILED_VERIFICATION` возвращает на предыдущий УГТ-элемент;
  `IP_TRIGGER_ACTIVATED` на УГТ 7 меняет ответственного на серийного
  производителя и фиксирует лицензионное событие.

Каждый transition требует actor, role, timestamp, reason, from/to state,
document/evidence references и immutable audit event. Property/contract tests
доказывают допустимые переходы, запрет обхода и все четыре loop-back сценария.

## 3. Календарный маршрут

### Этап 0 — доказанный baseline (22–24 июля)

- [x] Изолировать docs/frontend/backend worktrees и восстановить атомарную память.
- [x] Подключить ECC, Graphify, Headroom, Agent Browser, Huashu, Design.md,
  Anima SDK, Ponytail, CLI-Anything и Harness Bench.
- [x] Исправить offline build, реальную Primary/Replica readiness и небезопасный
  GigaChat transport; получить зелёные lint/build/Ruff/pytest/live probes.
- [ ] Сформировать реестр всех mock/TODO/fallback и карту PRD → экран → API →
  таблица → тест. Владелец: Maker. Gate: Checker подтверждает полноту реестра.

### Этап 1 — продуктовый UX и каркас данных (25–31 июля)

- [ ] Провести Huashu-сессию из трёх направлений на основе визуала MVP 0 и
  получить выбор Functional Validator.
- [ ] Перенести выбранные токены, навигацию, layout, состояния loading/empty/
  error/forbidden и responsive-поведение в Next.js без iframe и CDN-зависимостей.
- [ ] Описать OpenAPI-контракты и frontend API client для auth, projects,
  questionnaire, registries, documents и chat; запретить прямые hard-coded
  данные в P0-маршрутах ESLint/тестовым правилом.
- [ ] Подготовить тестовые fixtures только в схеме `test`; demo-данные должны
  быть явно отделены от production runtime.
- [ ] До 28 июля утвердить process state machine и role-access matrix; до 7
  августа выбрать 3–5 типов документов, до 10 августа получить их структурные
  схемы. Это входной gate, а не задача последней недели.

**Gate 31 июля:** выбранный дизайн применён к login, dashboard shell и одному
P0-кабинету; Agent Browser проходит keyboard/accessibility smoke; ни один P0
экран не использует неявные mock-данные.

### Этап 2 — Identity/RBAC и старт state machine (1–7 августа)

- [ ] Доказать регистрацию, login/logout, истечение/обновление сессии,
  запрет неавторизованных маршрутов. Восстановление пароля переносится после
  релиза, если нет готового доверенного email/identity-провайдера.
- [ ] Проверить матрицу permissions для всех 9 ролей на backend и frontend;
  устранить расхождения middleware/API.
- [ ] Подключить кабинеты ГосКомпании и R&D к реальным API/БД; P1/P2-кабинеты
  показывают честные ограниченные состояния, а не фиктивные KPI.
- [ ] Добавить audit trail для входа, изменения ролей и критичных действий.
- [ ] Провести security review: ORM-only, CORS, cookie/session flags, rate
  limiting auth, отсутствие секретов и персональных данных в логах.
- [ ] Backend-поток с 3 августа начинает state machine после фиксации permission
  contracts; frontend-поток завершает RBAC/E2E и готовит project shell.

**Gate 7 августа:** E2E-набор подтверждает четыре P0-роли (заказчик,
исполнитель, менеджер ЦНТР, администратор), а API-тесты подтверждают allow/deny
для всех 9. Source of truth для MVP v2 — PRD: роли 3 и 6 имеют P2; инвестор P1.

### Этап 3 — завершение state machine и УГТ (8–14 августа)

- [ ] Реализовать create/read/update проекта и сохранение ~350 ответов опросника
  транзакционно, с повторным открытием и продолжением черновика.
- [ ] Рассчитывать текущий УГТ на backend; frontend только отображает результат.
- [ ] Подключить участников, КТ-1, риски, сроки, бюджет plan/fact и историю
  возвратов к реальным таблицам и permission checks.
- [ ] Уточнить с Functional Validator судьбу КТ-2…КТ-4; до решения хранить их
  как конфигурируемые сущности, не как фиктивно завершённые этапы.
- [ ] Обеспечить optimistic concurrency/versioning для конфликтующих правок.
- [ ] Реализовать все 7 этапов Блока 1, 8 элементов Блока 2, экспертную группу,
  утверждение ТЗ, 7 источников финансирования и четыре hard-return transition.

**Gate 14 августа:** браузерный E2E проходит весь state machine Блоков 1–2 на
тестовом проекте; отдельные тесты вызывают все четыре возврата. Заказчик создаёт
проект, менеджер ведёт этапы, исполнитель загружает evidence, эксперт принимает
КТ-1, а audit trail содержит actor/role/from/to/reason/evidence/request-id.
Оценка 11 Maker-дней закрывается двумя потоками в период 3–14 августа, причём
опросник подключается к стабильному transition contract не раньше 8 августа.

### Этап 4 — документооборот и 3–5 ключевых артефактов (15–21 августа)

- [ ] Согласовать с методологами 3–5 типов, обязательные поля, версии и
  права доступа. Отсутствующий шаблон является бизнес-блокером, не поводом
  генерировать фиктивный документ.
- [ ] Реализовать единый template registry, статусы draft/review/approved,
  версии, комментарии, простой Accept и скачивание.
- [ ] Перевести ТЗ, Паспорт, ТЭО, Дорожную карту, Мини-ТЗ, акты верификации и
  остальные согласованные типы на один генератор с валидируемыми входами.
- [ ] Проверить разграничение: например, ТЭО доступно заказчику/аудитору, но не
  постороннему исполнителю.
- [ ] Добавить golden-file/contract tests для каждого согласованного типа.

**Gate 21 августа:** если схемы выбранных шаблонов утверждены до 10 августа, все типы
создаются без ручной правки структуры, версионируются, проходят role-access
tests и не содержат пустых обязательных секций. Если входной gate сорван,
release получает статус `NO-GO` по документообороту; отсутствие шаблона нельзя
скрывать генерацией пустого файла.

### Этап 5 — реестры, RAG и AI v0 (22–26 августа)

- [ ] Подключить реестр технологий и каталог исполнителей к PostgreSQL,
  реализовать поиск, фильтры, пагинацию и permission-safe DTO.
- [ ] Загрузить утверждённый корпус ГОСТ/шаблонов/кейсов с provenance,
  chunking, deduplication и версионированием embeddings в pgvector.
- [ ] Заменить hash-based embedding на утверждённую модель либо явно оставить
  его только в `test`; production retrieval должен иметь измеримое качество.
- [ ] Возвращать в AI v0 цитируемые источники; GigaChat-offline состояние должно
  быть честным и не имитировать LLM-ответ.
- [ ] Собрать evaluation set из типовых вопросов ЦНТР и измерить retrieval hit
  rate/groundedness; пороги зафиксировать до релиза.
- [ ] Реализовать AI Maker–Checker: Maker формирует ответ/документ, Checker
  проверяет ссылки, обязательные секции и правила ГОСТ; при findings результат
  не получает статус approved.
- [ ] Перед облачной LLM обезличивать ПД и чувствительные фрагменты КД,
  блокировать запрещённые классы данных, вести модель/токены/стоимость/latency и
  применять per-user/per-project лимиты.
- [ ] Добавить Redis только для кеша публичных TRL/template metadata с TTL и
  invalidation; отказ Redis не должен нарушать correctness. ФИПС live API
  переносится в v3, а данные реестра MVP загружаются из утверждённого набора с
  provenance.

**Gate 26 августа:** поиск по двум реестрам работает на утверждённых данных;
AI v0 отвечает только с источниками либо честно сообщает о недостатке данных;
Checker отклоняет неполный/неподтверждённый результат, redaction-тест не
пропускает ПД/КД, а budget test останавливает превышение лимита.

### Этап 6 — стабилизация и релиз (27–31 августа)

- [ ] Довести unit/integration coverage критичных backend/frontend-модулей до
  80%; обязательны auth, RBAC, projects, questionnaire, documents, RAG.
- [ ] Добавить CI: lint, typecheck, unit/integration, migration up/down smoke,
  production build, secret/dependency scan и Graphify portable-check.
- [ ] Проверить миграции на пустой БД и копии данных; backup/restore,
  Primary/Replica fail-closed, Nginx routing, structured logs и request IDs.
- [ ] Провести OWASP-oriented security review и accessibility WCAG AA smoke.
- [ ] Провести UAT по ролям с Functional Validator, исправить только P0/P1
  дефекты, заморозить scope и подготовить rollback/runbook.
- [ ] Создать release tag `mvp-v2.0.0`, changelog и доказательный отчёт.

**Full MVP v2 release gate 31 августа:** все строки tier `Full` и `Core+Full`
зелёные в CI и Human Check;
отсутствуют Critical/High security findings, неявные mocks и незакрытые P0
дефекты; миграция и rollback воспроизводимы; все коммиты/tag отправлены в origin.

Дополнительные измеримые условия release gate:

- четыре полных role-based E2E (заказчик, исполнитель, менеджер, администратор);
- happy path 7+8 этапов и четыре loop-back сценария;
- golden document contracts для каждого из 3–5 выбранных типов;
- axe: 0 critical/serious на login, dashboard, project, questionnaire,
  documents; ручная keyboard/focus/contrast проверка этих маршрутов;
- audit events append-only, обязательные поля заполнены, retention для MVP —
  не менее 1 года, экспорт доступен только admin/project-authorized roles.

**Core Pilot v1 gate (только fallback):** зелёные все строки `Core+Full`, но
document gate ограничен ТЗ/Паспортом/ТЭО; отсутствующие Full-функции скрыты или
помечены «не входят в Core Pilot». Название/тег не содержит `mvp-v2.0.0`, а
отчёт прямо фиксирует `NO-GO` полного MVP v2.

## 3.1. Бизнес-метрика −30%

До 31 июля Functional Validator совместно с Maker фиксирует baseline на трёх
эталонных сценариях: (A) первичная оценка УГТ, (B) подготовка ТЗ, (C) подготовка
Паспорта/ТЭО. Для каждого сценария измеряется медианное активное время и полное
elapsed time на одинаковом наборе входных данных: ручной процесс против
платформы, минимум 5 прогонов.

Release target: медианное elapsed time платформы не выше 70% baseline как
минимум в двух сценариях из трёх, без роста критических ошибок; третий сценарий
должен показать неухудшение. Отчёт содержит исходные timestamps, размер выборки,
число возвратов Checker и причины ошибок. Без baseline до 31 июля метрика PRD
не может считаться доказанной, а полный MVP v2 получает `NO-GO`.

## 4. Приоритеты при дефиците времени

1. **Не сокращать:** auth/RBAC, реальный проект/опросник, КТ-1, документы,
   audit trail, безопасность, миграции, тесты и backup/rollback.
2. **Допустимо упростить:** кабинеты P2, визуальную аналитику, Telegram,
   биллинг — до entitlement/тарифного флага без платёжного шлюза.
3. **Перенести в v3:** УКЭП, ЕСИА, внешний API/billing per request, интеграции
   1С/Контур/ФИПС, full-feature AI/fine-tuning, ВПК-контур и сертификацию ФСТЭК.

## 5. Решения, требующие Functional Validator

### Утверждено в ходе Functional Validation

- **Цель 31 августа:** рабочий клиентский вертикальный цикл от умной заявки до
  мониторинга показателей проекта; полнота функций важнее количества экранов.
- **Identity/domain model:** `OrganizationType`, системная `UserRole` и
  контекстная `ProjectRole` являются разными сущностями. Одна организация может
  быть заказчиком в одном проекте и исполнителем в другом; пользователь может
  иметь разные проектные роли в разных проектах.
- **Умная заявка:** детерминированные правила проверяют структуру и рассчитывают
  формальные показатели; AI анализирует свободный текст, классифицирует,
  выявляет противоречия и формирует вопросы/рекомендации. AI может присвоить
  `готова к рассмотрению` или `нужно уточнение`, но окончательные принятие и
  отказ принадлежат менеджеру ЦНТР и записываются в audit trail.
- **Регистрация:** физическое лицо, включая независимого эксперта, может создать
  профиль без организации. Критерии допуска разрабатывает профильный отдел
  ЦНТР; команда платформы реализует только переданную версионированную модель
  критериев и не подменяет собой методологов.
- **Множественное членство:** один пользователь может состоять в нескольких
  организациях. Для каждого membership хранятся роль, статус, период действия
  и основание; все memberships и проектные роли видны в личном кабинете.
- **Верификация контрагента:** локально проверяются формат ИНН/ОГРН и дубликаты;
  официальный provider ФНС при доступности обогащает карточку и сохраняет
  source/timestamp. Недоступность provider не блокирует регистрацию, а переводит
  её в `verification_pending`. Финальный допуск назначает менеджер ЦНТР.
- **Будущая автоматизация допуска:** решение может быть делегировано LLM только
  после утверждения критериев и отдельного релиза versioned decision engine.
  До этого LLM формирует рекомендацию. Любое автоматическое решение обязано
  сохранять версию правил/модели, входные evidence, объяснение и возможность
  ручного пересмотра.
- **Архитектурный рост:** stateless Next.js/FastAPI за Nginx, PostgreSQL
  Primary/Replica; Redis — необязательный cache/rate-limit слой, не source of
  truth и не single point of failure.
- **Августовский документооборот:** реализуются 3–5 ключевых типов; конкретный
  набор Functional Validator утвердит позже. Требование 22/22 переносится из
  августовского release gate в последующий релиз.
- **Отложено на октябрь–декабрь:** платёжный шлюз, Telegram, ЕСИА, УКЭП, live
  ФИПС, 1С/Контур, ВПК-контур и сертификация ФСТЭК.

### Требует решения

- Выбор одного из трёх UI-направлений на базе MVP 0 — до 27 июля.
- Подтверждение state machine, КТ-2…КТ-4 и четырёх возвратов — до 28 июля.
- Утверждение 3–5 типов документов и role-access matrix — до 7 августа;
  структурные схемы выбранных шаблонов — до 10 августа.
- Подтверждение source of truth по ролям: PRD (P2 роли 3/6, инвестор P1) — до
  28 июля.
- Подтверждение Core cut: без платёжного шлюза и Telegram; Redis только cache,
  ФИПС live API в v3 — до 28 июля.
- Передача datasets реестров (владелец, CSV/JSON schema, provenance, минимум
  20 технологий и 20 исполнителей) — до 14 августа.
- Утверждение production embedding/LLM-провайдера и evaluation set — до
  20 августа.
- Финальный UAT и go/no-go — 30–31 августа.

Если решение не получено к контрольной дате, Maker продолжает только по
независимым задачам и фиксирует бизнес-блокер; запрещено заменять решение
заглушкой.

# Архив: план и отметки предыдущего агента

Ниже сохранён неизменяемый исторический журнал. Его `[x]` не участвуют в
release gates нового плана и требуют повторного доказательства.

```
# PLAN: MVP v2 (Релиз: Конец августа 2026)

## Фаза 1: Инфраструктура и Фундамент (Неделя 1)
- [x] **Шаг 1.1:** Настроить `git worktrees` для фронтенда (Next.js) и бэкенда (FastAPI). ✅ 2026-07-21
- [x] **Шаг 1.2:** Инициализировать PostgreSQL БД. Поднять схему `public`. Подключить расширение `pgvector`. ✅ 2026-07-21
- [x] **Шаг 1.3:** Интегрировать NextAuth.js на стороне Next.js. Реализовать регистрацию, логин и защиту маршрутов (Middleware). ✅ 2026-07-21
- [x] **Шаг 1.4:** Спроектировать реляционную структуру БД для 9 ролей пользователей (RBAC). Создать таблицы `Users`, `Roles`, `Projects` с Serial PK и B-Tree/Hash индексами. ✅ 2026-07-21 (Users/Roles/UserRoles/Permissions/RolePermissions; Projects — в Фазе 3 вместе с дашбордом)

## Фаза 2: Адаптация MVP 0 и Личные Кабинеты (Неделя 2)
- [x] **Шаг 2.1:** Интегрировать текущий код из папки `КОД MVP "0" 210726 - ТОЛЬКО ФРОНТЭНД` в новый Next.js App Router. ✅ 2026-07-21
- [x] **Шаг 2.2:** Создать базовый UI Личного кабинета (ЛК) для роли "ГосКомпания" (Заказчик). ✅ 2026-07-21
- [x] **Шаг 2.3:** Создать базовый UI Личного кабинета для роли "Исполнитель" (R&D/ВУЗ). ✅ 2026-07-21

## Фаза 3: Дашборд Проекта и RAG (Недели 3-4)
- [x] **Шаг 3.1:** Разработать дашборд проекта (отражение прогресса УГТ 1-9, КТ-1). ✅ 2026-07-21
- [x] **Шаг 3.2:** Настроить FastAPI для приема JSON-данных из опросников фронтенда. ✅ 2026-07-21
- [x] **Шаг 3.3:** Подготовить RAG-пайплайн: загрузить шаблоны ТЗ, Паспорта и ТЭО в `pgvector`. ✅ 2026-07-21
- [x] **Шаг 3.4:** Реализовать автоматическую генерацию "скелетов" документов по данным опросников. ✅ 2026-07-21

## Фаза 4: Каталоги и AI-Ассистент (Недели 5-6)
- [x] **Шаг 4.1:** Разработать Реестр технологий и Каталог исполнителей. ✅ 2026-07-21
- [x] **Шаг 4.2:** Интегрировать базового чат-бота (AI v0) на основе GigaChat API через FastAPI. ✅ 2026-07-21

---

**Historical claim only:** «MVP v2 полностью завершён». Recovery validation is
still in progress and supersedes this statement.


```
