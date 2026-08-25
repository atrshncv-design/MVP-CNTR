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
    settings = Settings(
        app_env="production", jwt_secret="x" * 48, _env_file=None
    )
    assert settings.jwt_secret == "x" * 48


def test_dev_and_test_unaffected() -> None:
    settings = Settings(app_env="dev", jwt_secret=DEFAULT_JWT_SECRET, _env_file=None)
    assert settings.jwt_secret == DEFAULT_JWT_SECRET
