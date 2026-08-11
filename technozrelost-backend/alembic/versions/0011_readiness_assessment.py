"""readiness_assessment: versioned 22-checkpoint assessment model

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-04
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0011_readiness_assessment.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0011_readiness_assessment.sql')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.assessment_answers")
    op.execute("DROP TABLE IF EXISTS public.project_assessments")
    op.execute("DROP TABLE IF EXISTS public.assessment_checkpoints")
    op.execute("DROP TABLE IF EXISTS public.assessment_templates")
