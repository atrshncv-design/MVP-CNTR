# Интерфейсы аудита

## Границы, решённые в спецификации

| Единица | Владеет | Выставляет | Прячет |
|---|---|---|---|
| Инвентаризация | карта checkout и заявленных возможностей | проверенные факты о составе и связях | рабочие списки файлов |
| Доменный аудит | доказательства по назначенной зоне | кандидаты находок в едином формате | неподтверждённые гипотезы |
| Верификация | безопасные команды и их фактический вывод | pass/fail/blocked evidence | временные build/test-артефакты |
| Консолидация | дедупликация, severity, зависимости | `AUDIT_REPORT.md`, `AUDIT_FINDINGS.json` | внутреннюю сортировку кандидатов |
| Независимое ревью | доказательность и полнота | findings/coverage verdict | авторское толкование |

## Общий контракт доказательства

Каждый исполнитель пишет только свой `.autopilot/2026-09-10-deep-repository-audit--wip/evidence/NN-*.md`.
Кандидат находки: временный ID, title, category, proposed severity/confidence, exact
`path:line-range`, evidence, safe reproduction, impact, remediation, tests, dependencies.
Confirmed требует прямой трассы; гипотеза остаётся Probable/Suspicious. Секретные значения
не читать и не выводить. Исторические отчёты использовать только как указатели для новой
проверки текущего `e87267d`.

## Правила проекта

- Стек: Next.js 16 App Router; FastAPI/Python/SQLAlchemy; PostgreSQL 16/pgvector; Redis;
  MinIO/ClamAV; nginx; Docker Compose; Prometheus/Grafana.
- Не менять продуктовый код, зависимости, lockfiles, конфигурацию, миграции или данные.
- Не трогать запущенные `:3000`, `:8000` и Docker-контейнеры; не применять seed/migrations
  к постоянной БД; не делать deploy/publish.
- Разрешены read-only анализ и команды штатных gates. Любой потенциально state-changing
  smoke вернуть как `BLOCKED: <что>` с причиной вместо импровизации.
- `.env` не читать. Указывать только имена переменных.
- Backend: `uv run pytest -q`; `uv run ruff check app tests infra/alerter scripts/udgu_ingest`;
  `uv run mypy app`. Frontend: `npm test`; `npm run lint`; `npm run build`.
- Голый `uv sync` запрещён. Для установки только `uv sync --extra dev --locked` в
  изолированном окружении; недоступную зависимость не устанавливать молча, вернуть BLOCKED.
- Главный шов: публичный HTTP-контракт и штатные project gates; инфраструктура без live
  доступа проверяется executable contract tests с честным external-smoke limitation.

## Контракт консолидации

Финальный ID `AUD-NNN`. Severity строго Blocker/Critical/High/Medium/Low; confidence строго
Confirmed/Probable/Suspicious. Markdown и JSON должны содержать один и тот же набор ID,
severity, confidence и фактов. Не создавать находку ради количества и не переносить
непроверенный долг из `Plan.md`, `Status.md` или старого аудита.

## Из таска 01

- Evidence: `evidence/01-inventory-architecture.md`; карта checkout, 10 кандидатов IA-01..IA-10.
- Зелёные focused frontend contracts: matching 7/7, KT panel 8/8, routes 7/7.
- Консолидация обязана учесть craft concerns из `state.js` и не переносить завышенные impact/confidence.

## Из таска 02

- Evidence: `evidence/02-backend-api-security.md`; 111 маршрутов, 25 routers, кандидаты B02-001..B02-006.
- При консолидации: B02-004 оставить только unbounded-large; admin uniqueness не гарантирует наличие admin; тестовая выборка актуально 36/36.

## Из таска 03

- Evidence: `evidence/03-frontend-audit.md`; frontend route/role/API и findings FE03-01..FE03-19.
- Консолидация объединяет FE03-01/03/04/05/12 с IA-01/03-04/06/02/05+07; severity корректируется по craft review.
- Новые FE03-16..FE03-19 допускаются только после явной dependency/dedup mapping в evidence.

## Из таска 04

- Evidence: `evidence/04-database-migrations.md`; DB-01..DB-14, runtime DB checks честно blocked.
- Консолидация: DB-03 Medium (manager N+1), DB-07 loss Confirmed / lock-duration Probable, DB-12 Medium guard-gap, DB-02 split на race и orphan, DB-05 dedup с B02-004, DB-04 разбить/пометить группой, DB-09/DB-13 склеить, DB-14 оставить один канонический текст, Ruff FAIL тулингом не переносить.

## Из таска 05

- Evidence: `evidence/05-ai-files-security.md`; 05-01..05-08; focused LLM 7/7 и matching 7/7.
- Консолидация: 05-01 Critical только если ключ реально настраивался; 05-05 cost Probable без нагрузки, dedup B02-004/DB-05; 05-07/08 смаппить с T02/T04 DB-07; capture-stub тесты, не реальные провайдеры.

## Из таска 06

- Evidence: `evidence/06-devops-production.md`; 10 infra-кандидатов; live production drills не выполнялись.
- Консолидация: B06-001 Medium dev-only; B06-009 Probable без load-стенда; B06-010 dedup с 07, B06-009 с 08; SHA зафиксировать e87267d; alerter строки ±10.

## Из таска 07

- Evidence: `evidence/07-build-tests-dependencies.md`; install/build/frontend 182 green, mypy 2 errors, frontend audit critical/high.
- Консолидация: Next Critical только при reachable image/AVIF, иначе High; mypy High только если gate блокирует релиз; дописать dependencies BTD07-01/03/04; ограничение: нет ASGI smoke и nginx/alembic syntax.

## Из таска 08

- Evidence: `evidence/08-performance-resilience.md`; capacity tiers только расчётные, не load-tested.
- Консолидация: P08-03/04 dedup с DB-14/DB-03; P08-07 ссылка на B06-009; P08-06/08 dedup с T06; leak Confirmed + slope Probable; порог от 2GiB; uniform RU.

## Из таска 09

- Evidence: `evidence/09-business-traceability.md`; B-01..B-11, 0 новых ID, dedup к T01-T05.
- Консолидация: verdict только ok/разрыв; сводку deep states не превращать в находки; suites по ссылке метить; SHA обновить.
