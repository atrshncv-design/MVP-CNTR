"""Таск 06: размер пула соединений БД как настройка.

Дефолт SQLAlchemy (pool_size=5, max_overflow=10) при одном uvicorn-воркере
на контейнер ставит 200 параллельных запросов в очередь checkout'а
(равномерные +1.5 с на всех эндпоинтах в нагрузочном прогоне).
"""

from __future__ import annotations

from app.core.database import pool_options


def test_pool_options_use_settings(monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "db_pool_size", 7)
    monkeypatch.setattr(settings, "db_max_overflow", 13)
    opts = pool_options()
    assert opts == {"pool_size": 7, "max_overflow": 13}


def test_pool_options_defaults_allow_target_concurrency() -> None:
    opts = pool_options()
    # 200 одновременных пользователей профиля README-LOADTEST должны
    # помещаться в пул без многосекундной очереди.
    assert opts["pool_size"] + opts["max_overflow"] >= 50
