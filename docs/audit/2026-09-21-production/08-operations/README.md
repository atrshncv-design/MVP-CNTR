# 08 — Operations/performance (ticket 08)

Read-only оценка эксплуатации и производительности без нагрузочных,
restore- и restart-воздействий. Нагрузка не создавалась.

## Файлы зоны

| Файл | Назначение |
|---|---|
| `operations.md` | Отчёт: весь контур spec (27 пунктов) покрыт или `UNKNOWN`; сравнение single-node vs 2× R640 |
| `findings.json` | OPS-01…OPS-06 в схеме R26 (21 ключ: 19 полей spec + `effort` + `risk`, как у зон 04/05/06/07) |
| `EV-025-ops-static.md` | Новое доказательство: локальная статическая инвентаризация (deployed-факты переиспользованы из EV-003…EV-008) |
| `check_ops.py` | Гейт зоны: `python3 check_ops.py` |

## Доказательства

- Новое: EV-025 (статика worktree; исходная метка `2026-09-22` — exact UTC
  timestamp unavailable, граница из metadata `2026-09-22T08:54:23+0400`
  (= `2026-09-22T04:54:23Z`), ре-верификация `2026-09-22T04:59:20Z`;
  секреты — только имена, значений нет)
- Переиспользованы без повторных проб: EV-003 (рантайм), EV-004 (HTTP-точки),
  EV-005 (CI/CD), EV-006 (backup/monitoring/resources), EV-007 (compose),
  EV-008 (deploy-лог)
- Сырые логи/транскрипты не коммитились; секретов/ПДн/бизнес-строк нет

## Findings (кратко)

- OPS-01 (high): single-node SPOF — отказ хоста = полный простой
- OPS-02 (medium): offsite пуст — копий вне хоста, скорее всего, нет
- OPS-03 (medium): restore proof отсутствует — скрипт ≠ восстановление
- OPS-04 (low): RPO/RTO — цели без proof; доставка алертов недоказана
- OPS-05 (low): нет zero-downtime; rollback только образов, не испытан
- OPS-06 (low/product_recommendation): нет трейсинга и latency-SLO

## Исполнение (R30/R31)

Тикет исполнен через адаптер autopilot-opencode моделью
`opencode-go/muse-spark-1.3-contributor`. Значения секретов и credentials не
читались и не сохранялись; в артефактах — только имена ключей.

Repair note (root cause): EV-025 used a date-only stamp with no provable UTC, omitted R30/R31 provenance, and claimed 22 finding keys instead of the actual 21.

## Проверка

`python3 docs/audit/2026-09-21-production/08-operations/check_ops.py`
→ OK: 6 findings, checklist 27 tokens covered, no load created
