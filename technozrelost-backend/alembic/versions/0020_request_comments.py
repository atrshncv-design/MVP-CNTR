"""request_comments: comments on promotion requests

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-05
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0020_request_comments.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0020_request_comments.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.request_comments")
