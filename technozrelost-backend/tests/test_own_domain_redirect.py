"""Таск 07 (R08): 301 со старого имени — рендер nginx-инклуда из env.

Шов — код возврата + текст сгенерированного `redirect.conf` при подменённом
env. К живому серверу и docker не ходим: скрипт только валидирует имена
(та же строгость, что в гейте) и пишет файл. Ожидаемые значения — ручные.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
RENDER = INFRA_ROOT / "render_legacy_redirect.sh"

NEW_NAME = "cntr-prod.ru"
OLD_NAME = "1-2-3-4.sslip.io"

_SCRUB_KEYS = ("PUBLIC_HOST", "LEGACY_PUBLIC_HOST", "LEGACY_REDIRECT_OUT")


def _run_render(public: str, legacy: str | None, out: Path) -> subprocess.CompletedProcess[str]:
    env = {k: v for k, v in os.environ.items() if k not in _SCRUB_KEYS}
    env.update({"PUBLIC_HOST": public, "LEGACY_REDIRECT_OUT": str(out)})
    if legacy is not None:
        env["LEGACY_PUBLIC_HOST"] = legacy
    return subprocess.run(
        ["bash", str(RENDER)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_render_writes_301_blocks_for_legacy_pair(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    result = _run_render(NEW_NAME, OLD_NAME, out)
    assert result.returncode == 0, result.stderr
    text = out.read_text(encoding="utf-8")
    assert f"server_name {OLD_NAME};" in text
    assert f"server_name {NEW_NAME};" not in text
    assert f"return 301 https://{NEW_NAME}$request_uri;" in text
    assert "/.well-known/acme-challenge/" in text
    assert "/etc/nginx/certs/fullchain.pem" in text


def test_render_writes_comment_only_without_legacy(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    result = _run_render(NEW_NAME, None, out)
    assert result.returncode == 0, result.stderr
    text = out.read_text(encoding="utf-8")
    assert "server_name" not in text
    assert "return 301" not in text


def test_render_rejects_legacy_equal_to_public(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    result = _run_render(NEW_NAME, NEW_NAME, out)
    assert result.returncode == 1
    assert "совпадает" in result.stderr
    assert not out.exists()


def test_render_rejects_bad_legacy_before_writing(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    result = _run_render(NEW_NAME, "localhost", out)
    assert result.returncode == 1
    assert "LEGACY_PUBLIC_HOST" in result.stderr
    assert not out.exists()


def test_render_rejects_injection_in_names(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    result = _run_render(NEW_NAME, "x; rm -rf /", out)
    assert result.returncode == 1
    assert not out.exists()


def test_render_rejects_placeholder_public(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    result = _run_render("vash-domen.ru", OLD_NAME, out)
    assert result.returncode == 1
    assert "плейсхолдер" in result.stderr
    assert not out.exists()


def test_render_accepts_reverse_direction_pair(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    result = _run_render(OLD_NAME, NEW_NAME, out)
    assert result.returncode == 0, result.stderr
    text = out.read_text(encoding="utf-8")
    assert f"server_name {NEW_NAME};" in text
    assert f"return 301 https://{OLD_NAME}$request_uri;" in text
