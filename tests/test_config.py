"""Конфигурация подключения к БД (тикет 18): Primary/Replica DSN.

DATABASE_URL / DATABASE_REPLICA_URL имеют приоритет над разбиением
на части POSTGRES_HOST/PORT/USER/PASSWORD/DB.
"""

from app.core.config import Settings


def test_primary_dsn_built_from_parts() -> None:
    settings = Settings(
        _env_file=None,
        postgres_user="u",
        postgres_password="p",
        postgres_host="h",
        postgres_port=5432,
        postgres_db="db",
    )
    assert settings.primary_dsn == "postgresql+asyncpg://u:p@h:5432/db"


def test_database_url_overrides_parts() -> None:
    settings = Settings(
        _env_file=None,
        postgres_host="ignored",
        database_url="postgresql+asyncpg://u:p@custom:9999/db",
    )
    assert settings.primary_dsn == "postgresql+asyncpg://u:p@custom:9999/db"


def test_replica_dsn_none_without_replica() -> None:
    settings = Settings(_env_file=None)
    assert settings.replica_dsn is None


def test_replica_dsn_built_from_parts() -> None:
    # Явные kwargs: conftest.py выставляет POSTGRES_DB=technozrelost_test и
    # POSTGRES_REPLICA_HOST="" в os.environ — они не должны влиять на тест.
    settings = Settings(
        _env_file=None,
        postgres_user="technoz",
        postgres_password="change_me",
        postgres_db="technozrelost",
        postgres_replica_host="replica",
        postgres_replica_port=5433,
    )
    assert settings.replica_dsn == "postgresql+asyncpg://technoz:change_me@replica:5433/technozrelost"


def test_database_replica_url_overrides_parts() -> None:
    settings = Settings(
        _env_file=None,
        postgres_replica_host="ignored",
        database_replica_url="postgresql+asyncpg://u:p@replica:5432/db",
    )
    assert settings.replica_dsn == "postgresql+asyncpg://u:p@replica:5432/db"
