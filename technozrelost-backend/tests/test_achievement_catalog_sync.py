"""Дрейф каталога медалей: два носителя — seed_achievents.py и 0025_*.sql.

Оба источника парсятся статически (ast / regex), без выполнения кода и
без БД: тест ловит молчаливый разъезд числа или slug'ов между python-seed
и SQL-миграцией. Эталон (66 медалей, границы каталога ugt-1…s-legend)
взят из спеки §4.2 / catalog-66.md, а не из кода под тестом.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
SEED_PY = BACKEND_ROOT / "app" / "db" / "seed_achievements.py"
SEED_SQL = BACKEND_ROOT / "db" / "migrations" / "sql" / "0025_achievements.sql"

# Внешний эталон из catalog-66.md (спека §4.2), не из кода.
EXPECTED_COUNT = 66
FIRST_SLUG = "ugt-1"
LAST_SLUG = "s-legend"


def _python_slugs() -> list[str]:
    """Slug'и _CATALOG из seed_achievements.py через ast.literal_eval."""
    tree = ast.parse(SEED_PY.read_text(encoding="utf-8"), filename=str(SEED_PY))
    for node in tree.body:
        target = getattr(node, "target", None)
        targets = getattr(node, "targets", [])
        names = [target] if isinstance(target, ast.Name) else [
            t for t in targets if isinstance(t, ast.Name)
        ]
        # _CATALOG объявлен с аннотацией типа → AnnAssign; покрываем и Assign.
        node_value = getattr(node, "value", None)
        if node_value is not None and any(t.id == "_CATALOG" for t in names):
            rows = ast.literal_eval(node_value)
            return [row[0] for row in rows]
    raise AssertionError("_CATALOG не найден в seed_achievements.py")


def _sql_slugs() -> list[str]:
    """Slug'и из VALUES-строк INSERT в 0025_achievements.sql (regex)."""
    text = SEED_SQL.read_text(encoding="utf-8")
    block = text.split("VALUES", 1)[1].split("ON CONFLICT", 1)[0]
    # Строка строки: ('slug', ... , 'icon_key') — slug всегда первым токеном.
    rows = re.findall(r"^\s*\('([^']+)'", block, flags=re.MULTILINE)
    if not rows:
        raise AssertionError("INSERT-строки каталога не найдены в 0025_achievements.sql")
    return rows


def test_catalog_sources_have_spec_count_and_boundaries() -> None:
    """Каждый носитель по отдельности содержит эталонные 66 медалей."""
    py_slugs = _python_slugs()
    sql_slugs = _sql_slugs()
    assert len(py_slugs) == EXPECTED_COUNT, f"seed_achievements.py: {len(py_slugs)} ≠ 66"
    assert len(sql_slugs) == EXPECTED_COUNT, f"0025_achievements.sql: {len(sql_slugs)} ≠ 66"
    assert py_slugs[0] == FIRST_SLUG and py_slugs[-1] == LAST_SLUG
    assert sql_slugs[0] == FIRST_SLUG and sql_slugs[-1] == LAST_SLUG


def test_python_and_sql_slug_lists_are_identical() -> None:
    """Порядок и состав slug'ов совпадают между носителями (и slug=icon_key в SQL)."""
    py_slugs = _python_slugs()
    sql_slugs = _sql_slugs()
    only_py = set(py_slugs) - set(sql_slugs)
    only_sql = set(sql_slugs) - set(py_slugs)
    assert not only_py and not only_sql, (
        f"Каталог разъехалcя: только в python {sorted(only_py)}, "
        f"только в sql {sorted(only_sql)}"
    )
    assert py_slugs == sql_slugs, "Порядок sort_order различается между носителями"
