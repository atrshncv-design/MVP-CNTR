"""indexes_pagination: trgm GIN / GIN JSONB / Hash ogrn / B-Tree is_ai_area (P-05)

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-28

P-05: недостающие индексы горячих путей реестров НИОКТР:
- trgm GIN для ILIKE '%search%' (name, customer_name, organizations.name)
- GIN на JSONB nioktr_types (contains)
- Hash на organizations.ogrn (точный поиск)
- B-Tree на nioktr_cards.is_ai_area (флаговый фильтр)
Образец — 0027_performance_indexes.py/sql: IF NOT EXISTS + обратимый downgrade.

Связанные P-06..08 (пагинация) живут в коде API, но миграция 0028
фиксирует точку ветвления схемы для них.

"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"

_INDEXES = (
    ("ix_nioktr_cards_name_trgm", "nioktr_cards"),
    ("ix_nioktr_cards_customer_name_trgm", "nioktr_cards"),
    ("ix_organizations_name_trgm", "organizations"),
    ("ix_nioktr_cards_nioktr_types", "nioktr_cards"),
    ("ix_organizations_ogrn_hash", "organizations"),
    ("ix_nioktr_cards_is_ai_area_btree", "nioktr_cards"),
)


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0028_indexes_pagination.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) VALUES ('0028_indexes_pagination.sql')"
    )


def downgrade() -> None:
    for index_name, table_name in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS public.{index_name}")
