"""CLI-загрузчик нормативных документов (ГОСТы) в RAG-базу знаний.

Тикет 09: обёртка над app.db.seed_gost — чанкинг по разделам,
doc_type=gost, source_uri = файл#раздел, эмбеддинги, идемпотентность
по content_hash (повторный запуск не дублирует чанки).

Использование:
    uv run python scripts/load_gosts.py [--dir ПУТЬ_К_ПАПКЕ_С_PDF]

Источники по умолчанию (если --dir не задан):
    1. папка «ГОСТЫ» рядом с проектом (все *.pdf / *.docx / *.txt, рекурсивно);
    2. файлы ГОСТов в корне проекта (например, GOST-R-58048-2017.pdf).

Реальные PDF-файлы собирает пользователь (папка «ГОСТЫ»); скрипт готов
к работе сразу, как только файлы появятся.
"""

from __future__ import annotations

import argparse
import asyncio

from app.db.seed_gost import seed


def main() -> None:
    parser = argparse.ArgumentParser(description="Загрузка ГОСТов в RAG-базу")
    parser.add_argument(
        "--dir",
        help="Папка с PDF-файлами ГОСТов (по умолчанию: «ГОСТЫ» рядом с проектом)",
    )
    args = parser.parse_args()
    asyncio.run(seed(args.dir))


if __name__ == "__main__":
    main()
