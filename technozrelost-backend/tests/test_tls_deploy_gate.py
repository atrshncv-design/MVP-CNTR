"""Таск 07 (G02/G40/G41): TLS sslip.io и строгий гейт деплоя.

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

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
GATE = INFRA_ROOT / "tls_deploy_gate.py"

# Ручные значения, не из кода под тестом: валидный технический хост и
# заведомо мусорные.
PUBLIC_HOST = "1-2-3-4.sslip.io"
FOREIGN_HOST = "9-9-9-9.sslip.io"
_GATE_ENV_KEYS = ("PUBLIC_HOST", "NEXTAUTH_URL", "CORS_ORIGINS")


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
    ca_key, ca_crt = _make_ca(work)
    key, csr, crt = work / "leaf.key", work / "leaf.csr", work / "leaf.crt"
    ext = work / "ext.cnf"
    ext.write_text(f"subjectAltName=DNS:{host}\n", encoding="ascii")
    _openssl("req", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(key), "-out", str(csr), "-subj", f"/CN={host}")
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
