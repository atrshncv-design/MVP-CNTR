"""tech_requests: черновик технологического запроса заказчика

Revision ID: 0031
Revises: 0023
Create Date: 2026-08-10
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0031_tech_requests.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0031_tech_requests.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.tech_request_documents")
    op.execute("DROP TABLE IF EXISTS public.tech_requests")
