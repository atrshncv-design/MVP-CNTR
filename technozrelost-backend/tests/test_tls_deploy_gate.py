"""Таск 07 (G02/G40/G41 + R08): TLS sslip.io/свой домен и строгий гейт деплоя.

Швы — публичные границы `infra-single`/`acceptance`: публичный HTTPS,
готовность /ready без отключения проверки сертификата, свежесть сертификата.
К живому серверу тесты не ходят: гейт вызывается как процесс с подменённым
env, сертификаты — синтетические через openssl, конфиги читаются текстом.
Ожидаемые значения — ручные (имена хостов, коды возврата), а не из кода.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
GATE = INFRA_ROOT / "tls_deploy_gate.py"

# Ручные значения, не из кода под тестом: валидный технический хост и
# заведомо мусорные. R08: плюс собственный домен (фильтры операторов
# к wildcard-DNS) и старое имя переходного периода под 301.
PUBLIC_HOST = "1-2-3-4.sslip.io"
FOREIGN_HOST = "9-9-9-9.sslip.io"
OWN_HOST = "cntr-prod.ru"
OWN_FOREIGN_HOST = "someone-else.example.com"
LEGACY_SSLIP_HOST = "5-6-7-8.sslip.io"
PLACEHOLDER_HOST = "vash-domen.ru"
_GATE_ENV_KEYS = ("PUBLIC_HOST", "LEGACY_PUBLIC_HOST", "NEXTAUTH_URL", "CORS_ORIGINS")


def run_gate(extra_env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    inherited = {k: v for k, v in os.environ.items() if k not in _GATE_ENV_KEYS}
    inherited.update(extra_env)
    return subprocess.run(
        ["python3", str(GATE)],
        env=inherited,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_gate_rejects_localhost_nextauth_url(tmp_path: Path) -> None:
    result = run_gate(
        {
            "PUBLIC_HOST": PUBLIC_HOST,
            "NEXTAUTH_URL": "https://localhost",
            "CORS_ORIGINS": f"https://{PUBLIC_HOST}",
            "TLS_CERT_FILE": str(tmp_path / "missing.pem"),
            "TLS_KEY_FILE": str(tmp_path / "missing-key.pem"),
        }
    )
    assert result.returncode == 1
    assert "NEXTAUTH_URL не соответствует PUBLIC_HOST (https://localhost)" in result.stderr


def test_gate_rejects_http_nextauth_url(tmp_path: Path) -> None:
    result = run_gate(
        {
            "PUBLIC_HOST": PUBLIC_HOST,
            "NEXTAUTH_URL": f"http://{PUBLIC_HOST}",
            "CORS_ORIGINS": f"https://{PUBLIC_HOST}",
            "TLS_CERT_FILE": str(tmp_path / "missing.pem"),
            "TLS_KEY_FILE": str(tmp_path / "missing-key.pem"),
        }
    )
    assert result.returncode == 1
    assert "https" in result.stderr


def test_gate_rejects_cors_without_public_host(tmp_path: Path) -> None:
    result = run_gate(
        {
            "PUBLIC_HOST": PUBLIC_HOST,
            "NEXTAUTH_URL": f"https://{PUBLIC_HOST}",
            "CORS_ORIGINS": "https://localhost:3000",
            "TLS_CERT_FILE": str(tmp_path / "missing.pem"),
            "TLS_KEY_FILE": str(tmp_path / "missing-key.pem"),
        }
    )
    assert result.returncode == 1
    assert "CORS_ORIGINS" in result.stderr


def test_gate_fails_closed_without_cert_files(tmp_path: Path) -> None:
    result = run_gate(
        {
            "PUBLIC_HOST": PUBLIC_HOST,
            "NEXTAUTH_URL": f"https://{PUBLIC_HOST}",
            "CORS_ORIGINS": f"https://{PUBLIC_HOST}",
            "TLS_CERT_FILE": str(tmp_path / "missing.pem"),
            "TLS_KEY_FILE": str(tmp_path / "missing-key.pem"),
        }
    )
    assert result.returncode == 1
    assert "самоподписанный fallback запрещён" in result.stderr


def _openssl(*args: str) -> None:
    subprocess.run(["openssl", *args], check=True, capture_output=True, timeout=60)


def _make_ca(work: Path) -> tuple[Path, Path]:
    key, crt = work / "ca.key", work / "ca.crt"
    _openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(key), "-out", str(crt), "-days", "3650", "-subj", "/CN=test-ca")
    return key, crt


def _make_leaf(work: Path, host: str, days: str) -> tuple[Path, Path]:
    return _make_leaf_multi(work, (host,), days)


def _make_leaf_multi(work: Path, hosts: tuple[str, ...], days: str) -> tuple[Path, Path]:
    ca_key, ca_crt = _make_ca(work)
    key, csr, crt = work / "leaf.key", work / "leaf.csr", work / "leaf.crt"
    ext = work / "ext.cnf"
    san = ",".join(f"DNS:{item}" for item in hosts)
    ext.write_text(f"subjectAltName={san}\n", encoding="ascii")
    _openssl("req", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(key), "-out", str(csr), "-subj", f"/CN={hosts[0]}")
    _openssl("x509", "-req", "-in", str(csr), "-CA", str(ca_crt), "-CAkey", str(ca_key),
             "-CAcreateserial", "-out", str(crt), "-days", days, "-extfile", str(ext))
    return key, crt


def _make_selfsigned(work: Path, host: str) -> tuple[Path, Path]:
    key, crt = work / "self.key", work / "self.crt"
    _openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(key), "-out", str(crt), "-days", "90",
             "-subj", f"/CN={host}", "-addext", f"subjectAltName=DNS:{host}")
    return key, crt


def _valid_env(tmp_path: Path, key: Path, crt: Path) -> dict[str, str]:
    return {
        "PUBLIC_HOST": PUBLIC_HOST,
        "NEXTAUTH_URL": f"https://{PUBLIC_HOST}",
        "CORS_ORIGINS": f"https://{PUBLIC_HOST}",
        "TLS_CERT_FILE": str(crt),
        "TLS_KEY_FILE": str(key),
    }


def test_gate_rejects_certificate_for_foreign_host(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, FOREIGN_HOST, "90")
    result = run_gate(_valid_env(tmp_path, key, crt))
    assert result.returncode == 1
    assert "SAN" in result.stderr


def test_gate_rejects_selfsigned_certificate_with_correct_san(tmp_path: Path) -> None:
    key, crt = _make_selfsigned(tmp_path, PUBLIC_HOST)
    result = run_gate(_valid_env(tmp_path, key, crt))
    assert result.returncode == 1
    assert "самоподписанный" in result.stderr


def test_gate_rejects_expiring_certificate(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, PUBLIC_HOST, "1")
    result = run_gate(_valid_env(tmp_path, key, crt))
    assert result.returncode == 1
    assert "годен" in result.stderr


def test_gate_accepts_matching_fresh_certificate(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, PUBLIC_HOST, "90")
    result = run_gate(_valid_env(tmp_path, key, crt))
    assert result.returncode == 0
    assert "TLS-GATE OK" in result.stdout


def test_gate_uses_portable_subject_alt_name_argv(tmp_path: Path) -> None:
    fake_openssl = tmp_path / "openssl"
    fake_openssl.write_text(
        """#!/usr/bin/env python3
import sys

arguments = sys.argv[1:]
if arguments[-1] == "-ext subjectAltName":
    raise SystemExit(0)
if arguments[-2:] == ["-ext", "subjectAltName"]:
    print("X509v3 Subject Alternative Name:")
    print("    DNS:1-2-3-4.sslip.io")
elif arguments[-1] == "-issuer":
    print("issuer=CN=test-ca")
elif arguments[-1] == "-subject":
    print("subject=CN=1-2-3-4.sslip.io")
elif arguments[-1] == "-enddate":
    print("notAfter=Dec 31 23:59:59 2099 GMT")
else:
    raise SystemExit(2)
""",
        encoding="ascii",
    )
    fake_openssl.chmod(0o755)
    key = tmp_path / "leaf.key"
    cert = tmp_path / "leaf.crt"
    key.touch()
    cert.touch()
    env = _valid_env(tmp_path, key, cert)
    env["PATH"] = f"{tmp_path}{os.pathsep}{os.environ['PATH']}"
    result = run_gate(env)
    assert result.returncode == 0
    assert "TLS-GATE OK" in result.stdout


def _infrasource(name: str) -> str:
    return (INFRA_ROOT / name).read_text(encoding="utf-8")


def test_deploy_has_no_selfsigned_fallback_and_verifies_tls() -> None:
    deploy = _infrasource("deploy.sh")
    assert "openssl req -x509" not in deploy
    assert "tls_deploy_gate.py" in deploy
    assert "curl -k" not in deploy


def test_deploy_health_gate_uses_verified_public_host() -> None:
    deploy = _infrasource("deploy.sh")
    assert "PUBLIC_HOST" in deploy
    assert "--cacert" in deploy or "curl -fsS" in deploy


def test_deploy_forwards_tls_inputs_to_gate() -> None:
    deploy = _infrasource("deploy.sh")
    assert "TLS_CERT_FILE" in deploy
    assert "TLS_KEY_FILE" in deploy
    assert "TLS_MIN_VALIDITY_DAYS" in deploy


def test_nginx_serves_acme_challenge_and_redirects_rest() -> None:
    nginx = _infrasource("nginx/nginx.prod.conf")
    assert "/.well-known/acme-challenge/" in nginx
    assert "return 301 https://$host$request_uri;" in nginx
    assert "client_max_body_size 32m;" in nginx


def test_compose_mounts_acme_webroot_into_nginx() -> None:
    compose = _infrasource("docker-compose.prod.yml")
    assert "./certbot/www:/var/www/certbot" in compose


def test_production_env_example_names_tls_inputs() -> None:
    example = _infrasource(".env.production.example")
    assert "PUBLIC_HOST=" in example
    assert "ACME_EMAIL=" in example


def test_acme_scripts_cover_issue_dryrun_and_reload() -> None:
    issue = _infrasource("tls_issue.sh")
    renew = _infrasource("tls_renew.sh")
    assert "certbot" in issue and "sslip.io" in issue or "PUBLIC_HOST" in issue
    assert "--dry-run" in renew
    assert "nginx -s reload" in renew
    assert "tls_deploy_gate.py" in renew


# ── R08: свой домен + 301 со старого (оба формата имён) ──────────────────────

OWN_VALID_HOSTS = [
    "cntr-prod.ru",
    "my-centre.example.com",
    "domen.xn--p1ai",
]

OWN_INVALID_HOSTS = [
    "-bad.ru",
    "bad-.ru",
    "bad_.ru",
    "bad..ru",
    "bad.r",
    "good.123",
    "192.168.0.1",
    "1.2-3.4.sslip.io",
]


def _own_env(
    tmp_path: Path, key: Path, crt: Path, legacy: str | None = None
) -> dict[str, str]:
    env = {
        "PUBLIC_HOST": OWN_HOST,
        "NEXTAUTH_URL": f"https://{OWN_HOST}",
        "CORS_ORIGINS": f"https://{OWN_HOST}",
        "TLS_CERT_FILE": str(crt),
        "TLS_KEY_FILE": str(key),
    }
    if legacy is not None:
        env["LEGACY_PUBLIC_HOST"] = legacy
    return env


@pytest.mark.parametrize("host", OWN_VALID_HOSTS)
def test_gate_accepts_own_domain_formats(
    tmp_path: Path, host: str
) -> None:
    key, crt = _make_leaf(tmp_path, host, "90")
    result = run_gate(
        {
            "PUBLIC_HOST": host,
            "NEXTAUTH_URL": f"https://{host}",
            "CORS_ORIGINS": f"https://{host}",
            "TLS_CERT_FILE": str(crt),
            "TLS_KEY_FILE": str(key),
        }
    )
    assert result.returncode == 0
    assert "TLS-GATE OK" in result.stdout


@pytest.mark.parametrize("host", OWN_INVALID_HOSTS)
def test_gate_rejects_bad_own_domain_format(tmp_path: Path, host: str) -> None:
    result = run_gate(
        {
            "PUBLIC_HOST": host,
            "NEXTAUTH_URL": f"https://{host}",
            "CORS_ORIGINS": f"https://{host}",
            "TLS_CERT_FILE": str(tmp_path / "missing.pem"),
            "TLS_KEY_FILE": str(tmp_path / "missing-key.pem"),
        }
    )
    assert result.returncode == 1
    assert "PUBLIC_HOST" in result.stderr


def test_gate_rejects_placeholder_host(tmp_path: Path) -> None:
    result = run_gate(
        {
            "PUBLIC_HOST": PLACEHOLDER_HOST,
            "NEXTAUTH_URL": f"https://{PLACEHOLDER_HOST}",
            "CORS_ORIGINS": f"https://{PLACEHOLDER_HOST}",
            "TLS_CERT_FILE": str(tmp_path / "missing.pem"),
            "TLS_KEY_FILE": str(tmp_path / "missing-key.pem"),
        }
    )
    assert result.returncode == 1
    assert "плейсхолдер" in result.stderr


def test_gate_rejects_certificate_for_foreign_own_domain(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, OWN_FOREIGN_HOST, "90")
    result = run_gate(_own_env(tmp_path, key, crt))
    assert result.returncode == 1
    assert "SAN" in result.stderr


def test_gate_accepts_legacy_pair_with_both_names_in_san(tmp_path: Path) -> None:
    key, crt = _make_leaf_multi(tmp_path, (OWN_HOST, PUBLIC_HOST), "90")
    result = run_gate(_own_env(tmp_path, key, crt, legacy=PUBLIC_HOST))
    assert result.returncode == 0
    assert PUBLIC_HOST in result.stdout


def test_gate_accepts_legacy_pair_between_two_sslip_names(tmp_path: Path) -> None:
    key, crt = _make_leaf_multi(tmp_path, (LEGACY_SSLIP_HOST, PUBLIC_HOST), "90")
    result = run_gate(
        {
            "PUBLIC_HOST": LEGACY_SSLIP_HOST,
            "NEXTAUTH_URL": f"https://{LEGACY_SSLIP_HOST}",
            "CORS_ORIGINS": f"https://{LEGACY_SSLIP_HOST}",
            "TLS_CERT_FILE": str(crt),
            "TLS_KEY_FILE": str(key),
            "LEGACY_PUBLIC_HOST": PUBLIC_HOST,
        }
    )
    assert result.returncode == 0
    assert "TLS-GATE OK" in result.stdout


def test_gate_rejects_certificate_missing_legacy_san(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, OWN_HOST, "90")
    result = run_gate(_own_env(tmp_path, key, crt, legacy=PUBLIC_HOST))
    assert result.returncode == 1
    assert "LEGACY_PUBLIC_HOST" in result.stderr


def test_gate_rejects_legacy_equal_to_public(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, OWN_HOST, "90")
    result = run_gate(_own_env(tmp_path, key, crt, legacy=OWN_HOST))
    assert result.returncode == 1
    assert "совпадает" in result.stderr


def test_gate_rejects_bad_legacy_format(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, OWN_HOST, "90")
    result = run_gate(_own_env(tmp_path, key, crt, legacy="-bad.ru"))
    assert result.returncode == 1
    assert "LEGACY_PUBLIC_HOST" in result.stderr


def test_gate_rejects_placeholder_legacy(tmp_path: Path) -> None:
    key, crt = _make_leaf(tmp_path, OWN_HOST, "90")
    result = run_gate(_own_env(tmp_path, key, crt, legacy=PLACEHOLDER_HOST))
    assert result.returncode == 1
    assert "плейсхолдер" in result.stderr


def test_nginx_includes_generated_legacy_redirect() -> None:
    nginx = _infrasource("nginx/nginx.prod.conf")
    assert "include /etc/nginx/legacy/*.conf;" in nginx
    assert "return 301 https://$host$request_uri;" in nginx
    assert "client_max_body_size 32m;" in nginx


def test_compose_mounts_legacy_redirect_dir() -> None:
    compose = _infrasource("docker-compose.prod.yml")
    assert "./nginx/legacy:/etc/nginx/legacy" in compose
    assert "./certbot/www:/var/www/certbot" in compose


def test_production_env_example_names_legacy_input() -> None:
    example = _infrasource(".env.production.example")
    assert "LEGACY_PUBLIC_HOST=" in example
    assert "vash-domen.ru" in example


def test_deploy_renders_legacy_redirect_after_gate() -> None:
    deploy = _infrasource("deploy.sh")
    assert "render_legacy_redirect.sh" in deploy
    assert "LEGACY_PUBLIC_HOST" in deploy
    # Порядок вызовов — в финальном диспетче deploy/rollback (в файле два
    # case: ранний --help и финальный; берём последний).
    dispatch = deploy.rsplit('case "${1:-deploy}" in', 1)[1]
    assert dispatch.index("run_tls_gate") < dispatch.index("render_legacy_redirect")


def test_owner_instruction_covers_buy_write_report_restart() -> None:
    doc = _infrasource("README-OWN-DOMAIN.md")
    lowered = doc.lower()
    assert "купить" in lowered
    assert "LEGACY_PUBLIC_HOST" in doc
    assert "tls_issue.sh" in doc
    assert "301" in doc
    assert "vash-domen.ru" in doc
