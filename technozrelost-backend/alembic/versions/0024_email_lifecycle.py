"""email_lifecycle: подтверждение email и lifecycle аккаунта (тикет 01)

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-10
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0024_email_lifecycle.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0024_email_lifecycle.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.email_outbox")
    op.execute("DROP INDEX IF EXISTS public.users_email_verification_token_hash_hidx")
    op.execute("DROP INDEX IF EXISTS public.users_password_reset_token_hash_hidx")
    op.execute("DROP INDEX IF EXISTS public.users_email_verification_expires_bidx")
    op.execute("DROP INDEX IF EXISTS public.users_password_reset_expires_bidx")
    op.execute("ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS email_verified_at")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS email_verification_token_hash")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS email_verification_token_expires_at")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS password_reset_token_hash")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS password_reset_token_expires_at")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS login_attempts")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS locked_until")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS status")
