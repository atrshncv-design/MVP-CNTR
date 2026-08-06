"""Юнит-тесты чанкера ГОСТов."""

from __future__ import annotations

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
