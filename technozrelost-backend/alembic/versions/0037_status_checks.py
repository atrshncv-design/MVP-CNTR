"""status_checks: CHECK жизненных циклов проекта/документа/заявки/КТ (P2, таск 14)

Revision ID: 0037
Revises: 0036_semantic
Create Date: 2026-09-08

Решение §9 спеки: свободные строки статусов и полные выборки гниют тихо.
CHECK в БД отклоняет невалидный статус независимо от кода; наборы — из
кода API плюс legacy 'review' в данных (код его не создаёт, но данные есть).
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0037"
down_revision = "0036_semantic"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0037_status_checks.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) "
        "VALUES ('0037_status_checks.sql')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check")
    op.execute(
        "ALTER TABLE public.project_documents DROP CONSTRAINT IF EXISTS "
        "project_documents_status_check"
    )
    op.execute(
        "ALTER TABLE public.promotion_requests DROP CONSTRAINT IF EXISTS "
        "promotion_requests_status_check"
    )
    op.execute(
        "ALTER TABLE public.control_points DROP CONSTRAINT IF EXISTS "
        "control_points_status_check"
    )
    op.execute(
        "DELETE FROM public.db_migration_log WHERE filename = '0037_status_checks.sql'"
    )
