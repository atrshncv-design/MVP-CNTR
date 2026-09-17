"""REPAIR 2026-09-17: allowlist окружения прод-backend.

Факт с продакшена: backend-контейнер видит окружение только через явный
allowlist `environment:` сервиса backend в infra/docker-compose.prod.yml.
Переменной LLM_GATEWAY_ENABLED в allowlist не было — контейнер её не видел,
`llm_gateway_enabled` всегда False, синтез мёртв при живом ключе.

Контракт от повторения: все LLM_* (и вообще все секретосодержащие/
фиче-флаги) из infra/.env.production.example обязаны присутствовать в
`environment:` backend либо иметь явное исключение с причиной ниже.
Сверка — парсингом текстов, без докера.
"""

from __future__ import annotations

import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
PROD_COMPOSE = INFRA_ROOT / "docker-compose.prod.yml"
PROD_EXAMPLE = INFRA_ROOT / ".env.production.example"
APP_CONFIG = BACKEND_ROOT / "app" / "core" / "config.py"

# Переменные из example, которые backend осознанно НЕ получает: владелец —
# другой сервис контура (проверяется вхождением имени в его блок) либо
# host-уровень (потребляется deploy/tls-скриптами, никакой контейнер не читает).
# Ключ — имя переменной, значение — (владелец, причина).
EXCLUDED_FROM_BACKEND: dict[str, tuple[str, str]] = {
    # Frontend-сервис (runtime env).
    "NEXTAUTH_URL": ("frontend", "публичный адрес сайта, читает Next.js"),
    "NEXTAUTH_SECRET": ("frontend", "секрет NextAuth, читает Next.js"),
    "API_URL_INTERNAL": ("frontend", "server-side адрес API для NextAuth/SSR"),
    # Frontend build-arg (NEXT_PUBLIC_* запекается в образ при сборке).
    "NEXT_PUBLIC_API_URL": (
        "frontend",
        "build-arg образа frontend, не runtime env",
    ),
    # Redis: потолок памяти в командной строке сервиса redis.
    "REDIS_MAXMEMORY": ("redis", "флаг --maxmemory команды redis-server"),
    "REDIS_MAXMEMORY_POLICY": (
        "redis",
        "флаг --maxmemory-policy команды redis-server",
    ),
    # Grafana.
    "GRAFANA_ADMIN_USER": ("grafana", "админ-логин Grafana"),
    "GRAFANA_ADMIN_PASSWORD": ("grafana", "админ-пароль Grafana"),
    # Prometheus: флаги retention в команде сервиса prometheus.
    "PROM_RETENTION_TIME": ("prometheus", "флаг --storage.tsdb.retention.time"),
    "PROM_RETENTION_SIZE": ("prometheus", "флаг --storage.tsdb.retention.size"),
    # Sidecar таймера бэкапов.
    "BACKUP_AT": ("backup-timer", "расписание запуска backup.sh"),
    # Алертер.
    "BACKUP_MAX_AGE_HOURS": ("alerter", "порог свежести бэкапа для алертера"),
    "ALERTER_MINIO_HEALTH_URL": ("alerter", "проба MinIO алертером"),
    "ALERTER_CLAMAV_HOST": ("alerter", "проба ClamAV алертером"),
    "ALERTER_CLAMAV_PORT": ("alerter", "проба ClamAV алертером"),
    "WAL_OFFSITE_MAX_AGE_SECONDS": ("alerter", "порог свежести WAL-синка"),
    "WAL_ARCHIVE_MAX_AGE_SECONDS": ("alerter", "порог свежести WAL-архива"),
    "TELEGRAM_BOT_TOKEN": ("alerter", "уведомления алертера"),
    "TELEGRAM_CHAT_ID": ("alerter", "уведомления алертера"),
    # Offsite-синхронизация WAL.
    "WAL_OFFSITE_MARKER": ("wal-offsite", "маркер непрерывного синка WAL"),
    "WAL_OFFSITE_INTERVAL_SECONDS": ("wal-offsite", "период синка WAL"),
    "WAL_ARCHIVE_DIR": ("wal-offsite", "локальный каталог WAL-архива"),
    "WAL_ARCHIVE_KEEP_DAYS": ("wal-offsite", "retention локального WAL"),
    # Host-уровень: потребляют deploy.sh/tls_issue.sh, контейнеры не читают.
    "PUBLIC_HOST": ("host", "публичное имя контура, гейт deploy.sh"),
    "ACME_EMAIL": ("host", "email для уведомлений ACME, скрипты TLS"),
}

# Известно отсутствующие в allowlist backend (тот же класс бага, что
# LLM_GATEWAY_ENABLED; отдельный follow-up — чинить, убирая отсюда, а не молча).
# Тест фиксирует множество ТОЧНО: новый дрейф упадёт, а не растворится.
KNOWN_GAPS: dict[str, str] = {
    "CVD_MAX_AGE_SECONDS": (
        "читают backend (file_storage через settings.cvd_max_age_seconds) и "
        "alerter, но нет ни в backend-, ни в alerter-allowlist — всегда "
        "дефолт 604800 из кода (совпадает со значением example, поэтому "
        "немая деградация, а не авария)"
    ),
    "REPL_SLOT": (
        "читает backend (metrics /metrics через os.getenv, дефолт "
        "tz_replica_slot); на P1 слот пуст по проекту — метрика "
        "slot_retained_bytes опрашивает несуществующий слот и отдаёт 0"
    ),
}


def _example_keys() -> set[str]:
    """Имена переменных из .env.production.example (комментарии мимо)."""
    keys = set()
    for line in PROD_EXAMPLE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name = stripped.split("=", 1)[0].strip()
        if re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
            keys.add(name)
    return keys


def _service_block(compose: str, service: str) -> str:
    """Текст сервиса от `  <service>:` до следующего сервиса того же уровня."""
    headers = [(m.start(), m.group(1)) for m in re.finditer(r"(?m)^  ([a-z][a-z0-9-]*):", compose)]
    starts = {name: pos for pos, name in headers}
    assert service in starts, f"сервис {service} не найден в {PROD_COMPOSE.name}"
    begin = starts[service]
    following = [pos for pos, _ in headers if pos > begin]
    end = min(following) if following else len(compose)
    return compose[begin:end]


def _service_env_keys(block: str) -> set[str]:
    """Ключи `environment:` сервиса (ровно 6 пробелов — уровень записей)."""
    env = block.split("    environment:", 1)[1] if "    environment:" in block else ""
    # Обрыв на первом ключе уровня сервиса (4 пробела): depends_on/volumes/...
    cut = re.search(r"(?m)^    [a-z_]+:", env)
    if cut:
        env = env[: cut.start()]
    return set(re.findall(r"(?m)^      ([A-Z][A-Z0-9_]*):", env))


def test_llm_vars_from_example_are_in_backend_allowlist() -> None:
    """Ядро REPAIR: ни один LLM_* из example не теряется по дороге в контейнер."""
    compose = PROD_COMPOSE.read_text(encoding="utf-8")
    backend_keys = _service_env_keys(_service_block(compose, "backend"))
    llm_vars = sorted(k for k in _example_keys() if k.startswith("LLM_"))
    assert llm_vars, "в example не осталось LLM_*-переменных — контракт ослеп"
    assert "LLM_GATEWAY_ENABLED" in llm_vars
    missing = [k for k in llm_vars if k not in backend_keys]
    assert not missing, f"LLM_* из example отсутствуют в allowlist backend: {missing}"


def test_llm_gateway_enabled_is_fail_closed() -> None:
    """Гейтвей выключен по умолчанию на всех трёх слоях (ПДн не покидает контур)."""
    compose = PROD_COMPOSE.read_text(encoding="utf-8")
    backend_block = _service_block(compose, "backend")
    assert "LLM_GATEWAY_ENABLED: ${LLM_GATEWAY_ENABLED:-false}" in backend_block
    example = PROD_EXAMPLE.read_text(encoding="utf-8")
    assert re.search(r"(?m)^LLM_GATEWAY_ENABLED=false\s*$", example) is not None
    config = APP_CONFIG.read_text(encoding="utf-8")
    assert "llm_gateway_enabled: bool = False" in config


def test_example_vars_are_covered_or_explicitly_excluded() -> None:
    """Полный контракт: example -> backend, кроме явных исключений и KNOWN_GAPS."""
    compose = PROD_COMPOSE.read_text(encoding="utf-8")
    backend_keys = _service_env_keys(_service_block(compose, "backend"))
    example_keys = _example_keys()

    # Исключения обязаны объяснять владельца, владелец — реально содержать ключ
    # (host-уровень вместо этого обязан упоминаться в deploy/tls-скриптах).
    deploy_sources = (INFRA_ROOT / "deploy.sh").read_text(encoding="utf-8")
    tls_sources = ""
    tls_issue = INFRA_ROOT / "tls_issue.sh"
    if tls_issue.exists():
        tls_sources = tls_issue.read_text(encoding="utf-8")
    for var, (owner, _reason) in EXCLUDED_FROM_BACKEND.items():
        assert var in example_keys, f"исключение {var} протухло: нет в example"
        if owner == "host":
            assert var in deploy_sources or var in tls_sources, (
                f"host-исключение {var} не упоминается в deploy/tls-скриптах"
            )
        elif owner == "frontend" and var == "NEXT_PUBLIC_API_URL":
            frontend = _service_block(compose, "frontend")
            assert var in frontend, f"{var} пропал из блока frontend"
        else:
            assert var in _service_block(compose, owner), (
                f"исключение {var}: владельца {owner} нет ключа в compose"
            )

    uncovered = example_keys - backend_keys - set(EXCLUDED_FROM_BACKEND)
    assert uncovered == set(KNOWN_GAPS), (
        f"новый дрейф example->backend (не в исключениях и не в KNOWN_GAPS): "
        f"{sorted(uncovered - set(KNOWN_GAPS))}; "
        f"закрытые гэпы (убрать из KNOWN_GAPS): "
        f"{sorted(set(KNOWN_GAPS) - uncovered)}"
    )
