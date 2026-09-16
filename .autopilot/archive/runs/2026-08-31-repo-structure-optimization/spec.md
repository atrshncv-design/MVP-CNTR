# Спецификация: Оптимизация структуры директории без удаления рабочих файлов

## Задача

Пользователь — Functional Validator платформы «Технозрелость». За месяцы работы накопилось 19 веток, 8 прогонов `.autopilot/`, дубли `docs/remediation`↔`.autopilot`, 2 шаблона `.env.production`, 64M JSON в Git, битый `.gitignore` на `main`. Навигация оценена 6/10, вес 1.7 ГБ (из них 1.6 ГБ — пересоздаваемые кэши). Нужна удобная, правильная структура, без ошибок и без потери рабочих файлов.

## Решение

После сборки: локальные кэши почищены (восстановимо `uv sync`/`npm ci`/`next build`), `main:.gitignore` исправлен, дубли задокументированы/устранены где безопасно, второстепенные файлы ( `docs/docs`, фронтовый `DESIGN.md`) удалены только с двумя доказательствами, крупные бинари помечены кандидатами LFS но не удалены без решения, все сборки/тесты/миграции зелёные, `git status` чист.

## Пользовательские истории

| # | Метка | История | Приёмка |
|---|-------|---------|---------|
| 1 | R01 | Как валидатор, я хочу удобную навигацию, чтобы находить код/доки за <30с | `ls`/`find` без дублей, `docs/version-map.md` актуализирован |
| 2 | R01.1 | …и чтобы структура соответствовала `AGENTS.md:8` и `docs/adr/*` | границы `technozrelost-backend`/`frontend`/`docs` не нарушены |
| 3 | R02 | Как валидатор, я хочу правильную структуру (соответствие архитектуре) | `app/main.py` роутеры, `alembic`/`db/migrations/sql`, `infra/docker-compose*` на месте |
| 4 | R03 | Как валидатор, я хочу без ошибок (не сломать сборку) | `ruff check + mypy + pytest -q + npm lint/test/build` зелёные, `alembic upgrade head` OK |
| 5 | R04 | Как валидатор, хочу без удалений рабочих файлов | ни один `git ls-files` из `app/`, `src/`, `infra/`, `docs/adr`, `alembic` не удалён без 2 доказательств; `git diff main...HEAD --name-status` проверен |
| 6 | R05 | Как валидатор, хочу измеримый вес директории | `du -sh .` + breakdown `du -h -d1` задокументирован, 1.7 ГБ → ~130 МБ без кэшей |
| 7 | R06 | Как валидатор, хочу оценку навигации | отчёт 6/10 с таблицей проблем (§2) сохранён |
| 8 | R07 | Как валидатор, хочу безопасный план перед удалением | план 12 разделов (§11) с командами проверки, удаления только после `Ок` |
| 9 | R08i | *(подразумевается)* сохранить CI/CD/миграции/документацию | `.github/workflows/ci.yml`, `alembic upgrade head`, `docs/PRD.md` не затронуты; `git log --oneline` история сохранена |
| 10 | R09 | Как валидатор, хочу категории мусора 10+ | отчёт §3-§10, 50 групп дубликатов, крупные файлы топ-15 |
| 11 | R04.1 | …и чтобы крупные бинари не ломали клон | кандидаты LFS перечислены, `git rm --cached` только по согласованию |
| 12 | R04.2 | …и чтобы секреты не утекли | `git grep` секретов = только `*.example` + `secrets.enc.env` placeholder, локальные `.env` остаются ignored |

## Решения по реализации

* **Стек:** `git mv` + `git rm --cached` (не `rm`), `du -sh`, `git ls-files`, `shasum`, `python3 -m http.server` для дашборда — без новых зависимостей. Почему так: минимизирует риск, сохраняет историю `git log --follow`.
* **Фикс `.gitignore`:** cherry-pick `da684d4` из `autopilot/m0` в `main` (удалён `<<<<<<< HEAD`, добавлены `Graphify`/`Reports`). Почему: `main` битый с `babc9b9`, `HEAD` чист.
* **Локальные кэши:** `technozrelost-frontend/.next` (683M), `node_modules` (547M), `.venv` (283M), `tsconfig.tsbuildinfo`, `__pycache__`, `.mypy_cache` — только локальное `rm -rf`, пересоздаётся. Почему: 1.6 ГБ, 2 доказательства (not in `git ls-files` + `git check-ignore -v`).
* **Дубли:** `docs/DESIGN.md`↔`frontend/DESIGN.md` (hash), `docs/docs/agents/` — удалить фронтовый/лишний уровень; `reports/` vs `backend/reports/` — удалить backend дубль, поправить `rehearse_pitr.sh:REPORT`. Почему: `grep -r` 0 использований дубля.
* **Крупные:** `nioktr_all.json` 64M, `*.docx` 2.8M, `hero-bg.mp4` 2.5M, `.graphify/graph.json` 3.9M — помечены кандидатами LFS, не удалять без решения (требует `filter-repo`, ломает клоны).
* **Ветки:** 19 remote — архивировать `codex/*` через `git tag archive/<branch>` локально, `push --delete` только по согласованию. Почему: irreversible.

## Границы и швы

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `repo-hygiene` | `.gitignore`, `git ls-files`, `du`, `shasum`, ветки | `check-ignore(path)->ignored?`, `ls-files --others`, `branch-audit` | детали `filter-repo`/LFS |
| `docs-structure` | `docs/`, `AGENTS.md`, `version-map.md` | `doc-path -> canonical?` | история ADR |
| `build-gate` | `pyproject.toml`, `package.json`, `infra/docker-compose*` | `ruff/mypy/pytest/npm lint/test/build/alembic` | кэши `.next/.venv` |

Швы для тестов — `repo-hygiene: check-ignore` + `build-gate: ruff/mypy/pytest` (существующие). Идеал — 1 шов `build-gate`.

## Вне рамок

| Требование | Почему не сейчас |
|---|---|
| R11 LFS-миграция крупных файлов (`nioktr_all.json`, `*.docx`, `*.mp4`, `graph.json`) | Требует `git filter-repo` + согласование, ломает клоны; помечено как `Вероятно` (§4 аудита) |
| R01 удаление `docs/remediation`↔`.autopilot` дублей (50 групп) | Осознанное дублирование для внешнего агента (`docs/remediation/README.md:1`), удаление без решения — потеря `PLAN.md` |
| Удаление веток `codex/*` remote | Irreversible, gating во всех режимах, требует `git tag archive` + `push --delete` по отдельному `Ок` |

## Открытые места

Нет `placeholder` — все `R` покрыты. `emptyEnv` — `POSTGRES_PASSWORD`, `JWT_SECRET` и т.д. уже в `.env.example` c `change_me`, локальные `.env` ignored.

## Покрытие манифеста

| Требование | Раздел |
|---|---|
| R01 оптимизировать структуру | Истории 1-2, Решения §1-2 |
| R02 удобно | История 1 |
| R03 правильно | История 3, Границы |
| R04 без ошибок | История 4, Решения §3 |
| R05 без удалений рабочих | История 5, Вне рамок |
| R06 вес 1.7 ГБ | История 6 |
| R07 оценка 6/10 | История 7 |
| R08 безопасный план | История 8 |
| R09i сохранить сборку/CI | История 9 |
| R10 категории мусора | История 10, Вне рамок |
| R11 крупные LFS | История 11, Вне рамок |
| R12 секреты | История 12 |
