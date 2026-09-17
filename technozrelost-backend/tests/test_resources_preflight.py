"""Ресурсный конверт и preflight P1 (таск 04).

Поведенческие тесты через швы: код возврата и stderr `infra/preflight.py`
(гейт «до сборки и миграций») плюс readiness-контур. Без подстроковых
проверок production compose: тесты утверждают только поведение гейта на
реальном и фикстурном compose.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
PREFLIGHT = INFRA_ROOT / "preflight.py"

GIB_KB = 1024 * 1024


def run_preflight(extra_env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(extra_env)
    return subprocess.run(
        ["python3", str(PREFLIGHT)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def adequate_machine() -> dict[str, str]:
    return {
        "PREFLIGHT_CPUS": "6",
        "PREFLIGHT_MEM_TOTAL_KB": str(11 * GIB_KB),
        "PREFLIGHT_DISK_AVAIL_KB": str(100 * 1024 * 1024),
    }


def test_preflight_rejects_machine_below_cpu_target_before_build():
    result = run_preflight(
        {
            **adequate_machine(),
            "PREFLIGHT_CPUS": "4",
        }
    )

    assert result.returncode == 1
    assert "CPU" in result.stderr


def test_preflight_rejects_machine_below_memory_target():
    result = run_preflight(
        {
            **adequate_machine(),
            "PREFLIGHT_MEM_TOTAL_KB": str(8 * GIB_KB),
        }
    )

    assert result.returncode == 1
    assert "RAM" in result.stderr


def test_preflight_rejects_machine_below_disk_target():
    result = run_preflight(
        {
            **adequate_machine(),
            "PREFLIGHT_DISK_AVAIL_KB": str(20 * 1024 * 1024),
        }
    )

    assert result.returncode == 1
    assert "свободно" in result.stderr


def test_preflight_accepts_target_machine_within_memory_budget():
    result = run_preflight(adequate_machine())

    assert result.returncode == 0, result.stderr


def write_compose_fixture(tmp_path: Path, source: str) -> str:
    fixture = tmp_path / "docker-compose.fixture.yml"
    fixture.write_text(source, encoding="utf-8")
    return str(fixture)


def real_compose_source() -> str:
    return (INFRA_ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")


def test_preflight_rejects_compose_over_memory_budget(tmp_path: Path):
    fixture = write_compose_fixture(
        tmp_path, real_compose_source().replace("memory: 1536M", "memory: 16G", 1)
    )
    result = run_preflight({**adequate_machine(), "PREFLIGHT_COMPOSE_FILE": fixture})

    assert result.returncode == 1
    assert "8" in result.stderr


def test_preflight_rejects_compose_over_cpu_budget(tmp_path: Path):
    fixture = write_compose_fixture(
        tmp_path, real_compose_source().replace("cpus: '0.25'", "cpus: '10.0'", 1)
    )
    result = run_preflight({**adequate_machine(), "PREFLIGHT_COMPOSE_FILE": fixture})

    assert result.returncode == 1
    assert "CPU" in result.stderr


def test_preflight_rejects_redis_without_maxmemory(tmp_path: Path):
    fixture = write_compose_fixture(
        tmp_path, real_compose_source().replace('"--maxmemory",', '"--no-maxmemory",', 1)
    )
    result = run_preflight({**adequate_machine(), "PREFLIGHT_COMPOSE_FILE": fixture})

    assert result.returncode == 1
    assert "maxmemory" in result.stderr


def test_preflight_rejects_prometheus_without_retention(tmp_path: Path):
    source = real_compose_source().replace("--storage.tsdb.retention.time=", "--no-retention-time=")
    fixture = write_compose_fixture(tmp_path, source)
    result = run_preflight({**adequate_machine(), "PREFLIGHT_COMPOSE_FILE": fixture})

    assert result.returncode == 1
    assert "retention" in result.stderr


def test_preflight_gate_needs_no_docker_daemon():
    env = {**adequate_machine(), "PATH": "/usr/bin:/bin"}
    result = run_preflight(env)

    assert result.returncode == 0, result.stderr


def test_preflight_rejects_clamav_below_1gib(tmp_path: Path):
    fixture = write_compose_fixture(
        tmp_path, real_compose_source().replace("memory: 2G", "memory: 512M", 1)
    )
    result = run_preflight({**adequate_machine(), "PREFLIGHT_COMPOSE_FILE": fixture})

    assert result.returncode == 1
    assert "clamav" in result.stderr.lower()


def test_preflight_rejects_clamav_above_2gib(tmp_path: Path):
    # 2049M держит сумму лимитов в бюджете 8 ГиБ: отказ только по диапазону ClamAV.
    fixture = write_compose_fixture(
        tmp_path, real_compose_source().replace("memory: 2G", "memory: 2049M", 1)
    )
    result = run_preflight({**adequate_machine(), "PREFLIGHT_COMPOSE_FILE": fixture})

    assert result.returncode == 1
    assert "clamav" in result.stderr.lower()


def test_preflight_rejects_frontend_below_calibrated_cpu(tmp_path: Path):
    """Таск 08: тихий откат CPU фронта к 0.75 отклоняется до сборки."""
    fixture = write_compose_fixture(
        tmp_path, real_compose_source().replace("cpus: '1.25'", "cpus: '0.75'", 1)
    )
    result = run_preflight({**adequate_machine(), "PREFLIGHT_COMPOSE_FILE": fixture})

    assert result.returncode == 1
    assert "frontend" in result.stderr.lower()


def test_preflight_accepts_calibrated_frontend_cpu():
    """Таск 08: реальный compose — пол фронта 1.25 пройден, суммы в бюджете."""
    result = run_preflight(adequate_machine())

    assert result.returncode == 0, result.stderr
    assert "1.25" in (INFRA_ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")


def test_preflight_disk_error_names_parent_decisions_and_story():
    result = run_preflight(
        {
            **adequate_machine(),
            "PREFLIGHT_DISK_AVAIL_KB": str(20 * 1024 * 1024),
        }
    )

    assert result.returncode == 1
    assert "§4" in result.stderr
    assert "R01" in result.stderr
