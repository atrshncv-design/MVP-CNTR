# 14 — AI-01: bounded AI spend and provider failures

**Требования:** R23 (AI-01), R26 (часть AI-guardrails). **Blocked by:** 13. **Волна:** 4. **Зона:** `technozrelost-backend/app/core/config.py`, `technozrelost-backend/app/services/ai_assistant.py`, `technozrelost-backend/app/services/ai_metrics.py`, `technozrelost-backend/app/api/v1/chat.py`, `technozrelost-backend/app/api/v1/match.py`, `technozrelost-backend/app/api/v1/rag.py`, относящиеся backend tests. **Status:** in-progress.

## Цель

Закрыть AI-01: при включённом gateway каждый LLM-вызов имеет проверяемую route/user rate policy и дневную budget/quota крышку до отправки провайдеру; отказ/истощение лимита даёт текущий честный fallback/ошибку без обхода защиты. Повторные provider failures временно изолируются circuit breaker без изменения успешных путей.

## Основание

`docs/audit/2026-09-21-production/07-ai/findings.json`, `AI-01`: нет бюджета/квот/breaker; `/match` и `/rag/*` без собственного per-user rate-gate; единственная существующая rate policy — chat 30/60s; нет учёта размера контекста. Рекомендация требует per-route rate для `/match` и `/rag/search`, глобального дневного budget guard с alert и предварительной оценки контекста.

## Разделы спецификации

`spec.md`: §Решение (AI constraints, пункт 6); §Границы и швы (`ai-controls`); §Вне рамок. Источник finding — `docs/audit/2026-09-21-production/07-ai/findings.json`, AI-01; immutable audit baseline не менять.

## Критерии приёмки

- [ ] `/match` и `/rag/search` получают отдельный per-user/route limiter; существующий chat rate-limit сохраняет наблюдаемую семантику. Повышение лимита не допускается без config; ключи rate counters bounded по времени/размеру и не попадают в labels/logs.
- [ ] До каждого provider call оценивается размер входа и резервируется дневной token-budget/quota; при превышении provider не вызывается, используется честный существующий fallback или стабильный localized API error. Учитывается максимальный output cap из действующей конфигурации. Если точный tokenizer отсутствует, использовать документированную консервативную оценку без добавления зависимости и не называть её точным provider-token usage.
- [ ] Budget лимит конфигурируем и выражен в estimated tokens (без изобретения цены провайдера). При `LLM_GATEWAY_ENABLED=true` отсутствующий/невалидный лимит fail-fast; при gateway off локальная разработка остаётся возможной. Синтетические тесты доказывают reset по UTC-дню, параллельные резервации без overspend и fail-closed Redis/service failure в production-профиле; test/dev fallback не маскирует production.
- [ ] Исправная rate/budget policy применяется одинаково ко всем путям провайдера (chat, match, rag); нельзя вызвать общий service entrypoint в обход quota. Служебный вызов без user (если такой путь существует) получает явный bounded system bucket.
- [ ] Circuit breaker имеет тестируемые состояния closed/open/half-open, ограниченный cooldown/probe, и честный fallback при open; success восстанавливает circuit, исключения/timeout учитываются ровно один раз. Не добавлять retry storm или незапрошенные provider calls.
- [ ] Оператор может наблюдать rate denials, budget used/exhausted и breaker state через существующий metrics/log seam без пользовательских/tenant labels и без секретов. При приближении/исчерпании cap есть alertable metric/log; не отправлять внешние уведомления.
- [ ] Новые config variable names и default/required semantics задокументированы внутри config code/help без secret values; нет новых зависимостей, migrations/schema changes, frontend changes, image upgrades или иных AI prompt/persona правок.
- [ ] Focused tests, Ruff, Python 3.11 mypy и полный backend suite проходят. Все live provider/eval вызовы запрещены в T14; tests use synthetic inputs, fake provider and stubbed Redis only.

## Ограничения и безопасность

- Исполнитель не читает `.env`, `.env.production`, `.env.example` и credential stores; имена config variables и их required semantics берёт из этого ticket/spec и записывает только имена.
- Не читать/передавать ПДн, контакты, бюджеты, договоры, проекты или реальные промпты; test data только synthetic/утверждённые публичные ГОСТ-материалы.
- Ноль вызовов к production/LLM provider, ноль создания аккаунтов, миграций, DDL, контейнеров, deployment или изменений real configuration/data. Не менять тарифы/цену провайдера и не invent-ить SLA.
- Не менять публичные response contracts без backwards-compatible error code/localization; UI/prompt/injection/RAG quality issues относятся T08/T23/T24, а постоянная модель стоимости остаётся configurable.
- Не коммитить/пушить и не менять `.autopilot` файлы.

## Проверка

`cd technozrelost-backend && uv run pytest -q -k 'ai_budget or ai_rate or circuit_breaker'`; `uv run ruff check app tests infra/alerter scripts/udgu_ingest`; `/private/tmp/t04-backend-venv/bin/python -m mypy app`; `uv run pytest -q`. Проверить diff/scope и полный suite независимо у оркестратора.
