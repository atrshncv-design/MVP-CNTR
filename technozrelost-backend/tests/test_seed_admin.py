from __future__ import annotations

import pytest

from app.db.seed_admin import admin_credentials


def test_admin_credentials_require_explicit_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TEST_ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("TEST_ADMIN_PASSWORD", raising=False)

    with pytest.raises(SystemExit, match="required"):
        admin_credentials()


def test_admin_credentials_normalize_email_and_reject_short_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TEST_ADMIN_EMAIL", " Admin@MVP.Local ")
    monkeypatch.setenv("TEST_ADMIN_PASSWORD", "short")

    with pytest.raises(SystemExit, match="12\\+"):
        admin_credentials()

    monkeypatch.setenv("TEST_ADMIN_PASSWORD", "valid-local-password")
    assert admin_credentials() == ("admin@mvp.local", "valid-local-password")
