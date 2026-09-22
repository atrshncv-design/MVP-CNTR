# 09 — Финальный синтез, backlog и gate-решение (ticket 09)

Самодостаточный отчёт прогона `2026-09-21-production-technical-audit`.
Код продукта, production, схема БД, Autopilot-файлы и spec не менялись.
Mutations: 0. LLM-вызовов: 0 (лимит 200 не тронут). Секреты — только именами.
Исполнение: адаптер autopilot-opencode, модель
`opencode-go/muse-spark-1.3-contributor` (R30/R31).
Точка входа прогона: `docs/audit/2026-09-21-production/README.md`.
Гейт: `09-final/check_final.py` (проверяет 16/16 артефактов, root README и сам gate).

## R32 — реестры и запрет исправлений (явно)

R32: реестры полностью аудитированы в T02 (feature-matrix 33 строки F-001…F-033,
`02-features/feature-matrix.csv`) и T09 (unified `09-final/findings.json`,
30 записей, дедуплицирован, severity из зон сохранена); registry data проверена
без превращения backlog в executable repair tickets. Код продукта и production
не менялись и не исправлялись в этом прогоне: no code changes, product code
unchanged, БД/production без mutations (R29). T02/T09 — владельцы реестров.

## Карта 16 обязательных артефактов spec

Каждый пункт — существующий файл + именованный section anchor.

- <a id="artifact-01"></a>1. Executive summary — `09-final/README.md#artifact-01`
  (§ Executive summary).
- <a id="artifact-02"></a>2. Окружения и ограничения — `01-environments.md#artifact-02`
  + `00-evidence/README.md`.
- <a id="artifact-03"></a>3. Матрица переноса функций —
  `02-features/feature-matrix.csv#artifact-03`.
- <a id="artifact-04"></a>4. Архитектурная карта — `03-code/architecture.md#artifact-04`.
- <a id="artifact-05"></a>5. Findings registry — `09-final/findings.json#artifact-05`.
- <a id="artifact-06"></a>6. Отчёт по БД и защите данных —
  `04-database/db-model.md#artifact-06`.
- <a id="artifact-07"></a>7. Security report — `05-security/security.md#artifact-07`.
- <a id="artifact-08"></a>8. UX/UI report с screenshots — `06-ux/ux.md#artifact-08`
  + `06-ux/screenshots/*.png`.
- <a id="artifact-09"></a>9. AI registry и оценка —
  `07-ai/ai-registry.json#artifact-09` + `07-ai/ai.md`.
- <a id="artifact-10"></a>10. Operations/performance report —
  `08-operations/operations.md#artifact-10`.
- <a id="artifact-11"></a>11. Hardcode/stubs/dead code/dead ends list —
  `03-code/hardcode-stubs-deadends.md#artifact-11`.
- 12. Risk matrix — `09-final/README.md#artifact-12` (§ ниже).
- 13. Quick fixes — `09-final/README.md#artifact-13` (§ ниже).
- 14. 30/60/90 stabilization plan — `09-final/README.md#artifact-14` (§ ниже).
- 15. Prioritized backlog — `09-final/README.md#artifact-15` (§ ниже).
- 16. UNKNOWN — `09-final/README.md#artifact-16` (§ ниже).

## Executive summary

Проверен single-node production P1 (`root@213.139.209.165`, 12/12 healthy,
running `f06b15c`): публичные поверхности работают — `GET /api/v1/health` 200
`ok`, `GET /api/v1/ready` 200 `ready` (replica `not_configured`), landing `/`
200, `/api/v1/metrics` 200 только route-шаблоны (EV-003, EV-004); 13 public
routes × 1920/768/375 все 200, 41 screenshot (EV-019, EV-020, EV-021);
миграционный head `0037` доказан каталогом прод-БД (EV-013); заголовки
HSTS/nosniff/SAMEORIGIN + CSP nonce per-request закрыты end-to-end (EV-016);
compose-конфиг санитизирован: 108 ключей name+set/empty (EV-007).
Собрано 30 findings (2 high, 9 medium, 19 low — без severity inflation,
приоритизированы в `findings.json`): единственный high продуктового риска —
OPS-01 single-node SPOF; второй high — CODE-03 environment-BLOCKED локальных
backend-тестов (не продуктовая регрессия). Авторизованный runtime всех ролей,
live AI-качество, offsite-копии, at-rest шифрование, RPO/RTO-proof и restore
proof — честный UNKNOWN. Gate: **GO WITH CONDITIONS** с 4 blocking conditions
ниже. Planned features (УГТ-запуск, патентование, акселерация, P2-заглушки
F-028/F-029/F-033, выключенный LLM-gateway F-030) не считаются regression.

## Окружения и ограничения (артефакты 1–2)

- База: `00-evidence/README.md` (EV-001…EV-008, stop-сигналы не сработали),
  `01-environments.md` (local `f364388` vs server `f06b15c`, deployment path
  `~/MVP-CNTR` ≠ `/opt/technozrelost` из spec, single-node факт).
- Local HEAD `f364388` ≠ server HEAD `f06b15c`: выводы о deployed-коде — только
  там, где есть прямое EV-доказательство (Решение 7); остальное static/local.
- Локальные гейты environment-BLOCKED: backend-тесты `31 passed, 720 setup
  errors` без тестовой БД (CODE-03, EV-015); фронт `171 passed / 38 import
  errors` без `node_modules` (CODE-06); mypy падает на стабах numpy до анализа
  `app/`; зелёный шов — Ruff + non-DB acceptance set 32 passed (EV-018).

## Матрица переноса и архитектура (артефакты 3–4, 11)

- `02-features/feature-matrix.csv`: 33 строки F-001…F-033, 12 колонок spec.
  DEPLOYED_WORKING только F-001…F-004 (EV-004); EXPECTED — F-005…F-027, F-031,
  F-032; STUB — F-028, F-029, F-033; DISABLED — F-030; production_check
  UNKNOWN везде без прямых проб (R36).
- `03-code/architecture.md` — карта архитектуры и потоков данных;
  `03-code/hardcode-stubs-deadends.md` — hardcode/stubs/dead ends; dead code
  не заявлен (только alive/indeterminate); единственный доказанный dead end —
  P2 declared-403 через p2GatedMessage (CODE-05).
- `03-code/gates.md` — все пять local gates с точными причинами BLOCKED.

## Findings registry (артефакт 5): 30 записей, дедуплицирован

`09-final/findings.json` — объединение зон без изменения severity:
CODE-01, CODE-02, CODE-03, CODE-04, CODE-05, CODE-06;
DB-01, DB-02, DB-03, DB-04, DB-05, DB-06;
SEC-01, SEC-02, SEC-03, SEC-04, SEC-05;
UX-01, UX-02;
AI-01, AI-02, AI-03, AI-04, AI-05;
OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06.
Дублей нет (id уникальны), severity из зон сохранены, сортировка high→low.

## Контурные отчёты (артефакты 6–10)

- БД (`04-database/db-model.md`, EV-009…EV-015): 39 ORM-объектов metadata
  (36 declarative + 3 Core), каталог EV-013 (41 таблица, PK 41 / FK 55 /
  unique 12 / check 8, 150 index rows), applied head 0037 = файловый head
  (только version parity; schema/content drift UNKNOWN — DB-01); RLS нет,
  изоляция application-level (DB-02); ivfflat только в миграциях (DB-03);
  at-rest не доказано (DB-04); реплика подготовлена, не развёрнута (DB-05);
  soft-delete отсутствует repo-wide (DB-06).
- Security (`05-security/security.md`, EV-016…EV-018): контейнеры root без
  user/drop (SEC-01 medium); CORS credentialed + wildcard methods (SEC-02
  low); `/docs` deployed-состояние UNKNOWN (SEC-03 low); MFA нет, сброс
  ручной (SEC-04 recommendation); logout отзывает только refresh, окно access
  до ~часа (SEC-05 low).
- UX (`06-ux/ux.md`, 41 screenshot, EV-019, EV-020, EV-021): search без
  programmatic label + УГТ-selects без связки (UX-01 defect low); контраст
  оверлеев hero/nav computed-style не меряется (UX-02 recommendation).
- AI (`07-ai/ai-registry.json` 6 записей AI-CHAT/AI-CHAT-TUNO/AI-CHAT-KABA/
  AI-RAG-SEARCH/AI-MATCH/AI-GEN, `07-ai/ai.md`, `07-ai/eval-local.json`
  7 офлайн-кейсов, EV-022, EV-023, EV-024): нет budget/quota/breaker, /match
  без rate (AI-01 medium); нет schema-валидации 200-ответа (AI-02);
  in-memory метрики без персистентности (AI-03); срез контекста [:500]/[:200]
  без чанкинга (AI-04); live eval set отсутствует (AI-05).
- Operations (`08-operations/operations.md`, EV-025, EV-003…EV-008):
  single-node SPOF (OPS-01 high); `BACKUP_OFFSITE_REMOTE` пуст — копий вне
  хоста скорее всего нет (OPS-02 medium); restore proof отсутствует (OPS-03
  medium); RPO/RTO цели без proof, доставка алертов недоказана (OPS-04 low);
  нет zero-downtime, rollback только образов (OPS-05 low); нет трейсинга и
  latency-SLO (OPS-06 recommendation).

<a id="artifact-12"></a>
## Risk matrix (артефакт 12)

| Риск | Findings | Уровень |
|---|---|---|
| Полный простой при отказе хоста/диска; потеря данных сверх локального снапшота | OPS-01 high + OPS-02 + OPS-03 | high |
| Неограниченный LLM-spend при включении gateway | AI-01 medium | medium |
| Root-контейнеры на single-node (blast radius) | SEC-01 medium | medium |
| At-rest шифрование недоказано (диски/снапшоты/MinIO) | DB-04 medium | medium |
| Нет failover БД (replica not_configured) | DB-05 medium + OPS-01 | medium |
| Скрытые сбои через suppressed exceptions; шаткие AI-метрики | CODE-01, CODE-02 medium | medium |
| Локальные гейты не подтверждают качество (опора на CI) | CODE-03 high(env), CODE-06 medium(env) | process-high |
| Остальное (CORS, /docs, MFA, logout-окно, RLS-отсутствие, UX-доступность, AI-долг, RPO/SLO) | 17 low | low |

<a id="artifact-13"></a>
## Quick wins (артефакт 13; каждый — S/low, без downtime и миграций)

1. UX-01: aria-label поиску `/projects`, `<label for>` УГТ-selects `/roadmap`.
2. SEC-02: явные allow_methods/allow_headers вместо wildcard при credentials.
3. SEC-03: одна read-only проба `GET /docs` → зафиксировать 200/404, затем гейт.
4. DB-03: канонический список индексов держать в `db-model.md` (гейт уже есть).
5. AI-02: счётчик malformed_total отдельно от errors_total.
6. CODE-04: dev/prod-пресеты конфига разделить именами ключей.

<a id="artifact-14"></a>
## 30/60/90 stabilization plan (артефакт 14)

- 30 дней: safe test accounts (закрыть R36-UNKNOWN) + safe eval-план AI ≤200
  (AI-05); настроить offsite-remote, подтвердить ok-маркером (OPS-02);
  dry-run доставки алертов (OPS-04); одна проба /docs (SEC-03); зелёные гейты
  в каноничном окружении решением оркестратора (CODE-03, CODE-06).
- 60 дней: restore drill на staging с rehearsal-отчётом и замером RTO
  (OPS-03, OPS-04); non-root/drop-capabilities в compose (SEC-01); per-route
  rate + budget-guard AI (AI-01); решение владельца: RLS vs app-level
  (DB-02), soft-delete/retention ПДн (DB-06), MFA (SEC-04), TTL/blocklist
  access (SEC-05); явные чанки RAG с overlap (AI-04).
- 90 дней: план переезда 2×R640 (replica+failover, backend ×2, offsite)
  либо формальное принятие single-node (OPS-01, DB-05); at-rest шифрование
  (DB-04); OTel-трейсинг + latency-SLO + p95-панель (OPS-06); персистентные
  AI-метрики и staleness-мониторинг индекса (AI-03).

<a id="artifact-15"></a>
## Prioritized backlog (артефакт 15; не executable до согласования, R29)

P0 (blocking conditions C1–C4): OPS-01, OPS-02, OPS-03, CODE-03, CODE-06.
P1 (medium): SEC-01, AI-01, DB-04, DB-05, CODE-01, CODE-02.
P2 (low, по порядку quick wins → остальное): UX-01, SEC-02, SEC-03, DB-03,
AI-02, AI-03, AI-04, AI-05, CODE-04, CODE-05, DB-01, DB-02, DB-06, OPS-04,
OPS-05, OPS-06, SEC-04, SEC-05, UX-02.
Backlog не превращается в repair tickets без одобрения владельца.

<a id="artifact-16"></a>
## UNKNOWN и недостающие доказательства (артефакт 16)

1. Авторизованный runtime всех ролей (проекты, стадии, invites, файлы, SSE,
   dashboards, matching, AI, генерация) — нужны safe test accounts (R36).
2. Live AI-качество (синтез, rerank, цитаты, outage-хвосты) — нужен safe
   entrypoint + eval-план (0/200 потрачено).
3. Содержимое offsite-маркеров (копии вне хоста) и at-rest шифрование.
4. Restore proof, RPO/RTO-proof, окно простоя deploy, время рестарта.
5. Schema/content/manual drift БД (checksums/definitions не сверялись).
6. Deployed-состояние `/docs`, effective CORS origins/grants, возраст CVD.
7. Живые DB-internals (connections/slow/locks), рост диска, содержимое логов.
8. Large lists под данными, screen-reader прогон, loading/5xx под нагрузкой.
9. Точный scope будущих реестров/анкет (R33) — не блокирует аудит.

## Gate-решение: GO WITH CONDITIONS

Условия продолжения ограниченной эксплуатации (blocking conditions):
- C1 — offsite: настроен `BACKUP_OFFSITE_REMOTE` (именем) + свежая ok-строка
  маркера; иначе масштабирование незаменимых данных запрещено (OPS-02).
- C2 — restore: rehearsal-отчёт восстановления из свежего снапшота на
  staging с замером RTO; скрипт ≠ proof (OPS-03).
- C3 — test accounts: утверждены safe-аккаунты, закрывающие authorized
  runtime UNKNOWN перед любыми заявлениями о ролевых сценариях (R36).
- C4 — топология и гейты: владелец формально принял single-node SPOF
  (OPS-01) либо назначил срок 2×R640; канонические гейты зелёные после
  подготовки окружения (CODE-03, CODE-06).
Нарушение C1/C2 при росте критичных данных или инциденте переводит решение
в NO-GO до закрытия. Чистый GO требует дополнительно закрытых C1–C4 и
доказанных RPO/RTO.
