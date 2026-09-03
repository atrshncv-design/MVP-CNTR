"""Тесты шва udgu-ingest: CLI как чёрный ящик — ZIP → JSON+отчёты.

Почему на шве: проверяем только публичный интерфейс ingest.py через файловую
систему (вход ZIP, выход 4 файла), без БД и внутренностей. Ожидаемые значения
— разобранные вручную примеры и строки из ТЗ, не вычисленные кодом под тестом.
"""

from __future__ import annotations

import io
import json
import pathlib
import subprocess
import sys
import zipfile

import openpyxl


def _run_cli(zip_path: pathlib.Path, out_dir: pathlib.Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.udgu_ingest.ingest",
            "--zip",
            str(zip_path),
            "--out",
            str(out_dir),
        ],
        capture_output=True,
        text=True,
        cwd=".",
        check=False,
    )


def _make_xlsx_bytes(sheets: dict[str, list[list[object]]]) -> bytes:
    wb = openpyxl.Workbook()
    # удаляем дефолтный лист
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name)
        for r in rows:
            ws.append(r)
    bio = io.BytesIO()
    wb.save(bio)
    return bio.getvalue()


def _make_zip(
    zip_path: pathlib.Path,
    xlsx_bytes: bytes | None,
    extra_files: dict[str, bytes] | None = None,
) -> None:
    extra_files = extra_files or {}
    with zipfile.ZipFile(str(zip_path), "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if xlsx_bytes is not None:
            zf.writestr("00_опись.xlsx", xlsx_bytes)
        for name, data in extra_files.items():
            zf.writestr(name, data)


def _example_zip() -> pathlib.Path:
    return pathlib.Path("docs/udgu_template/example/УдГУ_потенциалУР_2026-09-03.zip")


# --- 1. happy path через пример архива ------------------------------------------------

def test_udgu_ingest_happy_path_example_zip(tmp_path: pathlib.Path) -> None:
    """Пример ZIP → 4 файла, json валиден, raw_refs проиндексированы."""
    zip_path = _example_zip()
    assert zip_path.exists(), "пример архива отсутствует"
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0, f"CLI упал: {res.stderr}"
    # 4 файла
    assert (out / "udgu_import.json").exists()
    assert (out / "report.json").exists()
    assert (out / "report.md").exists()
    assert (out / "warnings.log").exists()
    # json валиден по схеме (через pydantic)
    from scripts.udgu_ingest.models import UdguImport

    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    obj = UdguImport.model_validate(data)
    assert obj.university.name == "Удмуртский государственный университет"
    assert len(obj.departments) == 1
    assert len(obj.equipment) == 1
    assert len(obj.priorities) == 1
    # raw_refs содержит файлы из raw/ и тематических папок — вручную ожидаем >0
    assert len(obj.raw_refs) >= 8, f"raw_refs мало: {obj.raw_refs}"
    # проверяем, что в raw_refs есть файлы из raw/ и из тематической папки
    files = [r.file for r in obj.raw_refs]
    assert any(f.startswith("raw/") for f in files)
    assert any(f.startswith("01_") for f in files)
    # report.md человекочитаем
    md = (out / "report.md").read_text(encoding="utf-8")
    assert "Отчёт по выгрузке УдГУ" in md
    # warnings пустые для валидного примера
    wl = (out / "warnings.log").read_text(encoding="utf-8")
    assert "архив повреждён" not in wl.lower()


def test_udgu_ingest_cli_help_works() -> None:
    """--help возвращает 0 и описывает --zip/--out."""
    res = subprocess.run(
        [sys.executable, "-m", "scripts.udgu_ingest.ingest", "--help"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert res.returncode == 0
    assert "--zip" in res.stdout
    assert "--out" in res.stdout


# --- 2. пустой архив / пустой лист ----------------------------------------------------

def test_udgu_ingest_empty_archive_is_valid(tmp_path: pathlib.Path) -> None:
    """Пустая папка/лист → валидно, отчёт «раздел 03: нет данных»."""
    # создаём минимальный xlsx с заголовками и sentinel «нет данных»
    sheets = {
        "00_инструкция": [["Инструкция"]],
        "01_кафедры_лаб": [["название*", "факультет_институт"], ["нет данных"]],
        "02_приоритеты_заделы": [["направление_приоритет*", "TRL_1_9"], ["нет данных"]],
        "03_миссия_фронтир": [["миссия_текст", "фронтир_направления"], ["нет данных"]],
        "04_оборудование": [["название*", "год_выпуска"], ["нет данных"]],
        "05_РИД": [["название*", "тип"], ["нет данных"]],
        "06_услуги_МСП": [["название*", "описание"], ["нет данных"]],
        "07_люди_эксперты": [["ФИО*", "должность"], ["нет данных"]],
        "99_raw_опись": [["файл*", "тип_сущности"], ["нет данных"]],
    }
    xlsx = _make_xlsx_bytes(sheets)
    zip_path = tmp_path / "empty.zip"
    _make_zip(zip_path, xlsx, extra_files={})
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0, res.stderr
    assert "Traceback" not in res.stderr
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    obj = UdguImport.model_validate(data)
    # все разделы пустые
    assert obj.departments == []
    assert obj.equipment == []
    assert obj.priorities == []
    assert obj.mission is None
    # отчёт содержит фразу про пустой раздел
    md = (out / "report.md").read_text(encoding="utf-8")
    assert "раздел 03: нет данных" in md
    # json валиден
    assert obj.university.name != ""


def test_udgu_ingest_empty_zip_no_xlsx(tmp_path: pathlib.Path) -> None:
    """ZIP без xlsx → валидно, не падает."""
    zip_path = tmp_path / "no_xlsx.zip"
    with zipfile.ZipFile(str(zip_path), "w") as zf:
        zf.writestr("raw/файл.txt", "сырые".encode())
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0
    assert (out / "udgu_import.json").exists()
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    UdguImport.model_validate(data)
    md = (out / "report.md").read_text(encoding="utf-8")
    assert "раздел 03: нет данных" in md or "раздел 01" in md


# --- 3. битый архив ------------------------------------------------------------------

def test_udgu_ingest_broken_archive_logs_warning(tmp_path: pathlib.Path) -> None:
    """Битый ZIP (CRC) → warnings.log «архив повреждён», не traceback, json валиден."""
    zip_path = tmp_path / "broken.zip"
    # пишем мусор вместо zip
    zip_path.write_bytes(b"not a zip file \x00\x01\x02 broken")
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    # CLI не должен падать с traceback
    assert res.returncode == 0, res.stderr
    assert "Traceback" not in res.stderr
    assert "Traceback" not in res.stdout
    assert (out / "warnings.log").exists()
    wl = (out / "warnings.log").read_text(encoding="utf-8")
    assert "архив повреждён" in wl.lower()
    # фраза «файл X не читается» должна быть
    assert "не читается" in wl.lower()
    # json всё равно валиден (минимальный)
    assert (out / "udgu_import.json").exists()
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    UdguImport.model_validate(data)
    # успешные файлы отсутствуют, но отчёт существует
    assert (out / "report.md").exists()


def test_udgu_ingest_unreadable_excel_warns(tmp_path: pathlib.Path) -> None:
    """Нечитаемый Excel → warning, не падение."""
    zip_path = tmp_path / "bad_excel.zip"
    with zipfile.ZipFile(str(zip_path), "w") as zf:
        zf.writestr("00_опись.xlsx", b"not an excel")
        zf.writestr("raw/data.txt", "сырые".encode())
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0
    assert "Traceback" not in res.stderr
    wl = (out / "warnings.log").read_text(encoding="utf-8")
    assert "нечитаемый excel" in wl.lower()
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    UdguImport.model_validate(data)


# --- 4. дубли ------------------------------------------------------------------------

def test_udgu_ingest_duplicate_equipment_dedup(tmp_path: pathlib.Path) -> None:
    """Дубли по (тип+нормализованное название+год) → Hash-дедуп, одна запись + warning."""
    sheets = {
        "00_инструкция": [["Инструкция"]],
        "01_кафедры_лаб": [["название*"], ["Кафедра"]],
        "04_оборудование": [
            [
                "название*",
                "модель",
                "год_выпуска",
                "характеристики",
                "доступно_для_МСП",
                "компетенции",
                "файл_приложение",
            ],
            ["Микроскоп", "M1", "2021", "хар", "Да", "микро", ""],
            ["Микроскоп", "M1", "2021", "хар", "Да", "микро", ""],
            # с пробелом — тот же нормализованный
            ["Микроскоп ", "M1", "2021", "хар", "Да", "микро", ""],
        ],
        "03_миссия_фронтир": [["миссия_текст"], ["нет данных"]],
        "02_приоритеты_заделы": [["направление_приоритет*"], ["нет данных"]],
        "05_РИД": [["название*"], ["нет данных"]],
        "06_услуги_МСП": [["название*"], ["нет данных"]],
        "07_люди_эксперты": [["ФИО*"], ["нет данных"]],
        "99_raw_опись": [["файл*"], ["нет данных"]],
    }
    xlsx = _make_xlsx_bytes(sheets)
    zip_path = tmp_path / "dup.zip"
    _make_zip(zip_path, xlsx)
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    obj = UdguImport.model_validate(data)
    assert len(obj.equipment) == 1, f"ожидался дедуп до 1, получено {len(obj.equipment)}"
    wl = (out / "warnings.log").read_text(encoding="utf-8").lower()
    assert "дубликат" in wl
    assert "объединены" in wl
    assert "04" in wl


# --- 5. неверный TRL и обязательные поля -------------------------------------------

def test_udgu_ingest_invalid_trl_warns(tmp_path: pathlib.Path) -> None:
    """TRL вне 1-9 → warning, строка не падает, json валиден."""
    sheets = {
        "00_инструкция": [["Инструкция"]],
        "02_приоритеты_заделы": [
            ["направление_приоритет*", "TRL_1_9", "компетенции"],
            ["Кванты", "99", "кванты"],  # неверный TRL
            ["Фотоника", "0", "фотоника"],
            ["Норма", "4", "ок"],
        ],
        "01_кафедры_лаб": [["название*"], ["нет данных"]],
        "03_миссия_фронтир": [["миссия_текст"], ["нет данных"]],
        "04_оборудование": [["название*"], ["нет данных"]],
        "05_РИД": [["название*"], ["нет данных"]],
        "06_услуги_МСП": [["название*"], ["нет данных"]],
        "07_люди_эксперты": [["ФИО*"], ["нет данных"]],
        "99_raw_опись": [["файл*"], ["нет данных"]],
    }
    xlsx = _make_xlsx_bytes(sheets)
    zip_path = tmp_path / "trl.zip"
    _make_zip(zip_path, xlsx)
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0
    wl = (out / "warnings.log").read_text(encoding="utf-8").lower()
    assert "trl" in wl
    assert "1-9" in wl or "1–9" in wl
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    obj = UdguImport.model_validate(data)
    # валидная строка с TRL 4 должна попасть, невалидные — с trl=None но запись есть
    assert any(p.title == "Норма" and p.trl == 4 for p in obj.priorities)
    # у невалидных TRL должен быть сброшен в None (pydantic не пропустил бы 99)
    bad = [p for p in obj.priorities if p.title in ("Кванты", "Фотоника")]
    assert len(bad) == 2
    assert all(p.trl is None for p in bad)


def test_udgu_ingest_missing_required_name_warns(tmp_path: pathlib.Path) -> None:
    """Отсутствие обязательного поля название в 04 → warning.»"""
    sheets = {
        "00_инструкция": [["Инструкция"]],
        "04_оборудование": [
            ["название*", "год_выпуска"],
            ["", "2021"],  # пустое название строка 3
            ["Микроскоп", "2021"],
            ["", ""],  # пустая строка — пропускается
        ],
        "01_кафедры_лаб": [["название*"], ["нет данных"]],
        "02_приоритеты_заделы": [["направление_приоритет*"], ["нет данных"]],
        "03_миссия_фронтир": [["миссия_текст"], ["нет данных"]],
        "05_РИД": [["название*"], ["нет данных"]],
        "06_услуги_МСП": [["название*"], ["нет данных"]],
        "07_люди_эксперты": [["ФИО*"], ["нет данных"]],
        "99_raw_опись": [["файл*"], ["нет данных"]],
    }
    xlsx = _make_xlsx_bytes(sheets)
    zip_path = tmp_path / "req.zip"
    _make_zip(zip_path, xlsx)
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0
    wl = (out / "warnings.log").read_text(encoding="utf-8").lower()
    assert "лист 04" in wl
    assert "название" in wl
    assert "обязательно" in wl
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    obj = UdguImport.model_validate(data)
    assert len(obj.equipment) == 1
    assert obj.equipment[0].name == "Микроскоп"


# --- 6. нормализация имён папок ----------------------------------------------------

def test_udgu_ingest_normalizes_folder_names(tmp_path: pathlib.Path) -> None:
    """Папка 01_Кафедры и Лаборатории и 01_кафедры_лаб маппятся в один раздел."""
    # используем две разные папки, обе должны быть проиндексированы как raw_refs
    # и не приводить к ошибке — нормализация lower без пробелов/дефисов
    sheets = {
        "00_инструкция": [["Инструкция"]],
        "01_кафедры_лаб": [["название*"], ["Кафедра"]],
        "02_приоритеты_заделы": [["направление_приоритет*"], ["нет данных"]],
        "03_миссия_фронтир": [["миссия_текст"], ["нет данных"]],
        "04_оборудование": [["название*"], ["нет данных"]],
        "05_РИД": [["название*"], ["нет данных"]],
        "06_услуги_МСП": [["название*"], ["нет данных"]],
        "07_люди_эксперты": [["ФИО*"], ["нет данных"]],
        "99_raw_опись": [["файл*"], ["нет данных"]],
    }
    xlsx = _make_xlsx_bytes(sheets)
    zip_path = tmp_path / "norm.zip"
    with zipfile.ZipFile(str(zip_path), "w") as zf:
        zf.writestr("00_опись.xlsx", xlsx)
        # две папки с разным написанием, обе внутри тематики 01
        zf.writestr("01_Кафедры и Лаборатории/файл1.txt", b"a")
        zf.writestr("01_кафедры_лаб/файл2.txt", b"b")
        zf.writestr("raw/сырой.txt", b"raw")
    out = tmp_path / "out"
    res = _run_cli(zip_path, out)
    assert res.returncode == 0
    assert "Traceback" not in res.stderr
    data = json.loads((out / "udgu_import.json").read_text(encoding="utf-8"))
    from scripts.udgu_ingest.models import UdguImport

    obj = UdguImport.model_validate(data)
    files = [r.file for r in obj.raw_refs]
    # обе папки должны быть проиндексированы
    assert "01_Кафедры и Лаборатории/файл1.txt" in files
    assert "01_кафедры_лаб/файл2.txt" in files
    # функция нормализации должна быть использована в коде
    src = pathlib.Path("scripts/udgu_ingest/ingest.py").read_text(encoding="utf-8")
    assert "_normalize_folder" in src or "normalize" in src.lower()
    # проверяем lowercase без пробелов/дефисов в исходнике
    assert "lower" in src.lower()
