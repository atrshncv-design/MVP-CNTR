"""notification_outbox: outbox for realtime delivery and task claims

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0023_notification_outbox.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0023_notification_outbox.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.notification_outbox")
