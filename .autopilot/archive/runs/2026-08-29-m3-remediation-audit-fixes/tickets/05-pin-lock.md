# TICKET-05: Pin uv.lock и hygiene (H-03, L-05)

- **Спека:** SPEC-04
- **Проблемы:** H-03 (dirty `uv.lock`), L-05 (`ИМПОРТОЗАМЕЩЕНИЕ.md`)
- **Приоритет:** P0
- **Критичность:** High
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-01..04

## Проблема
`git status` `modified: technozrelost-backend/uv.lock` после `pyproject.toml` pin `==` — `HEAD` lock с `>=` → `uv sync --locked` на CI собирает другой граф, нарушает `AGENTS.md:6` push-контракт. `docs/ИМПОРТОЗАМЕЩЕНИЕ.md` не упоминает `pymupdf` AGPL.

## Требуемый результат
`uv.lock` все `==`, `git status` чистый, `origin` pushed, `ИМПОРТОЗАМЕЩЕНИЕ.md` обновлён, `.gitignore` graphify.

## Объём работ
- `technozrelost-backend/uv lock` (или `uv sync`) → `git add uv.lock` → `git commit -m "chore(m2): pin lock after N-17"` → `git push origin autopilot/m0-security-hardening`.
- `grep -c "@sha256" docker-compose.prod.yml` — не здесь, но `uv.lock` pin.
- `docs/ИМПОРТОЗАМЕЩЕНИЕ.md` после таблицы добавить: “`pymupdf==1.28.0` AGPL — только `seed_gost.py` offline, replacement `pypdf` BSD evaluated, decision Q-03 keep until Q1”.
- `.gitignore` проверить ` .graphify/branch.json` etc. — если нет, добавить (из `AGENTS.md` graphify правила).

## Не входит
Digest pinning (TICKET-08).

## Компоненты
- Файлы: `technozrelost-backend/uv.lock`, `docs/ИМПОРТОЗАМЕЩЕНИЕ.md`, `.gitignore`

## План
1. `cd technozrelost-backend && uv lock`.
2. `git diff HEAD -- uv.lock | head`.
3. `git add uv.lock docs/ИМПОРТОЗАМЕЩЕНИЕ.md .gitignore`.
4. `git commit`.
5. `git push origin autopilot/m0-security-hardening`.

## Пограничные случаи
- `uv lock` меняет `metadata` `requires-dist` — проверить `==` все.
- `.gitignore` уже содержит `.graphify/`? Проверить — добавить только `branch.json` etc. если нет.

## Тесты
- `uv sync --locked --extra dev` success (CI).
- `test_ci_dependency_audit_is_pinned_and_runs_via_uv` PASS.

## Критерии приёмки
- [ ] `git status` чистый.
- [ ] `grep "specifier = \"==" uv.lock` == все.
- [ ] `origin` pushed (`git log --branches --not --remotes` пусто).
- [ ] `ИМПОРТОЗАМЕЩЕНИЕ.md` содержит `pymupdf`.

## Команды проверки
- `git status`
- `uv sync --locked --extra dev && echo ok`
- `.venv/bin/pytest tests/test_infra_contracts.py -k test_ci_dependency_audit -q`

## Риски
- `uv lock` без `--upgrade` может оставить старые `pymupdf` 1.28.0 — ок, pinned.
- `.gitignore` изменение не требует `git rm --cached` если файлы не tracked.
