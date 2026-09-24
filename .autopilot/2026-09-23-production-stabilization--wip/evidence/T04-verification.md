# T04 — Python/mypy toolchain diagnosis

Дата: 2026-09-24 (+04:00). Исполнитель: Codex `gpt-6-luna`/high; продуктовых правок нет.

- Канонический `uv run mypy app` → exit 2, `numpy/__init__.pyi:737`: PEP 695 `type` statement не поддержан target Python 3.11. Runtime Python 3.14.0, mypy 2.3.0, numpy 2.5.2; `pyproject.toml:75` задаёт `python_version = "3.11"`. В `uv.lock` numpy 2.4.6 назначен Python <3.12, numpy 2.5.2 — >=3.12. Это mismatch между выбранным локальным runtime и target mypy, а не доказанный дефект приложения.
- Изолированный Python 3.11.15 доступен, но `uv run --python 3.11 --locked --extra dev mypy app` во временном окружении не смог скачать `httptools==0.8.0` из-за DNS/network. Полный совместимый gate **не проверен**; CI уже выбирает Python 3.11.
- Диагностический `uv run mypy --python-version 3.12 app` прошёл numpy-stub blocker, проверил 62 исходных файла и вернул exit 1: `app/api/v1/realtime.py:109` `[no-untyped-call]` и `app/main.py:311` `[arg-type]`. Оркестратор независимо повторил ту же команду и получил те же две ошибки.
- T04 остаётся BLOCKED до доступной синхронизации зависимостей Python 3.11 и повторного канонического mypy. Найденные ошибки приложения вынесены отдельно в D03/T26 и D04/T27. Нельзя объявлять mypy GREEN по диагностическому target 3.12.
- Production, секреты, lock, CI и продуктовые файлы не затрагивались.
