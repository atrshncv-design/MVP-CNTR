"""Санитизация HTML-контента новостей (тикет 05, спека §3.2/§3.7).

Контент приходит из текстового редактора фронтенда и встраивается в
страницы через ``dangerouslySetInnerHTML`` — backend обязан вычистить
небезопасные теги/атрибуты (152-ФЗ/ВПК; сторонние WYSIWYG-библиотеки
вне объёма, спека §6).

Подход: allowlist на основе ``html.parser`` (stdlib, без зависимостей):
- разрешены только структурные «безопасные» теги;
- атрибуты — только whitelist (href/src с безопасными схемами,
  относительные пути для img — storage-ключи медиа);
- ``script/style/iframe/object/embed/form/...`` — удаляются вместе с
  содержимым;
- остальное экранируется (``html.escape``).
"""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser

# Разрешённые структурные теги (без script/style/iframe и т.п.).
_ALLOWED_TAGS = {
    "p",
    "br",
    "hr",
    "strong",
    "b",
    "em",
    "i",
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
    "span",
    "div",
}

# (тег → {атрибут: допустимые схемы}) — всё остальное вырезается.
_URL_ATTRS: dict[str, dict[str, tuple[str, ...]]] = {
    "a": {"href": ("http", "https", "mailto")},
    "img": {"src": ("http", "https")},
}

# Контейнеры, удаляемые вместе с содержимым.
_STRIP_CONTAINER_TAGS = {
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "textarea",
    "button",
    "select",
    "option",
    "link",
    "meta",
    "svg",
    "math",
}


def _safe_url(value: str, schemes: tuple[str, ...]) -> bool:
    """URL допустим: относительный путь (storage-ключ) или известная схема."""
    candidate = value.strip()
    if not candidate:
        return False
    if candidate.startswith("/"):
        return True
    lowered = candidate.lower()
    return any(lowered.startswith(f"{scheme}:") for scheme in schemes)


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._out: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _STRIP_CONTAINER_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag not in _ALLOWED_TAGS:
            # Неизвестный тег — экранируем как текст (без атрибутов).
            self._out.append(html.escape(f"<{tag}>"))
            return
        allowed: list[tuple[str, str]] = []
        for name, value in attrs:
            name_l = name.lower()
            if tag == "a" and name_l == "rel":
                allowed.append((name_l, "nofollow noopener noreferrer"))
                continue
            url_schemes = _URL_ATTRS.get(tag, {}).get(name_l)
            if url_schemes is not None:
                if value is None or not _safe_url(value, url_schemes):
                    continue
                allowed.append((name_l, value))
            elif name_l in ("alt", "title") and value is not None:
                allowed.append((name_l, value))
        attrs_str = "".join(
            f' {key}="{html.escape(val, quote=True)}"' for key, val in allowed
        )
        self._out.append(f"<{tag}{attrs_str}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag in _ALLOWED_TAGS and not self._skip_depth:
            self._out.append(f"</{tag}>")

    def handle_endtag(self, tag: str) -> None:
        if tag in _STRIP_CONTAINER_TAGS:
            if self._skip_depth > 0:
                self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag in _ALLOWED_TAGS:
            self._out.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self._skip_depth:
            self._out.append(html.escape(data))

    def handle_comment(self, data: str) -> None:
        return  # комментарии удаляются

    def handle_decl(self, decl: str) -> None:
        return  # DOCTYPE и прочие декларации удаляются


def sanitize_html(raw: str | None) -> str:
    """Возвращает безопасный HTML; None/пустой вход → пустая строка."""
    if not raw:
        return ""
    parser = _Sanitizer()
    parser.feed(raw)
    parser.close()
    return "".join(parser._out)


def strip_tags(raw: str | None) -> str:
    """Текст без HTML-тегов с нормализованными пробелами (для excerpt)."""
    if not raw:
        return ""
    text = sanitize_html(raw)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()
