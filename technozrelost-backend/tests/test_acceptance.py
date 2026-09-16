"""Таск 10 (G47/G43–G45): приёмка — лёгкий harness, dry-run алерта.

Швы — публичные границы `acceptance`: вердикт pass/fail по порогам G47,
процедура dry-run синтетического алерта без секретов и сети. К живому
серверу Beget тесты не ходят: harness гоняется против локального
stdlib-стаба, ожидаемые пороги — ручные значения из брифа 2026-09-16
(99% успеха, API p95 ≤1с, страницы ≤2с, RAM <80%), а не из кода.
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_acceptance_thresholds_match_brief_g47():
    load = load_module("acceptance_load", INFRA_ROOT / "acceptance_load.py")

    assert load.THRESHOLDS["success_rate"] == 0.99
    assert load.THRESHOLDS["api_p95_s"] == 1.0
    assert load.THRESHOLDS["page_p95_s"] == 2.0
    assert load.THRESHOLDS["ram_used_percent"] == 80.0


def test_percentile_is_hand_computed():
    load = load_module("acceptance_load", INFRA_ROOT / "acceptance_load.py")

    samples = [float(value) for value in (10, 20, 30, 40, 50, 60, 70, 80, 90, 100)]
    assert load.percentile(samples, 95) == 100.0
    assert load.percentile(samples, 50) == 50.0
    assert load.percentile([1.0], 95) == 1.0
    assert load.percentile([], 95) == 0.0


def test_verdict_passes_only_inside_all_g47_gates():
    load = load_module("acceptance_load", INFRA_ROOT / "acceptance_load.py")

    good = {"success_rate": 0.995, "api_p95_s": 0.4, "page_p95_s": 1.2, "ram_percent": 61.0}
    assert load.verdict(good)["overall"] == "PASS"

    for key, bad_value in (
        ("success_rate", 0.98),
        ("api_p95_s", 1.01),
        ("page_p95_s", 2.01),
        ("ram_percent", 80.0),
    ):
        metrics = dict(good)
        metrics[key] = bad_value
        assert load.verdict(metrics)["overall"] == "FAIL", key

    unknown_ram = dict(good)
    unknown_ram["ram_percent"] = None
    failed = load.verdict(unknown_ram)
    assert failed["overall"] == "FAIL"
    assert failed["checks"]["ram"].startswith("FAIL")


class StubHandler(BaseHTTPRequestHandler):
    mode = "ok"

    def do_GET(self):  # noqa: N802
        if self.mode == "broken" and self.path.startswith("/api/v1/projects/registry"):
            body, status = b"error", 500
        else:
            body, status = b'{"status":"ok"}', 200
        payload = body if self.path != "/" else b"<html>page</html>"
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


def run_harness_against_stub(mode: str, tmp_path: Path) -> subprocess.CompletedProcess[str]:
    StubHandler.mode = mode
    server = ThreadingHTTPServer(("127.0.0.1", 0), StubHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_address[1]}"
        report = tmp_path / "acceptance.json"
        env = {**os.environ, "PYTHONPATH": str(BACKEND_ROOT)}
        return subprocess.run(
            [
                sys.executable,
                str(INFRA_ROOT / "acceptance_load.py"),
                "--api-url",
                base,
                "--page-url",
                base,
                "--concurrency",
                "5",
                "--requests",
                "20",
                "--report",
                str(report),
            ],
            env=env,
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
    finally:
        server.shutdown()
        thread.join()


def test_harness_passes_against_healthy_local_stub(tmp_path: Path):
    result = run_harness_against_stub("ok", tmp_path)

    assert result.returncode == 0, result.stderr
    assert "ACCEPTANCE PASS" in result.stdout
    report = json.loads((tmp_path / "acceptance.json").read_text(encoding="utf-8"))
    assert report["verdict"] == "PASS"
    assert report["metrics"]["success_rate"] == 1.0


def test_harness_fails_when_registry_errors_drag_success_below_99(tmp_path: Path):
    result = run_harness_against_stub("broken", tmp_path)

    assert result.returncode == 1
    assert "ACCEPTANCE FAIL" in result.stdout


def test_alert_dryrun_sends_nothing_and_names_no_values(tmp_path: Path):
    env = {k: v for k, v in os.environ.items() if "TELEGRAM" not in k}
    env.update(
        {
            "PYTHONPATH": str(BACKEND_ROOT),
            "TELEGRAM_BOT_TOKEN": "synthetic-token-value",
            "TELEGRAM_CHAT_ID": "synthetic-chat-value",
        }
    )
    result = subprocess.run(
        [sys.executable, str(INFRA_ROOT / "acceptance_alert_dryrun.py")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stderr
    assert "DRY-RUN" in result.stdout
    assert "TELEGRAM_BOT_TOKEN" in result.stdout
    assert "synthetic-token-value" not in result.stdout + result.stderr
    assert "synthetic-chat-value" not in result.stdout + result.stderr
    assert "api.telegram.org" not in result.stdout + result.stderr
