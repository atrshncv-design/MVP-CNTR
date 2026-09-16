# Тикет 01 — Фикс .gitignore на main + удаление безопасных дублей документации

## Цель
Закрывает R01,R03,R04,R05,R08,R09i. Делает навигацию предсказуемой без риска для сборки.

## Контекст
- `main:.gitignore` битый с `babc9b9` (`<<<<<<< HEAD` строка 1), в `HEAD` (`autopilot/m0` `da684d4`) уже fix. `git check-ignore -v` на `main` не работает.
- `docs/docs/agents/domain.md` + `issue-tracker.md` — артефакт `083f89d`, `grep -r docs/docs` =0, `git log --follow` показывает импорт.
- `docs/DESIGN.md` ↔ `technozrelost-frontend/DESIGN.md` hash-идентичны (50 групп дублей), канон — `docs/DESIGN.md`.
- `technozrelost-backend/.env.production.example` (72 строки) vs `infra/.env.production.example` (105 строк) — дубликат.

## Работа
1. Fix `main:.gitignore`: `git checkout main` + `git cherry-pick da684d4` (или `git show HEAD:.gitignore > .gitignore`), `git diff HEAD` проверить отсутствие `<<<<<<<`, наличие секций `Graphify`/`Reports`.
2. `git rm -r docs/docs` (проверить `git ls-files | grep docs/docs` =2 файла, `grep -r docs/docs` 0).
3. `git rm technozrelost-frontend/DESIGN.md` (проверить `diff docs/DESIGN.md technozrelost-frontend/DESIGN.md` identical, `git log --oneline -- docs/DESIGN.md` канон).
4. Для `.env.production.example`: оставить `infra/.env.production.example` каноном, `technozrelost-backend/.env.production.example` — пометить deprecated комментарием или `git rm` после согласования (в этом тикете — только добавить header `DEPRECATED: см. infra/.env.production.example`, не удалять без второго подтверждения).

## Приёмка
- `git show main:.gitignore | head -n1` = `# --- ОС-мусор ---` (без `<<<<<<<`)
- `git ls-files | grep -E "docs/docs|frontend/DESIGN"` =0
- `git status` clean, `git diff main...HEAD -- .gitignore` показывает fix
- `ruff check` / `mypy` / `pytest -q` / `npm run lint` — без регресса (не трогаем код, но гоняем gate)

## Зона
`.gitignore`, `docs/docs/`, `technozrelost-frontend/DESIGN.md`, `technozrelost-backend/.env.production.example`

## Зависимости
Нет
