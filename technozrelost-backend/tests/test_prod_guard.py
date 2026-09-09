"""Прод-guard: в production запрещены дефолтные/пустые секреты (R05.2)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings

DEFAULT_JWT_SECRET = "change_me_super_secret_at_least_32_chars_long_for_hs256"


def test_production_rejects_default_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="jwt_secret"):
        Settings(app_env="production", jwt_secret=DEFAULT_JWT_SECRET)


def test_production_rejects_empty_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="jwt_secret"):
        Settings(app_env="production", jwt_secret="")


def test_production_accepts_real_secret() -> None:
    # Таск 01 (R03i): прод-контракт — настоящий JWT-секрет ПЛЮС REDIS_URL.
    settings = Settings(
        app_env="production",
        jwt_secret="x" * 48,
        redis_url="redis://redis:6379/0",
        postgres_password="p" * 16,
        minio_secret_key="s" * 16,
        _env_file=None,
    )
    assert settings.jwt_secret == "x" * 48


def test_dev_and_test_unaffected() -> None:
    settings = Settings(app_env="dev", jwt_secret=DEFAULT_JWT_SECRET, _env_file=None)
    assert settings.jwt_secret == DEFAULT_JWT_SECRET
