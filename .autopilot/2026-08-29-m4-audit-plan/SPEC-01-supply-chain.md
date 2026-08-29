# SPEC-01: Воспроизводимость поставки и hygiene (H-01, M-05, L-04)

## Контекст
Аудит 2026-08-29 нашёл 3 связанные проблемы supply-chain: `H-01` `infra/docker-compose.prod.yml:134` `image: mkodockx/docker-clamav:1.4.3-r0-alpine@sha256:b443cd4f…` — digest placeholder, тег отсутствует в Hub (85 тегов, макс 1.1.2, `docker manifest inspect` → `no such manifest`), `minio` уже pinned `a1ea…` но пара неполная; `M-05` `git status --porcelain` `27 M + 12 ??` после M3 (`.autopilot/2026-08-29-m4-audit-plan`, `docs/remediation-m4`, `alembic/versions/0032`, `uv.lock`, `reports/*.json`) — нарушает `AGENTS.md:6` push-контракт; `L-04` `technozrelost-backend/.gitignore` `reports/` игнорит только внутри backend, корень `reports/loadtest_report.json` остаётся untracked (контрадикция с ADR-0016 «backend reports игнор, корень stub отслеживаемый»). Затронуты `infra/docker-compose.prod.yml`, `.gitignore`, `technozrelost-backend/.gitignore`, `uv.lock`.

Текущее неправильно: `docker compose pull` на проде потянет левый слой или упадёт; `deploy.sh rollback previous` без коммита невозможен; `reports/*.json` копятся как untracked.

## Цель
`docker pull` детерминирован по digest для всех внешних образов, `git status` чистый, `origin` pushed, `reports/` артефакты хранятся только как `pitr-*.txt` в git, `loadtest/*.json` — в игноре кроме stub.

## Не входит
Смена Registry на Valkey, замена `pymupdf` (Q-03 keep until Q1), `technologies` кэш (SPEC-05), `pg` миграция (SPEC-02).

## Функциональные требования
- `FR-01` `docker-compose.prod.yml` содержит `minio:RELEASE.2025-04-22T22-12-26Z@sha256:a1ea29fa28355559ef137d71fc570e508a214ec84ff8083e39bc5428980b015e` (уже) и `clamav: clamav/clamav:1.4.3@sha256:75fb5fd95fcbe1d7e6d240c369c1572b686ee2c95949d1042b5148de8eddebb4` (oci index, amd64, verified 2026-08-29). `grep -c "@sha256" infra/docker-compose.prod.yml` ≥2, `docker pull` re-pull месяц спустя — тот же `RepoDigest`.
- `FR-02` После `git add .autopilot/ docs/remediation-m4/ docs/adr/0014..16 technozrelost-backend/alembic/versions/0032* technozrelost-backend/db/migrations/sql/0032* technozrelost-backend/uv.lock && git commit -m "feat(m4): …" && git push origin autopilot/m0-security-hardening` → `git status --porcelain` пустой, `git log -1 --oneline` содержит `feat(m4)` или `chore(m4)`.
- `FR-03` `.gitignore` (корень) содержит `reports/*.json` + `!reports/pitr-rehearsal-*.txt` + `!reports/loadtest/PROC-01.json` (stub), `technozrelost-backend/.gitignore` остаётся `reports/` (игнорит). `git check-ignore -v reports/loadtest_report.json` → root `.gitignore`, `git check-ignore -v reports/pitr-rehearsal-2026-08-29.txt` → не игнор.
- `FR-04` `uv.lock` все `==`, `uv sync --locked --extra dev` success, `git diff HEAD -- uv.lock` 0 после коммита.

## Нефункциональные
- Воспроизводимость: `uv.lock` + `RepoDigest` — год спустя тот же граф.
- Безопасность: digest pinning — защита от tag hijack; `.env.production` остаётся в игноре.

## Техническое решение
- `docker pull clamav/clamav:1.4.3 && docker inspect --format '{{index .RepoDigests 0}}' clamav/clamav:1.4.3` → `sha256:75fb5fd95f…` (если Hub недоступен — взять из `docs/adr/0016` уже верифицирован, но повторить `inspect` перед коммитом). Заменить строку `image: mkodockx/docker-clamav…` на `clamav/clamav:1.4.3@sha256:75fb…` + обновить коммент `// M-04/TICKET-01: oficiální digest, mkodockx 1.4.3 absent`. `minio` не трогать.
- `.gitignore` корень: добавить после `reports/` секции 3 строки: `reports/*.json`, `!reports/pitr-rehearsal-*.txt`, `!reports/loadtest/PROC-01.json` (или `reports/loadtest/*.json` игнор кроме PROC-01 — выбрать один). Проверить `git check-ignore -v` до/после.
- `git add` список TICKET-02 + `git push origin autopilot/m0-security-hardening` (ветка текущая `autopilot/m0-security-hardening`, remote `origin` уже). Если `origin` требует `git push -u`, использовать `git push`.
- `uv.lock`: уже pinned `==`, не менять `pyproject.toml`, только `git add uv.lock` если `uv lock --check` прошёл.

## Сценарии
- **Given** чистый clone, **When** `uv sync --locked --extra dev && docker compose -f technozrelost-backend/infra/docker-compose.prod.yml pull --quiet` **Then** digest тот же, не latest.
- **Given** `git status` после фикса, **When** `git status --porcelain` **Then** 0, `git diff origin/autopilot/m0-security-hardening..HEAD --stat` содержит 14 тикетов.
- **Given** `reports/loadtest_report.json` stub, **When** `git check-ignore` **Then** игнор, `pitr-rehearsal-2026-08-29.txt` — не игнор.

## Безопасность
- Нет секретов в `uv.lock`/`pyproject.toml` (`grep -i password` 0).
- Digest pinning — supply-chain.

## Тестирование
- `tests/test_infra_contracts.py` `test_production_compose_wires_replication_and_storage_probes` обновить на `assert "@sha256:" in compose_text` ×2.
- `test_digest_pinned` — `grep -c @sha256` ≥2 и что `clamav` image содержит `clamav/clamav`.

## Критерии приёмки
- [ ] `grep @sha256` в `docker-compose.prod.yml` ≥2, `clamav` digest `75fb…` верифицирован `inspect`.
- [ ] `git status --porcelain` 0, `git log -1` содержит m4, `git push` без error.
- [ ] `git check-ignore -v reports/loadtest_report.json` → root `.gitignore`, `pitr-*.txt` не игнор.
- [ ] `uv sync --locked` PASS.

## Definition of Done
FR, тесты, доки, нет TODO (`grep TODO` 0 в `infra/`), `git push` done, `ruff/mypy` untouched, `pytest` green.
