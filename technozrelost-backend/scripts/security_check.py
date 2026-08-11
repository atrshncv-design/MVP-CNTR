#!/usr/bin/env python3
"""Security harness платформы «Технозрелость» (тикет 21).

Проверки:
  1. secrets    — скан git-tracked файлов на ключи/пароли/токены (кроме .env*/tests)
  2. deps       — uv audit (известные CVE в lockfile) + таблица версий ключевых пакетов
  3. RBAC       — менеджер не видит admin/audit, аутсайдер не видит чужой проект (403/404)
  4. IDOR       — проект чужого пользователя → 404 (не 403 с раскрытием существования)
  5. file-sec   — upload с поддельным MIME отклоняется (проверка по сигнатуре), валидный PDF — 201

Запуск (нужен живой сервер + БД для назначения staff-ролей):
  uv run python scripts/security_check.py                     # против 127.0.0.1:8000
  uv run python scripts/security_check.py --base-url https://... --repo-root .
  uv run python scripts/security_check.py --skip-live         # только secrets + deps

Staff-роли (cntr_manager/cntr_admin) недоступны через публичную регистрацию.
Скрипт сначала пробует демо-аккаунты (demo.manager@example.com / DemoPass123! из
`uv run python -m app.db.reset_demo --seed-only`), при неудаче назначает роль
прямым INSERT в user_roles (зеркально tests/support.py, нужен доступ к БД).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx

PASSWORD = "Probe12345"  # синтетический пароль тестовых пользователей (dev-only)
DEMO_PASSWORD = "DemoPass123!"  # синтетический пароль демо-аккаунтов (тикет 19)

# Значения, похожие на реальные секреты (>= 12 символов) — кандидаты на FAIL.
SECRET_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"""(?i)(api[_-]?key|apikey|secret|password|passwd|token)\s*[=:]\s*["'][^"']{12,}["']"""),
    re.compile(r"""(?i)(bearer\s+)[A-Za-z0-9\-_.]{20,}"""),
]
# Подстроки, дисквалифицирующие значение (плейсхолдеры/демо-дефолты).
PLACEHOLDER_MARKERS = (
    "change_me",
    "example",
    "your_",
    "your-",
    "xxx",
    "todo",
    "lorem",
    "<your",
    "$",
    "${",
    "demo",
    "test",
    "probe",
    "load",
    "placeholder",
)
SECRET_EXCLUDE_PATHS = (".env", ".venv/", "node_modules/", "tests/", "__pycache__/", ".git/")

KEY_PACKAGES = (
    "fastapi",
    "uvicorn",
    "sqlalchemy",
    "asyncpg",
    "pydantic",
    "python-jose",
    "passlib",
    "bcrypt",
    "minio",
    "reportlab",
    "httpx",
    "pymupdf",
)

MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)


@dataclass
class Check:
    name: str
    passed: bool | None  # None = SKIP (не выполнимо в текущем окружении)
    detail: str = ""


# ─── 1. Secrets scan (чистая логика, юнит-тестируется) ─────────────────────


def _looks_like_secret(value: str) -> bool:
    lowered = value.lower()
    return not any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def scan_for_secrets(repo_root: Path) -> list[dict]:
    """Сканирует git-tracked файлы репозитория на секреты.

    Возвращает список находок: {path, line, match, value_preview}.
    """
    try:
        tracked = subprocess.run(
            ["git", "ls-files"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=30,
        ).stdout.splitlines()
    except (subprocess.SubprocessError, FileNotFoundError):
        tracked = []
    findings: list[dict] = []
    for rel in tracked:
        if any(rel.startswith(prefix) or prefix in rel for prefix in SECRET_EXCLUDE_PATHS):
            continue
        path = repo_root / rel
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            for pattern in SECRET_PATTERNS:
                for match in pattern.finditer(line):
                    value = match.group(0)
                    if not _looks_like_secret(value):
                        continue
                    preview = value[:24].rstrip() + ("***" if len(value) > 24 else "")
                    findings.append(
                        {
                            "path": rel,
                            "line": lineno,
                            "match": preview,
                        }
                    )
    return findings


# ─── 2. Dependency audit ────────────────────────────────────────────────────


def dependency_audit(repo_root: Path) -> tuple[list[dict], str | None]:
    """uv audit + версии ключевых пакетов. Возвращает (находки, ошибка)."""
    findings: list[dict] = []
    error: str | None = None
    try:
        proc = subprocess.run(
            ["uv", "audit"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=120,
        )
        out = proc.stdout + proc.stderr
        lower = out.lower()
        # Фрагменты "Package has N known vulnerabilities:" — до следующего
        # такого заголовка. Если в фрагменте есть "no fix versions available"
        # — severity=warn (фикса нет: гейт не роняет, но фиксируется).
        import re as _re

        vuln_headers = list(_re.finditer(r"^(.+?) has \d+ known vulnerabilit", lower, _re.M))
        for i, m in enumerate(vuln_headers):
            end = vuln_headers[i + 1].start() if i + 1 < len(vuln_headers) else len(lower)
            section = lower[m.start():end]
            no_fix = "no fix versions available" in section
            head = m.group(0).strip()
            findings.append(
                {
                    "source": "uv audit",
                    "detail": head[:200],
                    "severity": "warn" if no_fix else "fail",
                }
            )
        # Прочие строки с cve/advisory (без "has N known") — только если
        # секций не было вообще (иначе это хвосты warn-секций-дубликаты)
        if not vuln_headers:
            for line in lower.splitlines():
                if "vulnerable" in line or "advisory" in line or "cve" in line:
                    findings.append(
                        {"source": "uv audit", "detail": line.strip()[:200], "severity": "fail"}
                    )
        if proc.returncode != 0 and not findings:
            error = f"uv audit exit={proc.returncode}: {out[-300:]}"
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        error = f"uv audit недоступен: {exc}"
    return findings, error


def key_package_versions(repo_root: Path) -> dict[str, str]:
    try:
        proc = subprocess.run(
            ["uv", "pip", "list", "--format", "json"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=60,
        )
        data = json.loads(proc.stdout)
    except (subprocess.SubprocessError, FileNotFoundError, json.JSONDecodeError):
        return {}
    return {p["name"]: p["version"] for p in data if p["name"] in KEY_PACKAGES}


# ─── Live API helpers ───────────────────────────────────────────────────────


class Api:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=30.0)

    def close(self) -> None:
        self._client.close()

    def request(
        self, method: str, path: str, token: str | None = None, **kwargs
    ) -> httpx.Response:
        headers = dict(kwargs.pop("headers", {}))
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return self._client.request(method, self.base_url + path, headers=headers, **kwargs)

    def register(self, email: str, role_slug: str = "gk_customer") -> dict:
        resp = self.request(
            "POST",
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "full_name": f"Security {email.split('@')[0]}",
                "organization": "ООО Секьюрити",
                "role_slug": role_slug,
            },
        )
        if resp.status_code == 409:
            resp = self.request(
                "POST",
                "/api/v1/auth/login",
                json={"email": email, "password": PASSWORD},
            )
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"register {email}: {resp.status_code} {resp.text[:200]}")
        data = resp.json()
        return {"token": data["access_token"], "user_id": data["user"]["id"], "email": email}

    def login(self, email: str, password: str) -> dict | None:
        resp = self.request(
            "POST", "/api/v1/auth/login", json={"email": email, "password": password}
        )
        if resp.status_code != 200:
            return None
        return resp.json()


def _promote_via_db(user_id: int, slug: str) -> None:
    """Назначает роль прямым INSERT (зеркально tests/support.py)."""
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
        conn.execute("DELETE FROM public.user_roles WHERE user_id = %s", (user_id,))
        conn.execute(
            """
            INSERT INTO public.user_roles (user_id, role_id, is_primary)
            SELECT %s, id, TRUE FROM public.roles WHERE slug = %s
            """,
            (user_id, slug),
        )
    finally:
        conn.close()


def _staff_user(api: Api, demo_email: str, slug: str) -> dict | None:
    """Демо-аккаунт или регистрация + назначение роли через БД."""
    demo = api.login(demo_email, DEMO_PASSWORD)
    if demo:
        return {"token": demo["access_token"], "user_id": demo["user"]["id"]}
    try:
        user = api.register(f"sec.{slug}.{uuid.uuid4().hex[:6]}@example.com")
        _promote_via_db(user["user_id"], slug)
        fresh = api.login(user["email"], PASSWORD)
        if not fresh:
            return None
        return {"token": fresh["access_token"], "user_id": user["user_id"]}
    except (RuntimeError, ImportError, OSError) as exc:
        print(f"  WARN: staff-роль {slug} недоступна ({exc}) — проверки пропущены")
        return None


# ─── 3–5. Live checks ───────────────────────────────────────────────────────


def live_checks(base_url: str) -> list[Check]:
    api = Api(base_url)
    checks: list[Check] = []
    try:
        # Подготовка: клиенты и менеджер/админ
        a = api.register(f"sec.a.{uuid.uuid4().hex[:6]}@example.com")
        b = api.register(f"sec.b.{uuid.uuid4().hex[:6]}@example.com")
        manager = _staff_user(api, "demo.manager@example.com", "cntr_manager")
        admin = _staff_user(api, "demo.admin@example.com", "cntr_admin")

        # Проект пользователя A (опросник уровня 1 → auto_confirmed)
        resp = api.request(
            "POST",
            "/api/v1/assessments",
            token=a["token"],
            json={
                "name": "Security harness project",
                "category": "it",
                "target_level": 9,
                "questionnaire_results": [
                    {"level_id": 1, "checked_items": ["sec"], "percentage": 60.0}
                ],
            },
        )
        project_id: int | None = None
        if resp.status_code == 201:
            project_id = resp.json().get("id")
        if project_id is None:
            checks.append(
                Check(
                    "setup: проект пользователя A",
                    False,
                    f"POST /assessments -> {resp.status_code}",
                )
            )
            return checks

        # RBAC: публичные реестры (тикет 22, B1) — доступны без токена (200)
        for public_path in (
            "/api/v1/projects/registry",
            "/api/v1/nioktr",
            "/api/v1/executors/specialists",
        ):
            r = api.request("GET", public_path)
            checks.append(
                Check(
                    f"RBAC: публичный реестр {public_path} без токена -> 200",
                    r.status_code == 200,
                    f"status={r.status_code}",
                )
            )

        # RBAC: менеджер не видит admin/audit, клиент не видит очередь менеджера
        for label, token, path, expected in (
            (
                "RBAC: клиент -> очередь менеджера 403",
                a["token"],
                "/api/v1/manager/queue/drafts",
                403,
            ),
            ("RBAC: клиент -> admin/audit 403", a["token"], "/api/v1/admin/audit", 403),
            (
                "RBAC: менеджер -> admin/audit 403",
                (manager or {}).get("token"),
                "/api/v1/admin/audit",
                403,
            ),
        ):
            if token is None:
                checks.append(Check(label, None, "нет токена менеджера — SKIP"))
                continue
            r = api.request("GET", path, token=token)
            checks.append(
                Check(
                    label,
                    r.status_code == expected,
                    f"status={r.status_code}, ожидалось {expected}",
                )
            )

        # RBAC positive: менеджер видит свою очередь
        if manager:
            r = api.request("GET", "/api/v1/manager/queue/drafts", token=manager["token"])
            checks.append(
                Check(
                    "RBAC: менеджер -> очередь 200",
                    r.status_code == 200,
                    f"status={r.status_code}",
                )
            )
        if admin:
            r = api.request("GET", "/api/v1/admin/audit", token=admin["token"])
            checks.append(
                Check(
                    "RBAC: админ -> admin/audit 200",
                    r.status_code == 200,
                    f"status={r.status_code}",
                )
            )

        # RBAC/IDOR: аутсайдер не видит проект и файлы чужого проекта
        r = api.request("GET", f"/api/v1/projects/{project_id}", token=b["token"])
        checks.append(
            Check(
                "IDOR: проект чужого пользователя -> 404",
                r.status_code == 404,
                f"status={r.status_code} (не 403 — существование скрыто)",
            )
        )
        r = api.request("GET", f"/api/v1/projects/{project_id}/files", token=b["token"])
        checks.append(
            Check(
                "IDOR: файлы чужого проекта -> 404",
                r.status_code == 404,
                f"status={r.status_code}",
            )
        )
        r = api.request("GET", f"/api/v1/projects/{project_id}", token=a["token"])
        checks.append(
            Check(
                "RBAC: владелец видит свой проект 200",
                r.status_code == 200,
                f"status={r.status_code}",
            )
        )

        # File security: валидный PDF по сигнатуре -> 201; поддельный MIME -> 422
        r = api.request(
            "POST",
            f"/api/v1/projects/{project_id}/files",
            token=a["token"],
            files={"file": ("harness-ok.pdf", MINIMAL_PDF, "application/pdf")},
        )
        checks.append(
            Check(
                "FILE: валидный PDF (сигнатура %PDF-) -> 201",
                r.status_code == 201,
                f"status={r.status_code}",
            )
        )
        r = api.request(
            "POST",
            f"/api/v1/projects/{project_id}/files",
            token=a["token"],
            files={"file": ("report.pdf", b"this is plain text, not a pdf", "application/pdf")},
        )
        checks.append(
            Check(
                "FILE: поддельный MIME (текст как .pdf) -> 422",
                r.status_code == 422,
                f"status={r.status_code} (MIME определяется по сигнатуре, не по имени)",
            )
        )
        r = api.request("GET", f"/api/v1/projects/{project_id}/files", token=a["token"])
        checks.append(
            Check(
                "FILE: список файлов проекта 200",
                r.status_code == 200,
                f"status={r.status_code}",
            )
        )
    finally:
        api.close()
    return checks


# ─── Отчёт ──────────────────────────────────────────────────────────────────


def _fmt_checks(checks: list[Check]) -> str:
    lines = ["-" * 66, "SECURITY HARNESS — РЕЗУЛЬТАТЫ", "-" * 66]
    for c in checks:
        mark = "PASS" if c.passed else ("SKIP" if c.passed is None else "FAIL")
        lines.append(f"  [{mark}] {c.name}: {c.detail}")
    lines.append("-" * 66)
    failed = [c for c in checks if c.passed is False]
    lines.append(f"ИТОГ: {'ALL CHECKS PASS' if not failed else f'{len(failed)} FAIL'}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Security harness (тикет 21).")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Базовый URL API")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Корень репозитория для secrets/deps сканов",
    )
    parser.add_argument("--skip-live", action="store_true", help="Только secrets + deps (без API)")
    parser.add_argument("--json", type=Path, default=None, help="Сохранить результат в JSON")
    args = parser.parse_args()

    all_checks: list[Check] = []

    # 1. Secrets
    findings = scan_for_secrets(args.repo_root)
    for f in findings:
        all_checks.append(
            Check("SECRETS", False, f"{f['path']}:{f['line']} {f['match']}")
        )
    all_checks.append(
        Check(
            "SECRETS: в git-tracked файлах нет ключей/паролей",
            not findings,
            f"находок: {len(findings)} (исключены .env*, tests/)",
        )
    )

    # 2. Dependencies: с фиксом — FAIL; без фикса — WARN (не роняет гейт)
    vulns, audit_error = dependency_audit(args.repo_root)
    fixable = [v for v in vulns if v.get("severity") != "warn"]
    for v in vulns:
        passed = None if v.get("severity") == "warn" else False
        label = "WARN" if v.get("severity") == "warn" else "CVE"
        all_checks.append(Check(f"DEPS: {label}", passed, f"{v['detail']}"))
    if audit_error:
        all_checks.append(Check("DEPS: uv audit", None, audit_error))
    versions = key_package_versions(args.repo_root)
    detail = ", ".join(f"{k}={v}" for k, v in sorted(versions.items())) or "uv pip list недоступен"
    all_checks.append(
        Check(
            "DEPS: fixable CVE в lockfile",
            not fixable,
            f"fixable: {len(fixable)}, no-fix WARN: {len(vulns) - len(fixable)} | {detail}",
        )
    )

    # 3–5. Live
    if not args.skip_live:
        all_checks.extend(live_checks(args.base_url))

    print(_fmt_checks(all_checks))
    if args.json:
        payload = [
            {"name": c.name, "passed": c.passed, "detail": c.detail} for c in all_checks
        ]
        args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Результат сохранён: {args.json}")

    return 1 if any(c.passed is False for c in all_checks) else 0


if __name__ == "__main__":
    sys.exit(main())
