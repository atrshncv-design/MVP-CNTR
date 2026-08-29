# SPEC-04: Воспроизводимость поставки и изоляция сетей (H-03, M-04, L-05)

## Контекст
H-03: `technozrelost-backend/uv.lock` dirty после `pyproject.toml:14` pin `==` — `git status` `modified: uv.lock` + untracked `.graphify/, docs/SOPS.md`, `HEAD` lock с `>=` → `uv sync --locked` на CI собирает другой граф, деплой не déterministe, нарушает `AGENTS.md:6` push-контракт. M-04: `docker-compose.prod.yml:101` `minio:RELEASE...` без `@sha256:digest` — tag мутабелен, supply-chain риск (требование `BACKLOG.md: INF-14`). L-05: `docs/ИМПОРТОЗАМЕЩЕНИЕ.md` не упоминает `pymupdf` AGPL решение. Затронуты `technozrelost-backend/pyproject.toml`, `uv.lock`, `infra/docker-compose.prod.yml`, `infra/.env.production.example`, `.gitignore`, `docs/ИМПОРТОЗАМЕЩЕНИЕ.md`, `docs/adr/`.

## Цель
`uv sync --locked` детерминирован, `docker pull` детерминирован по digest, `.gitignore` не пропускает `.graphify/cache`, доки консистентны.

## Не входит
Замена `pymupdf` кодом (Q-03 — оставляем offline, ADR). Не меняем `pg_hba.conf` (уже scram, SPEC-03).

## Функциональные требования
- `FR-01` `pyproject.toml` все `dependencies` `==` (уже) + `uv.lock` `requires-dist` все `==` и `uv sync --locked` без `--upgrade` проходит в CI (`setup-uv --locked`).
- `FR-02` `git status` чистый после `uv lock` — нет `modified: uv.lock`, untracked `.graphify/branch.json, worktree.json, needs_update, cache/` игнорируются.
- `FR-03` `docker-compose.prod.yml` `image: minio/minio:RELEASE.2025-04-22T22-12-26Z@sha256:<64hex>` и `mkodockx/docker-clamav:1.4.3-r0-alpine@sha256:<64hex>` — digest взят из `docker inspect` prod-registry.
- `FR-04` `.gitignore` содержит `.graphify/branch.json`, `worktree.json`, `needs_update`, `cache/` (per `AGENTS.md` graphify правила).
- `FR-05` `docs/ИМПОРТОЗАМЕЩЕНИЕ.md` секция “Прикладные библиотеки” упоминает `pymupdf AGPL → pypdf BSD` оценку и решение “оставить offline до Q1”.

## Нефункциональные
- Воспроизводимость: `uv.lock` commit + `docker-compose pull --quiet` idempotent.
- Безопасность: digest pinning — защита от tag hijack.

## Техническое решение
- `uv lock` (в `technozrelost-backend/`) → `git add uv.lock` → `git commit -m "chore(m2): pin lock after N-17"` → `git push origin autopilot/m0-security-hardening`.
- `docker pull minio/minio:RELEASE.2025-04-22T22-12-26Z && docker inspect --format '{{index .RepoDigests 0}}'` → вписать digest. Аналогично `clamav`.
- `.gitignore` добавить 4 строки `.graphify/...` + `docs/SOPS.md` если содержит `sops` secret (проверить, иначе не игнорить).
- `docs/ИМПОРТОЗАМЕЩЕНИЕ.md` после таблицы: “`pymupdf==1.28.0` AGPL — только `seed_gost.py` offline, замена на `pypdf` оценена, решение Q-03”.
- `infra/.env.production.example` уже `REDIS_PASSWORD` — не трогать.

## Сценарии
- **Given** чистый clone, **When** `uv sync --locked --extra dev`, **Then** success, версии как в `uv.lock` (не latest).
- **Given** `docker compose pull`, **When** re-pull через месяц, **Then** digest тот же, не latest.
- **Given** `git status`, **When** после фикса, **Then** чистый.

## Безопасность
- Нет секретов в `uv.lock`/`pyproject.toml` (проверить `grep -i password`).

## Тестирование
- CI: `uv sync --locked` (уже в `ci.yml: backend`).
- Local: `uv lock --check` (dry-run) в pre-commit.
- `test_ci_dependency_audit_is_pinned_and_runs_via_uv` уже PASS.

## Критерии приёмки
- [ ] `uv.lock` `==` все, `git status` чистый, `git log` содержит pin commit, `origin` pushed.
- [ ] `docker-compose.prod.yml` обе строки с `@sha256:`.
- [ ] `.gitignore` 4 graphify строки.
- [ ] `ИМПОРТОЗАМЕЩЕНИЕ.md` обновлён.

## DoD
FR, `ruff/mypy` не трогаем, `pytest` green, доки, нет TODO, `git push` done.
