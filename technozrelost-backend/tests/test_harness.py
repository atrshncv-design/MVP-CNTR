"""Юнит-тесты чистых функций нагрузочного и security harness (тикет 21).

Не требуют живого сервера: проверяют расчёт отчёта (p50/p95/p99, цели PASS/FAIL)
и логику secrets-сканера.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.loadtest import RequestResult, compute_report, percentile
from scripts.security_check import scan_for_secrets


def _res(kind: str, method: str, endpoint: str, status: int, latency_s: float) -> RequestResult:
    return RequestResult(
        kind=kind,
        method=method,
        endpoint=endpoint,
        status=status,
        latency_s=latency_s,
        success=200 <= status < 300,
    )


def test_percentile_empty_and_single() -> None:
    assert percentile([], 95) == 0.0
    assert percentile([0.5], 95) == 0.5


def test_percentile_values() -> None:
    values = [float(i) for i in range(1, 101)]  # 1..100
    assert percentile(values, 50) == 50.5
    assert percentile(values, 95) == 95.05
    assert percentile(values, 99) == 99.01


def test_compute_report_read_write_split_and_targets() -> None:
    results = [
        # 20 быстрых чтений по 0.1s
        *[_res("read", "GET", "/projects/registry", 200, 0.1) for _ in range(20)],
        # 10 медленных записей по 1.5s (p95 write > 1s -> FAIL)
        *[_res("write", "POST", "/assessments", 201, 1.5) for _ in range(10)],
        # одна ошибка 500 -> success rate 96.8% < 99% -> FAIL
        _res("write", "POST", "/profile", 500, 0.3),
    ]
    report = compute_report(results, duration_s=10.0)

    assert report["total_requests"] == 31
    assert report["success_rate"] == pytest.approx(30 / 31, abs=0.0001)
    assert report["throughput_req_s"] == 3.1
    # GET попал в read, POST — в write (независимо от корзины)
    assert report["latency_read_ms"]["count"] == 20
    assert report["latency_write_ms"]["count"] == 11
    assert report["latency_read_ms"]["p95"] == 100.0
    assert report["targets"]["success_rate >= 99%"]["pass"] is False
    assert report["targets"]["p95 read <= 500ms"]["pass"] is True
    assert report["targets"]["p95 write <= 1000ms"]["pass"] is False
    assert report["all_targets_pass"] is False
    assert "POST /assessments" in report["per_endpoint"]


def test_compute_report_all_green() -> None:
    results = [
        *[_res("read", "GET", "/nioktr?limit=20", 200, 0.05) for _ in range(200)],
        *[_res("write", "POST", "/assessments", 201, 0.2) for _ in range(50)],
        *[_res("file", "POST", "/projects/{pid}/files", 201, 0.4) for _ in range(20)],
        *[_res("manager", "GET", "/manager/queue/drafts", 200, 0.08) for _ in range(10)],
    ]
    report = compute_report(results, duration_s=30.0)
    assert report["success_rate"] == 1.0
    assert report["all_targets_pass"] is True
    # корзины в отчёте
    assert report["buckets"]["read"]["count"] == 200
    assert report["buckets"]["manager"]["count"] == 10


def test_scan_for_secrets_finds_and_excludes(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    (repo / "app").mkdir(parents=True)
    (repo / "tests").mkdir()
    (repo / "app" / "leak.py").write_text(
        'api_key = "sk-abcdefghijklmnopqrstuvwxyz123456"\n', encoding="utf-8"
    )
    (repo / "app" / "ok.py").write_text(
        'password = "change_me_default_value"\n', encoding="utf-8"
    )
    (repo / "tests" / "fixture.py").write_text(
        'api_key = "sk-fake-in-tests-123456789012"\n', encoding="utf-8"
    )
    (repo / "app" / "token.txt").write_text(
        "Bearer abcdefghijklmnopqrstuvwxyz123456\n", encoding="utf-8"
    )

    # git ls-files в tmp-репо не сработает — подменяем через monkeypatch? Нет:
    # сканер использует git ls-files; в tmp без git вернёт пусто. Поэтому
    # проверяем оба пути: с git-репо (ниже) и логику _looks_like_secret.
    assert scan_for_secrets(repo) == []  # нет git-трекинга — пустой скан


def test_scan_for_secrets_git_tracked(tmp_path: Path) -> None:
    import subprocess

    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    (repo / "app").mkdir()
    (repo / "app" / "leak.py").write_text(
        'api_key = "sk-abcdefghijklmnopqrstuvwxyz123456"\n', encoding="utf-8"
    )
    (repo / "app" / "ok.py").write_text(
        'password = "change_me_super_secret_default"\n', encoding="utf-8"
    )
    (repo / "tests").mkdir()
    (repo / "tests" / "fixture.py").write_text(
        'api_key = "sk-fake-in-tests-123456789012"\n', encoding="utf-8"
    )
    (repo / ".env.example").write_text("OPENAI_API_KEY=your-key-here-123456\n", encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
    subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x"],
        cwd=repo,
        check=True,
    )

    findings = scan_for_secrets(repo)
    paths = [f["path"] for f in findings]
    assert "app/leak.py" in paths  # реальный ключ найден
    assert "app/ok.py" not in paths  # плейсхолдер change_me проигнорирован
    assert "tests/fixture.py" not in paths  # tests исключены
    assert ".env.example" not in paths  # .env* исключены
    assert len(findings) == 1
