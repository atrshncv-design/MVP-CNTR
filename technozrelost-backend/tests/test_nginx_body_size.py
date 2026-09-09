"""Таск 07 (R05i, история 16): лимит тела прод-балансировщика под загрузки.

Шов — HTTP-граница плюс текст proxy-конфига (прецедент — nginx-контракт
в test_sse_ticket.py): прод-nginx обязан пропускать легитимный файл ровно
25 МБ (тело = файл + multipart-конверт), а тело сверх лимита оба слоя
(nginx и backend-middleware) режут внятным 413. Единый источник лимита —
app/core/config.py max_request_body_mb; равенство сверяется тестом, чтобы
значения не разъехались снова.

Реальный 25-МБ multipart гонять не нужно: backend-middleware решает по
заголовку Content-Length до чтения тела, поэтому границу проверяем
подменённым заголовком при крошечном теле — тем же HTTP, что видит прод.
"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent
NGINX_PROD_CONF = BACKEND_ROOT / "infra" / "nginx" / "nginx.prod.conf"

# История 16: легитимный файл — ровно 25 МиБ чистых байт файла.
FILE_25MB = 25 * 1024 * 1024
# Верхняя оценка multipart-конверта (boundary + заголовки частей + поле
# title): вживую это сотни байт, берём 64 КиБ с запасом. Число ручное, а не
# из кода под тестом — иначе тест согласится с кодом всегда.
MULTIPART_ENVELOPE_RESERVE = 64 * 1024


def _nginx_body_bytes() -> int:
    """client_max_body_size из прод-конфига в байтах (nginx: k/m = 1024)."""
    source = NGINX_PROD_CONF.read_text(encoding="utf-8")
    matches = re.findall(r"(?m)^\s*client_max_body_size\s+(\d+)\s*([kKmM]?)\s*;", source)
    assert len(matches) == 1, f"ожидался ровно один лимит тела, найдено: {matches}"
    value, unit = matches[0]
    factor = {"": 1, "k": 1024, "m": 1024 * 1024}[unit.lower()]
    return int(value) * factor


def test_proxy_allows_exact_25mb_file_with_envelope(client: TestClient) -> None:
    """История 16: файл ровно 25 МБ + конверт проходит оба слоя (не 413)."""
    from app.services import file_storage

    assert file_storage.MAX_FILE_SIZE == FILE_25MB
    body_len = FILE_25MB + MULTIPART_ENVELOPE_RESERVE
    # Backend-слой тем же HTTP: заявленная длина влезает в глобальный лимит
    # (мимо — 401 от обработчика логина, а не 413 от middleware).
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nginx-boundary@example.com", "password": "x"},
        headers={"content-length": str(body_len)},
    )
    assert response.status_code == 401, response.text
    # Proxy-слой: та же заявленная длина влезает в client_max_body_size.
    assert body_len <= _nginx_body_bytes()


def test_proxy_limit_matches_backend_single_source() -> None:
    """Единый источник: nginx равен backend-лимиту тела, не лимиту файла."""
    import app.main as main_mod

    assert _nginx_body_bytes() == main_mod.max_request_body_bytes


def test_proxy_over_limit_rejected_with_413(client: TestClient) -> None:
    """Сверх лимита — внятный 413; границу берём из proxy-конфига."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nginx-over@example.com", "password": "x"},
        headers={"content-length": str(_nginx_body_bytes() + 1)},
    )
    assert response.status_code == 413
