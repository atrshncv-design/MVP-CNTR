"""Юнит-тесты чанкера ГОСТов."""

from __future__ import annotations

from collections.abc import Sequence

from app.db.seed_gost import chunk_text


def test_chunk_text_splits_long_text_into_sections() -> None:
    text = (
        "1 Область применения\n" + "Текст области применения. " * 80 + "\n\n"
        "2 Нормативные ссылки\n" + "Текст ссылок. " * 80 + "\n\n"
        "3.1 Термины\n" + "Текст терминов. " * 80
    )
    chunks = chunk_text(text)
    assert len(chunks) >= 2
    assert all(len(c) <= 3000 for c in chunks)
    assert all(len(c.strip()) >= 100 for c in chunks)


def test_chunk_text_keeps_short_text_single() -> None:
    chunks = chunk_text("5.2 Критерии УГТ\n" + "Короткий текст критериев. " * 20)
    assert len(chunks) == 1


def test_chunk_text_joins_without_losing_content() -> None:
    body = "Абзац. " * 200
    chunks = chunk_text(body)
    joined = " ".join(chunks).replace(" ", "")
    assert len(joined) > 500  # контент не потерян
    assert all(len(c) <= 3000 for c in chunks)


def test_chunk_text_filters_tiny_fragments() -> None:
    chunks = chunk_text("1 Введение\n\nКороткий текст без содержания")
    assert all(len(c.strip()) >= 100 for c in chunks)


def _gost_like_text() -> str:
    return (
        "ГОСТ Р 58048-2017 МЕТОДОЛОГИЯ ОЦЕНКИ УРОВНЯ ГОТОВНОСТИ ТЕХНОЛОГИЙ\n"
        "1 Область применения\n"
        "Настоящий стандарт устанавливает методологию оценки уровня готовности "
        "технологий в различных областях промышленности. " * 40
        + "\n\n"
        + "2 Нормативные ссылки\n"
        "В настоящем стандарте использованы ссылки на следующие документы. " * 40
        + "\n\n"
        + "3.1 Уровень готовности технологий\n"
        "УГТ 1 — сформулированы фундаментальные принципы технологии. " * 40
        + "\n\n"
        + "4 Порядок оценки\n"
        "Оценка проводится по девяти уровням готовности. " * 40
    )


def test_ingest_document_metadata(tmp_path) -> None:
    """Чанки ГОСТа: doc_type=gost, source_uri = файл#раздел (тикет 09)."""
    import asyncio

    from sqlalchemy import select

    from app.core.database import SessionLocal
    from app.db.models import RagDocument
    from app.db.seed_gost import ingest_document

    doc_file = tmp_path / "GOST-R-58048-2017.txt"
    doc_file.write_text(_gost_like_text(), encoding="utf-8")

    async def _run() -> tuple[int, Sequence[RagDocument]]:
        async with SessionLocal() as db:
            inserted = await ingest_document(db, doc_file)
            await db.commit()
            rows = (await db.execute(select(RagDocument))).scalars().all()
            return inserted, rows

    inserted, rows = asyncio.run(_run())
    assert inserted >= 2, f"ожидалось >= 2 чанка, вставлено {inserted}"
    assert len(rows) == inserted
    for doc in rows:
        assert doc.doc_type == "gost"
        assert doc.source_uri == f"GOST-R-58048-2017.txt#chunk-{doc.template_metadata['chunk']}"
        assert doc.template_metadata["file"] == "GOST-R-58048-2017.txt"
        assert doc.content_hash


def test_ingest_document_idempotent(tmp_path) -> None:
    """Повторный запуск загрузчика не дублирует чанки (тикет 09)."""
    import asyncio

    from sqlalchemy import func, select

    from app.core.database import SessionLocal
    from app.db.models import RagDocument
    from app.db.seed_gost import ingest_document

    doc_file = tmp_path / "GOST-R-58048-2017.txt"
    doc_file.write_text(_gost_like_text(), encoding="utf-8")

    async def _run_once() -> tuple[int, int]:
        async with SessionLocal() as db:
            inserted = await ingest_document(db, doc_file)
            await db.commit()
            total = int(
                (await db.execute(select(func.count(RagDocument.id)))).scalar_one()
            )
            return inserted, total

    first_inserted, total_after_first = asyncio.run(_run_once())
    assert first_inserted >= 2
    second_inserted, total_after_second = asyncio.run(_run_once())
    assert second_inserted == 0, f"второй прогон вставил {second_inserted} чанков"
    assert total_after_second == total_after_first, (
        f"дубликаты: {total_after_first} → {total_after_second}"
    )


def test_ingest_document_same_hash_skips(tmp_path) -> None:
    """Идемпотентность по content_hash: одинаковый текст → один чанк в БД."""
    import asyncio

    from sqlalchemy import func, select

    from app.core.database import SessionLocal
    from app.db.models import RagDocument
    from app.db.seed_gost import ingest_document

    doc_file = tmp_path / "gost.txt"
    doc_file.write_text(_gost_like_text(), encoding="utf-8")

    async def _run() -> int:
        async with SessionLocal() as db:
            await ingest_document(db, doc_file)
            await db.commit()
            await ingest_document(db, doc_file)
            await db.commit()
            return int(
                (await db.execute(select(func.count(RagDocument.id)))).scalar_one()
            )

    total = asyncio.run(_run())
    assert total >= 2
    unique_hashes = asyncio.run(_count_unique_hashes())
    assert unique_hashes == total


async def _count_unique_hashes() -> int:
    from sqlalchemy import func, select

    from app.core.database import SessionLocal
    from app.db.models import RagDocument

    async with SessionLocal() as db:
        return int(
            (
                await db.execute(
                    select(func.count(func.distinct(RagDocument.content_hash)))
                )
            ).scalar_one()
        )
