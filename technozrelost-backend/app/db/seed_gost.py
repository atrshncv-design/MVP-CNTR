"""Загрузка ГОСТов (PDF) в RAG-базу знаний.

Использование:
    uv run python -m app.db.seed_gost [--dir ПУТЬ_К_ПАПКЕ_С_PDF]

По умолчанию ищет папку «ГОСТЫ» рядом с проектом; если её нет — берёт
GOST-R-58048-2017.pdf в корне проекта. Идемпотентно (по content_hash).
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import re
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.core.embeddings import embed_text
from app.db.models import RagDocument

# Границы чанков (символы)
CHUNK_MIN = 1200
CHUNK_TARGET = 2000
CHUNK_MAX = 3000

# Маркеры начала разделов ГОСТа (заголовки вида "5.2 ...", "ПРИЛОЖЕНИЕ ...")
SECTION_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\s+[А-ЯA-Z]", re.MULTILINE)


def chunk_text(text: str) -> list[str]:
    """Нарезка текста ГОСТа на чанки по разделам с учётом границ размера."""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    sections = SECTION_RE.split(text)
    # SECTION_RE.split даёт [до-первого-заголовка, "5.2", "текст", "5.3", ...]
    chunks: list[str] = []
    current = sections[0] if sections else ""
    for i in range(1, len(sections) - 1, 2):
        heading = sections[i]
        body = sections[i + 1]
        section_text = f"{heading} {body}".strip()
        if not section_text:
            continue

        if len(current) + len(section_text) <= CHUNK_TARGET:
            current = f"{current}\n\n{section_text}".strip()
            continue
        if current:
            chunks.append(current[:CHUNK_MAX])
        current = section_text

        # Очень длинный раздел — режем по абзацам
        while len(current) > CHUNK_MAX:
            split_at = current.rfind("\n\n", CHUNK_MIN, CHUNK_MAX)
            if split_at == -1:
                split_at = CHUNK_MAX
            chunks.append(current[:split_at].strip())
            current = current[split_at:].strip()

    if current.strip():
        chunks.append(current[:CHUNK_MAX].strip())
    return [c for c in chunks if len(c.strip()) >= 100]


def extract_pdf_text(pdf_path: Path) -> str:
    """Извлечение текстового слоя PDF (pymupdf).

    N-17: pymupdf==1.28.0 — AGPL-3.0 (B2G-риск). Используется только в
    офлайн-сидинге ГОСТов; замена оценивается на pypdf (BSD) / pdfminer.six
    с сохранением API extract_pdf_text. См. pyproject.toml и
    docs/ИМПОРТОЗАМЕЩЕНИЕ.md.
    """
    import fitz  # PyMuPDF — AGPL, см. N-17

    doc = fitz.open(str(pdf_path))
    try:
        pages = [str(page.get_text("text")) for page in doc]
    finally:
        doc.close()
    return "\n\n".join(pages)


def extract_docx_text(docx_path: Path) -> str:
    """Извлечение текста из .docx через zipfile+xml (без новых зависимостей)."""
    import re as _re
    import zipfile

    with zipfile.ZipFile(docx_path) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
    # текст в <w:t>...</w:t>, абзацы в <w:p>...</w:p>
    paragraphs = _re.findall(r"<w:p[ >].*?</w:p>", xml, _re.S)
    parts = []
    for p in paragraphs:
        text = "".join(_re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, _re.S))
        if text.strip():
            parts.append(text)
    return "\n\n".join(parts)


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf_text(path)
    if suffix == ".docx":
        return extract_docx_text(path)
    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    return ""


def _is_gost_name(path: Path) -> bool:
    return "гос" in path.stem.lower() or "gost" in path.stem.lower()


def find_doc_sources() -> list[Path]:
    """Папка «ГОСТЫ» (все PDF/DOCX/TXT, рекурсивно) или ГОСТ-файлы в корне."""
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    candidates: list[Path] = []
    patterns = ("*.pdf", "*.docx", "*.txt")
    for base in (project_root, project_root.parent):
        gost_dir = base / "ГОСТЫ"
        if gost_dir.is_dir():
            for pattern in patterns:
                candidates.extend(sorted(gost_dir.rglob(pattern)))
        for pattern in patterns:
            candidates.extend(sorted(p for p in base.glob(pattern) if _is_gost_name(p)))
    # дедупликация, сохраняя порядок; пропуск пустых файлов
    seen: set[str] = set()
    result: list[Path] = []
    for path in candidates:
        key = str(path.resolve())
        if key not in seen and path.stat().st_size > 0:
            seen.add(key)
            result.append(path)
    return result


async def ingest_document(db: AsyncSession, doc_path: Path) -> int:
    text_content = extract_text(doc_path)
    chunks = chunk_text(text_content)
    inserted = 0
    for idx, chunk in enumerate(chunks):
        content_hash = hashlib.sha256(chunk.encode("utf-8")).hexdigest()
        existing = await db.scalar(
            select(RagDocument).where(RagDocument.content_hash == content_hash)
        )
        if existing:
            continue
        title = f"{doc_path.stem} — раздел {idx + 1}"
        doc = RagDocument(
            title=title,
            doc_type="gost",
            ugt_level=None,
            content_hash=content_hash,
            raw_text=chunk,
            source_uri=f"{doc_path.name}#chunk-{idx + 1}",
            template_metadata={"file": doc_path.name, "chunk": idx + 1},
            embedding=None,
        )
        db.add(doc)
        await db.flush()
        emb = embed_text(chunk)
        emb_str = "[" + ",".join(f"{v:.8f}" for v in emb) + "]"
        sql = (
            "UPDATE public.rag_documents "
            "SET embedding = CAST(:emb AS vector) WHERE id = :did"
        )
        await db.execute(text(sql), {"emb": emb_str, "did": doc.id})
        inserted += 1
    return inserted


async def seed(directory: str | None = None) -> None:
    sources = [Path(directory)] if directory else find_doc_sources()
    if not sources:
        print("Документы не найдены. Положите файлы в папку «ГОСТЫ» рядом с проектом.")
        return

    async with SessionLocal() as db:
        for doc_path in sources:
            if not doc_path.exists():
                print(f"  SKIP (нет файла): {doc_path}")
                continue
            count = await ingest_document(db, doc_path)
            await db.commit()
            print(f"  {doc_path.name}: +{count} чанков (идемпотентно)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Загрузка ГОСТов в RAG-базу")
    parser.add_argument("--dir", help="Папка с PDF-файлами ГОСТов")
    args = parser.parse_args()
    asyncio.run(seed(args.dir))
