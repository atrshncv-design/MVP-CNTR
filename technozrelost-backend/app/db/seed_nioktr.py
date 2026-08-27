"""Импорт полного массива НИОКТР в реестры: organizations + nioktr_cards.

Использование:
    uv run python -m app.db.seed_nioktr [--input data/nioktr_all.json]

Источник: компактная версия полного массива (16 582 карточки),
формат полей — см. data/nioktr_all.json (keyword_list, executor{...},
customer — строка, budgets[{funds, budget_type}]).

Идемпотентно: организации дедуплицируются по ОГРН, карточки — по
registration_number. Старые записи technologies с source_uri LIKE 'nioktr:%'
удаляются (перенос НИОКТР в отдельный раздел nioktr_cards).
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.db.models import NioktrCard, Organization, Technology

DEFAULT_INPUT = Path(__file__).resolve().parent.parent.parent / "data" / "nioktr_all.json"

UNIVERSITY_MARKERS = ("УНИВЕРСИТЕТ", "ИНСТИТУТ", "АКАДЕМИЯ", "ВЫСШЕЙ ШКОЛЫ", "НИИ")


def _org_type(name: str) -> str:
    upper = (name or "").upper()
    if any(m in upper for m in UNIVERSITY_MARKERS):
        return "scientific_org"
    return "company"


def _iso_clean(value: Any) -> str | None:
    """ISO-даты из источника: обрезаем до YYYY-MM-DD, если есть время."""
    if not value:
        return None
    s = str(value).strip()
    return s[:10] if len(s) >= 10 else s


async def seed(input_path: Path, drop_old_technologies: bool = True) -> None:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    cards = data.get("cards", [])

    async with SessionLocal() as db:
        # ── Организации ──
        org_by_ogrn: dict[str, Organization] = {}
        org_counts: dict[str, int] = {}
        org_keywords: dict[str, set[str]] = {}
        org: Organization | None
        for card in cards:
            ex = card.get("executor") or {}
            ogrn = ex.get("ogrn")
            if not ogrn:
                continue
            org_counts[ogrn] = org_counts.get(ogrn, 0) + 1
            org_keywords.setdefault(ogrn, set()).update(card.get("keyword_list") or [])

        for ogrn, count in org_counts.items():
            existing = await db.scalar(
                select(Organization).where(Organization.ogrn == ogrn)
            )
            if existing:
                existing.projects_count = count
                existing.competencies = sorted(org_keywords.get(ogrn, set()))[:30]
                org_by_ogrn[ogrn] = existing
                continue
            first: dict[str, Any] = next(
                (c for c in cards if (c.get("executor") or {}).get("ogrn") == ogrn),
                {},
            )
            ex = first.get("executor") or {}
            org = Organization(
                name=ex.get("name") or ex.get("short_name") or f"Организация {ogrn}",
                short_name=ex.get("short_name"),
                ogrn=ogrn,
                org_type=_org_type(ex.get("name") or ""),
                region=ex.get("territory"),  # территория в компакте
                competencies=sorted(org_keywords.get(ogrn, set()))[:30],
                projects_count=count,
            )
            db.add(org)
            await db.flush()
            org_by_ogrn[ogrn] = org
        await db.commit()

        # ── Перенос: удаляем старые НИОКТР-технологии ──
        if drop_old_technologies:
            result = await db.execute(
                delete(Technology).where(Technology.source_uri.like("nioktr:%"))
            )
            print(f"Технологии старого раздела НИОКТР удалено: {getattr(result, 'rowcount', 0)}")

        # ── Карточки НИОКТР ──
        existing_regs = {
            reg
            for (reg,) in (
                await db.execute(select(NioktrCard.registration_number))
            ).all()
        }
        inserted = 0
        updated = 0
        no_reg_counter = 0
        for card in cards:
            reg = card.get("registration_number")
            if not reg or str(reg).strip().lower() == "none":
                # Источник содержит карточки с номером-строкой "None" — даём суррогат
                no_reg_counter += 1
                reg = f"NO-REG-{no_reg_counter}"
            ex = card.get("executor") or {}
            ogrn = ex.get("ogrn") or ""
            org = org_by_ogrn.get(ogrn) if ogrn else None
            budgets = [
                {
                    "funds": b.get("funds"),
                    "budget_type": b.get("budget_type"),
                }
                for b in (card.get("budgets") or [])
            ]
            values = dict(
                name=card.get("name") or reg,
                annotation=card.get("annotation"),
                keywords=card.get("keyword_list") or [],
                nioktr_types=card.get("nioktr_types") or [],
                state_program=card.get("state_program"),
                federal_program=card.get("federal_program"),
                created_date=_iso_clean(card.get("created_date")),
                start_date=_iso_clean(card.get("start_date")),
                end_date=_iso_clean(card.get("end_date")),
                is_ai_area=bool(card.get("is_ai_area")),
                is_ai_usage=bool(card.get("is_ai_usage")),
                executor_name=ex.get("name"),
                executor_short_name=ex.get("short_name"),
                executor_ogrn=ogrn or None,
                executor_territory=ex.get("territory"),
                customer_name=card.get("customer"),
                budgets=budgets,
                organization_id=org.id if org else None,
                source="МИНОБРНАУКИ России",
            )
            if reg in existing_regs:
                card_row = await db.scalar(
                    select(NioktrCard).where(NioktrCard.registration_number == reg)
                )
                for key, val in values.items():
                    setattr(card_row, key, val)
                updated += 1
                continue
            db.add(NioktrCard(registration_number=reg, **values))
            inserted += 1
        await db.commit()
        print(
            f"Организации: {len(org_counts)} | Карточки НИОКТР: +{inserted} "
            f"(обновлено {updated}) | Всего в БД: {len(existing_regs) + inserted}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Импорт НИОКТР в реестры")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument(
        "--keep-old-technologies",
        action="store_true",
        help="не удалять старые записи technologies с source_uri nioktr:*",
    )
    args = parser.parse_args()
    asyncio.run(seed(Path(args.input), drop_old_technologies=not args.keep_old_technologies))
