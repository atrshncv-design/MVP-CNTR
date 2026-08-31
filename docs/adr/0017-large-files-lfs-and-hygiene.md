# ADR 0017 — Крупные файлы и гигиена репозитория (2026-08-31, repo-structure-optimization)

## Контекст
Аудит 2026-08-31: 733 tracked файла, `du -sh .` 1.7 ГБ (1.6 ГБ — кэши), 50 групп дублей, 19 remote-веток, `.gitignore` битый на `main` (`babc9b9` `<<<<<<< HEAD`), крупные tracked: `data/nioktr_all.json` 64M, `docs/Справочник…docx` 2.8M, `public/videos/hero-bg.mp4` 2.5M, `.graphify/graph.json` 3.9M.

## Решение
1. **Не удалять крупные файлы без отдельного решения.** `git rm --cached` + `git lfs track` + `filter-repo` ломает клоны (переписывает 30+ коммитов). Помечены кандидатами LFS в `docs/version-map.md:Актуально на 2026-08-31`, оставлены в Git.
2. **Кэши — только локально, ignored.** `technozrelost-frontend/.next` 683M, `node_modules` 547M, `.venv` 283M, `__pycache__`, `.mypy_cache`, `.graphify/cache` — `rm -rf` локально, восстановливаются `uv sync --extra dev`/`npm ci`/`next build`. `git status --ignored` подтверждает.
3. **Дубли `docs/docs` и фронтовый `DESIGN.md`** — удалены `git rm` с 2 доказательствами (`shasum` identical, `grep -r` 0). Канон: `docs/DESIGN.md`, `docs/adr/`.
4. **`reports/` vs `backend/reports/`** — канон `reports/` (whitelisted `pitr-rehearsal-*.txt`, `loadtest/PROC-01.json`), `backend/reports/` — ignored, локально удалён. `rehearse_pitr.sh:REPORT` остаётся `$ROOT/reports` (внутри бэкенда) — при следующем прогоне пересоздаст `backend/reports`, что допустимо.
5. **Ветки — локальные теги, не push.** `git tag archive/main-pre-hygiene-20260831` etc. созданы локально 2026-08-31, `push --delete` только по отдельному `Ок` (irreversible).

## Последствия
- `git clone` остаётся тяжёлым (64M JSON), но рабочим.
- Навигация: `ls` без `docs/docs`, один `DESIGN.md`, `du -sh .` 1.4 ГБ после очистки кэшей (без `.next` полного удаления — 683M остаётся для тестов).
- `main:.gitignore` fix — cherry-pick `da684d4` в `main` отдельным шагом, не в этом ADR.

## Альтернативы
- Сразу `filter-repo` для 64M — отклонено: риск + необходимость пересоздания форков.
- Игнорить `graph.json` — отклонено: portable artifact по `graphify` skill.

## Ссылки
- Аудит §3-§9, `docs/version-map.md:2026-08-31`, `spec.md:Границы`, `tickets/01…03`.
