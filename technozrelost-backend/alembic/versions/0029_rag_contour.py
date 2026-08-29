"""rag_contour: contour tuno/kaba + two partial ivfflat WHERE (R22, интервью 04)

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-28

R22: Туно vs Каба — один столбец contour TEXT CHECK(tuno,kaba) DEFAULT 'tuno'
и два частичных ivfflat-индекса WHERE contour = ... (изолируют поиск
реестров vs ГОСТ, rag.py:26 контур-фильтр в SQL_SEARCH_KNN). Backfill
старых строк → 'tuno' для обратной совместимости. Обратима: downgrade
дропает индексы и столбец. Образец — 0028_indexes_pagination.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"

_INDEXES = (
    ("rag_documents_embedding_tuno_ivfflat", "rag_documents"),
    ("rag_documents_embedding_kaba_ivfflat", "rag_documents"),
)


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0029_rag_contour.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0029_rag_contour.sql')"
    )


def downgrade() -> None:
    for index_name, _table in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS public.{index_name}")
    op.execute("ALTER TABLE public.rag_documents DROP CONSTRAINT IF EXISTS rag_documents_contour_check")
    op.execute("ALTER TABLE public.rag_documents DROP COLUMN IF EXISTS contour")
