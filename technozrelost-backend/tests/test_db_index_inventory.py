"""DB-03: статическая сверка канонического инвентаря индексов.

Проверка намеренно не подключается к PostgreSQL и не выполняет DDL: она
сопоставляет поддерживаемый документ с ORM metadata и исходными SQL-миграциями.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from app.db.models import Base

BACKEND_ROOT = Path(__file__).resolve().parents[1]
SQL_ROOT = BACKEND_ROOT / "db" / "migrations" / "sql"
INVENTORY_PATH = BACKEND_ROOT / "docs" / "database-indexes.md"

# Канонический набор проверяется статически, чтобы исчезновение ORM-декларации
# не могло одновременно исчезнуть и из теста, и из инвентаря.
ORM_INDEX_SOURCES: dict[str, tuple[str, str, str, str]] = {
    "ix_projects_public_registry": (
        "projects",
        "app/db/models.py",
        "btree",
        "is_public",
    ),
    "ix_projects_category": ("projects", "app/db/models.py", "btree", ""),
    "ix_project_members_user_id": (
        "project_members",
        "app/db/models.py",
        "btree",
        "",
    ),
    "ix_organizations_ogrn_hash": (
        "organizations",
        "app/db/models.py",
        "hash",
        "",
    ),
    "ix_organizations_name_trgm": (
        "organizations",
        "app/db/models.py",
        "gin",
        "",
    ),
    "ix_nioktr_cards_created_date": (
        "nioktr_cards",
        "app/db/models.py",
        "btree",
        "",
    ),
    "ix_nioktr_cards_organization_id": (
        "nioktr_cards",
        "app/db/models.py",
        "btree",
        "",
    ),
    "ix_nioktr_cards_name_trgm": (
        "nioktr_cards",
        "app/db/models.py",
        "gin",
        "",
    ),
    "ix_nioktr_cards_customer_name_trgm": (
        "nioktr_cards",
        "app/db/models.py",
        "gin",
        "",
    ),
    "ix_nioktr_cards_nioktr_types": (
        "nioktr_cards",
        "app/db/models.py",
        "gin",
        "",
    ),
    "ix_nioktr_cards_is_ai_area_btree": (
        "nioktr_cards",
        "app/db/models.py",
        "btree",
        "",
    ),
    "ix_news_posts_status_published": (
        "news_posts",
        "app/db/models.py",
        "btree",
        "",
    ),
    "ix_user_achievements_user_id_hash": (
        "user_achievements",
        "app/db/models.py",
        "hash",
        "",
    ),
    "ix_user_achievements_achievement_id_hash": (
        "user_achievements",
        "app/db/models.py",
        "hash",
        "",
    ),
    "ix_user_achievements_project_id_hash": (
        "user_achievements",
        "app/db/models.py",
        "hash",
        "",
    ),
    "ix_project_achievements_project_id_hash": (
        "project_achievements",
        "app/db/models.py",
        "hash",
        "",
    ),
    "ix_project_achievements_achievement_id_hash": (
        "project_achievements",
        "app/db/models.py",
        "hash",
        "",
    ),
}

# Граница миграционного контура — перечень покрытых SQL-источников. Список
# индексов из него не задаётся вручную: он извлекается из CREATE INDEX ниже.
MIGRATION_SOURCE_NAMES = (
    "0002_rag_documents.sql",
    "0027_performance_indexes.sql",
    "0028_indexes_pagination.sql",
    "0029_rag_contour.sql",
    "0031_perf_p14_created_date.sql",
    "0036_semantic_embeddings_reindex.sql",
)
MIGRATION_SOURCES = tuple(SQL_ROOT / source for source in MIGRATION_SOURCE_NAMES)

PARTIAL_IVFFLAT = {
    "rag_documents_embedding_tuno_ivfflat": "tuno",
    "rag_documents_embedding_kaba_ivfflat": "kaba",
}

_INDEX_RE = re.compile(
    r"CREATE\s+(?P<unique>UNIQUE\s+)?INDEX\s+"
    r"(?:IF\s+NOT\s+EXISTS\s+)?(?P<name>[A-Za-z_][\w$]*)\s+"
    r"(?P<body>.*?);",
    re.IGNORECASE | re.DOTALL,
)
_COMMENT_RE = re.compile(r"--[^\n]*|/\*.*?\*/", re.DOTALL)
_INVENTORY_INDEX_RE = re.compile(
    r"^\| `(?P<name>[A-Za-z_][\w$]*)` \|",
    re.MULTILINE,
)
_MIGRATION_SOURCE_RE = re.compile(r"db/migrations/sql/[A-Za-z0-9_]+\.sql")


@dataclass(frozen=True)
class DiscoveredIndex:
    table: str
    method: str
    where: str
    sources: tuple[str, ...]


def _inventory() -> str:
    assert INVENTORY_PATH.is_file(), f"нет инвентаря индексов: {INVENTORY_PATH}"
    return INVENTORY_PATH.read_text(encoding="utf-8")


def _inventory_rows(inventory: str) -> dict[str, tuple[str, ...]]:
    rows: dict[str, tuple[str, ...]] = {}
    for line in inventory.splitlines():
        match = _INVENTORY_INDEX_RE.match(line)
        if match is None:
            continue
        fields = tuple(part.strip() for part in line.strip().strip("|").split("|"))
        assert len(fields) == 6, f"неожиданная строка инвентаря: {line}"
        index_name = match.group("name")
        assert index_name not in rows, f"повторная строка инвентаря для {index_name}"
        rows[index_name] = fields
    return rows


def _row(inventory: str, index_name: str) -> tuple[str, ...]:
    rows = _inventory_rows(inventory)
    assert index_name in rows, f"нет строки инвентаря для {index_name}"
    return rows[index_name]


def _metadata_indexes() -> dict[str, tuple[str, str, str]]:
    indexes: dict[str, tuple[str, str, str]] = {}
    for table in Base.metadata.sorted_tables:
        for index in table.indexes:
            assert index.name is not None
            using = index.dialect_options["postgresql"].get("using") or "btree"
            where = index.dialect_options["postgresql"].get("where")
            indexes[index.name] = (
                table.name,
                str(using).lower(),
                str(where) if where is not None else "",
            )
    return indexes


def _sql_without_comments(path: Path) -> str:
    return _COMMENT_RE.sub("", path.read_text(encoding="utf-8"))


def _migration_details(statement: re.Match[str]) -> tuple[str, str, str]:
    body = statement.group("body").strip()
    table_match = re.search(
        r"\bON\s+(?:public\.)?(?P<table>[A-Za-z_][\w$]*)",
        body,
        re.IGNORECASE,
    )
    assert table_match is not None, "не удалось определить таблицу в CREATE INDEX"
    using_match = re.search(r"\bUSING\s+(?P<method>\w+)\b", body, re.IGNORECASE)
    method = using_match.group("method").lower() if using_match else "btree"
    where_match = re.search(r"\bWHERE\s+(?P<condition>.+)\Z", body, re.IGNORECASE | re.DOTALL)
    where = " ".join(where_match.group("condition").split()) if where_match else ""
    return table_match.group("table").lower(), method, where


def _discover_migration_indexes() -> dict[str, DiscoveredIndex]:
    discovered: dict[str, DiscoveredIndex] = {}
    for path in MIGRATION_SOURCES:
        assert path.is_file(), f"не найден покрытый SQL-источник: {path}"
        source = path.relative_to(BACKEND_ROOT).as_posix()
        sql = _sql_without_comments(path)
        for statement in _INDEX_RE.finditer(sql):
            index_name = statement.group("name")
            table, method, where = _migration_details(statement)
            previous = discovered.get(index_name)
            if previous is None:
                discovered[index_name] = DiscoveredIndex(
                    table=table,
                    method=method,
                    where=where,
                    sources=(source,),
                )
                continue
            assert previous.table == table, f"разные таблицы для {index_name}"
            assert previous.method == method, f"разные методы для {index_name}"
            assert previous.where == where, f"разные условия для {index_name}"
            assert source not in previous.sources, f"повтор CREATE INDEX в {source}: {index_name}"
            discovered[index_name] = DiscoveredIndex(
                table=previous.table,
                method=previous.method,
                where=previous.where,
                sources=previous.sources + (source,),
            )
    return discovered


def _assert_row_details(
    row: tuple[str, ...],
    *,
    table: str,
    method: str,
    where: str,
) -> None:
    assert row[1] == f"`{table}`", f"неверная таблица в строке {row[0]}"
    assert row[3] == f"`{method}`", f"неверный метод в строке {row[0]}"
    expected_where = f"`WHERE {where}`" if where else "—"
    assert row[4] == expected_where, f"неверное условие в строке {row[0]}"


def test_inventory_covers_orm_metadata_indexes() -> None:
    """Каждый явный Base.metadata.index должен иметь строку и ORM source."""
    metadata_indexes = _metadata_indexes()
    migration_indexes = _discover_migration_indexes()
    assert set(metadata_indexes) == set(ORM_INDEX_SOURCES)
    inventory = _inventory()
    documented_indexes = set(_inventory_rows(inventory))
    assert documented_indexes == set(ORM_INDEX_SOURCES) | set(migration_indexes)
    for index_name, (table_name, source, method, where) in ORM_INDEX_SOURCES.items():
        assert metadata_indexes[index_name] == (table_name, method, where)
        row = _row(inventory, index_name)
        _assert_row_details(row, table=table_name, method=method, where=where)
        assert source in row[5]


def test_inventory_covers_named_migration_indexes() -> None:
    """Каждый именованный CREATE INDEX покрытого SQL-источника есть в инвентаре."""
    inventory = _inventory()
    discovered = _discover_migration_indexes()
    for index_name, details in discovered.items():
        row = _row(inventory, index_name)
        _assert_row_details(
            row,
            table=details.table,
            method=details.method,
            where=details.where,
        )
        assert set(_MIGRATION_SOURCE_RE.findall(row[5])) == set(details.sources)


def test_inventory_keeps_partial_ivfflat_conditions() -> None:
    """Оба contour-specific ivfflat индекса обязаны оставаться в обоих DDL-источниках."""
    inventory = _inventory()
    discovered = _discover_migration_indexes()
    expected_sources = {
        "db/migrations/sql/0029_rag_contour.sql",
        "db/migrations/sql/0036_semantic_embeddings_reindex.sql",
    }
    for index_name, contour in PARTIAL_IVFFLAT.items():
        assert index_name in discovered
        details = discovered[index_name]
        assert details.table == "rag_documents"
        assert details.method == "ivfflat"
        assert details.where == f"contour = '{contour}'"
        assert set(details.sources) == expected_sources
        row = _row(inventory, index_name)
        _assert_row_details(
            row,
            table=details.table,
            method=details.method,
            where=details.where,
        )
        assert set(_MIGRATION_SOURCE_RE.findall(row[5])) == expected_sources


def test_inventory_is_static_source_check() -> None:
    """Регрессия не должна превращаться в скрытый DDL/DB probe."""
    source = Path(__file__).read_text(encoding="utf-8")
    assert "op." + "execute" not in source
    assert "create_" + "engine" not in source
    assert "psy" + "copg" not in source
    assert "async" + "pg" not in source
