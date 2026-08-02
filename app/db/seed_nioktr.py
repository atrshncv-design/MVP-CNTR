"""Импорт выборки НИОКТР в реестры: organizations + technologies.

Использование:
    uv run python -m app.db.seed_nioktr [--input data/nioktr_sample.json]

Идемпотентно: организации дедуплицируются по ОГРН, технологии — по
registration_number.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.core.database import SessionLocal
from app.db.models import Organization, Technology

DEFAULT_INPUT = Path(__file__).resolve().parent.parent.parent / "data" / "nioktr_sample.json"

UNIVERSITY_MARKERS = ("УНИВЕРСИТЕТ", "ИНСТИТУТ", "АКАДЕМИЯ", "ВЫСШЕЙ ШКОЛЫ", "НИИ")


def _org_type(name: str) -> str:
    upper = (name or "").upper()
    if any(m in upper for m in UNIVERSITY_MARKERS):
        return "scientific_org"
    return "company"


async def seed(input_path: Path) -> None:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    cards = data.get("cards", [])

    async with SessionLocal() as db:
        # ── Организации ──
        org_by_ogrn: dict[str, Organization] = {}
        org_counts: dict[str, int] = {}
        org_keywords: dict[str, set[str]] = {}
        for card in cards:
            ex = card.get("executor") or {}
            ogrn = ex.get("ogrn")
            if not ogrn:
                continue
            org_counts[ogrn] = org_counts.get(ogrn, 0) + 1
            org_keywords.setdefault(ogrn, set()).update(card.get("keywords") or [])

        for ogrn, count in org_counts.items():
            existing = await db.scalar(
                select(Organization).where(Organization.ogrn == ogrn)
            )
            if existing:
                existing.projects_count = count
                org_by_ogrn[ogrn] = existing
                continue
            first = next(
                (c for c in cards if (c.get("executor") or {}).get("ogrn") == ogrn),
                {},
            )
            ex = first.get("executor") or {}
            org = Organization(
                name=ex.get("name") or ex.get("short_name") or f"Организация {ogrn}",
                short_name=ex.get("short_name"),
                ogrn=ogrn,
                org_type=_org_type(ex.get("name") or ""),
                region=ex.get("region"),
                competencies=sorted(org_keywords.get(ogrn, set()))[:30],
                projects_count=count,
            )
            db.add(org)
            await db.flush()
            org_by_ogrn[ogrn] = org
        await db.commit()

        # ── Технологии ──
        inserted = 0
        for card in cards:
            reg = card.get("registration_number")
            if not reg:
                continue
            existing = await db.scalar(
                select(Technology).where(Technology.registration_number == reg)
            )
            if existing:
                continue
            ex = card.get("executor") or {}
            ogrn = ex.get("ogrn") or ""
            org = org_by_ogrn.get(ogrn) if ogrn else None
            tech = Technology(
                name=card.get("name") or reg,
                description=(card.get("annotation") or "")[:4000] or None,
                category="AI/ML" if card.get("is_ai_area") else "НИОКТР",
                keywords=card.get("keywords") or [],
                registration_number=reg,
                organization_id=org.id if org else None,
                source_uri=f"nioktr:{reg}",
            )
            db.add(tech)
            inserted += 1
        await db.commit()
        print(f"Организации: {len(org_counts)} | Технологии: +{inserted} (идемпотентно)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Импорт НИОКТР в реестры")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    args = parser.parse_args()
    asyncio.run(seed(Path(args.input)))
