"""Санитизация HTML новостей на записи: stored XSS исключён (F04-11, F03-02).

Контент новостей рендерится на /news/[id] через dangerouslySetInnerHTML,
поэтому бэкенд обязан вычищать разметку allow-list'ом при записи.
"""

from __future__ import annotations

from app.services.html_sanitizer import sanitize_html


def test_script_tag_is_removed() -> None:
    clean = sanitize_html("<p>новость</p><script>alert(1)</script>")
    assert "<script" not in clean
    assert "alert(1)" not in clean
    assert "<p>новость</p>" in clean


def test_event_handler_attribute_is_removed() -> None:
    clean = sanitize_html('<img src="cover.png" onerror="alert(1)">')
    assert "onerror" not in clean
    assert "<img" in clean


def test_formatting_links_and_images_are_kept() -> None:
    dirty = (
        "<b>жирный</b>"
        '<a href="https://example.com/x">ссылка</a>'
        '<img src="/media/2026/cover.png" alt="обложка">'
    )
    clean = sanitize_html(dirty)
    assert "<b>жирный</b>" in clean
    assert 'href="https://example.com/x"' in clean
    assert "</a>" in clean
    assert 'src="/media/2026/cover.png"' in clean


def test_javascript_url_is_neutralized() -> None:
    clean = sanitize_html('<a href="javascript:alert(1)">текст</a>')
    assert "javascript:" not in clean


def test_iframe_and_object_are_removed() -> None:
    clean = sanitize_html(
        '<p>текст</p><iframe src="https://evil.example"></iframe>'
        '<object data="https://evil.example/x.swf"></object>'
    )
    assert "iframe" not in clean
    assert "object" not in clean
    assert "evil.example" not in clean
