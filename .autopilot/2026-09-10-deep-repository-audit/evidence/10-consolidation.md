# Evidence 10: консолидация (таск 10, без правок продукта)

Baseline `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, worktree HEAD на момент сборки `aa82ab525b62701877af5a9397400ff8db52e1e3`, дата 2026-09-11. Продукт не менялся; `.env` не читались; коммит не делался. Артефакты: `<root>/AUDIT_REPORT.md`, `<root>/AUDIT_FINDINGS.json` (66 ID AUD-001..066).

## Дедупликация (по interfaces + state.js concerns)

- FE03-01 + IA-01 + 05-01 → AUD-001 (High Confirmed; Critical только при реально настроенном публичном ключе; CSP-часть retained).
- IA-02 + FE03-05 → AUD-002 (High Confirmed, одна false-success цепь).
- IA-03 + IA-04 + FE03-03 → AUD-003 (High Confirmed; два механизма в одном ID: failed-write success + фабрикация/wrong-stage; backend авторитет noted).
- IA-06 (subset) + FE03-04 → AUD-004 (Medium Confirmed; cursor/search/region retained, status-subset внутри).
- IA-05 + FE03-12-template → AUD-005 (Medium); IA-07 + FE03-12-filters → AUD-006 (Medium); две независимые missing-API не схлопнуты.
- IA-08 → AUD-007; IA-09 → AUD-008 (Low drift, impact не преувеличен); IA-10 + FE03-16 → AUD-009 (Medium Probable: отсутствие Confirmed, гипотеза необходимости отделена/понижена); FE03-07 → AUD-010 отдельно.
- B02-004 + DB-05 + 05-05-unbounded → AUD-014 (High Confirmed; только unbounded-large, negative-LIMIT отброшен; cost-slope Probable).
- P08-03 → AUD-041 (один текст DB-14: stage/file/fan-out + scheduler fan-out); P08-04 → AUD-032/AUD-033 (без отдельных AUD); P08-07 → AUD-056 (ссылка, без отдельного AUD); P08-06 → AUD-065, P08-08 → AUD-066 (отдельные, depends_on T06); P08-01 → AUD-062, P08-02 → AUD-063, P08-05 → AUD-064.
- B06-010 → отдельный AUD-057 (digest-prod/CI-parity), BTD07-01 → AUD-058 (lock-advisory reachable); связаны depends_on, не склеены.
- DB-09 + DB-13 → AUD-037 (High Probable: upgrade-block Probable + downgrade-loss Confirmed в одном ID); DB-14 один текст AUD-041; DB-02 split AUD-030 (race High) + AUD-031 (orphan Medium); DB-04 группой AUD-033.
- Craft severity/confidence: FE03-01 High; FE03-04 Medium; FE03-11 AUD-022 Probable; FE03-19 AUD-028 Probable; DB-03 AUD-032 Medium; DB-07 AUD-035 loss Confirmed/lock Probable в одном ID; DB-12 AUD-040 Medium; 05-01 conditional Critical в AUD-001; 05-05 cost Probable в AUD-014; B06-001 AUD-048 Medium dev-only; B06-009 AUD-056 Probable; Next reachable → AUD-058 Critical; mypy gate-blocks → AUD-059 High; Ruff FAIL не перенесён.
- T09 B-01..B-11: 0 новых ID; все разрывы смаплены на IA/B02/FE03/DB/05 (таблица в evidence/09 §Дедупликация).
- Suites T01..T09 приняты «по ссылке», не свежий прогон (помечено в отчёте §6).

## Проверки

- `python3 -m json.tool AUDIT_FINDINGS.json > /dev/null` → JSON_VALID.
- Сверка скриптом: json_count 66; md_unique 66; missing_in_md []; table_rows 66; mismatch []; detail_headers 66.
- Файлы: все `files[].path` из JSON существуют на worktree (missing 0).
- Набор severity/confidence MD-таблица §9.1 == JSON (mismatch 0).
- Секретов ноль (только имена переменных); продуктовый `git diff --check` чист по продукту (только pre-existing `.autopilot` dirty/untracked).

## Ограничения консолидации

Свежие suite-прогоны не выполнялись; DB/Browser/load/live-smoke BLOCKED как в T04/T06/T08; Probable/Suspicious оставлены честными (AUD-009/022/024/028/037/038/056 + cost-части + AUD-025).

## Исправление сводок 2026-09-11 (дозапрос)

Root cause: сводные числа набраны вручную и разошлись с таблицей/JSON.
Пересчёт скриптом (Counter по JSON и §9.1): Critical 1, High 25, Medium 35, Low 5, Confirmed 58, Probable 7, Suspicious 1 (66). Исправлены только строка «Итог» и заголовки §9.2 (Confirmed 58)/§9.3 (8: Probable 7 + Suspicious 1) + явный список Probable-7; ID/severity/JSON/продукт не тронуты.
Повторная сверка: `json.tool` VALID; TABLE==JSON (High 25/Medium 35/Low 5/Critical 1; Confirmed 58/Probable 7/Suspicious 1; 66 rows); mismatch []; details 66; `git diff --check` чисто по продукту.
