# T22 — проверка контракта тестовых mocks

Дата: 2026-09-24. Commit `14eca1d` в `autopilot/production-stabilization`.

- RED до исправления: полный backend suite — 705 passed, 15 failed, 1 warning; четыре `_fake_ok_llm` не принимали `session_id` из `stages.py` (см. `T02-verification.md`).
- Исполнитель Codex `gpt-6-luna`/high изменил только четыре разрешённых test-файла: `test_achievements.py`, `test_achievements_t06.py`, `test_full_ugt_journey.py`, `test_requirement_sets.py`. В каждом добавлен keyword-only `session_id: str`; продуктовый код и assertions не менялись.
- Сфокусированный GREEN у исполнителя: 28 passed. Ruff на изменённых файлах — exit 0.
- Независимый полный GREEN оркестратора: `uv run pytest -q` → exit 0, 720 passed, 1 warning, 560.65s. Полный Ruff → exit 0.
- Два независимых scope/craft review: блокирующих замечаний нет. Оставшаяся warning — Starlette deprecation, не относится к T22.
- Production, секреты и lock-файлы не затрагивались.
