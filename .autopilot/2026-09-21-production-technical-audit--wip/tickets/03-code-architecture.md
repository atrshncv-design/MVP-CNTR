# 03 — Качество кода и архитектура

**Требования:** R03, R09, R10, R25, R26, R30, R31, R35
**Blocked by:** 02
**Зона:** `docs/audit/2026-09-21-production/03-code/`
**Волна:** 3
**Status:** ready

## Что должно заработать

Появляются architecture map, доказанный список hardcode/stubs/dead ends/dead code и code-quality findings. Запускаются backend tests/Ruff/mypy и frontend tests/build; ошибки не скрываются.

## Критерии приёмки

- [ ] Architecture/data-flow map ссылается на точки входа и границы.
- [ ] Все обязательные code-категории из spec проверены; dead claims имеют runtime/import/scheduler evidence.
- [ ] Все пять local gates запущены; pass/fail/blocked с точной причиной.
- [ ] Findings валидны по JSON-схеме и не смешивают defect/risk/debt/recommendation.
