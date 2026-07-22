"""projects, questionnaire_results, project_members, control_points, project_documents, audit_trail

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-21 14:00:00
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0004_projects_and_questionnaire.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) "
        "VALUES ('0004_projects_and_questionnaire.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.audit_trail")
    op.execute("DROP TABLE IF EXISTS public.project_documents")
    op.execute("DROP TABLE IF EXISTS public.control_points")
    op.execute("DROP TABLE IF EXISTS public.project_members")
    op.execute("DROP TABLE IF EXISTS public.questionnaire_results")
    op.execute("DROP TABLE IF EXISTS public.projects")
