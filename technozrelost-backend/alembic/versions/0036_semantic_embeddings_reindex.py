"""semantic embeddings reindex marker (таск 12, R05i история 14)

Revision ID: 0036
Revises: 0033 (branch: параллельно с 0034 task-14)
Create Date: 2026-09-08

Модель semantic-ru-v2 (офлайн, без внешних API): размерность 1536
сохранена — индекс pgvector согласован, пересоздание не требуется.
Векторы пересчитываются идемпотентным скриптом
scripts/reindex_rag_embeddings.py. Миграция фиксирует модель в COMMENT
и гарантирует частичные ivfflat-индексы (IF NOT EXISTS). Обратима:
downgrade возвращает прежний комментарий и запись журнала.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0036_semantic"
down_revision = "0033"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0036_semantic_embeddings_reindex.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) "
        "VALUES ('0036_semantic_embeddings_reindex.sql')"
    )


def downgrade() -> None:
    op.execute(
        "COMMENT ON COLUMN public.rag_documents.embedding IS "
        "'Вектор эмбеддинга (pgvector, dim=1536).'"
    )
    op.execute(
        "DELETE FROM public.db_migration_log "
        "WHERE filename = '0036_semantic_embeddings_reindex.sql'"
    )
