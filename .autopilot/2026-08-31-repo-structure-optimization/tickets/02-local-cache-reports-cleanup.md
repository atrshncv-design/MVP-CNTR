# Тикет 02 — Локальная очистка кэшей + дедуп reports (без Git)

## Цель
Закрывает R01,R04,R05,R06,R09. Освобождает ~1.6 ГБ локально, убирает дубль reports без потери истории.

## Контекст
- Локально ignored: `technozrelost-frontend/.next` 683M, `node_modules` 547M, `.venv` 283M, `tsconfig.tsbuildinfo`, `__pycache__`, `.mypy_cache` — 2 доказательства: not in `git ls-files` + `git check-ignore -v`.
- Дубли: `reports/loadtest/PROC-01.json` (tracked, whitelisted) ↔ `technozrelost-backend/reports/loadtest/PROC-01.json` (identical hash, but `backend/reports/` is ignored via `backend/.gitignore:reports/` and locally exists). `rehearse_pitr.sh:REPORT=$ROOT/reports/...` указывает на backend/reports.

## Работа
1. Локально (не коммитить, не push): `rm -rf technozrelost-frontend/.next technozrelost-frontend/tsconfig.tsbuildinfo technozrelost-frontend/next-env.d.ts .mypy_cache technozrelost-backend/.mypy_cache .pytest_cache .ruff_cache __pycache__ technozrelost-*/__pycache__ .graphify/cache technozrelost-*/.graphify/cache`
   - Предварительно `git status --ignored` убедиться что всё ignored.
   - После: `du -sh .` должен показать ~130M без кэшей (+ .git 34M), `git status` остаётся clean.
   - Восстановление: `uv sync --extra dev`, `npm ci`, `npm run build` (проверить, но не обязательно выполнять полностью — достаточно `du -sh` + `git ls-files` проверка).
2. Дубли reports: `rm -rf technozrelost-backend/reports` (локально, ignored). Если `REPORT` в `rehearse_pitr.sh` указывает на backend, поправить на `reports/` (проверить `grep -n REPORT technozrelost-backend/scripts/rehearse_pitr.sh` + `infra/backup.sh`).
   - Проверить `diff reports/loadtest/PROC-01.json technozrelost-backend/reports/loadtest/PROC-01.json` identical перед удалением.
   - `git ls-files | grep reports` должен остаться только `reports/loadtest/PROC-01.json` + `pitr-rehearsal-*.txt`.

## Приёмка
- `git ls-files --others --exclude-standard` =0 (не появилось новых untracked)
- `git status --ignored` — количество ignored уменьшилось на удалённые кэши
- `ls -lh reports/loadtest/PROC-01.json` существует, `ls technozrelost-backend/reports` — нет
- `cat technozrelost-backend/scripts/rehearse_pitr.sh | grep REPORT` указывает на `reports/` если был фикс

## Зона
Локальные кэши (ignored), `technozrelost-backend/reports/`, `technozrelost-backend/scripts/rehearse_pitr.sh`

## Зависимости
После 01 (чтобы fix .gitignore не мешал check-ignore)
