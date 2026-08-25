"""Санитизация HTML-контента новостей при записи (F04-11, R05; OWASP-базовая линия).

Контент новостей рендерится на /news/[id] через ``dangerouslySetInnerHTML``,
поэтому единственная точка записи обязана вычищать разметку. Санитайзер —
``nh3`` (Rust-биндинг ammonia) с allow-list'ом: текстовые/структурные теги,
ссылки и картинки; script/iframe/object удаляются вместе с содержимым,
атрибуты вне allow-list (включая все on*-обработчики) отсекаются,
URL-схемы ограничены http/https/mailto (javascript:-URL невозможны).

Единая точка для любых контентных HTML-полей: новые модули (в т.ч.
новостной раздел) вызывают ``sanitize_html`` при записи, а не хранят сырой HTML.
"""

from __future__ import annotations

import nh3

_ALLOWED_TAGS = frozenset(
    {
        "p",
        "br",
        "hr",
        "b",
        "strong",
        "i",
        "em",
        "u",
        "s",
        "sub",
        "sup",
        "ul",
        "ol",
        "li",
        "h2",
        "h3",
        "h4",
        "blockquote",
        "pre",
        "code",
        "span",
        "div",
        "a",
        "img",
        "figure",
        "figcaption",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
    }
)

_ALLOWED_URL_SCHEMES = frozenset({"http", "https", "mailto"})

_ALLOWED_ATTRIBUTES = {
    # rel добавляется принудительно (link_rel), вручную не разрешён
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "width", "height"},
}


def sanitize_html(raw: str) -> str:
    """Возвращает безопасный HTML: всё вне allow-list'а вырезано/экранировано."""
    return nh3.clean(
        raw,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        url_schemes=_ALLOWED_URL_SCHEMES,
        link_rel="noopener noreferrer",
    )
