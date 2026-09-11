# Evidence 02: Backend, API и разграничение доступа

## База и метод

- Проверен checkout `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, ветка
  `audit/deep-repository-20260910`; продуктовые файлы не изменялись, `.env` не читался.
- Статически разобраны все включения router в `technozrelost-backend/app/main.py:309-334`,
  все декораторы HTTP-маршрутов, `app/core/deps.py`, `app/schemas.py`, ORM-модели,
  задействованные сервисы и защитные тесты. Итого: 111 HTTP-маршрутов в 25 router-модулях.
- Сценарии ниже логически полны на публичном HTTP-шве. Live exploitation не выполнялась:
  она меняла бы БД/объектное хранилище, что запрещено условиями аудита.

## Полный router inventory

| Router | Маршрутов | Поверхность и dependency chain |
|---|---:|---|
| `achievements.py` | 3 | catalog public/read replica; mine `CurrentUser`; project public iff `is_public`, иначе project access |
| `admin.py` | 2 | `CurrentUser` + runtime `cntr_admin` для audit/stats |
| `assessments.py` | 3 | template public; create/mine `CurrentUser` |
| `auth.py` | 5 | register/login/refresh/logout public token flows; me `CurrentUser` |
| `chat.py` | 4 | все `CurrentUser`; in-memory per-user AI limiter |
| `executors.py` | 3 | public/optional auth, registry limiter, read replica |
| `files.py` | 4 | `CurrentUser` + `require_project_access`; signature/size/scan gates |
| `generation.py` | 1 | `CurrentUser` + project access + doc-type allowlist |
| `health.py` | 2 | public liveness/readiness |
| `invites.py` | 6 | project-admin capability; accept `CurrentUser`; legal manager/admin |
| `manager.py` | 5 | `cntr_manager|cntr_admin` dependency |
| `match.py` | 1 | `CurrentUser` |
| `membership.py` | 6 | `CurrentUser`; priority/project/manager checks per operation |
| `metrics.py` | 1 | public Prometheus endpoint |
| `news.py` | 13 | feed/detail/categories public; mutations author/admin; create staff |
| `nioktr.py` | 4 | public/optional auth, registry limiter, read replica |
| `notifications.py` | 2 | `CurrentUser`, every object constrained by `user.id` |
| `profiles.py` | 12 | own-profile/org membership; manager dependency for review |
| `projects.py` | 11 | registry public; remaining `CurrentUser` with ownership/member/staff checks |
| `rag.py` | 3 | `CurrentUser`; upload staff, reads any authenticated user |
| `realtime.py` | 6 | one-use SSE ticket; manager/admin checks for emit/tasks |
| `requests.py` | 5 | `CurrentUser` + project/request pairing; cleanup admin/owner/staff |
| `stages.py` | 4 | `CurrentUser` + project access; stage/project pairing |
| `technologies.py` | 1 | `CurrentUser`, bounded page |
| `users.py` | 4 | own updates `CurrentUser`; list/update `cntr_admin` |

## Подтверждённые кандидаты

### B02-001: Pending join раскрывает закрытую карточку и договорные поля

- Category: BOLA / information disclosure
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/membership.py:136-191`,
  `technozrelost-backend/app/api/v1/membership.py:40-62`,
  `technozrelost-backend/app/api/v1/projects.py:169-195`,
  `technozrelost-backend/app/schemas.py:77-100`
- Evidence: обычный join без HMAC создаёт членство `pending` (`membership.py:160-176`), но ответ
  сразу сериализует весь `ProjectOut` (`:190-191`). В него входят `budget`, `join_token`,
  `legal_owner`, `rights_holder`, `contract_number`, `contract_basis` (`:40-62`). При этом общий
  access guard признаёт только `status == "active"` (`projects.py:176-183`), то есть тот же
  pending-пользователь не прошёл бы обычное чтение карточки.
- Safe reproduction: зарегистрированный пользователь получает/угадывает действующий `TZ-*` и
  вызывает `POST /api/v1/projects/join` с любым `role_in_project`, без `share_sig`; HTTP 200
  содержит закрытые и договорные поля, хотя заявка ещё не одобрена.
- Impact: утечка коммерческих/договорных атрибутов приватного проекта до решения модератора;
  отсутствие rate limit на join (`membership.py:136-191`) усиливает перебор короткого токена.
- Remediation: для pending вернуть только `{status, project_id, project_name}` либо отдельный
  минимальный DTO; не возвращать capability-токен и legal/budget поля; добавить limiter по
  user/IP и токену.
- Tests: pending join не возвращает `join_token`, budget/legal fields; pending actor получает
  404 на project detail; серия неверных токенов заканчивается 429.
- Dependencies: нет.

### B02-002: Конкурентная передача project_admin может создать двух администраторов

- Category: authorization race / privilege integrity
- Proposed severity: High
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/invites.py:66-87`,
  `technozrelost-backend/app/api/v1/invites.py:236-258`,
  `technozrelost-backend/db/migrations/sql/0017_project_invites_admin.sql:5-7`
- Evidence: проверка полномочия, чтение списка администраторов, снятие флагов и выдача новому
  участнику выполняются read-modify-write без `FOR UPDATE`, conditional update или уникального
  ограничения. Схема добавляет только boolean и не обеспечивает «ровно один admin».
- Safe reproduction: текущий admin параллельно отправляет два `POST
  /api/v1/projects/{id}/transfer-admin` для разных активных участников. Оба запроса проходят
  `require_project_admin` до коммита, каждый снимает старый флаг и выставляет свой target;
  после обоих commit оба target могут иметь `is_project_admin=true` и создавать/revoke invites.
- Impact: непредусмотренное размножение проектных полномочий; последующая передача одним из
  администраторов может неожиданно отозвать другого.
- Remediation: заблокировать проект/строки membership в одной транзакции и делать атомарную
  передачу; обеспечить инвариант БД частичным unique index по `project_id WHERE is_project_admin`.
- Tests: два реально конкурентных transfer-запроса дают один success/один conflict и ровно один
  admin после завершения.
- Dependencies: DB migration.

### B02-003: Решение по первичному draft теряет notification/outbox после успешного ответа

- Category: transaction / background failure semantics
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/manager.py:115-177`,
  `technozrelost-backend/app/services/notifications.py:24-46`,
  `technozrelost-backend/app/core/database.py:51-54`
- Evidence: `decide_draft` коммитит проект и audit в `manager.py:167`, затем вызывает
  `notify_user` (`:168-175`). Сервис делает только `flush` и добавляет outbox без commit
  (`notifications.py:35-46`). Dependency лишь закрывает сессию после `yield` и не коммитит
  (`database.py:51-54`), поэтому открытая транзакция откатывается при закрытии.
- Safe reproduction: менеджер успешно решает draft; после HTTP 200 новая сессия читает
  `notifications`/`notification_outbox` владельца: события `draft.decided` нет.
- Impact: владелец не получает решение; outbox не является transactional и событие невозможно
  восстановить из очереди. Бизнес-изменение уже необратимо закоммичено.
- Remediation: вызвать `notify_user` до единственного commit вместе с проектом/audit либо явно
  коммитить вторую транзакцию с документированной компенсацией.
- Tests: после approve и reject проверять notification и outbox из новой DB-сессии.
- Dependencies: нет.

### B02-004: RAG search/list допускают неограниченный объём ответа и вычислений

- Category: validation / resource exhaustion
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/app/schemas.py:308-323`,
  `technozrelost-backend/app/api/v1/rag.py:36-64`,
  `technozrelost-backend/app/services/rag.py:163-212`,
  `technozrelost-backend/app/services/rag.py:215-224`
- Evidence: `query`, `raw_text` и `top_k` не имеют длины/диапазона; `top_k` напрямую формирует
  `fetch_k=top_k*4` и число возвращаемых полных `raw_text`. `GET /rag/templates` вообще не имеет
  pagination и возвращает все полные документы. Глобальный 32 MiB limit ограничивает только
  request, не DB work/response.
- Safe reproduction: любой аутентифицированный пользователь отправляет `/rag/search` с очень
  большим `top_k` и широким query либо многократно читает `/rag/templates`; сервер сканирует,
  ранжирует и сериализует большой corpus. Отрицательный `top_k` также доходит до SQL LIMIT и
  способен дать 500 вместо 422.
- Impact: дешёвое истощение CPU/памяти/DB и массовая выгрузка corpus обычной учётной записью.
- Remediation: `query` max length, `top_k=Field(ge=1, le=...)`, bounded pagination и summary DTO
  без `raw_text` для list; отдельный лимитер на AI/RAG routes.
- Tests: `top_k<=0`/oversized query дают 422; cap соблюдается; list имеет bounded page.
- Dependencies: API contract.

### B02-005: Критичные мутации не образуют полный audit trail

- Category: auditability / access governance
- Proposed severity: Medium
- Confidence: Confirmed
- Files: `technozrelost-backend/app/api/v1/projects.py:306-395`,
  `technozrelost-backend/app/api/v1/invites.py:90-113`,
  `technozrelost-backend/app/api/v1/invites.py:221-282`,
  `technozrelost-backend/app/api/v1/profiles.py:294-345`,
  `technozrelost-backend/app/api/v1/news.py:425-633`
- Evidence: publish/hide/archive/delete project, create/revoke invite, transfer project admin,
  legal-field changes, profile/org moderation и все news mutations коммитят изменения без
  `AuditTrailEntry`. Глобальный audit заявлен как источник всех событий, но фактически покрывает
  лишь отдельные project/user/control-point flows.
- Safe reproduction: admin передаёт project_admin или менеджер меняет договорные поля; затем
  `GET /api/v1/admin/audit?project_id=...` не содержит субъекта, старого/нового значения и
  времени этой операции.
- Impact: расследование privilege/contract/content incidents и доказательство «кто изменил»
  невозможны; append-only свойство таблицы не компенсирует отсутствующие записи.
- Remediation: определить обязательную матрицу security/business events и писать audit в той же
  транзакции с actor, target и безопасным diff; не включать токены/секреты.
- Tests: по одному HTTP contract test на каждый класс критичной мутации и rollback atomicity.
- Dependencies: политика retention/PII для audit.

### B02-006: Ошибки MinIO раскрывают внутренний detail клиенту

- Category: error handling / internal information disclosure
- Proposed severity: Low
- Confidence: Confirmed
- Files: `technozrelost-backend/app/services/file_storage.py:95-122`,
  `technozrelost-backend/app/services/file_storage.py:226-244`,
  `technozrelost-backend/app/core/errors.py:144-147`
- Evidence: исключение MinIO включается дословно в `FileStorageError`, затем дословно
  подставляется в публичный `STORAGE_UNAVAILABLE.detail`. Оно может раскрыть endpoint, bucket,
  сетевую причину и детали SDK.
- Safe reproduction: при безопасно смоделированном исключении SDK аутентифицированный upload
  получает HTTP 503 с исходным `str(exc)`.
- Impact: облегчение разведки внутренней инфраструктуры; возможна утечка чувствительных частей
  сообщения стороннего SDK.
- Remediation: наружу стабильное общее сообщение/code, полный exception только в server log с
  request ID.
- Tests: synthetic SDK exception отсутствует в response body и присутствует только в captured log.
- Dependencies: нет.

## Защитные швы и отсутствие подтверждения по классам

- Authentication/RBAC: JWT signature/expiry/type проверяются в `core/security.py:49-50` и
  `core/deps.py:20-37`; роль берётся из актуального User, а не JWT claims. Саморегистрация имеет
  allowlist (`auth.py:50-66`), user role mutation закрыта `cntr_admin` (`users.py:35,105-112`).
- Ownership/BOLA: общий project guard ограничивает creator/active member/staff и маскирует
  чужой проект 404 (`projects.py:169-195`); file/request/control-point child ID дополнительно
  сверяется с parent project. Notification read сверяет `note.user_id` (`notifications.py:43-53`).
- Mass assignment: входные Pydantic DTO перечисляют изменяемые поля; найденный `model_dump` в
  `news.py:435-450` применяется по явному allowlist. Прямого присваивания произвольных ORM-полей
  не найдено.
- Injection/RCE/deserialization: пользовательские значения передаются SQLAlchemy bind-параметрами;
  динамический RAG SQL строит только имена собственных bind slots (`rag.py:127-148`). Shell,
  pickle, unsafe YAML и пользовательской подстановки SQL identifiers не найдено.
- SSRF/URL: `source_uri` хранится/возвращается, но не fetch-ится; единственный HTTP client берёт
  base URL из operator config, не запроса (`ai_assistant.py:48-53,80-98`). Request-driven SSRF
  не подтверждён.
- Upload/path traversal: поток режется на 25 MiB (`file_storage.py:443-464`), MIME определяется
  сигнатурой/OOXML structure (`:133-167`), storage key server-generated UUID (`:356-373`),
  download только после clean scan и project access (`files.py:128-163`).
- Errors/statuses: доменные ошибки централизованы в `raise_error`, стабильный код идёт в
  `X-Error-Code` (`core/errors.py:1065-1093`); validation handler не отдаёт traceback, fallback
  500 содержит только request ID (`main.py:226-278`). Исключение B02-006 отмечено выше.
- Pagination/filtering: public registries ограничены 50-200 и registry limiter; users/audit/
  requests/join queue ограничены максимум 1000. Unbounded остаются own projects, notifications,
  manager queues, own/admin news и RAG list; наиболее опасный RAG вынесен в B02-004.
- Transactions/races/idempotency: refresh и invite slot используют conditional atomic UPDATE;
  task claim использует `FOR UPDATE SKIP LOCKED`. Не подтверждены SQL injection и cross-project
  child substitution; подтверждённые transfer/notification gaps вынесены выше.
- CORS/CSRF/JWT: backend принимает Bearer header, не cookie, поэтому cookie-CSRF на этом шве не
  подтверждён. CORS ограничен configured origin list (`main.py:288-294`); wildcard methods/headers
  сам по себе не расширяет origin. Access token после password change/logout живёт до TTL
  (`auth.py:179-191`, `users.py:66-81`) и явно документирован как компромисс.
- Background: news scheduler имеет DB advisory lock, persistent status и exception loop
  (`main.py:67-102`). SSE ticket одноразовый и access token в URL запрещён
  (`realtime.py:142-184`). Realtime publish best-effort, persistent notification/outbox является
  recovery path, кроме B02-003.

## Глубинные состояния и ограничения

- Первый запуск/пустая БД: public probes и list endpoints имеют пустые ответы; schema creation и
  migration execution относятся к другим таскам и здесь не выполнялись.
- Неверный/предельный ввод: глобальный request body 32 MiB и upload 25 MiB есть; DTO gaps для RAG,
  unbounded strings/query lists и несколько unbounded reads отмечены выше.
- Отказ зависимости: readiness fail-closed для configured Redis/MinIO/ClamAV; file download
  fail-closed по scan status. Клиентская утечка MinIO detail отмечена B02-006.
- Прерывание/повтор: refresh/invite claim/task claim имеют concurrency primitives; transfer admin
  и draft notification не имеют требуемой атомарности (B02-002/B02-003).
- Рост объёма: public registry pagination присутствует; RAG и несколько private queues/list
  требуют bounded pagination. Нагрузочные характеристики не заявляются без стенда.
- Границы ролей/организаций: tenant/org isolation как отдельного tenant_id в модели нет;
  project boundary строится по creator/active membership/staff. Пользовательская организация
  проверяет membership/admin для edit/submit. Основная доказанная BOLA — B02-001.
- Последствия/обратимость: archive обратим только прямой правкой/новым feature path (unarchive API
  нет); delete и object remove необратимы. Для этих операций audit/compensation неполны.

## Команды

- AST inventory всех `app/api/v1/*.py` → `111` маршрутов, распределение отражено в таблице.
- `git rev-parse HEAD` → `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`.
- `uv run pytest tests/test_rbac_projects.py tests/test_privileged_roles.py
  tests/test_upload_hardening.py tests/test_refresh_atomic.py tests/test_invite_race.py
  tests/test_sse_ticket.py -q` → BLOCKED: `pytest` отсутствует в изолированном окружении;
  dev extra не устанавливался. `uv run` автоматически создал ignored `.venv` и установил
  locked runtime-набор; project manifests/lockfiles не менялись.
