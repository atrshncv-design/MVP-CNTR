# Тикет 03 — Гигиена веток/крупные файлы + финальный gate

## Цель
Закрывает R01,R02,R07,R08,R09,R11. Делает 19 веток обозримыми, крупные файлы помечены, сборка зелёная.

## Контекст
- 19 remote веток: `autopilot/*` 3, `codex/*` 9, `feat/*` 2, `new-front`, `release/friday-rc`. `docs/version-map.md:1` уже устарел (описывает 50 веток на 2026-08-25). `git branch -a` показывает все merged в `main` кандидаты на архив.
- Крупные tracked: `data/nioktr_all.json` 64M, `docs/*.docx` 2.8M, `public/videos/hero-bg.mp4` 2.5M, `.graphify/graph.json` 3.9M — кандидаты LFS, но без `filter-repo` не удалять (ломает клоны). Нужно задокументировать.

## Работа
1. Не удаляя remote-ветки (gating): создать локальные теги-архивы для полностью влитых веток (`git tag archive/<branch> <branch>` для `codex/*` где `git branch --merged main` ), список в `docs/version-map.md` обновить секцией `2026-08-31: аудит 19 веток — кандидаты archive/* (требует отдельного Ок для push --delete)`.
2. Для крупных файлов: добавить секцию `## Крупные файлы (кандидаты LFS)` в `docs/version-map.md` или отдельный `docs/adr/0017-large-files-lfs.md` (ADR): перечислить 4 файла, размер, использование (`seed_nioktr.py:28`, `page.tsx:55`, `graphify`), решение — оставить в Git до отдельного решения, не `git rm --cached`.
3. Обновить `docs/version-map.md: Карта версий` — фактический `HEAD` `8ee427f` +30 vs `main` `a7dfbf3`, `origin/main` HEAD, `autopilot/m0` current branch.
4. Финальный gate: `uv run ruff check app`, `uv run mypy app`, `uv run pytest -q` (требует pg-primary), `npm run lint`, `npm test`, `npx tsc --noEmit`. Если БД недоступна — `pytest --collect-only`. `git status` clean, `git ls-files --others --exclude-standard` 0.

## Приёмка
- `docs/version-map.md` содержит актуальную таблицу веток на 2026-08-31 и секцию крупных файлов
- `git tag | grep archive/` — локальные теги созданы, `git push origin --delete` НЕ выполнен (gating)
- `git ls-files | xargs ls -lh | sort -hr | head` — крупные файлы всё ещё tracked (не удалены)
- Gate: `ruff`/`mypy`/`npm lint` EXIT 0, `git status` clean

## Зона
`docs/version-map.md`, `docs/adr/0017-large-files-lfs.md`, `git tag` (локально)

## Зависимости
После 01,02
