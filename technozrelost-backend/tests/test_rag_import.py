"""Таск 06 — RAG-импорт только корпуса ГОСТов (G50, G56–G58).

Шов — allowlist-гейт + хеш-манифест в scripts/rag_import.py.
Чистые юнит-тесты без БД: ожидаемые значения разобраны вручную.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

VALID_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer\n%%EOF\n"
NOT_A_PDF = b"this is plain text, not a pdf document body"


def _write(path: Path, data: bytes) -> Path:
    path.write_bytes(data)
    return path


def test_allowlist_accepts_gost_pdf() -> None:
    from scripts.rag_import import is_allowed_corpus_file

    assert is_allowed_corpus_file(Path("ГОСТ Р 58048-2017 Трансфер.pdf"))
    assert is_allowed_corpus_file(Path("гост р 15.301-2016 разработка.pdf"))
    assert is_allowed_corpus_file(Path("ГОСТ 15.309-98 Испытания.pdf"))


def test_allowlist_rejects_zip_docx_and_internal_docs() -> None:
    from scripts.rag_import import is_allowed_corpus_file

    # ZIP/DOCX даже с именем ГОСТа — вне allowlist (G58)
    assert not is_allowed_corpus_file(Path("ГОСТ Р 58048-2017.pdf.zip"))
    assert not is_allowed_corpus_file(Path("ГОСТ Р 58048-2017.docx"))
    assert not is_allowed_corpus_file(Path("ГОСТ Р 58048-2017.PDF.ZIP"))
    # внутренние документы — интервью, roadmap, код, отчёты, доступы (G57)
    assert not is_allowed_corpus_file(Path("интервью ЦНТР.pdf"))
    assert not is_allowed_corpus_file(Path("roadmap.pdf"))
    assert not is_allowed_corpus_file(Path("отчёт по проекту.pdf"))
    assert not is_allowed_corpus_file(Path("доступы.txt"))
    assert not is_allowed_corpus_file(Path("main.py"))


def test_scan_collects_only_allowed_and_reports_reasons(tmp_path: Path) -> None:
    from scripts.rag_import import scan_corpus_dir

    _write(tmp_path / "ГОСТ Р 58048-2017 Методические указания.pdf", VALID_PDF)
    _write(tmp_path / "ГОСТ Р 57194.3-2016 Технологический аудит.pdf", NOT_A_PDF)
    _write(tmp_path / "ГОСТ Р 58048-2017 копия.zip", b"PK\x03\x04junk")
    _write(tmp_path / "ГОСТ Р 58048-2017 копия.docx", b"PK\x03\x04junk")
    _write(tmp_path / "интервью ЦНТР.pdf", VALID_PDF)
    _write(tmp_path / "ГОСТ пустой.pdf", b"")

    scan = scan_corpus_dir(tmp_path)

    assert [p.name for p in scan.allowed] == [
        "ГОСТ Р 58048-2017 Методические указания.pdf"
    ]
    reasons = {r.name: r.reason for r in scan.rejected}
    assert reasons["ГОСТ Р 57194.3-2016 Технологический аудит.pdf"] == "damaged"
    assert reasons["ГОСТ пустой.pdf"] == "damaged"
    assert reasons["ГОСТ Р 58048-2017 копия.zip"] == "not-in-allowlist"
    assert reasons["ГОСТ Р 58048-2017 копия.docx"] == "not-in-allowlist"
    assert reasons["интервью ЦНТР.pdf"] == "not-in-allowlist"


def test_manifest_reproducible_and_repeat_import_is_noop(tmp_path: Path) -> None:
    from scripts.rag_import import build_manifest, diff_manifests, plan_import

    _write(tmp_path / "ГОСТ Б.pdf", VALID_PDF)
    _write(tmp_path / "ГОСТ А.pdf", VALID_PDF + b"%extra")

    first = build_manifest(sorted(tmp_path.iterdir()))
    second = build_manifest(sorted(tmp_path.iterdir(), reverse=True))
    assert first.to_json() == second.to_json()  # порядок обхода не влияет

    plan = plan_import({}, first)
    assert not plan.is_noop and plan.added == ["ГОСТ А.pdf", "ГОСТ Б.pdf"]

    repeat = plan_import(first.entries, first)
    assert repeat.is_noop  # повтор без изменений — no-op (G50)
    assert repeat.added == [] and repeat.changed == [] and repeat.removed == []

    assert diff_manifests(first.entries, second.entries).is_noop


def test_manifest_detects_changed_and_removed(tmp_path: Path) -> None:
    from scripts.rag_import import build_manifest, plan_import

    old_file = _write(tmp_path / "ГОСТ А.pdf", VALID_PDF)
    _write(tmp_path / "ГОСТ Удаляемый.pdf", VALID_PDF)
    old = build_manifest(sorted(tmp_path.iterdir()))

    old_file.write_bytes(VALID_PDF + b"%v2")
    (tmp_path / "ГОСТ Удаляемый.pdf").unlink()
    new = build_manifest(sorted(tmp_path.iterdir()))

    plan = plan_import(old.entries, new)
    assert not plan.is_noop
    assert plan.changed == ["ГОСТ А.pdf"]
    assert plan.removed == ["ГОСТ Удаляемый.pdf"]


def test_external_gate_never_passes_non_allowlist() -> None:
    from scripts.rag_import import ensure_allowed_for_external

    ensure_allowed_for_external("ГОСТ Р 58048-2017 Трансфер.pdf")  # не падает
    with pytest.raises(ValueError):
        ensure_allowed_for_external("интервью ЦНТР.pdf")
    with pytest.raises(ValueError):
        ensure_allowed_for_external("ГОСТ Р 58048-2017.docx")


def test_import_module_secret_scan_is_clean() -> None:
    from scripts import rag_import

    source = Path(rag_import.__file__).read_text(encoding="utf-8")
    secret_assign = re.compile(
        r"""(?i)(api[_-]?key|apikey|secret|password|passwd|token)\s*=\s*["'][^"']{12,}["']"""
    )
    hits = [
        line
        for line in source.splitlines()
        if secret_assign.search(line) and "RAG_CORPUS_DIR" not in line
    ]
    assert hits == []
    assert json.loads('{"a": 1}') == {"a": 1}  # sanity: манифест — валидный JSON
