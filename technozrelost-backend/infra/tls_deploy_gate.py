#!/usr/bin/env python3
"""TLS-гейт production-деплоя P1 (таск 07, G02/G40/G41 + R08: свой домен).

Отклоняет выкладку ДО сборки вместо молчаливого самоподписанного fallback:
localhost/HTTP-URL, несоответствие SAN сертификата публичному хосту и скорая
экспирация. Вызывается из `deploy.sh` (deploy и rollback); к живому серверу
не ходит — резолвинг имени и публичную валидность цепочки доказывает финальный
health-гейт deploy.sh (верифицированный curl без `-k`).

Шов: код возврата + stderr.
  0 — хост, URL, CORS и сертификат соответствуют публичному контуру;
  1 — несоответствие (localhost, HTTP, чужой SAN, экспирация, нет файлов);
  2 — внутренняя ошибка (нет openssl, сертификат не читается).

Входы (env, значениями не логируются; секреты не читаются вовсе):
  PUBLIC_HOST — техническое имя `<ipv4>.sslip.io` ИЛИ собственный домен
      (FQDN: метки LDH, минимум две, TLD — буквы 2+ или punycode xn--...);
  LEGACY_PUBLIC_HOST — необязательное старое имя (любой из двух форматов,
      обязано отличаться от PUBLIC_HOST): редиректит 301 на новое, поэтому
      SAN сертификата обязан содержать оба имени;
  NEXTAUTH_URL — обязан быть `https://<PUBLIC_HOST>`;
  CORS_ORIGINS — через запятую, обязан содержать `https://<PUBLIC_HOST>`
      и не содержать localhost/127.0.0.1/0.0.0.0/http-ориджины;
  TLS_CERT_FILE / TLS_KEY_FILE — fullchain/privkey (дефолт: nginx/certs/);
  TLS_MIN_VALIDITY_DAYS — минимум годности сертификата (дефолт: 14).

`vash-domen.ru` — плейсхолдер из документации: формат проходит, но как
значение запрещён (fail-closed — впишите купленное имя).

Почему так (Решения §5, истории 37–38/G40–G41): домена нет, а авторизация
и ПДн по HTTP или под чужим/просроченным сертификатом недопустимы.
Почему свой домен (R08): репутационные фильтры мобильных операторов
к wildcard-DNS — с телефонов платформа без VPN открывается только
на собственном имени; покупка имени — за владельцем, код готовит
переключение (инструкция — infra/README-OWN-DOMAIN.md).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

INFRA_ROOT = Path(__file__).resolve().parent
DEFAULT_CERT = INFRA_ROOT / "nginx" / "certs" / "fullchain.pem"
DEFAULT_KEY = INFRA_ROOT / "nginx" / "certs" / "privkey.pem"

MIN_VALIDITY_DAYS = 14
# Плейсхолдер собственного имени из документации (R08): формат FQDN проходит,
# но как значение запрещён везде — впишите купленное имя.
OWN_PLACEHOLDER = "vash-domen.ru"
# Техническое имя — вшитый IPv4 сервера: `1-2-3-4.sslip.io` или
# `1.2.3.4.sslip.io`. Резолвинг отдельно не проверяем: sslip.io отдаёт
# вшитый адрес по построению, а достижимость доказывает финальный
# верифицированный health-гейт deploy.sh.
SSLIP_RE = re.compile(r"^(\d{1,3}([-.]))\d{1,3}\2\d{1,3}\2\d{1,3}\.sslip\.io$", re.IGNORECASE)
# Собственное имя (R08): метки LDH 1..63, минимум две метки; подзона
# sslip.io сюда не входит — это технический формат выше.
OWN_LABEL_RE = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")
OWN_TLD_RE = re.compile(r"^[A-Za-z]{2,}$")
OWN_PUNYCODE_TLD_RE = re.compile(r"^xn--[A-Za-z0-9-]+$", re.IGNORECASE)
LOCAL_TOKENS = ("localhost", "127.0.0.1", "0.0.0.0", "::1")


def is_sslip_host(host: str) -> bool:
    if SSLIP_RE.match(host) is None:
        return False
    for octet in re.split(r"[-.]", host[: -len(".sslip.io")]):
        if not octet.isdigit() or int(octet) > 255:
            return False
    return True


def is_own_domain(host: str) -> bool:
    lowered = host.lower()
    if len(host) > 253:
        return False
    if any(token in lowered for token in LOCAL_TOKENS):
        return False
    if lowered.endswith(".sslip.io"):
        return False
    if lowered == OWN_PLACEHOLDER:
        return False
    labels = host.split(".")
    if len(labels) < 2:
        return False
    for label in labels:
        if OWN_LABEL_RE.match(label) is None:
            return False
    tld = labels[-1]
    if OWN_TLD_RE.match(tld) is not None:
        return True
    return OWN_PUNYCODE_TLD_RE.match(tld) is not None


def fail(errors: list[str]) -> int:
    for error in errors:
        print(error, file=sys.stderr)
    return 1


def check_public_host(errors: list[str]) -> str | None:
    host = os.environ.get("PUBLIC_HOST", "").strip().strip("\"'")
    if not host:
        errors.append(
            "TLS-GATE: PUBLIC_HOST не задан — нужен `<ipv4>.sslip.io` или собственный домен"
        )
        return None
    lowered = host.lower()
    if any(token in lowered for token in LOCAL_TOKENS):
        errors.append(f"TLS-GATE: PUBLIC_HOST указывает на локальный адрес ({host})")
        return None
    if lowered == OWN_PLACEHOLDER:
        errors.append(
            f"TLS-GATE: PUBLIC_HOST — плейсхолдер {OWN_PLACEHOLDER}, "
            "впишите купленное имя (см. infra/README-OWN-DOMAIN.md)"
        )
        return None
    if is_sslip_host(host) or is_own_domain(host):
        return host
    errors.append(
        f"TLS-GATE: PUBLIC_HOST не техническое имя `<ipv4>.sslip.io` "
        f"и не собственный домен ({host})"
    )
    return None


def check_legacy_host(errors: list[str], host: str) -> str | None:
    """Старое имя переходного периода (R08): любой из двух форматов, != PUBLIC_HOST.

    Пусто — редирект выключен (штатно до/после переезда). Задано — nginx
    301-редиректит его на новое имя, поэтому формат проверяется так же строго.
    """
    raw = os.environ.get("LEGACY_PUBLIC_HOST", "").strip().strip("\"'")
    if not raw:
        return None
    lowered = raw.lower()
    if any(token in lowered for token in LOCAL_TOKENS):
        errors.append(f"TLS-GATE: LEGACY_PUBLIC_HOST указывает на локальный адрес ({raw})")
        return None
    if lowered == OWN_PLACEHOLDER:
        errors.append(
            f"TLS-GATE: LEGACY_PUBLIC_HOST — плейсхолдер {OWN_PLACEHOLDER}, "
            "впишите реальное старое имя либо оставьте пустым"
        )
        return None
    if lowered == host.lower():
        errors.append("TLS-GATE: LEGACY_PUBLIC_HOST совпадает с PUBLIC_HOST — редирект в себя")
        return None
    if is_sslip_host(raw) or is_own_domain(raw):
        return raw
    errors.append(
        f"TLS-GATE: LEGACY_PUBLIC_HOST не техническое имя `<ipv4>.sslip.io` "
        f"и не собственный домен ({raw})"
    )
    return None


def check_nextauth_url(errors: list[str], host: str) -> None:
    raw = os.environ.get("NEXTAUTH_URL", "").strip().strip("\"'")
    if not raw:
        errors.append("TLS-GATE: NEXTAUTH_URL не задан — нужен `https://<PUBLIC_HOST>`")
        return
    parsed = urlparse(raw)
    if parsed.scheme != "https":
        errors.append(f"TLS-GATE: NEXTAUTH_URL не https ({parsed.scheme or 'без схемы'})")
        return
    if (parsed.hostname or "").lower() != host.lower():
        errors.append(f"TLS-GATE: NEXTAUTH_URL не соответствует PUBLIC_HOST ({raw})")
        return
    if parsed.port not in (None, 443):
        errors.append("TLS-GATE: NEXTAUTH_URL с нестандартным портом запрещён")
        return
    if any(token in raw.lower() for token in LOCAL_TOKENS):
        errors.append(f"TLS-GATE: NEXTAUTH_URL указывает на локальный адрес ({raw})")


def check_cors(errors: list[str], host: str) -> None:
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if not raw:
        errors.append("TLS-GATE: CORS_ORIGINS пуст — нужен `https://<PUBLIC_HOST>`")
        return
    origins = [item.strip().strip("\"'") for item in raw.split(",") if item.strip()]
    expected = f"https://{host.lower()}"
    normalized = set()
    for origin in origins:
        parsed = urlparse(origin)
        lowered = origin.lower()
        if any(token in lowered for token in LOCAL_TOKENS):
            errors.append("TLS-GATE: CORS_ORIGINS содержит локальный ориджин")
            return
        if parsed.scheme == "http":
            errors.append("TLS-GATE: CORS_ORIGINS содержит http-ориджин")
            return
        normalized.add(lowered.rstrip("/"))
    if expected not in normalized:
        errors.append("TLS-GATE: CORS_ORIGINS не содержит публичный хост")


def openssl_text(path: Path, kind: str) -> str | None:
    proc = subprocess.run(
        ["openssl", "x509", "-in", str(path), "-noout", kind],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode != 0:
        return None
    return proc.stdout


def check_certificate(errors: list[str], host: str, legacy: str | None) -> None:
    cert = Path(os.environ.get("TLS_CERT_FILE", str(DEFAULT_CERT)))
    key = Path(os.environ.get("TLS_KEY_FILE", str(DEFAULT_KEY)))
    # Нет файлов — провал, а не генерация: молчаливый самоподписанный
    # fallback запрещён (истории 37–38/G40–G41).
    if not cert.is_file():
        errors.append(
            f"TLS-GATE: сертификат отсутствует ({cert}) — выпустите через ACME "
            "(infra/tls_issue.sh), самоподписанный fallback запрещён"
        )
        return
    if not key.is_file():
        errors.append(f"TLS-GATE: ключ сертификата отсутствует ({key})")
        return
    if shutil.which("openssl") is None:
        print("TLS-GATE: внутренняя ошибка гейта: нет openssl", file=sys.stderr)
        raise SystemExit(2)
    san = openssl_text(cert, "-ext subjectAltName")
    if san is None:
        san = openssl_text(cert, "-text")
    if san is None:
        print("TLS-GATE: внутренняя ошибка гейта: сертификат не читается", file=sys.stderr)
        raise SystemExit(2)
    if host.lower() not in san.lower():
        errors.append("TLS-GATE: SAN сертификата не содержит PUBLIC_HOST")
    # R08: редирект со старого имени идёт по HTTPS — без старого имени в SAN
    # браузер покажет предупреждение о чужом сертификате вместо перехода.
    if legacy is not None and legacy.lower() not in san.lower():
        errors.append(
            "TLS-GATE: SAN сертификата не содержит LEGACY_PUBLIC_HOST — "
            "перевыпустите тем же процессом на оба имени (infra/tls_issue.sh)"
        )
    issuer = openssl_text(cert, "-issuer")
    subject = openssl_text(cert, "-subject")
    if issuer is not None and subject is not None:
        issuer_dn = issuer.split("=", 1)[1].strip() if "=" in issuer else issuer.strip()
        subject_dn = subject.split("=", 1)[1].strip() if "=" in subject else subject.strip()
        if issuer_dn == subject_dn:
            errors.append("TLS-GATE: сертификат самоподписанный — нужен ACME (infra/tls_issue.sh)")
    enddate = openssl_text(cert, "-enddate")
    if enddate is None or "=" not in enddate:
        print("TLS-GATE: внутренняя ошибка гейта: нет срока годности", file=sys.stderr)
        raise SystemExit(2)
    try:
        not_after = datetime.strptime(enddate.split("=", 1)[1].strip(), "%b %d %H:%M:%S %Y %Z")
        not_after = not_after.replace(tzinfo=timezone.utc)  # noqa: UP017 — гейт идёт под системным python3 (3.9)
    except ValueError as exc:
        print("TLS-GATE: внутренняя ошибка гейта: не разбирается notAfter", file=sys.stderr)
        raise SystemExit(2) from exc
    try:
        minimum = int(os.environ.get("TLS_MIN_VALIDITY_DAYS", str(MIN_VALIDITY_DAYS)))
    except ValueError as exc:
        print("TLS-GATE: внутренняя ошибка гейта: TLS_MIN_VALIDITY_DAYS не число", file=sys.stderr)
        raise SystemExit(2) from exc
    remaining_days = (not_after - datetime.now(timezone.utc)).total_seconds() / 86400  # noqa: UP017 — см. выше
    if remaining_days < minimum:
        errors.append(
            f"TLS-GATE: сертификат годен ещё {remaining_days:.1f} дн. < {minimum} дн. — "
            "обновите (infra/tls_renew.sh)"
        )
    elif remaining_days < 30:
        print(
            f"TLS-GATE WARNING: сертификат годен ещё {remaining_days:.1f} дн. — "
            "запланируйте обновление (infra/tls_renew.sh)",
            file=sys.stderr,
        )


def main() -> int:
    errors: list[str] = []
    host = check_public_host(errors)
    legacy: str | None = None
    if host is not None:
        legacy = check_legacy_host(errors, host)
    if host is not None:
        legacy = check_legacy_host(errors, host)
        check_nextauth_url(errors, host)
        check_cors(errors, host)
        check_certificate(errors, host, legacy)
    if errors:
        return fail(errors)
    if legacy:
        print(f"TLS-GATE OK: https://{host} (SAN и годность в норме, 301 с {legacy})")
    else:
        print(f"TLS-GATE OK: https://{host} (SAN и годность сертификата в норме)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
