# 22 — Контракт mocks оценки стадий (D01)

**Требование:** D01; служит R20/R21 и разблокирует T02.
**Приоритет:** немедленно после T02 baseline, до T03/T04.
**Зона:** четыре backend test-файла ниже.

## Цель

Существующие 15 проверок оценки стадий снова проходят после добавления в вызов `ask_llm` именованного `session_id`. Тесты продолжают проверять смысл ответа; их проверки нельзя удалить или ослабить.

## Доказательство RED

`evidence/T02-verification.md`: независимый `uv run pytest -q` → 705 passed, 15 failed; ошибки `TypeError: _fake_ok_llm() got an unexpected keyword argument 'session_id'` в четырёх файлах. До правки перепроверь вызов `stages.py` и все его test mocks, затем запусти один сфокусированный красный тест.

## Разрешённые файлы

- `technozrelost-backend/tests/test_achievements.py`
- `technozrelost-backend/tests/test_achievements_t06.py`
- `technozrelost-backend/tests/test_full_ugt_journey.py`
- `technozrelost-backend/tests/test_requirement_sets.py`

Не менять `app/**`, миграции, lock-файлы, production, `.autopilot/**` и другие тесты. Исполнитель не коммитит.

## Приёмка

1. Контракт `ask_llm(..., session_id=...)` подтверждён кодом и вызывающими местами.
2. Каждый из четырёх mocks принимает только необходимый новый аргумент; существующие смысловые assertions сохранены.
3. Сфокусированные тесты, ранее падавшие из-за `session_id`, проходят.
4. Ruff на изменённых тестах проходит.
5. Исполнитель возвращает короткий контракт `STATUS/FILES/TESTS/INTERFACES/REQUIREMENTS/CONCERNS/BLOCKERS`; полный backend suite повторяет оркестратор.

## Стоп

Если `session_id` должен менять поведение теста, а не только сигнатуру mock, верни `NEEDS_CONTEXT` с конкретным тестом и ожидаемым сценарием. Не делай механическое `**kwargs` во всех mocks и не маскируй падения.
