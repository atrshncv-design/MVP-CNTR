"""T13 regression-контракт least-privilege hardening контейнеров.

Проверка статическая: она не запускает контейнеры и не читает окружение.  Её
граница — текст Compose/Dockerfile и реестр исключений в runbook, где security
policy должна быть проверяемой до production-разрешения.
"""

from __future__ import annotations

import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
COMPOSE_FILES = {
    "dev": INFRA_ROOT / "docker-compose.yml",
    "prod": INFRA_ROOT / "docker-compose.prod.yml",
}
RUNBOOK = INFRA_ROOT / "container-hardening-runbook.md"
BACKEND_DOCKERFILE = BACKEND_ROOT / "Dockerfile"
FRONTEND_DOCKERFILE = REPO_ROOT / "technozrelost-frontend" / "Dockerfile"

PROD_SERVICES = {
    "db",
    "minio",
    "clamav",
    "redis",
    "backend",
    "backup-timer",
    "wal-offsite",
    "alerter",
    "frontend",
    "nginx",
    "prometheus",
    "grafana",
}
DEV_SERVICES = {"pg-primary", "pg-replica", "minio", "redis", "clamav"}
ROOT_ENTRYPOINT_EXCEPTIONS = {
    "db",
    "pg-primary",
    "pg-replica",
    "clamav",
    "nginx",
}


def _service_blocks(source: str) -> dict[str, str]:
    services = source.split("\nservices:\n", 1)[1].split("\nvolumes:\n", 1)[0]
    matches = list(re.finditer(r"(?m)^  (?P<name>[A-Za-z0-9][A-Za-z0-9_-]*):\s*$", services))
    return {
        match.group("name"): services[match.start() : matches[index + 1].start()
                                  if index + 1 < len(matches) else len(services)]
        for index, match in enumerate(matches)
    }


def _assert_compose_policy(block: str, service: str, *, root_exception: bool) -> None:
    assert "privileged: true" not in block, f"{service}: privileged mode запрещён"
    assert "cap_add:" not in block, f"{service}: неожиданно возвращены capabilities"
    assert re.search(r"(?m)^\s+security_opt:", block), f"{service}: нет security_opt"
    assert "no-new-privileges:true" in block, f"{service}: нет no-new-privileges"
    assert re.search(r"(?m)^\s+read_only:\s+true\s*$", block), f"{service}: нет read-only rootfs"
    assert re.search(r"(?m)^\s+tmpfs:", block), f"{service}: не задан writable tmpfs"
    if root_exception:
        return
    assert re.search(r'(?m)^\s+user:\s*["\']?\d+:\d+["\']?\s*$', block), (
        f"{service}: отсутствует непривилегированный UID:GID"
    )
    assert re.search(r"(?m)^\s+cap_drop:\s*\[ALL\]\s*$", block), f"{service}: cap_drop не ALL"


def test_container_hardening_contract() -> None:
    """Каждая Compose-служба имеет явную policy; исключения не маскируются PASS."""
    blocks_by_file: dict[str, dict[str, str]] = {}
    expected_by_file = {"dev": DEV_SERVICES, "prod": PROD_SERVICES}
    for name, path in COMPOSE_FILES.items():
        source = path.read_text(encoding="utf-8")
        blocks = _service_blocks(source)
        blocks_by_file[name] = blocks
        assert set(blocks) == expected_by_file[name], f"{name}: неожиданный набор сервисов"

        for service, block in blocks.items():
            root_exception = service in ROOT_ENTRYPOINT_EXCEPTIONS
            _assert_compose_policy(block, f"{name}/{service}", root_exception=root_exception)
            if root_exception:
                assert "T13 exception" in block, f"{name}/{service}: нет явной пометки исключения"

    nginx_block = blocks_by_file["prod"]["nginx"]
    assert re.search(r"(?m)^\s+restart:\s+unless-stopped\s*$", nginx_block), (
        "prod/nginx: restart policy must remain unless-stopped"
    )

    runbook = RUNBOOK.read_text(encoding="utf-8")
    for service in ROOT_ENTRYPOINT_EXCEPTIONS:
        assert f"`{service}`" in runbook, f"runbook не документирует исключение {service}"
    for section in (
        "## Предварительные условия",
        "## Локальная валидация",
        "## Состав change plan",
        "## Наблюдаемые health/readiness-критерии",
        "## Rollback",
        "## Немедленные stop conditions",
    ):
        assert section in runbook, f"runbook: отсутствует {section}"
    assert "COMPOSE_DISABLE_ENV_FILE=1" in runbook
    assert "config --quiet" in runbook
    assert "no-new-privileges:true" in runbook
    assert "read-only" in runbook.lower()
    assert "Writable surface" in runbook
    assert "Компенсирующая изоляция" in runbook

    dev_clamav_row = re.search(
        r"(?m)^\| `clamav` \(dev: `mkodockx/docker-clamav:alpine`\).*\|$",
        runbook,
    )
    assert dev_clamav_row, "runbook: нет evidence-limited dev ClamAV exception"
    dev_clamav_text = dev_clamav_row.group(0).lower()
    assert "официальн" not in dev_clamav_text, (
        "dev ClamAV row must not assert a specific entrypoint"
    )
    assert "unknown" in dev_clamav_text
    assert "подтверж" in dev_clamav_text

    change_plan = runbook.split("## Состав change plan", 1)[1].split("\n## ", 1)[0]
    plan_text = change_plan.lower()
    for token in (
        "docker compose",
        "build",
        "up -d",
        "ps",
        "curl",
        "downtime",
        "unknown",
        "staging",
        "health",
        "readiness",
        "stop",
        "rollback",
        "не выполнять",
    ):
        assert token in plan_text, f"change plan: отсутствует {token}"
    for component in (
        "backend",
        "frontend",
        "postgres",
        "clamav",
        "minio",
        "redis",
        "nginx",
        "prometheus",
        "grafana",
        "backup-timer",
        "wal-offsite",
        "alerter",
        "pg-primary",
        "pg-replica",
    ):
        assert component in plan_text, f"change plan: не описан компонент {component}"

    for dockerfile in (BACKEND_DOCKERFILE, FRONTEND_DOCKERFILE):
        source = dockerfile.read_text(encoding="utf-8")
        assert "USER app:app" in source, f"{dockerfile}: runtime не переключён на app"
        assert "chown -R app:app" in source, f"{dockerfile}: нет build-time ownership"
    assert "PYTHONDONTWRITEBYTECODE=1" in BACKEND_DOCKERFILE.read_text(encoding="utf-8")
    assert "HOME=/tmp" in FRONTEND_DOCKERFILE.read_text(encoding="utf-8")
