"""RAG-импорт только корпуса ГОСТов (таск 06, G50/G56–G58).

Deny-by-default: в индекс попадает только allowlist ``ГОСТ*.pdf`` из папки
«Трансфер технологий». ZIP, DOCX, внутренние документы (интервью, roadmap,
код, отчёты, доступы) и повреждённые копии отбрасываются и фиксируются
с причиной. Повторный импорт без изменений — no-op по хеш-манифесту.

Исходные PDF в git не коммитятся; манифест — воспроизводимый JSON.
Секретов здесь нет и быть не должно: только имена (G52), значений — никогда.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

# Явный allowlist (G58): имя начинается с ГОСТ, расширение строго .pdf.
ALLOWLIST_PREFIX = "гост"
ALLOWED_SUFFIX = ".pdf"

# Причины отбраковки — стабильные строки для логов и тестов.
REASON_NOT_IN_ALLOWLIST = "not-in-allowlist"
REASON_DAMAGED = "damaged"

PDF_SIGNATURE = b"%PDF-"
MANIFEST_FILENAME = "gost_manifest.json"


def is_allowed_corpus_file(path: Path | str) -> bool:
    """Только ``ГОСТ*.pdf`` (регистр не важен). Всё остальное — deny."""
    name = Path(path).name.lower()
    return name.startswith(ALLOWLIST_PREFIX) and name.endswith(ALLOWED_SUFFIX)


def _looks_like_pdf(path: Path) -> bool:
    """Сигнатурная проверка: ненулевой размер + заголовок %PDF-."""
    try:
        if path.stat().st_size == 0:
            return False
        with path.open("rb") as fh:
            return fh.read(len(PDF_SIGNATURE)) == PDF_SIGNATURE
    except OSError:
        return False


@dataclass(frozen=True)
class RejectedFile:
    name: str
    reason: str


@dataclass(frozen=True)
class CorpusScan:
    allowed: list[Path] = field(default_factory=list)
    rejected: list[RejectedFile] = field(default_factory=list)


def scan_corpus_dir(directory: Path | str) -> CorpusScan:
    """Разложить файлы папки на разрешённые и отбракованные (детерминированно)."""
    base = Path(directory)
    allowed: list[Path] = []
    rejected: list[RejectedFile] = []
    for entry in sorted(base.iterdir(), key=lambda p: p.name):
        if not entry.is_file():
            continue
        if not is_allowed_corpus_file(entry.name):
            rejected.append(RejectedFile(entry.name, REASON_NOT_IN_ALLOWLIST))
        elif not _looks_like_pdf(entry):
            rejected.append(RejectedFile(entry.name, REASON_DAMAGED))
        else:
            allowed.append(entry)
    return CorpusScan(allowed=allowed, rejected=rejected)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class CorpusManifest:
    entries: dict[str, str] = field(default_factory=dict)  # имя -> sha256

    def to_json(self) -> str:
        """Воспроизводимая сериализация: сортировка ключей, фикс. формат."""
        return json.dumps(self.entries, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def build_manifest(files: list[Path]) -> CorpusManifest:
    return CorpusManifest({p.name: sha256_file(p) for p in files})


def read_manifest(path: Path) -> CorpusManifest:
    if not path.exists():
        return CorpusManifest({})
    data = json.loads(path.read_text(encoding="utf-8"))
    return CorpusManifest({str(k): str(v) for k, v in data.items()})


def write_manifest(manifest: CorpusManifest, path: Path) -> None:
    path.write_text(manifest.to_json(), encoding="utf-8")


@dataclass(frozen=True)
class ImportPlan:
    added: list[str] = field(default_factory=list)
    changed: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)

    @property
    def is_noop(self) -> bool:
        return not self.added and not self.changed and not self.removed


def plan_import(old: dict[str, str], new: CorpusManifest) -> ImportPlan:
    """Сравнение манифестов: что индексировать, что убрать; пусто — no-op."""
    added = sorted(n for n in new.entries if n not in old)
    changed = sorted(n for n in new.entries if n in old and old[n] != new.entries[n])
    removed = sorted(n for n in old if n not in new.entries)
    return ImportPlan(added=added, changed=changed, removed=removed)


def diff_manifests(old: dict[str, str], new: dict[str, str]) -> ImportPlan:
    return plan_import(old, CorpusManifest(dict(new)))


def ensure_allowed_for_external(source_name: str) -> None:
    """Гейт внешнего запроса (G56): не-allowlist никогда не уходит наружу."""
    if not is_allowed_corpus_file(source_name):
        raise ValueError(f"источник вне корпуса ГОСТов: {source_name!r}")


def default_manifest_path() -> Path:
    return Path(__file__).resolve().parent / MANIFEST_FILENAME


def run_import(
    corpus_dir: Path | str, manifest_path: Path | str, *, dry_run: bool = False
) -> ImportPlan:
    """Точка входа импорта: скан → манифест → план; запись, если не no-op."""
    scan = scan_corpus_dir(corpus_dir)
    for rejected in scan.rejected:
        print(f"  SKIP ({rejected.reason}): {rejected.name}")
    manifest = build_manifest(scan.allowed)
    plan = plan_import(read_manifest(Path(manifest_path)).entries, manifest)
    if plan.is_noop:
        print(f"no-op: корпус без изменений ({len(manifest.entries)} файлов)")
        return plan
    print(
        f"план: +{len(plan.added)} ~{len(plan.changed)} -{len(plan.removed)} "
        f"(всего {len(manifest.entries)})"
    )
    if not dry_run:
        write_manifest(manifest, Path(manifest_path))
        print(f"манифест записан: {manifest_path}")
    return plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--corpus-dir",
        default=os.environ.get("RAG_CORPUS_DIR", ""),
        help="Папка корпуса (или env RAG_CORPUS_DIR — только имя переменной)",
    )
    parser.add_argument(
        "--manifest",
        default=str(default_manifest_path()),
        help="Путь хеш-манифеста",
    )
    parser.add_argument("--dry-run", action="store_true", help="Не писать манифест")
    args = parser.parse_args(argv)
    if not args.corpus_dir:
        print("Нет папки корпуса: задайте --corpus-dir или RAG_CORPUS_DIR")
        return 2
    if not Path(args.corpus_dir).is_dir():
        print(f"Нет папки корпуса: {args.corpus_dir}")
        return 2
    run_import(Path(args.corpus_dir), Path(args.manifest), dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
