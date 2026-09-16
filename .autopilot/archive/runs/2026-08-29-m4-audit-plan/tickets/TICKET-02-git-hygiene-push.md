# TICKET-02: Git hygiene + push (M-05)

- **Спека:** SPEC-01
- **Проблемы:** M-05 (`git status` dirty 27M+12?? не запушен, push-контракт `AGENTS.md:6`)
- **Приоритет:** P0
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** TICKET-01,03 (чтобы запушить вместе)
- **Можно параллельно с:** — (финал P0)

## Проблема
`git status --porcelain` `27 M + 12 ??` после M3 (`.autopilot/`, `docs/adr/0014..16`, `alembic/versions/0032`, `uv.lock`, `reports/*.json`, `.graphify/`) — не запушено в `origin autopilot/m0-security-hardening`. `git log --oneline -15` последний `c3c941e` M2, M3 не в remote. `deploy.sh rollback previous` без коммита невозможен.

## Требуемый результат
`git status --porcelain` 0, `git log -1` содержит `feat(m4)` или `chore(m4)`, `git push origin autopilot/m0-security-hardening` без error, `git diff origin/…` 0.

## Объём работ
- `git add .autopilot/ docs/remediation-m4/ docs/adr/0014* docs/adr/0015* docs/adr/0016* technozrelost-backend/alembic/versions/0032* technozrelost-backend/db/migrations/sql/0031* technozrelost-backend/db/migrations/sql/0032* technozrelost-backend/uv.lock technozrelost-frontend/next.config.ts technozrelost-frontend/src/middleware.ts` (или `git add -A` после `git status` проверки).
- `git commit -m "feat(m4): audit remediation 14 findings 6 specs 14 tickets"`.
- `git push origin autopilot/m0-security-hardening` (ветка текущая).
- Проверить `git status --porcelain` пустой и `git diff --stat HEAD` 0.

## Не входит
Code fix beyond hygiene (они уже в TICKET-01..), `reports/*.json` не коммитить как code (только `pitr-*.txt` per `.gitignore`).

## Компоненты
- Файлы: все M3 dirty + M4 specs/tickets
- Remote: `origin` `https://github.com/atrshncv-design/MVP-CNTR.git`

## План
1. `git status --porcelain` → 27M.
2. `git add` список TICKET-01.. + `docs/remediation-m4/`.
3. `git commit -m …`.
4. `git push origin autopilot/m0-security-hardening`.
5. `git status` 0.

## Пограничные случаи
- `.graphify/` не коммитить глубоко — только `graph.json` portable, `branch.json` игнор (уже в `.gitignore`).
- `reports/*.json` игнор per TICKET-13 — не `add` их как code.

## Тесты
- Нет, только `git status` и `git log`.

## Критерии приёмки
- [ ] `git status --porcelain` 0.
- [ ] `git log -1 --oneline` содержит `feat(m4)`.
- [ ] `git push` без error, `git diff origin/autopilot/m0-security-hardening..HEAD` 0.

## Команды проверки
- `git status --porcelain`
- `git log --oneline -3`
- `git push origin autopilot/m0-security-hardening --dry-run`

## Риски
- Конфликт push если remote ahead — `git pull --rebase` перед push.
