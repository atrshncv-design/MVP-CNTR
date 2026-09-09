"""Переиндексация RAG-эмбеддингов моделью semantic-ru-v2 (таск 12, R05i).

Идемпотентно: повторный прогон пересчитывает те же векторы
(детерминированная модель, перезапись). Размерность 1536 — индекс
pgvector и миграция 0034 согласованы, пересоздание не требуется.

Запуск из technozrelost-backend/:
    uv run python -m scripts.reindex_rag_embeddings [--batch-size 200]
"""
from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select, text

logger = logging.getLogger(__name__)

SQL_UPDATE = """
UPDATE public.rag_documents
SET embedding = CAST(:embedding AS vector)
WHERE id = :doc_id
"""


async def reindex_all(batch_size: int = 200) -> int:
    from app.core.database import SessionLocal
    from app.core.embeddings import EMBEDDING_DIM, EMBEDDING_MODEL, embed_text
    from app.db.models import RagDocument

    assert EMBEDDING_DIM == 1536, EMBEDDING_DIM
    total = 0
    async with SessionLocal() as db:
        offset = 0
        while True:
            rows = list(
                (await db.execute(
                    select(RagDocument).order_by(RagDocument.id).offset(offset).limit(batch_size)
                )).scalars().all()
            )
            if not rows:
                break
            for doc in rows:
                emb = embed_text(doc.raw_text or "")
                emb_str = "[" + ",".join(f"{v:.8f}" for v in emb) + "]"
                await db.execute(text(SQL_UPDATE), {"embedding": emb_str, "doc_id": doc.id})
                total += 1
            await db.commit()
            offset += batch_size
    logger.info("reindex rag: модель %s, обновлено %d", EMBEDDING_MODEL, total)
    return total


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=200)
    args = parser.parse_args()
    updated = asyncio.run(reindex_all(batch_size=args.batch_size))
    print(f"reindexed {updated}")


if __name__ == "__main__":
    main()
