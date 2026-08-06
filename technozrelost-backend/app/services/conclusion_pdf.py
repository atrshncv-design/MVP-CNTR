"""PDF-заключение менеджера по рассмотренной заявке (тикет 09).

Генерация валидного PDF через reportlab с кириллическим шрифтом
(системный: Arial на macOS, DejaVuSans на Linux; Dockerfile ставит
fonts-dejavu-core). Заключение подписывается данными менеджера и
уровнями — неизменяемый артефакт решения.
"""

from __future__ import annotations

import io
from datetime import UTC, datetime
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",  # macOS
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Debian/Ubuntu
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",  # Fedora/RHEL
]

_FONT_NAME = "Cyr"


def _register_font() -> str:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            pdfmetrics.registerFont(TTFont(_FONT_NAME, path))
            return _FONT_NAME
    return "Helvetica"  # fallback: только ASCII (без кириллицы)


def build_conclusion_pdf(
    *,
    project_name: str,
    project_code: str,
    from_level: int,
    to_level: int,
    status: str,
    manager_name: str,
    reason: str | None,
    decided_at: datetime | None,
) -> bytes:
    """Строит PDF-заключение по рассмотренной заявке (approved/rejected)."""
    font = _register_font()
    buf = io.BytesIO()
    page = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    page.setTitle(f"Заключение по заявке {project_code}")
    page.setFont(font, 16)
    page.drawString(20 * mm, height - 20 * mm, "ЗАКЛЮЧЕНИЕ ЦНТР")
    page.setFont(font, 10)
    page.drawString(
        20 * mm,
        height - 27 * mm,
        f"по ГОСТ Р 58048-2017 · сформировано {datetime.now(UTC).strftime('%d.%m.%Y %H:%M UTC')}",
    )

    page.setFont(font, 12)
    y = height - 45 * mm
    rows = [
        ("Проект", project_name),
        ("Код", project_code),
        ("Переход уровня", f"УГТ {from_level} → УГТ {to_level}"),
        (
            "Решение",
            "ПОДТВЕРЖДЕНО" if status == "approved" else "ОТКЛОНЕНО",
        ),
        ("Менеджер", manager_name or "—"),
        (
            "Дата решения",
            decided_at.strftime("%d.%m.%Y %H:%M") if decided_at else "—",
        ),
    ]
    for label, value in rows:
        page.drawString(20 * mm, y, f"{label}: {value}")
        y -= 9 * mm

    if reason:
        page.setFont(font, 11)
        page.drawString(20 * mm, y - 4 * mm, "Основание:")
        page.setFont(font, 10)
        text = page.beginText(20 * mm, y - 12 * mm)
        text.setFont(font, 10)
        text.textLines(reason[:600])
        page.drawText(text)

    page.showPage()
    page.save()
    return buf.getvalue()
