# Границы: repo-structure-optimization

Источник: `spec.md: Границы и швы`.

| Модуль | Владеет | Выставляет | Прячет |
|---|---|---|---|
| `repo-hygiene` | `.gitignore`, `git ls-files`, `du`, ветки, `shasum` | `check-ignore(path)->ignored?` | LFS/filter-repo детали |
| `docs-structure` | `docs/`, `AGENTS.md`, `version-map.md` | `doc-path -> canonical?` | ADR история |
| `build-gate` | `pyproject.toml`, `package.json`, `infra/docker-compose*` | `ruff/mypy/pytest/npm lint/test/build/alembic` | кэши |

Шов: `build-gate` (ruff/mypy/pytest) — основной.
