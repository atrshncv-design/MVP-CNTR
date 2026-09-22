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

## Blocking review condition 01

Исправить только следующие блокеры независимого review:

1. `hardcode-stubs-deadends.md`: R09 покрыт частично — добавить проверку coupling, unused dependencies, duplication и complexity; для недоказуемого дать `UNKNOWN` с воспроизводимой командой/evidence, а не объявлять категорию вне safe-зоны.
2. `gates.md` и `findings.json`: фактический backend baseline — `31 passed, 720 setup errors`, а не «720 тестов» и не «ни один тест не запустился». Согласовать все формулировки с этим результатом.
3. `architecture.md` и `hardcode-stubs-deadends.md`: в `app/main.py:313-338` ровно 26 вызовов `app.include_router`; проверка должна исключать строку-комментарий, которую захватывает простой `rg -c include_router`.
4. `architecture.md`: утверждение «остальное требует JWT» неверно. Точно перечислить доказанные публичные routes, включая публичные GET из technologies/news/executors/nioktr, либо сузить формулировку до проверенного набора.
5. `gates.md`: frontend suite не обозначать `FAIL` как продуктовую регрессию, если полный suite заблокирован отсутствующим `next-intl`/`node_modules`; сохранить точные наблюдаемые `171 passed / 38 import errors`, статус `BLOCKED` и запрет молча устанавливать зависимость. Убедиться, что в артефактах нет красного product-suite результата.

Больше ничего не менять.

## Blocking review condition 02

Исправить только остаток условия 1 и новый breakage ремонта:

1. `hardcode-stubs-deadends.md`: команда для inventory импортов не должна использовать `rg -h` (в установленном ripgrep это `--help`). Дать реально исполнимую воспроизводимую команду и проверить её результат.
2. Проверка duplication должна охватывать весь codebase или быть корректным `UNKNOWN` с реально выполненным широким inventory/evidence; нельзя объявлять категорию «вне safe-зоны» и одновременно ограничивать ручную сверку двумя файлами.
3. Вернуть открывающий backtick перед `_news_scheduler_loop`.

Больше ничего не менять.
