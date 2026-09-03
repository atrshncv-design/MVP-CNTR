# Пайплайн выгрузки УдГУ (udgu-ingest)

Назначение: CLI-пайплайн normalize+validate+report на стороне ЦНТР.
Принимает ZIP-архив по папкам по темам, валидирует структуру, читает
Excel-ядро (`00_опись.xlsx`) + индексирует сырые файлы, нормализует и
генерирует `udgu_import.json` в схеме платформы.

## Вход/выход

```
scripts/udgu_ingest/ingest.py --zip archive.zip --out ./out
  → udgu_import.json (Pydantic UdguImport)
  → report.md / report.json
  → warnings.log
```

Пока реализован каркас и схема (таск 01). Сам `ingest.py` появится в таске 03.

## Модели

`models.py` — Pydantic-модели `UdguImport`, `Department`, `Priority`,
`Equipment`, `Patent`, `Service`, `Person` (+ `University`, `Mission`, `RawRef`).

- `competencies: list[str]` как в платформе.
- `trl: int 1-9` валидируется (ge=1, le=9).
- `extra_sections: dict[str, list[dict]]` — расширяемость 08_... без ломки схемы.
- Импорт без БД: `from scripts.udgu_ingest.models import UdguImport`.

## Схема

`docs/udgu_template/schema/udgu_template.schema.json` — JSON Schema Draft 2020-12,
покрывает 7 разделов + `raw_refs` + `university` meta. Генерируется из моделей.

## Расширяемость

Новый тип: добавить `08_мой_тип/` и запись в `extra_sections: {"08_custom": [{"name":"x"}]}`.
Валидация не падает, отчёт включает новую секцию.

## Стек

Python 3.11+, `pydantic>=2.5`, `openpyxl>=3.1`, `pandas>=2.0`, `typer`/`click`, `pytest`.
