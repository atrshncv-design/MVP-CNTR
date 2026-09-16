"""Таск 07 (G40/G41): валидация PUBLIC_HOST в infra/tls_issue.sh.

Шов — код возврата + stderr/stdout скрипта при подменённом env-файле.
К живому серверу и docker не ходим: docker подменяется фейком в PATH.
Валидный хост обязан дойти до выпуска (фейк-docker вызван, rc 0);
невалидный — упасть ДО docker с текстом про `<ipv4>.sslip.io`.
TLS_STAGING=1 держит массив аргументов непустым (старый bash < 4.4
роняет раскрытие пустого массива под `set -u`; на bash 5.3 то же rc 0).
Ожидаемые значения — ручные (имена хостов, коды возврата), а не из кода.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
ISSUE = INFRA_ROOT / "tls_issue.sh"

VALIDATION_ERROR = "PUBLIC_HOST должен быть техническим именем <ipv4>.sslip.io"

# Ручные значения, не из кода под тестом.
VALID_HOSTS = [
    "213.139.209.165.sslip.io",  # прод-значение с сервера (dotted)
    "1-2-3-4.sslip.io",  # dashed
    "255.255.255.255.sslip.io",  # граница октетов dotted
    "192-168-0-1.sslip.io",  # граница октетов dashed
]

INVALID_HOSTS = [
    "",
    "localhost",
    "example.com",
    "1.2.3.4.example.com",
    "1.2.3.4.sslip.io.evil.com",
    "https://1-2-3-4.sslip.io",
    "999.1.1.1.sslip.io",
    "1-2-3-300.sslip.io",
    "256.256.256.256.sslip.io",
    "1.2.3.sslip.io",
    "1.2.3.4.5.sslip.io",
    "1.2-3.4.sslip.io",  # смешанные разделители запрещены (единообразие)
    "abc.sslip.io",
]

_SCRUB_KEYS = ("PUBLIC_HOST", "ACME_EMAIL")


def _run_issue(
    host: str, work: Path
) -> tuple[subprocess.CompletedProcess[str], Path]:
    env_file = work / "test.env"
    env_file.write_text(
        f"PUBLIC_HOST={host}\nACME_EMAIL=ops@example.com\n", encoding="utf-8"
    )
    fake_bin = work / "bin"
    fake_bin.mkdir()
    calls_log = work / "docker-calls.log"
    fake_docker = fake_bin / "docker"
    fake_docker.write_text(
        f'#!/bin/sh\necho "docker $*" >> "{calls_log}"\nexit 0\n',
        encoding="utf-8",
    )
    fake_docker.chmod(0o755)
    env = {k: v for k, v in os.environ.items() if k not in _SCRUB_KEYS}
    env.update(
        {
            "ENV_FILE": str(env_file),
            "TLS_STAGING": "1",
            "PATH": f"{fake_bin}{os.pathsep}{os.environ.get('PATH', '')}",
        }
    )
    proc = subprocess.run(
        ["bash", str(ISSUE)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return proc, calls_log


def _docker_calls(calls_log: Path) -> str:
    if not calls_log.exists():
        return ""
    return calls_log.read_text(encoding="utf-8")


@pytest.mark.parametrize("host", VALID_HOSTS)
def test_issue_accepts_technical_sslip_host(tmp_path: Path, host: str) -> None:
    proc, calls_log = _run_issue(host, tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert VALIDATION_ERROR not in proc.stderr
    assert f"Сертификат для {host} установлен" in proc.stdout
    assert "certonly" in _docker_calls(calls_log)


@pytest.mark.parametrize("host", INVALID_HOSTS)
def test_issue_rejects_non_technical_host_before_docker(
    tmp_path: Path, host: str
) -> None:
    proc, calls_log = _run_issue(host, tmp_path)
    assert proc.returncode == 1
    assert VALIDATION_ERROR in proc.stderr
    assert _docker_calls(calls_log) == ""
