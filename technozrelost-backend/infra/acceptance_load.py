#!/usr/bin/env python3
"""Лёгкий нагрузочный harness приёмки P1 (таск 10, истории 3/9, G47).

Проверяет пороги брифа 2026-09-16 против ЛОКАЛЬНОГО стенда:
  success_rate >= 99%, API p95 <= 1с, страницы p95 <= 2с, RAM < 80%.
Только stdlib (urllib + threads): dev-зависимости не нужны.

Шов: код возврата + stdout + JSON-отчёт.
  0 — ACCEPTANCE PASS (все четыре порога);
  1 — ACCEPTANCE FAIL (порог не пройден, какой — в отчёте);
  2 — внутренняя ошибка (стенд недоступен, нет замера RAM не роняет,
      но помечает RAM как unknown → FAIL, fail-closed).

Против боевого сервера Beget скрипт сам НЕ запускается: точную команду
для оператора см. в `infra/README-ACCEPTANCE.md` (раздел 1).
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Пороги — дословно из брифа 2026-09-16 («Рекомендуемые пороги»),
# история 44/G47. Менять только вместе с брифом.
THRESHOLDS = {
    "success_rate": 0.99,
    "api_p95_s": 1.0,
    "page_p95_s": 2.0,
    "ram_used_percent": 80.0,
}

DEFAULT_CONCURRENCY = 50  # история 9/G03: прогон на 50 concurrent.
DEFAULT_REQUESTS = 500
DEFAULT_TIMEOUT_S = 10.0


def percentile(samples: list[float], pct: float) -> float:
    """Nearest-rank перцентиль; пустая выборка — 0.0 (нечего утверждать)."""
    if not samples:
        return 0.0
    ordered = sorted(samples)
    rank = math.ceil(pct / 100.0 * len(ordered)) - 1
    return ordered[max(0, min(rank, len(ordered) - 1))]


def read_ram_used_percent() -> float | None:
    """Доля занятой RAM хоста, %; None — измерить нечем (fail-closed ниже)."""
    value = _ram_from_proc()
    if value is not None:
        return value
    return _ram_from_sysctl()


def _ram_from_proc() -> float | None:
    try:
        fields: dict[str, int] = {}
        for line in Path("/proc/meminfo").read_text(encoding="ascii").splitlines():
            match = re.match(r"(\w+):\s+(\d+)", line)
            if match:
                fields[match.group(1)] = int(match.group(2))
        total = fields.get("MemTotal", 0)
        available = fields.get("MemAvailable", 0)
        if total <= 0 or available < 0:
            return None
        return (total - available) / total * 100.0
    except OSError:
        return None


def _ram_from_sysctl() -> float | None:
    """macOS-стенд для локальной проверки (не прод-замер)."""
    try:
        total_out = subprocess.run(
            ["sysctl", "-n", "hw.memsize"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        vm_out = subprocess.run(
            ["vm_stat"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if total_out.returncode != 0 or vm_out.returncode != 0:
            return None
        total = int(total_out.stdout.strip())
        page_size = 4096
        size_match = re.search(r"page size of (\d+) bytes", vm_out.stdout)
        if size_match:
            page_size = int(size_match.group(1))
        free_pages = 0
        for key in ("Pages free", "Pages inactive", "Pages speculative"):
            match = re.search(rf"{key}:\s+(\d+)", vm_out.stdout)
            if match:
                free_pages += int(match.group(1))
        if total <= 0:
            return None
        return (total - free_pages * page_size) / total * 100.0
    except (OSError, ValueError):
        return None


def fetch(url: str, timeout_s: float) -> tuple[bool, float]:
    """Один GET: (успех = HTTP 2xx, латентность в секундах)."""
    started = time.monotonic()
    try:
        request = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            ok = 200 <= response.status < 300
            response.read()
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        ok = False
    return ok, time.monotonic() - started


def one_iteration(api_url: str, page_url: str, timeout_s: float) -> list[tuple[str, bool, float]]:
    probes = [
        ("api", f"{api_url}/api/v1/health"),
        ("api", f"{api_url}/api/v1/projects/registry?limit=20"),
        ("page", f"{page_url}/"),
    ]
    return [(kind, *fetch(url, timeout_s)) for kind, url in probes]


def run_load(api_url: str, page_url: str, concurrency: int, requests: int, timeout_s: float):
    ram_before = read_ram_used_percent()
    api_latencies: list[float] = []
    page_latencies: list[float] = []
    outcomes: list[bool] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [
            pool.submit(one_iteration, api_url, page_url, timeout_s) for _ in range(requests)
        ]
        for future in concurrent.futures.as_completed(futures):
            for kind, ok, latency in future.result():
                outcomes.append(ok)
                if kind == "api":
                    api_latencies.append(latency)
                else:
                    page_latencies.append(latency)
    ram_after = read_ram_used_percent()
    ram_samples = [value for value in (ram_before, ram_after) if value is not None]
    total = len(outcomes)
    return {
        "success_rate": (sum(1 for ok in outcomes if ok) / total) if total else 0.0,
        "api_p95_s": percentile(api_latencies, 95),
        "page_p95_s": percentile(page_latencies, 95),
        "ram_percent": max(ram_samples) if ram_samples else None,
        "requests": total,
        "concurrency": concurrency,
    }


def verdict(metrics: dict) -> dict:
    """Вердикт по порогам G47; неизвестный RAM — FAIL (fail-closed)."""
    checks: dict[str, str] = {}
    success = float(metrics["success_rate"])
    checks["success"] = (
        f"PASS success_rate={success:.3f}"
        if success >= THRESHOLDS["success_rate"]
        else f"FAIL success_rate={success:.3f} < {THRESHOLDS['success_rate']}"
    )
    api_p95 = float(metrics["api_p95_s"])
    checks["api_p95"] = (
        f"PASS api_p95={api_p95:.3f}s"
        if api_p95 <= THRESHOLDS["api_p95_s"]
        else f"FAIL api_p95={api_p95:.3f}s > {THRESHOLDS['api_p95_s']}s"
    )
    page_p95 = float(metrics["page_p95_s"])
    checks["page_p95"] = (
        f"PASS page_p95={page_p95:.3f}s"
        if page_p95 <= THRESHOLDS["page_p95_s"]
        else f"FAIL page_p95={page_p95:.3f}s > {THRESHOLDS['page_p95_s']}s"
    )
    ram = metrics["ram_percent"]
    if ram is None:
        checks["ram"] = "FAIL ram=unknown (нечем измерить, fail-closed)"
    elif float(ram) < THRESHOLDS["ram_used_percent"]:
        checks["ram"] = f"PASS ram={float(ram):.1f}%"
    else:
        checks["ram"] = f"FAIL ram={float(ram):.1f}% >= {THRESHOLDS['ram_used_percent']}%"
    overall = "PASS" if all(value.startswith("PASS") for value in checks.values()) else "FAIL"
    return {"overall": overall, "checks": checks}


def run(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--page-url", default="http://127.0.0.1:3000")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    parser.add_argument("--requests", type=int, default=DEFAULT_REQUESTS)
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_S)
    parser.add_argument("--report", default="reports/acceptance-load.json")
    args = parser.parse_args(argv)

    if args.concurrency < 1 or args.requests < 1:
        print("ACCEPTANCE ERROR: concurrency и requests — положительные", file=sys.stderr)
        return 2
    try:
        metrics = run_load(
            args.api_url, args.page_url, args.concurrency, args.requests, args.timeout
        )
    except Exception as exc:  # fail-closed: непонятное состояние — не PASS.
        print(f"ACCEPTANCE ERROR: {type(exc).__name__}", file=sys.stderr)
        return 2

    result = verdict(metrics)
    report = {
        "thresholds": dict(THRESHOLDS),
        "metrics": metrics,
        "checks": result["checks"],
        "verdict": result["overall"],
        "endpoints": {
            "api_health": f"{args.api_url}/api/v1/health",
            "api_registry": f"{args.api_url}/api/v1/projects/registry?limit=20",
            "page": f"{args.page_url}/",
        },
    }
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    print(f"ACCEPTANCE {result['overall']}: {metrics['requests']} req, "
          f"success={metrics['success_rate']:.3f}, "
          f"api_p95={metrics['api_p95_s']:.3f}s, page_p95={metrics['page_p95_s']:.3f}s, "
          f"ram={metrics['ram_percent']}")
    for check in result["checks"].values():
        print(f"  {check}")
    return 0 if result["overall"] == "PASS" else 1


def main() -> int:
    return run(sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
