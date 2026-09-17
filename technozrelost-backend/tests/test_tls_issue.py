"""Таск 07 (G40/G41 + R08): валидация имён в infra/tls_issue.sh.

Шов — код возврата + stderr/stdout скрипта при подменённом env-файле.
К живому серверу и docker не ходим: docker подменяется фейком в PATH.
Валидный хост обязан дойти до выпуска (фейк-docker вызван, rc 0);
невалидный — упасть ДО docker с текстом про `<ipv4>.sslip.io`.
Два формата имени: техническое `<ipv4>.sslip.io` и собственный домен
(R08: фильтры операторов к wildcard-DNS); старое имя из LEGACY_PUBLIC_HOST
идёт вторым SAN того же сертификата. vash-domen.ru — плейсхолдер,
выпуск на него запрещён.
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
    "cntr-prod.ru",  # R08: собственный домен
    "my-centre.example.com",  # R08: дефис и подзона
    "domen.xn--p1ai",  # R08: punycode-TLD
    "example.com",  # формат FQDN валиден (резервность — не дело формата)
    "1.2.3.4.example.com",  # числовые метки при буквенном TLD — FQDN
    "1.2.3.4.sslip.io.evil.com",  # чужой домен с sslip.io в середине — FQDN
]

INVALID_HOSTS = [
    "",
    "localhost",
    "example.com.evil.com/../x",
    "https://1-2-3-4.sslip.io",
    "999.1.1.1.sslip.io",
    "1-2-3-300.sslip.io",
    "256.256.256.256.sslip.io",
    "1.2.3.sslip.io",
    "1.2.3.4.5.sslip.io",
    "1.2-3.4.sslip.io",  # смешанные разделители запрещены (единообразие)
    "abc.sslip.io",
    # R08: собственный домен — строгий FQDN.
    "-bad.ru",  # метка с дефиса
    "bad-.ru",  # метка на дефис
    "bad_.ru",  # подчёркивание вне LDH
    "bad..ru",  # пустая метка
    ".bad.ru",  # ведущая точка
    "bad.ru.",  # замыкающая точка
    "bad.r",  # TLD из одной буквы
    "good.123",  # числовой TLD (голый IP — не домен)
    "192.168.0.1",  # голый IPv4 без суффикса
    "good.ru:443",  # порт — не часть имени
    "a",  # одна метка — не FQDN
    # Плейсхолдер vash-domen.ru — отдельный тест с dedicated-сообщением.
]

_SCRUB_KEYS = ("PUBLIC_HOST", "LEGACY_PUBLIC_HOST", "ACME_EMAIL")


def _run_issue(
    host: str, work: Path, legacy: str | None = None
) -> tuple[subprocess.CompletedProcess[str], Path]:
    lines = f"PUBLIC_HOST={host}\nACME_EMAIL=ops@example.com\n"
    if legacy is not None:
        lines += f"LEGACY_PUBLIC_HOST={legacy}\n"
    env_file = work / "test.env"
    env_file.write_text(lines, encoding="utf-8")
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
def test_issue_rejects_non_technical_host_before_docker(tmp_path: Path, host: str) -> None:
    proc, calls_log = _run_issue(host, tmp_path)
    assert proc.returncode == 1
    assert VALIDATION_ERROR in proc.stderr
    assert _docker_calls(calls_log) == ""


@pytest.mark.parametrize("host", ["vash-domen.ru", "VASH-DOMEN.RU"])
def test_issue_rejects_placeholder_with_dedicated_message(tmp_path: Path, host: str) -> None:
    proc, calls_log = _run_issue(host, tmp_path)
    assert proc.returncode == 1
    assert "плейсхолдер" in proc.stderr
    assert _docker_calls(calls_log) == ""


def test_issue_requests_both_names_when_legacy_set(tmp_path: Path) -> None:
    proc, calls_log = _run_issue("cntr-prod.ru", tmp_path, legacy="1-2-3-4.sslip.io")
    assert proc.returncode == 0, proc.stderr
    calls = _docker_calls(calls_log)
    assert "certonly" in calls
    assert "-d cntr-prod.ru" in calls
    assert "-d 1-2-3-4.sslip.io" in calls


def test_issue_rejects_bad_legacy_before_docker(tmp_path: Path) -> None:
    proc, calls_log = _run_issue("cntr-prod.ru", tmp_path, legacy="localhost")
    assert proc.returncode == 1
    assert "LEGACY_PUBLIC_HOST" in proc.stderr
    assert _docker_calls(calls_log) == ""


def test_issue_rejects_legacy_equal_to_public_before_docker(tmp_path: Path) -> None:
    proc, calls_log = _run_issue("cntr-prod.ru", tmp_path, legacy="cntr-prod.ru")
    assert proc.returncode == 1
    assert "совпадает" in proc.stderr
    assert _docker_calls(calls_log) == ""
