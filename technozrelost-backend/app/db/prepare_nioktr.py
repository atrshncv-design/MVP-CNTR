"""Предобработка массива НИОКТР: фильтрация и компактная выборка для демо.

Использование:
    uv run python -m app.db.prepare_nioktr [--input ПУТЬ] [--limit 400]

Приоритет — карточки с is_ai_area=true; остаток добирается свежими карточками.
Результат: backend/data/nioktr_sample.json (< 50 МБ), источник для seed_nioktr.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_INPUT = (
    PROJECT_ROOT / "ТЕСТОВЫЙ АНАЛИЗ ДАННЫХ" / "nioktr_2025_all_months.json"
)
OUTPUT = Path(__file__).resolve().parent.parent.parent / "data" / "nioktr_sample.json"

DEFAULT_LIMIT = 400


def _compact_card(card: dict) -> dict:
    """Оставляет только нужные поля карточки НИОКТР."""
    executor = card.get("executor") or {}
    customer = card.get("customer") or {}
    return {
        "registration_number": card.get("registration_number"),
        "name": card.get("name"),
        "annotation": (card.get("annotation") or "")[:4000],
        "keywords": card.get("keyword_list") or [],
        "nioktr_types": card.get("nioktr_types") or [],
        "state_program": card.get("state_program"),
        "created_date": card.get("created_date"),
        "is_ai_area": bool(card.get("is_ai_area")),
        "is_ai_usage": bool(card.get("is_ai_usage")),
        "executor": {
            "name": executor.get("name"),
            "short_name": executor.get("short_name"),
            "ogrn": executor.get("ogrn"),
            "organization_type": executor.get("organization_type"),
            "region": executor.get("region") or executor.get("territory"),
        },
        "customer": {
            "name": customer.get("name"),
            "short_name": customer.get("short_name"),
        },
    }


def prepare(input_path: Path, limit: int) -> None:
    print(f"Загрузка {input_path} …")
    with input_path.open(encoding="utf-8") as f:
        data = json.load(f)
    cards = data.get("cards", [])
    print(f"Всего карточек: {len(cards)}")

    seen: set[str] = set()
    selected: list[dict] = []

    def _pick(card: dict) -> bool:
        reg = card.get("registration_number")
        if not reg or reg in seen:
            return False
        seen.add(reg)
        selected.append(_compact_card(card))
        return True

    # 1. Приоритет: AI-карточки
    ai_cards = [c for c in cards if c.get("is_ai_area") or c.get("is_ai_usage")]
    for card in ai_cards:
        if len(selected) >= limit:
            break
        _pick(card)

    # 2. Добираем свежими (по дате создания) до лимита
    rest = sorted(
        (c for c in cards if not (c.get("is_ai_area") or c.get("is_ai_usage"))),
        key=lambda c: c.get("created_date") or "",
        reverse=True,
    )
    for card in rest:
        if len(selected) >= limit:
            break
        _pick(card)

    print(f"Выбрано: {len(selected)} (AI: {sum(1 for c in selected if c['is_ai_area'])})")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"cards": selected}, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"Сохранено: {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.1f} МБ)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Предобработка массива НИОКТР")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    args = parser.parse_args()
    prepare(Path(args.input), args.limit)
