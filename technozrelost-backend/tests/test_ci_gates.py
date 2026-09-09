"""Таск 08 (R05i, история 15): зелёные гейты CI.

Шов — текст .github/workflows/ci.yml (прецедент — nginx/sse-контракты
в test_nginx_body_size.py / test_sse_ticket.py): CI обязан ловить то,
что ломалось — линт тестов, сборку образов, smoke готовности зависимостей.
Красный гейт блокирует мерж: без continue-on-error и с триггером на PR.
"""
from __future__ import annotations

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
CI_YML = REPO_ROOT / ".github" / "workflows" / "ci.yml"


def _ci() -> str:
    assert CI_YML.is_file(), f"нет CI-конфига: {CI_YML}"
    return CI_YML.read_text(encoding="utf-8")


def test_ruff_covers_code_and_tests() -> None:
    """Линт чист и по коду, и по тестам — без исключений под ковром."""
    ci = _ci()
    assert "ruff check" in ci
    assert "scripts/udgu_ingest" in ci, "ruff должен покрывать scripts/udgu_ingest"
    for token in ("app", "tests", "infra/alerter"):
        assert token in ci, f"ruff потерял зону: {token}"
    assert "per-file-ignores" not in ci
    assert "extend-ignore" not in ci


def test_backend_image_builds() -> None:
    """CI собирает backend-образ (блокеры прод-образа — до мержа)."""
    ci = _ci().lower()
    assert "docker build" in ci
    assert "dockerfile" in ci


def test_prod_client_libs_checked() -> None:
    """CI проверяет наличие клиентских библиотек прод-зависимостей."""
    ci = _ci().lower()
    assert "redis" in ci
    assert "minio" in ci
    assert ("pip show" in ci) or ("import redis" in ci)


def test_readiness_smoke_covers_deps() -> None:
    """CI включает smoke готовности: БД, кэш, хранилище, скан."""
    ci = _ci().lower()
    assert "smoke" in ci, "нет smoke-шага готовности"
    assert ("postgres" in ci) or ("db" in ci)
    assert ("redis" in ci) or ("cache" in ci)
    assert ("minio" in ci) or ("storage" in ci)
    assert ("clamav" in ci) or ("scan" in ci)


def test_red_gate_blocks_merge() -> None:
    """Красный гейт блокирует мерж: PR-триггер, без глушилок ошибок."""
    ci = _ci()
    low = ci.lower()
    assert "pull_request" in low, "CI должен срабатывать на PR"
    assert "continue-on-error: true" not in low
    assert "backend" in low and "frontend" in low
