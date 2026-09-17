#!/usr/bin/env python3
"""Лёгкий нагрузочный harness приёмки P1 (таск 10, истории 3/9, G47; методика — таск 08).

Проверяет пороги брифа 2026-09-16 против ЛОКАЛЬНОГО стенда:
  success_rate >= 99%, API p95 <= 1с, страницы p95 <= 2с, RAM < 80%.
Только stdlib (urllib + threads): dev-зависимости не нужны.

Методика (таск 08, диагноз продакшена 2026-09-17): hammer с одного IP
упирается в анонимный лимит реестра (registry_anon_limit=120/60с) — это
срабатывание защиты от накруток, а не деградация сервиса, поэтому лимиты
НЕ ослабляются, а измерение идёт распределёнными пользователями:

* auth-режим (``--auth-users N``, N>0): harness регистрирует N тестовых
  пользователей ``POST /api/v1/auth/register`` и раздаёт воркерам Bearer
  round-robin; пробы реестра идут аутентифицированными под высокий
  auth-лимит (registry_auth_limit=10000/60с). Любой 429 здесь — провал.
  Именно auth-прогон закрывает гейтовые пороги.
* anon-режим (``--auth-users 0``, дефолт): пробы без Authorization —
  проверка защиты: ожидаемый 429 с главой ``X-Error-Code:
  REGISTRY_RATE_LIMITED`` провалом НЕ считается (исключён из неуспеха),
  429 без главы или с чужой главой — провал.

Шов: код возврата + stdout + JSON-отчёт.
  0 — ACCEPTANCE PASS (все четыре порога);
  1 — ACCEPTANCE FAIL (порог не пройден, какой — в отчёте);
  2 — внутренняя ошибка (стенд недоступен, не поднялись тестовые
      пользователи, нет замера RAM не роняет, но помечает RAM как
      unknown → FAIL, fail-closed).

Против боевого сервера Beget скрипт сам НЕ запускается: точную команду
для оператора см. в `infra/README-ACCEPTANCE.md` (раздел 1).
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import os
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
DEFAULT_AUTH_USERS = 0  # 0 — anon-режим (проверка защиты); >0 — auth-режим.

# Ожидаемый ответ защиты реестра: статус и глава каталога ошибок
# (app/core/errors.py: REGISTRY_RATE_LIMITED; лимиты в app/core/config.py:
# anon registry_anon_limit=120/60с, auth registry_auth_limit=10000/60с).
# Защита от накруток не ослабляется — harness обходит её честными
# учётками, а не поднятием лимитов.
EXPECTED_RATE_LIMIT_STATUS = 429
EXPECTED_RATE_LIMIT_CODE = "REGISTRY_RATE_LIMITED"
ERROR_CODE_HEADER = "X-Error-Code"

REGISTER_PATH = "/api/v1/auth/register"
LOGIN_PATH = "/api/v1/auth/login"
# Роль тестовых учёток — из allowlist саморегистрации
# (app/core/deps.py SELF_REGISTER_ALLOWED_SLUGS): иначе 403.
LOADTEST_ROLE_SLUG = "gk_customer"

# Provisioning auth-режима под зону nginx auth (10r/s burst 10, nodelay;
# см. infra/nginx/nginx.prod.conf, INF-12): зону ослаблять запрещено,
# поэтому регистрация идёт последовательно темпом ~8/с (запас под джиттер
# и фоновые /login), а ответы 429/503 дожимаются ретраями с backoff.
PROVISION_RATE_PER_S = 8.0
PROVISION_MAX_ATTEMPTS = 5
PROVISION_BACKOFF_BASE_S = 0.5
RETRYABLE_REGISTER_STATUSES = frozenset({429, 503})

# Категории ответа пробы: ok (2xx), expected_limited (ожидаемый 429 защиты
# в anon-режиме), failed (всё остальное, включая 429 в auth-режиме).
OK = "ok"
EXPECTED_LIMITED = "expected_limited"
FAILED = "failed"


def percentile(samples: list[float], pct: float) -> float:
    """Nearest-rank перцентиль; пустая выборка — 0.0 (нечего утверждать)."""
    if not samples:
        return 0.0
    ordered = sorted(samples)
    rank = math.ceil(pct / 100.0 * len(ordered)) - 1
    return ordered[max(0, min(rank, len(ordered) - 1))]


def classify(status: int, error_code: str | None, authed: bool) -> str:
    """Категория ответа пробы.

    Ожидаемый 429 защиты (статус + глава каталога) — не провал только
    в anon-режиме: там он доказывает, что защита от накруток сработала.
    В auth-режиме любой 429 — провал: честные учётки под высоким
    auth-лимитом ограничиваться не должны.
    """
    if 200 <= status < 300:
        return OK
    if (
        not authed
        and status == EXPECTED_RATE_LIMIT_STATUS
        and (error_code or "") == EXPECTED_RATE_LIMIT_CODE
    ):
        return EXPECTED_LIMITED
    return FAILED


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


def fetch(
    url: str, timeout_s: float, headers: dict[str, str] | None = None
) -> tuple[int, float, str | None]:
    """Один GET: (HTTP-статус, латентность в секундах, глава X-Error-Code).

    Транспортная ошибка — статус 0 без главы (fail-closed: это провал,
    а не «ожидаемый лимит»).
    """
    started = time.monotonic()
    try:
        request = urllib.request.Request(url, method="GET", headers=headers or {})
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            status = int(response.status)
            error_code = response.headers.get(ERROR_CODE_HEADER)
            response.read()
    except urllib.error.HTTPError as exc:
        status = int(exc.code)
        try:
            error_code = exc.headers.get(ERROR_CODE_HEADER) if exc.headers else None
        except (AttributeError, ValueError):
            error_code = None
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        status, error_code = 0, None
    return status, time.monotonic() - started, error_code


def post_json(url: str, payload: dict[str, object], timeout_s: float) -> dict:
    """Один POST JSON; возвращает разобранное тело. Ошибки — RuntimeError.

    Значения payload (пароли) в сообщениях не отражаются — только статус
    и короткий класс причины.
    """
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url, data=body, method="POST", headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"POST {url} -> HTTP {int(exc.code)}") from exc
    except (urllib.error.URLError, OSError, TimeoutError, ValueError) as exc:
        raise RuntimeError(f"POST {url} -> {type(exc).__name__}") from exc


def _register_one(api_url: str, index: int, stamp: str, timeout_s: float) -> str:
    """Регистрация одной тестовой учётки; возвращает access_token.

    Email уникален на прогон (stamp pid+время): повторный прогон не
    ловит 409. Если 409 всё же случился (гонка прогонов) — fallback
    на login той же парой, чужие учётки не трогаем.
    """
    email = f"acceptance-load-{stamp}-{index}@example.com"
    password = f"Acceptance-Load-{stamp}-{index}-pass"
    payload = {
        "email": email,
        "password": password,
        "full_name": f"Acceptance Load {index}",
        "role_slug": LOADTEST_ROLE_SLUG,
    }
    try:
        data = post_json(f"{api_url}{REGISTER_PATH}", payload, timeout_s)
    except RuntimeError as exc:
        if "HTTP 409" not in str(exc):
            raise
        data = post_json(
            f"{api_url}{LOGIN_PATH}",
            {"email": email, "password": password},
            timeout_s,
        )
    token = data.get("access_token") if isinstance(data, dict) else None
    if not isinstance(token, str) or not token:
        raise RuntimeError(f"POST {api_url}{REGISTER_PATH} -> нет access_token")
    return token


def _register_status_from_error(exc: Exception) -> int | None:
    """HTTP-статус из RuntimeError post_json; None — не HTTP-ошибка."""
    match = re.search(r"HTTP (\d+)", str(exc))
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _is_retryable_register_error(exc: Exception) -> bool:
    """Ретраить только перегрузку/лимит (429/503); остальное — сразу наружу."""
    return _register_status_from_error(exc) in RETRYABLE_REGISTER_STATUSES


def _register_one_with_retry(api_url: str, index: int, stamp: str, timeout_s: float) -> str:
    """Одна учётка с ретраями 429/503 (до PROVISION_MAX_ATTEMPTS попыток).

    Backoff экспоненциальный от PROVISION_BACKOFF_BASE_S: 0.5/1/2/4с.
    Не-retryable (409→login внутри _register_one, 400/403/4xx, транспорт)
    пробрасывается сразу без повторов.
    """
    last_exc: Exception | None = None
    for attempt in range(1, PROVISION_MAX_ATTEMPTS + 1):
        try:
            return _register_one(api_url, index, stamp, timeout_s)
        except RuntimeError as exc:
            last_exc = exc
            if not _is_retryable_register_error(exc) or attempt >= PROVISION_MAX_ATTEMPTS:
                raise
            time.sleep(PROVISION_BACKOFF_BASE_S * (2 ** (attempt - 1)))
    raise last_exc if last_exc is not None else RuntimeError("register retry exhausted")


def provision_auth_tokens(api_url: str, count: int, timeout_s: float) -> list[str]:
    """Регистрация ``count`` тестовых пользователей; Bearer round-robin ниже.

    Последовательно темпом PROVISION_RATE_PER_S (~8/с): запас под зону
    nginx auth 10r/s burst 10, которую ослаблять запрещено. Каждая учётка
    дожимается ретраями 429/503 с backoff (_register_one_with_retry).
    Ошибка любой регистрации — RuntimeError (run() превращает в код 2:
    непонятное состояние — не PASS). Пароли синтетические, в отчёт и
    stdout не попадают; после прогона оператор удаляет учётки
    ``acceptance-load-*@example.com`` (см. README-ACCEPTANCE.md).
    """
    stamp = f"{os.getpid()}-{int(time.time())}"
    interval = 1.0 / PROVISION_RATE_PER_S
    tokens: list[str] = []
    for index in range(count):
        if index > 0:
            time.sleep(interval)
        tokens.append(_register_one_with_retry(api_url, index, stamp, timeout_s))
    return tokens


def auth_headers(token: str | None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"} if token else {}


def one_iteration(
    api_url: str, page_url: str, timeout_s: float, token: str | None = None
) -> list[tuple[str, str, float]]:
    """Три пробы воркера: (вид, категория classify(), латентность).

    Bearer несёт только проба реестра — она единственная под лимитом;
    health и страница идут анонимно, как у живых посетителей.
    """
    authed = token is not None
    probes = [
        ("api", f"{api_url}/api/v1/health", None),
        ("api", f"{api_url}/api/v1/projects/registry?limit=20", token),
        ("page", f"{page_url}/", None),
    ]
    results = []
    for kind, url, probe_token in probes:
        status, latency, error_code = fetch(url, timeout_s, auth_headers(probe_token))
        results.append((kind, classify(status, error_code, authed), latency))
    return results


def run_load(
    api_url: str,
    page_url: str,
    concurrency: int,
    requests: int,
    timeout_s: float,
    tokens: list[str] | None = None,
):
    authed = bool(tokens)
    ram_before = read_ram_used_percent()
    api_latencies: list[float] = []
    page_latencies: list[float] = []
    succeeded = 0
    limited = 0
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [
            pool.submit(
                one_iteration,
                api_url,
                page_url,
                timeout_s,
                tokens[index % len(tokens)] if tokens else None,
            )
            for index in range(requests)
        ]
        for future in concurrent.futures.as_completed(futures):
            for kind, category, latency in future.result():
                if category == OK:
                    succeeded += 1
                elif category == EXPECTED_LIMITED:
                    limited += 1
                else:
                    failed += 1
                if kind == "api":
                    api_latencies.append(latency)
                else:
                    page_latencies.append(latency)
    ram_after = read_ram_used_percent()
    ram_samples = [value for value in (ram_before, ram_after) if value is not None]
    total = succeeded + limited + failed
    # Ожидаемый 429 защиты — не провал: в зачёт успеха идёт наряду с 2xx.
    success = ((succeeded + limited) / total) if total else 0.0
    return {
        "success_rate": success,
        "api_p95_s": percentile(api_latencies, 95),
        "page_p95_s": percentile(page_latencies, 95),
        "ram_percent": max(ram_samples) if ram_samples else None,
        "requests": total,
        "concurrency": concurrency,
        "mode": "auth" if authed else "anon",
        "auth_users": len(tokens) if tokens else 0,
        "rate_limited_expected": limited,
        "failed": failed,
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
    parser.add_argument(
        "--auth-users",
        type=int,
        default=DEFAULT_AUTH_USERS,
        help=(
            "число тестовых пользователей (регистрация + Bearer round-robin "
            "на пробы реестра); 0 — anon-режим проверки защиты"
        ),
    )
    parser.add_argument("--report", default="reports/acceptance-load.json")
    args = parser.parse_args(argv)

    if args.concurrency < 1 or args.requests < 1:
        print("ACCEPTANCE ERROR: concurrency и requests — положительные", file=sys.stderr)
        return 2
    if args.auth_users < 0:
        print("ACCEPTANCE ERROR: --auth-users — неотрицательное", file=sys.stderr)
        return 2
    tokens: list[str] = []
    if args.auth_users > 0:
        try:
            tokens = provision_auth_tokens(args.api_url, args.auth_users, args.timeout)
        except Exception as exc:  # fail-closed: непонятное состояние — не PASS.
            print(f"ACCEPTANCE ERROR: тестовые пользователи не поднялись: {exc}", file=sys.stderr)
            return 2
    try:
        metrics = run_load(
            args.api_url,
            args.page_url,
            args.concurrency,
            args.requests,
            args.timeout,
            tokens or None,
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
          f"mode={metrics['mode']}, "
          f"success={metrics['success_rate']:.3f}, "
          f"api_p95={metrics['api_p95_s']:.3f}s, page_p95={metrics['page_p95_s']:.3f}s, "
          f"ram={metrics['ram_percent']}, "
          f"limited_expected={metrics['rate_limited_expected']}, failed={metrics['failed']}")
    for check in result["checks"].values():
        print(f"  {check}")
    return 0 if result["overall"] == "PASS" else 1


def main() -> int:
    return run(sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
