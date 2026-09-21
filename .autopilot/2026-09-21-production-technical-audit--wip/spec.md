# Спецификация: production technical audit

## Задача

Владельцу нужен не отчёт о намерениях кода, а доказательное сопоставление локальной версии, Git, deployment, production и ожидаемого поведения. Каждый вывод должен быть воспроизводимым, а недоступное — честно помечено `UNKNOWN`.

## Решение

Аудит проходит в изолированном worktree без изменения кода, схемы БД и production. Он сочетает статическую инвентаризацию, read-only SSH/БД/метрики, низкоинтенсивные HTTP/UI-проверки, локальные гейты и лимитированную AI-оценку. Результат — Markdown-отчёт, CSV/JSON-реестры, screenshots, backlog и gate-решение.

## Истории и приёмка

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | R01–R06 | Как владелец, я вижу точный снимок всех окружений | SHA, dirty-state, versions, services, manifests, deploy/log/backup/monitoring metadata с доказательствами; нет mutations |
| 2 | R07–R10 | Я получаю полную карту функций и переноса | Каждая функция имеет статус, роли, данные, local/server/prod evidence; dead code подтверждён runtime-поиском |
| 3 | R09–R15 | Я вижу код, БД и security как единый контур | Архитектура, migrations, constraints, indexes, ORM, least privilege, auth/RBAC/ownership/invites и OWASP-классы проверены |
| 4 | R16–R18 | Я вижу фактический UX production | Публичные экраны и состояния пройдены на 1920/768/375; каждый visual finding имеет screenshot/URL/viewport/steps |
| 5 | R19–R22 | Я получаю доказательную AI/RAG-оценку | Реестр entrypoints/models/prompts/tools/data/RAG/output/guardrails/cost/observe/fallback; до 200 запросов, только ГОСТы/синтетика, denylist не нарушен |
| 6 | R23–R25 | Я понимаю эксплуатационный риск | Probes, limits, logs, metrics, backup/restore/RPO/RTO, CI/CD, rollback, SPOF, Redis/PostgreSQL/queues проверены read-only; нагрузка не запускалась |
| 7 | R26–R28 | Я получаю приоритеты, а не свалку наблюдений | Findings имеют полную схему, risk matrix, 30/60/90, quick wins и `GO`/`GO WITH CONDITIONS`/`NO-GO` |
| 8 | R29–R33 | Я сам решаю, когда начнётся исправление | Аудит не меняет код; backlog не становится executable tickets до согласования; реестры и будущие анкеты вынесены |
| 9 | R34–R37 | Я могу повторить аудит и продолжить его безопасно | Markdown + JSON/CSV + screenshots; local gates; role tests `UNKNOWN` до test accounts; секреты не читаются и не сохраняются |

## Решения по реализации

1. Базовый снимок — `f364388`: он отличается от запрошенного `3a4dfe3` только закрытием предыдущего Autopilot-прогона; продуктовый код не менялся.
2. Production-доступ — `root@213.139.209.165`, `/opt/technozrelost`; только read-only команды. `.env`, private keys, credential files и resolved config не читаются.
3. БД — только catalog/schema metadata, migrations, constraints, indexes, sizes, safe EXPLAIN и aggregate counts; никаких business rows.
4. HTTP/UI — низкая частота, без создания production-данных. Остановка при 5xx, unhealthy, росте latency, mutation или чувствительном выводе.
5. AI — жёсткий cap 200; снача inventory/config/log evidence, затем минимальный eval на ГОСТах/синтетике. Вызовы без auth или safe prompt не выполняются, а помечаются `UNKNOWN`.
6. Доказательства хранят команду, UTC/локальную дату, target, exit/status, краткий санитизированный вывод и ссылку на finding/feature.
7. Любая оценка без production-доказательства явно маркируется static/local, а не deployed.
8. Статусы функций закрытый список: `EXPECTED`, `LOCAL_ONLY`, `SERVER_ONLY`, `DEPLOYED_WORKING`, `DEPLOYED_BROKEN`, `PARTIALLY_DEPLOYED`, `DISABLED`, `STUB`, `UNKNOWN`.
9. Перед будущей Phase 5 оркестратор запускает `opencode doctor`, повторно проверяет точный ID `opencode-go/muse-spark-1.3-contributor` и роли: OpenCode только исполняет таски, не меняе spec/dashboard/interfaces/status, не принимает сам себя и не коммитит.

## Обязательные контуры проверки

- **Код:** границы, циклы, дубли, complexity, types, errors, suppressed exceptions, retries, races, N+1, resources, global mutable state, hardcode, TODO/FIXME/HACK, mocks/stubs/fallbacks, dead branches/endpoints/components/dependencies/tables, logs с данными, test gaps/flakes/vacuous assertions, vulnerabilities.
- **БД и защита данных:** entities/normalization/types/PK/FK/unique/check/NOT NULL/cascade/orphans/soft delete/audit/timestamps/enums/versioning/indexes/plans/growth/retention; migration order/reproducibility/drift/compatibility/transactions/rollback/locks/data loss/manual changes/seeds; TLS/encryption/key management/users/least privilege/network exposure/RLS/tenant isolation/ORM injection protection/masking/access logs/backup encryption/restore/deletion.
- **Application security:** auth/session lifecycle, password hashing/policy, reset/recovery, MFA, UI+backend authorization, IDOR/BOLA, escalation, CSRF/XSS/SSRF/injection, uploads/path traversal/open redirect, CORS/CSP/cookies/JWT rotation, brute-force/rate limits, secrets, supply chain, container privileges, admin/debug/errors.
- **UX/UI:** desktop/tablet/mobile/min width/long content/empty/loading/validation/error/forbidden/large lists/modals/dropdowns/toasts/sticky/zoom/keyboard; overlap/clipping/overflow/z-index/scroll/layout shift/text/actions/dead ends/duplicates/spacing/colors/type/feedback/language/placeholders/contrast/focus/screen reader labels/action semantics.
- **AI/RAG:** real provider call, key validity by behavior not value, timeout/retry/circuit breaker/fallback/schema validation/prompt injection/tool permissions/tenant isolation/provider data policy/logging/hallucinations/citations/grounding/retrieval/chunking/embeddings/metadata/staleness/prompt versions/reproducibility/eval sets/human-in-loop/budget/rate/quota/cap/queue/cache/context limits/outage.
- **Эксплуатация:** reproducibility/probes/restart/resources/disk/log rotation/monitoring/alerting/tracing/errors/backup/restore/RPO/RTO/CI/CD/rollback/zero-downtime/SPOF/Redis persistence+eviction/PostgreSQL connections+slow queries+locks/queues/retries/DLQ.

## Границы MVP и инфраструктурная рамка

- Доступные сейча области: реестр, поддержка, консалтинг, сотрудничество, поиск и аналитика.
- Оценка УГТ и переходы готовятся к запуску. Патентование, акселерация и внутренние AI-контуры в разработке. Их отсутствие не regression; преждевременная публикация — finding.
- Целевая минимальная production-топология — 2× Dell R640 с отказоустойчивостью. Текущий single-node deployment оценивается отдельно как факт, а не как цель.

## Обязательные артефакты

1. Executive summary.
2. Окружения и ограничения.
3. Матрица переноса функций.
4. Архитектурная карта.
5. Findings registry.
6. Отчёт по БД и защите данных.
7. Security report.
8. UX/UI report с screenshots.
9. AI registry и оценка.
10. Operations/performance report.
11. Hardcode/stubs/dead code/dead ends list.
12. Risk matrix.
13. Quick fixes.
14. 30/60/90 stabilization plan.
15. Prioritized backlog без executable repair tickets.
16. UNKNOWN и недостающие доказательства.

## Коммуникация

После каждого этапа оркестратор сообщает: что проверено; какие доказательства получены; что найдено; что осталось `UNKNOWN`; какие действия требуют подтверждения; следующий безопасный шаг. Ошибки инструментов не скрываются, гипотезы не выдаются за факты.

## Границы и швы

| Модуль | Владеет | Выставляет | Прячет |
|--------|---------|------------|--------|
| `evidence` | протокол и безопасные выдержки | `evidence ID -> source, command, result, timestamp` | санитайзинг и сырые логи |
| `feature-matrix` | статус каждой функции | CSV с утверждёнными колонками | черновую инвентаризацию |
| `findings` | дефекты/риски/долг/рекомендации | JSON с полной схемой R26 | рабочие заметки |
| `ai-registry` | AI/RAG entrypoints и controls | JSON-реестр R19 | тексты prompts/responses с риском данных |
| `report` | выводы, risk, 30/60/90, gate | Markdown со ссылками на IDs | сырые транскрипты |

### Схемы артефактов

- `feature-matrix.csv`: `id`, `feature`, `expected_behavior`, `local_implementation`, `server_implementation`, `production_check`, `roles`, `data_entities`, `status`, `defect_id`, `evidence_ids`, `recommendation`.
- `findings.json`: для каждой находки `id`, `area`, `severity`, `confidence`, `affected_environments`, `affected_roles`, `description`, `business_effect`, `technical_cause`, `evidence_ids`, `reproduction_steps`, `safe_recommendation`, `complexity`, `dependencies`, `regression_risk`, `migration_required`, `downtime_required`, `acceptance_criteria`, `kind` (`defect`/`risk`/`debt`/`product_recommendation`).
- `ai-registry.json`: `ai_id`, `feature`, `entry_point`, `model_provider`, `agent`, `prompt_location_versioning`, `tools`, `input_context_sensitivity`, `rag_sources_filters`, `output_format_validation`, `guardrails`, `cost_controls`, `observability`, `fallback`, `status`, `tests`, `evidence_ids`.

Тестовые швы: существующие HTTP boundaries, CLI gates, ORM metadata, browser DOM/screenshots и JSON-schema артефактов. Новые production-интерфейсы не создаются.

## Вне рамок

| Требование | Почему не сейчас |
|------------|----------------|
| R29 — executable repair tickets | Findings и приоритеты снача утверждает владелец; текущий backlog не даёт разрешения на исправление продукта |
| R33 — новые реестры/анкеты | Поля ещё не утверждены; текущий прогон только оценивает готовность |
| R36 — авторизованные production-сценарии | Test accounts не созданы; валидация — static/tests/metadata, runtime-поле — `UNKNOWN` |
| Load/fuzz/restore/restart/DDL/migrations/DNS/firewall/secrets | Требуют отдельного подтверждения; в этом прогоне не запускаются |

Execution-контракт R30–R31 действует в текущем прогоне: каждый тикет Phase 5
выполняется только адаптером Autopilot–OpenCode и только моделью
`opencode-go/muse-spark-1.3-contributor`; оркестратор пишет spec/tickets,
проверяет результат, тестирует, коммитит и пушит, но не создаёт аудитные
артефакты вместо исполнителя.

## Открытые места

- Окончательный набор открытых полей реестров пока не утверждён и не блокирует аудит.
- Ролевой runtime без test accounts помечается `UNKNOWN`, а не считается пройденным.
- Production AI eval выполняется только если существующий safe entrypoint не требует чтения/передачи credentials.

## Покрытие манифеста

| Требования | Разделы |
|------------|---------|
| R01–R06 | Задача, Решение, История 1, Решения 1–2, 6–7 |
| R07–R10 | История 2, Границы `feature-matrix`/`evidence` |
| R11–R15 | История 3, Решения 3, 7 |
| R16–R18 | История 4, Решения 4 |
| R19–R22 | История 5, Решения 5, Граница `ai-registry` |
| R23–R25 | История 6, Вне рамок |
| R26–R28 | История 7, Граница `findings`/`report` |
| R29–R33 | История 8, Вне рамок |
| R34–R37 | История 9, Границы, Открытые места |
