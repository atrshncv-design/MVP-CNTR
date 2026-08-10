# 04 — Проверка чистого клона

**What to build:** Воспроизводимый clean-clone gate, доказывающий, что новый агент не зависит от локального мусора и выбирает правильное приложение.

**Blocked by:** 03 — Удаление подтверждённого мусора и усиление ignore.

**Status:** ready-for-review

- [ ] В новом временном клоне выполняются документированные setup, lint, typecheck, tests и builds.
- [ ] Не требуются незафиксированные файлы или значения секретов.
- [ ] Secret scan и repository hygiene checks включены в CI.
- [ ] Отчёт фиксирует commit и команды воспроизведения.

## Comments

### Acceptance notes (по ревью оркестратора, 10.08.2026)

- Добавлен и сохранён `.github/workflows/repo-hygiene.yml` (check-ignore матрица, tracked secret-like files, secret scan с маскированным выводом, generated artifacts).
- Ad-hoc верификация workflow — **12/12 PASS** (YAML + все 4 шага read-only; временный скрипт `hermes-verify-*` создан в OS-темп-каталоге, выполнен и удалён).
- Реальный запуск GitHub Actions возможен ТОЛЬКО после push ветки — push в этом запуске запрещён, прогон за оркестратором.
- Backend БД-зависимые проверки (alembic / pytest / health) — **BLOCKED** (docker daemon не запущен, connection refused), НЕ маскировались под PASS; команды воспроизведения — в `clean-clone-report.md` (таблица BLOCKED).
