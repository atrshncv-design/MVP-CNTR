# Production technical audit — точка входа (прогон 2026-09-21-production)

Самодостаточная точка входа. Прогон `2026-09-21-production-technical-audit`:
сопоставление local (`f364388`) → server (`f06b15c`) → production
(`root@213.139.209.165`, 12/12 healthy, single-node P1). Код продукта,
production, схема БД, Autopilot-файлы и spec не менялись (mutations: 0).
LLM-вызовов: 0 из cap 200. Секреты — только именами, значений нет.
Исполнение: адаптер autopilot-opencode, модель
`opencode-go/muse-spark-1.3-contributor` (R30/R31).
Гейт этого файла: `09-final/check_final.py` (входит в gate вместе с этим README).

Как читать: начни с Executive summary ниже, затем иди по нумерованной карте
16 обязательных артефактов spec (§ Карта); каждый пункт — существующий файл
плюс именованный section anchor. Канон деталей — `09-final/README.md`
(финальный синтез, gate-решение, 30 findings). Evidence IDs: EV-001, EV-004,
EV-007, EV-013, EV-016, EV-019, EV-022, EV-025 (детали — в зональных отчётах).

## Executive summary

Публичные поверхности production работают: `GET /api/v1/health` 200 `ok`,
`GET /api/v1/ready` 200 `ready` (replica `not_configured`), landing `/` 200
(EV-004); 13 public routes × 1920/768/375 все 200, 41 screenshot
(EV-019, EV-020, EV-021); миграционный head `0037` доказан каталогом прод-БД
(EV-013); заголовки HSTS/nosniff/SAMEORIGIN + CSP nonce закрыты end-to-end
(EV-016); compose-конфиг санитизирован (EV-007). Собрано 30 findings
(2 high, 9 medium, 19 low, без severity inflation, `09-final/findings.json`):
единственный high продуктового риска — OPS-01 single-node SPOF; второй high —
CODE-03 environment-BLOCKED локальных backend-тестов (не продуктовая
регрессия). Авторизованный runtime, live AI-качество, offsite-копии, at-rest
шифрование, RPO/RTO-proof и restore proof — честный UNKNOWN. Gate:
**GO WITH CONDITIONS** с 4 blocking conditions C1–C4 (§ artifact-15 и
`09-final/README.md`). Planned features (УГТ-запуск, патентование,
акселерация, P2-заглушки F-028/F-029/F-033, выключенный LLM-gateway F-030)
не считаются regression.

## R32 — реестры и запрет исправлений (явно)

R32: реестры полностью аудитированы в T02 (feature-matrix 33 строки F-001…F-033,
`02-features/feature-matrix.csv`, статусы закрытого словаря) и T09 (unified
`09-final/findings.json`, 30 записей, дедуплицирован, severity из зон сохранена);
registry data проверена без превращения backlog в executable repair tickets.
Код продукта и production не менялись и не исправлялись в этом прогоне:
no code changes, product code unchanged, БД/production без mutations (R29).
T02/T09 — владельцы реестров; будущие реестры/анкеты (R33) вне рамок.

## Карта 16 обязательных артефактов spec

Каждый пункт: существующий файл + именованный section anchor.

- <a id="artifact-01"></a>1. Executive summary — `09-final/README.md#artifact-01`
  (§ Executive summary) + этот файл § Executive summary.
- <a id="artifact-02"></a>2. Окружения и ограничения — `01-environments.md#artifact-02`
  + `00-evidence/README.md` (EV-001…EV-008).
- <a id="artifact-03"></a>3. Матрица переноса функций —
  `02-features/feature-matrix.csv#artifact-03` (33 строки F-001…F-033, 12 колонок spec).
- <a id="artifact-04"></a>4. Архитектурная карта —
  `03-code/architecture.md#artifact-04`.
- <a id="artifact-05"></a>5. Findings registry —
  `09-final/findings.json#artifact-05` (30 записей, схема R26, дедуплицирован).
- <a id="artifact-06"></a>6. Отчёт по БД и защите данных —
  `04-database/db-model.md#artifact-06` (EV-009…EV-015).
- <a id="artifact-07"></a>7. Security report —
  `05-security/security.md#artifact-07` (EV-016…EV-018).
- <a id="artifact-08"></a>8. UX/UI report с screenshots —
  `06-ux/ux.md#artifact-08` + `06-ux/screenshots/*.png` (41 PNG, EV-019…EV-021).
- <a id="artifact-09"></a>9. AI registry и оценка —
  `07-ai/ai-registry.json#artifact-09` (6 записей, 17 полей spec) + `07-ai/ai.md`
  + `07-ai/eval-local.json` (EV-022…EV-024, 0/200 live calls).
- <a id="artifact-10"></a>10. Operations/performance report —
  `08-operations/operations.md#artifact-10` (EV-025, EV-003…EV-008).
- <a id="artifact-11"></a>11. Hardcode/stubs/dead code/dead ends list —
  `03-code/hardcode-stubs-deadends.md#artifact-11` (dead code не заявлен;
  доказанный dead end — P2 declared-403 CODE-05).
- <a id="artifact-12"></a>12. Risk matrix — `09-final/README.md#artifact-12`
  + § Risk matrix ниже.
- <a id="artifact-13"></a>13. Quick fixes (quick wins) —
  `09-final/README.md#artifact-13` + § Quick wins ниже (S/low, без downtime/миграций).
- <a id="artifact-14"></a>14. 30/60/90 stabilization plan —
  `09-final/README.md#artifact-14` + § 30/60/90 ниже.
- <a id="artifact-15"></a>15. Prioritized backlog без executable repair tickets —
  `09-final/README.md#artifact-15` + § Backlog ниже (R29: не executable до согласования).
- <a id="artifact-16"></a>16. UNKNOWN и недостающие доказательства —
  `09-final/README.md#artifact-16` + § UNKNOWN ниже.

Проверка карты: `python3 docs/audit/2026-09-21-production/09-final/check_final.py`.

## Risk matrix

Кратко (канон — `09-final/README.md#artifact-12`): high — полный простой при
отказе хоста/диска (OPS-01 + OPS-02 + OPS-03); medium — неограниченный LLM-spend
(AI-01), root-контейнеры (SEC-01), at-rest недоказан (DB-04), нет failover БД
(DB-05), suppressed exceptions/AI-метрики (CODE-01/CODE-02); process-high —
локальные гейты BLOCKED (CODE-03, CODE-06, опора на CI); остальное (17 low) — low.

## Quick wins

Кратко (канон — `09-final/README.md#artifact-13`): 1. UX-01 aria-label/labels;
2. SEC-02 явные allow_methods/headers; 3. SEC-03 одна проба `GET /docs`;
4. DB-03 канонический список индексов; 5. AI-02 счётчик malformed_total;
6. CODE-04 разделение dev/prod-пресетов. Каждый — S/low, без downtime и миграций.

## 30/60/90 stabilization plan

Кратко (канон — `09-final/README.md#artifact-14`): 30 дней — safe test accounts
(R36), safe AI eval ≤200, offsite-remote ok-маркер, dry-run алертов, проба /docs,
зелёные гейты; 60 дней — restore drill на staging + RTO, non-root/drop-caps,
per-route AI rate + budget-guard, решения RLS/soft-delete/MFA/TTL, чанки RAG;
90 дней — план 2×R640 либо принятие single-node, at-rest шифрование,
OTel-трейсинг + latency-SLO, персистентные AI-метрики.

## Prioritized backlog

Кратко (канон — `09-final/README.md#artifact-15`, blocking conditions C1–C4):
P0 — OPS-01, OPS-02, OPS-03, CODE-03, CODE-06 (C1 offsite, C2 restore, C3 test
accounts, C4 single-node SPOF + гейты); P1 (medium) — SEC-01, AI-01, DB-04,
DB-05, CODE-01, CODE-02; P2 (low) — остальные по порядку quick wins. Backlog не
превращается в repair tickets без одобрения владельца (R29).

## UNKNOWN и недостающие доказательства

Кратко (канон — `09-final/README.md#artifact-16`): авторизованный runtime всех
ролей (нужны safe test accounts, R36); live AI-качество (нужен safe entrypoint +
eval-план, 0/200 потрачено); offsite-содержимое и at-rest; restore/RPO/RTO-proof
и окно простоя; schema/content drift БД; deployed `/docs`, effective CORS,
возраст CVD; живые DB-internals, рост диска, логи; large lists, screen reader,
loading/5xx; scope будущих реестров (R33) — не блокирует аудит.
