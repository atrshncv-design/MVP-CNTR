#!/usr/bin/env python3
"""Нагрузочный профиль платформы «Технозрелость» (тикет 21).

Воспроизводимый профиль 1 000 виртуальных пользователей:
  70%  чтение   — реестры (projects/registry, nioktr, executors), карточка проекта
  20%  ЛК/опрос — POST /assessments, PATCH /profile, GET /assessments/mine, /projects, /auth/me
   8%  файлы    — upload/list через POST|GET /projects/{id}/files
   2%  менеджер  — GET /manager/queue/drafts (токен менеджера)

Отчёт: success rate, p50/p95/p99 (read/write раздельно), throughput req/s.
Цели: >=99% успеха, p95 read <=500ms, write <=1s — подсветка PASS/FAIL.

Запуск (PYTHONPATH=. как для всего backend):
  1) Подготовка токенов пользователей (однократно, в т.ч. на сервере):
       uv run python scripts/loadtest.py --prepare-users 1000 --seed-manager
  2) Прогон:
       uv run python scripts/loadtest.py --users 1000 --duration 120
  3) Локальная проверка (малый масштаб):
       uv run python scripts/loadtest.py --users 20 --duration 30

Зависимости: httpx (dev-группа), psycopg (только для --seed-manager).
Отчёт сохраняется в reports/loadtest_report.json (каталог в .gitignore).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import statistics
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import httpx

DEFAULT_PROFILE = {"read": 0.70, "write": 0.20, "file": 0.08, "manager": 0.02}
DEFAULT_TARGETS = {"success_rate": 0.99, "p95_read_s": 0.5, "p95_write_s": 1.0}

PASSWORD = "LoadTest123!"
TOKEN_FILE = Path(".loadtest_tokens.json")
REPORT_FILE = Path("reports/loadtest_report.json")

# Минимальный PDF по сигнатуре %PDF- (хранилище определяет MIME по сигнатуре).
MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)

# Шаблоны эндпоинтов: кортеж (kind, method, template, вес внутри корзины).
READ_ACTIONS = [
    ("read", "GET", "/projects/registry", 3),
    ("read", "GET", "/nioktr?limit=20", 2),
    ("read", "GET", "/executors/specialists", 1),
    ("read", "GET", "/executors/organizations", 1),
]
WRITE_ACTIONS = [
    ("write", "POST", "/assessments", 2),
    ("write", "PATCH", "/profile", 2),
    ("write", "GET", "/projects", 1),
    ("write", "GET", "/assessments/mine", 1),
    ("write", "GET", "/auth/me", 1),
]
FILE_ACTIONS = [
    ("file", "POST", "/projects/{pid}/files", 1),
    ("file", "GET", "/projects/{pid}/files", 1),
]
MANAGER_ACTIONS = [("manager", "GET", "/manager/queue/drafts", 1)]


@dataclass
class RequestResult:
    kind: str
    method: str
    endpoint: str  # шаблон с {pid}, не конкретный id
    status: int | None
    latency_s: float
    success: bool
    error: str | None = None


@dataclass
class UserState:
    token: str
    email: str
    project_id: int | None = None
    did_assessment: bool = False


def percentile(sorted_values: list[float], p: float) -> float:
    """p-перцентиль (0..100) по отсортированному списку; пустой список -> 0.0."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    idx = (len(sorted_values) - 1) * p / 100.0
    lo = int(idx)
    hi = min(lo + 1, len(sorted_values) - 1)
    frac = idx - lo
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * frac


def _pct_stats(values: list[float]) -> dict[str, float]:
    ordered = sorted(values)
    return {
        "count": len(values),
        "p50": round(percentile(ordered, 50) * 1000, 2),
        "p95": round(percentile(ordered, 95) * 1000, 2),
        "p99": round(percentile(ordered, 99) * 1000, 2),
        "mean_ms": round(statistics.fmean(values) * 1000, 2) if values else 0.0,
    }


def _bucket_stats(results: list[RequestResult], bucket: str) -> dict:
    items = [r for r in results if r.kind == bucket]
    lat = [r.latency_s for r in items]
    ok = sum(1 for r in items if r.success)
    return {
        "count": len(items),
        "success_rate": round(ok / len(items), 4) if items else None,
        **_pct_stats(lat),
    }


def compute_report(
    results: list[RequestResult],
    duration_s: float,
    targets: dict[str, float] | None = None,
) -> dict:
    """Считает отчёт: success rate, p50/p95/p99 (read/write), throughput, цели PASS/FAIL.

    Read/write в отчёте — по природе запроса (GET — чтение, мутации — запись),
    независимо от корзины трафика (manager/file GET попадают в read).
    """
    targets = targets or DEFAULT_TARGETS
    total = len(results)
    ok = sum(1 for r in results if r.success)
    read_lat = [r.latency_s for r in results if r.method in ("GET", "HEAD")]
    write_lat = [r.latency_s for r in results if r.method not in ("GET", "HEAD")]

    by_endpoint: dict[str, list[RequestResult]] = {}
    for r in results:
        by_endpoint.setdefault(f"{r.method} {r.endpoint}", []).append(r)

    per_endpoint = {
        ep: {
            "count": len(items),
            "success_rate": round(sum(1 for r in items if r.success) / len(items), 4),
            **_pct_stats([r.latency_s for r in items]),
        }
        for ep, items in sorted(by_endpoint.items())
    }

    success_rate = ok / total if total else 0.0
    checks = {
        "success_rate >= 99%": {
            "value": round(success_rate * 100, 2),
            "pass": success_rate >= targets["success_rate"],
        },
        "p95 read <= 500ms": {
            "value": round(percentile(sorted(read_lat), 95) * 1000, 2) if read_lat else None,
            "pass": (not read_lat) or percentile(sorted(read_lat), 95) <= targets["p95_read_s"],
        },
        "p95 write <= 1000ms": {
            "value": round(percentile(sorted(write_lat), 95) * 1000, 2) if write_lat else None,
            "pass": (not write_lat) or percentile(sorted(write_lat), 95) <= targets["p95_write_s"],
        },
    }

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "duration_s": round(duration_s, 2),
        "throughput_req_s": round(total / duration_s, 2) if duration_s else 0.0,
        "total_requests": total,
        "success_rate": round(success_rate, 4),
        "successes": ok,
        "failures": total - ok,
        "latency_read_ms": _pct_stats(read_lat),
        "latency_write_ms": _pct_stats(write_lat),
        "buckets": {b: _bucket_stats(results, b) for b in ("read", "write", "file", "manager")},
        "targets": checks,
        "all_targets_pass": all(c["pass"] for c in checks.values()),
        "per_endpoint": per_endpoint,
    }


def _fmt_report(report: dict) -> str:
    lines: list[str] = []
    lines.append("=" * 62)
    lines.append("НАГРУЗОЧНЫЙ ПРОФИЛЬ — ОТЧЁТ (тикет 21)")
    lines.append("=" * 62)
    lines.append(
        f"duration={report['duration_s']}s  requests={report['total_requests']}  "
        f"throughput={report['throughput_req_s']} req/s"
    )
    lines.append(
        f"success rate: {report['success_rate'] * 100:.2f}% "
        f"({report['successes']} ok / {report['failures']} fail)"
    )
    for label, ms in (
        ("read", report["latency_read_ms"]),
        ("write", report["latency_write_ms"]),
    ):
        lines.append(
            f"latency {label:5s}: p50={ms['p50']}ms p95={ms['p95']}ms "
            f"p99={ms['p99']}ms mean={ms['mean_ms']}ms (n={ms['count']})"
        )
    lines.append("-" * 62)
    lines.append("Цели:")
    for name, c in report["targets"].items():
        lines.append(f"  [{'PASS' if c['pass'] else 'FAIL'}] {name}: {c['value']}")
    lines.append("-" * 62)
    lines.append("По эндпоинтам:")
    for ep, st in report["per_endpoint"].items():
        lines.append(
            f"  {ep:42s} n={st['count']:5d} ok={st['success_rate'] * 100:5.1f}% "
            f"p50={st['p50']:7.1f} p95={st['p95']:7.1f} p99={st['p99']:7.1f}ms"
        )
    lines.append("=" * 62)
    verdict = "ALL TARGETS PASS" if report["all_targets_pass"] else "TARGETS NOT MET"
    lines.append(f"ИТОГ: {verdict}")
    return "\n".join(lines)


def _pick_action(bucket: str) -> tuple[str, str, str]:
    table = {
        "read": READ_ACTIONS,
        "write": WRITE_ACTIONS,
        "file": FILE_ACTIONS,
        "manager": MANAGER_ACTIONS,
    }[bucket]
    weights = [a[3] for a in table]
    return random.choices(table, weights=weights, k=1)[0][:3]


async def _do_request(
    client: httpx.AsyncClient,
    base_url: str,
    method: str,
    path: str,
    token: str | None,
    *,
    json_body: dict | None = None,
    files: dict | None = None,
) -> tuple[int | None, str | None, dict | None]:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = await client.request(
            method,
            base_url + path,
            headers=headers,
            json=json_body,
            files=files,
            timeout=httpx.Timeout(20.0, connect=5.0),
        )
        body: dict | None = None
        if resp.content:
            try:
                body = resp.json()
            except ValueError:
                body = None
        return resp.status_code, None, body
    except httpx.HTTPError as exc:
        return None, f"{type(exc).__name__}: {exc}", None


async def _run_user(
    client: httpx.AsyncClient,
    base_url: str,
    cfg: argparse.Namespace,
    user: UserState,
    manager_token: str | None,
    results: list[RequestResult],
    start: float,
) -> None:
    random.seed(user.email)
    while time.monotonic() - start < cfg.duration:
        bucket = random.choices(
            list(cfg.profile), weights=list(cfg.profile.values()), k=1
        )[0]
        if bucket == "manager" and not manager_token:
            bucket = "read"

        kind, method, template = _pick_action(bucket)
        path = template
        json_body = None
        files = None
        if bucket == "file":
            if user.project_id is None:
                # Без своего проекта файловые операции невозможны — пропуск.
                await asyncio.sleep(random.uniform(cfg.think_min, cfg.think_max))
                continue
            path = template.format(pid=user.project_id)
            if method == "POST":
                files = {
                    "file": (
                        f"loadtest-{user.email.split('@')[0]}.pdf",
                        MINIMAL_PDF,
                        "application/pdf",
                    )
                }
        elif kind == "write" and template == "/assessments":
            if not user.did_assessment:
                json_body = {
                    "name": f"Проект {user.email}",
                    "category": random.choice(["it", "production", "science"]),
                    "target_level": 9,
                    "questionnaire_results": [
                        {
                            "level_id": level,
                            "checked_items": ["load"],
                            "percentage": random.choice([25.0, 50.0, 75.0, 100.0]),
                        }
                        for level in range(1, random.randint(2, 5))
                    ],
                }
            else:
                # Переоценка запрещена (403) — повторная запись идёт в профиль.
                template = "/profile"
                path = "/profile"
                method = "PATCH"
                json_body = {
                    "headline": f"Инженер {random.randint(1, 9999)}",
                    "bio": "Нагрузочный профиль (тикет 21)",
                }
        elif kind == "write" and template == "/profile":
            json_body = {
                "headline": f"Инженер {random.randint(1, 9999)}",
                "bio": "Нагрузочный профиль (тикет 21)",
            }

        token = manager_token if bucket == "manager" else user.token
        t0 = time.monotonic()
        status, error, body = await _do_request(
            client, base_url, method, path, token, json_body=json_body, files=files
        )
        latency = time.monotonic() - t0
        success = status is not None and 200 <= status < 300
        results.append(
            RequestResult(
                kind=kind,
                method=method,
                endpoint=template,
                status=status,
                latency_s=latency,
                success=success,
                error=error,
            )
        )

        if status == 201 and template == "/assessments":
            user.did_assessment = True
            if isinstance(body, dict) and body.get("id"):
                user.project_id = int(body["id"])

        await asyncio.sleep(random.uniform(cfg.think_min, cfg.think_max))


async def run_loadtest(cfg: argparse.Namespace) -> tuple[list[RequestResult], float]:
    users = _load_users(cfg.token_file)
    if len(users) < cfg.users:
        sys.exit(
            f"Недостаточно подготовленных пользователей: нужно {cfg.users}, "
            f"в {cfg.token_file} — {len(users)}. Сначала: "
            f"--prepare-users {cfg.users}"
        )
    users = users[: cfg.users]
    manager_token = next((u["access_token"] for u in users if u.get("is_manager")), None)
    if not manager_token:
        print(
            "WARN: менеджерский токен не найден — 2% менеджера будут исполнены как чтение "
            "(подготовьте: --seed-manager)",
            file=sys.stderr,
        )

    limits = httpx.Limits(
        max_connections=cfg.users + 16, max_keepalive_connections=cfg.users
    )
    results: list[RequestResult] = []
    start = time.monotonic()
    async with httpx.AsyncClient(limits=limits) as client:
        await asyncio.gather(
            *[
                _run_user(
                    client,
                    cfg.base_url,
                    cfg,
                    UserState(
                        token=u["access_token"],
                        email=u["email"],
                    ),
                    manager_token,
                    results,
                    start,
                )
                for u in users
            ]
        )
    return results, time.monotonic() - start


# ─── Подготовка пользователей ──────────────────────────────────────────────


def _load_users(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save_users(path: Path, users: list[dict]) -> None:
    path.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


async def _prepare_one(
    sem: asyncio.Semaphore,
    client: httpx.AsyncClient,
    base_url: str,
    index: int,
) -> dict:
    async with sem:
        email = f"load.user{index:04d}@example.com"
        body = {
            "email": email,
            "password": PASSWORD,
            "full_name": f"Нагрузочный пользователь {index}",
            "organization": "ООО Нагрузка",
            "role_slug": "gk_customer",
        }
        resp = await client.post(
            f"{base_url}/api/v1/auth/register", json=body, timeout=30.0
        )
        if resp.status_code == 409:
            # Уже зарегистрирован (повторный --prepare-users) — логинимся.
            resp = await client.post(
                f"{base_url}/api/v1/auth/login",
                json={"email": email, "password": PASSWORD},
                timeout=30.0,
            )
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"prepare user {index}: {resp.status_code} {resp.text[:200]}")
        data = resp.json()
        return {
            "email": email,
            "full_name": body["full_name"],
            "access_token": data["access_token"],
            "user_id": data["user"]["id"],
            "is_manager": False,
        }


async def prepare_users(cfg: argparse.Namespace) -> int:
    existing = {u["email"] for u in _load_users(cfg.token_file)}
    sem = asyncio.Semaphore(cfg.prepare_concurrency)
    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=64)) as client:
        tasks = [
            _prepare_one(sem, client, cfg.base_url, i)
            for i in range(1, cfg.prepare_users + 1)
            if f"load.user{i:04d}@example.com" not in existing
        ]
        fresh = await asyncio.gather(*tasks)
    users = _load_users(cfg.token_file) + fresh
    _save_users(cfg.token_file, users)
    print(
        f"Подготовлено пользователей: всего={len(users)} новых={len(fresh)} "
        f"(файл {cfg.token_file})"
    )
    return len(fresh)


def seed_manager(cfg: argparse.Namespace) -> None:
    """Повышает первого пользователя из токен-файла до cntr_manager (как админ).

    Прямой INSERT в user_roles зеркалирует назначение администратором —
    публичная регистрация роли ЦНТР не выдаёт (зеркально tests/support.py).
    """
    users = _load_users(cfg.token_file)
    if not users:
        sys.exit("Нет пользователей в токен-файле — сначала --prepare-users")
    import psycopg

    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost"),
        autocommit=True,
    )
    try:
        user_id = users[0]["user_id"]
        conn.execute("DELETE FROM public.user_roles WHERE user_id = %s", (user_id,))
        conn.execute(
            """
            INSERT INTO public.user_roles (user_id, role_id, is_primary)
            SELECT %s, id, TRUE FROM public.roles WHERE slug = 'cntr_manager'
            """,
            (user_id,),
        )
    finally:
        conn.close()
    users[0]["is_manager"] = True
    _save_users(cfg.token_file, users)
    print(f"Пользователь {users[0]['email']} (id={user_id}) назначен cntr_manager.")


# ─── CLI ────────────────────────────────────────────────────────────────────


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Нагрузочный профиль 1000 пользователей (тикет 21).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--base-url", default="http://127.0.0.1:8000", help="Базовый URL API")
    p.add_argument("--users", type=int, default=1000, help="Виртуальных пользователей")
    p.add_argument("--duration", type=int, default=120, help="Длительность, секунд")
    p.add_argument("--think-min", type=float, default=0.5, help="Мин. think time, с")
    p.add_argument("--think-max", type=float, default=3.0, help="Макс. think time, с")
    p.add_argument(
        "--token-file", type=Path, default=TOKEN_FILE, help="Файл токенов пользователей"
    )
    p.add_argument(
        "--report", type=Path, default=REPORT_FILE, help="Куда сохранить отчёт (JSON)"
    )
    p.add_argument(
        "--prepare-users", type=int, default=0, help="Зарегистрировать N пользователей и выйти"
    )
    p.add_argument(
        "--prepare-concurrency", type=int, default=20, help="Параллелизм регистрации"
    )
    p.add_argument(
        "--seed-manager",
        action="store_true",
        help="Назначить первого пользователя cntr_manager и выйти",
    )
    return p


def main() -> int:
    cfg = _build_parser().parse_args()
    cfg.profile = dict(DEFAULT_PROFILE)

    if cfg.seed_manager:
        seed_manager(cfg)
        return 0
    if cfg.prepare_users:
        asyncio.run(prepare_users(cfg))
        return 0

    print(
        f"Профиль: {cfg.users} пользователей, {cfg.duration}s, "
        f"think {cfg.think_min}-{cfg.think_max}s, база {cfg.base_url}"
    )
    print("Корзины: read 70% | write 20% | file 8% | manager 2%")
    try:
        results, duration = asyncio.run(run_loadtest(cfg))
    except KeyboardInterrupt:
        print("\nПрервано — строю отчёт по частичным данным...")
        return 2

    report = compute_report(results, duration)
    cfg.report.parent.mkdir(parents=True, exist_ok=True)
    cfg.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(_fmt_report(report))
    print(f"Отчёт сохранён: {cfg.report}")
    return 0 if report["all_targets_pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
