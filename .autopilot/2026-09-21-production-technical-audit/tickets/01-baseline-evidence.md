# 01 — Baseline: local, Git, server, production

**Требования:** R01–R06, R23, R24, R30, R31, R37
**Blocked by:** —
**Зона:** `docs/audit/2026-09-21-production/00-evidence/` · `01-environments.md`
**Волна:** 1
**Status:** ready

## Что должно заработать

Появляется воспроизводимый, санитизированный baseline локального checkout, origin, deployment и production runtime. Только read-only; при первом stop-сигнале дальше не идти.

## Из брифа, дословно

> «До анализа зафиксируй»
> «Пассивный production-блок разрешён»

## Разделы спецификации

История 1; Решения 1–4, 6–7; Обязательные контуры: эксплуатация.

## Критерии приёмки

- [ ] Local branch/SHA/status/remotes и server SHA/dirty-state зафиксированы.
- [ ] OS/runtime/Docker/Compose/images/services/health/manifests зафиксированы без env values.
- [ ] CI/CD, deploy events, logs metadata, backup/WAL/monitoring/alerting metadata и public health/ready имеют evidence IDs.
- [ ] Для production зафиксированы санитизированный `docker compose config` без environment values и конфигурационные ключи только как `name + set/empty`; `.env` и credential stores не читаются.
- [ ] Последнее deployment-событие подтверждено безопасным хвостом журнала с автоматической маскировкой tokens/cookies/email/phones/project content, а не только metadata файла.
- [ ] Ни одной mutation; секреты/ПДн/бизнес-строки не сохранены.

## Blocking review condition 01

Причина: первоначальный проход зафиксировал лишь имена manifest/config и metadata deploy-журнала, поэтому R06 был закрыт частично. Дополнить только недостающие evidence и сводку по двум критериям выше; существующие доказательства не пересобирать и продукт/production не изменять.
