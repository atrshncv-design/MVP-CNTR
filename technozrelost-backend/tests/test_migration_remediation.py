"""TICKET-06 (M-01) закалка миграции 0031 — грязные даты → NULL."""

from __future__ import annotations

import os
from pathlib import Path

import psycopg
from fastapi.testclient import TestClient


def test_migration_0031_handles_garbage_date(client: TestClient) -> None:  # noqa: ARG001
    """0031 не падает на '', 'bad', 'неизвестно', '2024-02-30', '2024-13-01'."""
    from alembic import command
    from alembic.config import Config

    backend_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_root / "alembic"))

    dsn = {
        "host": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "port": int(os.environ.get("POSTGRES_PORT", "5432")),
        "user": os.environ.get("POSTGRES_USER", "technoz"),
        "password": os.environ.get("POSTGRES_PASSWORD", "change_me"),
        "dbname": os.environ.get("POSTGRES_DB", "technozrelost_test"),
        "autocommit": True,
    }

    # Downgrade до 0030 чтобы created_date снова VARCHAR
    command.downgrade(cfg, "0030")

    conn = psycopg.connect(**dsn)
    try:
        # чистим старые тестовые записи
        conn.execute("DELETE FROM public.nioktr_cards WHERE registration_number LIKE 'TEST-GARBAGE-%'")
        cases = [
            ("TEST-GARBAGE-EMPTY", ""),
            ("TEST-GARBAGE-BAD", "bad"),
            ("TEST-GARBAGE-CYR", "неизвестно"),
            ("TEST-GARBAGE-0230", "2024-02-30"),
            ("TEST-GARBAGE-1301", "2024-13-01"),
        ]
        for reg, val in cases:
            conn.execute(
                "INSERT INTO public.nioktr_cards (registration_number, name, created_date) VALUES (%s,%s,%s)",
                (reg, f"Garbage {reg}", val),
            )
        conn.execute(
            "INSERT INTO public.nioktr_cards (registration_number, name, created_date) VALUES (%s,%s,%s)",
            ("TEST-GARBAGE-VALID", "Valid", "2024-01-02"),
        )
        conn.execute(
            "INSERT INTO public.nioktr_cards (registration_number, name, created_date) VALUES (%s,%s,%s)",
            ("TEST-GARBAGE-VALID2", "Valid2", "2023-12-31"),
        )
    finally:
        conn.close()

    # upgrade должен не бросить
    try:
        command.upgrade(cfg, "head")
    except Exception as exc:  # noqa: BLE001
        # гарантируем возврат к head даже при падении для следующих тестов
        try:
            command.upgrade(cfg, "head")
        except Exception:
            pass
        raise AssertionError(f"alembic upgrade head упал на грязных данных: {exc}") from exc

    # проверяем результаты
    conn = psycopg.connect(**dsn)
    try:
        rows = {
            r[0]: r[1]
            for r in conn.execute(
                "SELECT registration_number, created_date FROM public.nioktr_cards WHERE registration_number LIKE 'TEST-GARBAGE-%'"
            ).fetchall()
        }
        # грязные → NULL
        for reg in ["TEST-GARBAGE-EMPTY", "TEST-GARBAGE-BAD", "TEST-GARBAGE-CYR", "TEST-GARBAGE-0230", "TEST-GARBAGE-1301"]:
            assert rows[reg] is None, f"{reg} должен стать NULL, получил {rows[reg]!r}"
        # валидные → DATE
        assert str(rows["TEST-GARBAGE-VALID"]) == "2024-01-02", rows["TEST-GARBAGE-VALID"]
        assert str(rows["TEST-GARBAGE-VALID2"]) == "2023-12-31"
        # идемпотентность: повторный upgrade не падает
        command.upgrade(cfg, "head")
        # downgrade → upgrade цикл не падает
        command.downgrade(cfg, "0030")
        command.upgrade(cfg, "head")
    finally:
        # чистим и возвращаем head
        try:
            conn.execute("DELETE FROM public.nioktr_cards WHERE registration_number LIKE 'TEST-GARBAGE-%'")
        except Exception:
            pass
        conn.close()
        try:
            command.upgrade(cfg, "head")
        except Exception:
            pass
