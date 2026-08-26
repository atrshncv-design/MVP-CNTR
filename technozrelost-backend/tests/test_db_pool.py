"""Размер пула соединений БД: из настроек и под контролем guard-формулы (P-01).

История: таск 06 поднял дефолты ради 200 параллельных пользователей одного
воркера. Прогон m0-security-hardening (R14) сменил контракт: прод — две
реплики приложения, и сумма их пулов вместе с резервом обязана умещаться
в max_connections=100 PostgreSQL.
"""

from __future__ import annotations

from app.core.database import pool_options


def test_pool_options_use_settings(monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "db_pool_size", 7)
    monkeypatch.setattr(settings, "db_max_overflow", 13)
    opts = pool_options()
    assert opts == {"pool_size": 7, "max_overflow": 13}


def test_pool_budget_fits_postgres_max_connections() -> None:
    """Guard-формула (R14): пулы всех процессов + резерв строго меньше лимита БД.

    Валится при любом рассинхроне цифр — изменённый дефолт пула, число реплик
    или max_connections без согласования остальных красит тест.
    """
    from app.core.config import settings

    used = settings.db_app_replicas * (settings.db_pool_size + settings.db_max_overflow)
    assert used + settings.db_connections_reserve < settings.db_max_connections
