#!/usr/bin/env python3
"""Preflight-гейт production-контура P1 (таск 04, R01/G15/G18/G42/G47).

Отклоняет машину слабее цели ДО сборки образов и миграций. Вызывается из
`deploy.sh` (deploy и rollback); без демона Docker и без секретов.

Шов: код возврата + stderr.
  0 — машина и compose-бюджет соответствуют цели;
  1 — несоответствие (машина слабее цели, бюджет превышен, нет лимита,
      нет maxmemory/retention);
  2 — внутренняя ошибка (нет compose-файла, нечем измерить без оверрайда).

Входы (env, значениями не логируются; секреты не читаются вовсе):
  PREFLIGHT_CPUS / PREFLIGHT_MEM_TOTAL_KB / PREFLIGHT_DISK_AVAIL_KB —
      измеренные значения (дефолт: nproc, MemTotal, свободное место тома
      compose-файла); тесты подменяют их без настоящей слабой машины.
  PREFLIGHT_DISK_PATH — том для замера места (дефолт: каталог compose-файла).
  PREFLIGHT_COMPOSE_FILE — проверяемый compose (дефолт: prod compose рядом).

Цели (трассировка — таблица «Ресурсный конверт P1» в README-DEPLOY.md,
Решения §4, история 1/R01: цель 6 vCPU / 11 ГиБ / 150 ГБ;
история 23/G15: 100 МБ новых файлов/день):
  CPU >= 6 vCPU, RAM >= 11 ГиБ, свободно >= 60 ГБ (диск 150 ГБ:
      100 МБ новых файлов/день ~= 37 ГБ за год + снапшоты, WAL, образы и
      кэш сборки), сумма лимитов памяти <= 8 ГиБ, сумма лимитов CPU <= 6 vCPU.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

INFRA_ROOT = Path(__file__).resolve().parent
DEFAULT_COMPOSE = INFRA_ROOT / "docker-compose.prod.yml"

MIN_CPUS = 6
MIN_MEM_GIB = 11
# 60 ГБ свободно до выкладки (Решения §4, история 1/R01 + история 23/G15:
# диск 150 ГБ: 100 МБ новых файлов/день ~= 37 ГБ за год + снапшоты, WAL,
# мониторинг, образы и кэш сборки в одном бюджете).
MIN_DISK_FREE_GB = 60
MEM_BUDGET_MIB = 8192  # 8 ГиБ — суммарный потолок лимитов контейнеров.
CPU_BUDGET_CPUS = 6.0  # 6 vCPU — суммарный потолок лимитов CPU контейнеров.
# История 39 (G42), Решения (ClamAV 1–2 ГиБ): локальный замер 7 МиБ снят
# с нездорового демона и нерепрезентативен — границы проекта, а не замера.
CLAMAV_MIN_MIB = 1024  # 1 ГиБ.
CLAMAV_MAX_MIB = 2048  # 2 ГиБ.

# Долгоживущие сервисы prod-контура: у каждого обязаны быть лимиты CPU и RAM.
EXPECTED_SERVICES = (
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
)

_SIZE_RE = re.compile(
    r"^\s*(?P<number>\d+(?:\.\d+)?)\s*(?P<unit>[kmg])?(?:i)?(?:b)?\s*$",
    re.IGNORECASE,
)
_UNIT_MULT = {"": 1, "k": 1024, "m": 1024**2, "g": 1024**3}


def parse_size_to_bytes(raw: str) -> int | None:
    """Разбор '2G' / '200mb' / '10GB' / '512M' в байты; None — не размер."""
    match = _SIZE_RE.match(raw.strip().strip("\"'"))
    if match is None:
        return None
    return int(float(match.group("number")) * _UNIT_MULT[match.group("unit").lower()])


def read_cpus() -> int | None:
    override = os.environ.get("PREFLIGHT_CPUS", "").strip()
    if override:
        try:
            return int(override)
        except ValueError:
            return None
    count = os.cpu_count()
    return count if count else None


def read_mem_total_kb() -> int | None:
    override = os.environ.get("PREFLIGHT_MEM_TOTAL_KB", "").strip()
    if override:
        try:
            value = int(override)
            return value if value > 0 else None
        except ValueError:
            return None
    try:
        for line in Path("/proc/meminfo").read_text(encoding="ascii").splitlines():
            if line.startswith("MemTotal:"):
                return int(line.split()[1])
    except OSError:
        pass
    try:  # macOS-стенд для локальной проверки (не прод-замер).
        out = subprocess.run(
            ["sysctl", "-n", "hw.memsize"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if out.returncode == 0:
            return int(out.stdout.strip()) // 1024
    except (OSError, ValueError):
        pass
    return None


def read_disk_avail_kb(path: str) -> int | None:
    override = os.environ.get("PREFLIGHT_DISK_AVAIL_KB", "").strip()
    if override:
        try:
            value = int(override)
            return value if value >= 0 else None
        except ValueError:
            return None
    try:
        return shutil.disk_usage(path).free // 1024
    except OSError:
        return None


def split_services(source: str) -> dict[str, str]:
    """Блоки сервисов верхнего уровня compose (без YAML-зависимости)."""
    services_block = source.split("\nservices:\n", 1)[1]
    tail = services_block.split("\nvolumes:", 1)[0].split("\nnetworks:", 1)[0]
    blocks: dict[str, str] = {}
    current: str | None = None
    acc: list[str] = []
    for line in tail.splitlines():
        header = re.match(r"^  ([A-Za-z0-9_.-]+):\s*(#.*)?$", line)
        if header:
            if current is not None:
                blocks[current] = "\n".join(acc)
            current = header.group(1)
            acc = []
        elif current is not None:
            acc.append(line)
    if current is not None:
        blocks[current] = "\n".join(acc)
    return blocks


def find_limit(block: str, key: str) -> str | None:
    match = re.search(rf"(?m)^\s*{key}:\s*['\"]?([^'\"\s#]+)['\"]?\s*(#.*)?$", block)
    return match.group(1) if match else None


def check_machine(errors: list[str]) -> None:
    cpus = read_cpus()
    if cpus is None:
        errors.append("PREFLIGHT: CPU не измерено (PREFLIGHT_CPUS не задано, nproc недоступен)")
    elif cpus < MIN_CPUS:
        errors.append(f"PREFLIGHT: CPU {cpus} < цели {MIN_CPUS} vCPU — машина слабее цели")

    mem_kb = read_mem_total_kb()
    if mem_kb is None:
        errors.append("PREFLIGHT: RAM не измерена (PREFLIGHT_MEM_TOTAL_KB не задано)")
    elif mem_kb < MIN_MEM_GIB * 1024 * 1024:
        have_gib = mem_kb / (1024 * 1024)
        errors.append(
            f"PREFLIGHT: RAM {have_gib:.1f} ГиБ < цели {MIN_MEM_GIB} ГиБ — машина слабее цели"
        )

    compose_file = os.environ.get("PREFLIGHT_COMPOSE_FILE", str(DEFAULT_COMPOSE))
    disk_path = os.environ.get("PREFLIGHT_DISK_PATH", str(Path(compose_file).parent))
    disk_kb = read_disk_avail_kb(disk_path)
    if disk_kb is None:
        errors.append("PREFLIGHT: свободное место не измерено (PREFLIGHT_DISK_AVAIL_KB не задано)")
    elif disk_kb < MIN_DISK_FREE_GB * 1024 * 1024:
        have_gb = disk_kb / (1024 * 1024)
        errors.append(
            f"PREFLIGHT: свободно {have_gb:.1f} ГБ < цели {MIN_DISK_FREE_GB} ГБ "
            "(Решения §4, история 1/R01 + история 23/G15: диск 150 ГБ, "
            "100 МБ новых файлов/день, снапшоты, WAL, образы)"
        )


def check_compose_budget(errors: list[str]) -> None:
    compose_file = Path(os.environ.get("PREFLIGHT_COMPOSE_FILE", str(DEFAULT_COMPOSE)))
    if not compose_file.is_file():
        errors.append(f"PREFLIGHT: compose-файл не найден: {compose_file}")
        return
    try:
        source = compose_file.read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"PREFLIGHT: compose-файл не читается: {exc}")
        return
    if "\nservices:\n" not in source:
        errors.append("PREFLIGHT: в compose-файле нет блока services")
        return
    blocks = split_services(source)
    total_mib = 0
    total_cpus = 0.0
    redis_limit_bytes: int | None = None
    for service in EXPECTED_SERVICES:
        block = blocks.get(service)
        if block is None:
            errors.append(f"PREFLIGHT: нет долгоживущего сервиса '{service}' в compose")
            continue
        memory = find_limit(block, "memory")
        cpus = find_limit(block, "cpus")
        if memory is None:
            errors.append(f"PREFLIGHT: у сервиса '{service}' нет лимита памяти")
            continue
        if cpus is None:
            errors.append(f"PREFLIGHT: у сервиса '{service}' нет лимита CPU")
        else:
            try:
                total_cpus += float(cpus)
            except ValueError:
                errors.append(f"PREFLIGHT: у сервиса '{service}' не число лимита CPU")
        size = parse_size_to_bytes(memory)
        if size is None:
            errors.append(f"PREFLIGHT: у сервиса '{service}' не размер лимита памяти")
            continue
        mib = (size + 1024**2 - 1) // 1024**2
        total_mib += mib
        if service == "redis":
            redis_limit_bytes = size
    if total_mib > MEM_BUDGET_MIB:
        errors.append(
            f"PREFLIGHT: сумма лимитов памяти {total_mib} МиБ > потолка "
            f"{MEM_BUDGET_MIB} МиБ (8 ГиБ)"
        )
    if total_cpus - CPU_BUDGET_CPUS > 1e-9:
        errors.append(
            f"PREFLIGHT: сумма лимитов CPU {total_cpus:.2f} > потолка "
            f"{CPU_BUDGET_CPUS:.1f} vCPU (целевая машина 6 vCPU)"
        )
    check_redis(errors, blocks.get("redis", ""), redis_limit_bytes)
    check_prometheus(errors, blocks.get("prometheus", ""))
    check_clamav(errors, blocks.get("clamav", ""))


def service_command(block: str) -> str:
    """Команда сервиса одной строкой (flow- и block-стили)."""
    single = re.search(r"(?m)^\s*command:\s*\[(?P<items>[^\]]*)\]", block)
    if single:
        return single.group("items")
    lines = block.splitlines()
    for index, line in enumerate(lines):
        if re.match(r"^\s*command:\s*(\|.*)?$", line):
            chunk = [line]
            for follow in lines[index + 1 :]:
                if re.match(r"^\s{6,}\S", follow):
                    chunk.append(follow)
                else:
                    break
            return "\n".join(chunk)
    inline = re.search(r"(?m)^\s*command:\s*(?P<cmd>\S.*)$", block)
    return inline.group("cmd") if inline else ""


def expand_compose_defaults(text: str) -> str:
    """Подставляет дефолты `${VAR:-default}` сырым текстом compose (без env)."""
    return re.sub(r"\$\{[^}:]+:-([^}]*)\}", r"\1", text)


def check_redis(errors: list[str], block: str, limit_bytes: int | None) -> None:
    command = expand_compose_defaults(service_command(block))
    if re.search(r"--maxmemory(?=[\"',\s\]=])", command) is None:
        errors.append("PREFLIGHT: у redis нет настроенного maxmemory (политика вытеснения)")
        return
    match = re.search(r"--maxmemory[\"',\s\]]+([\"']?)([0-9A-Za-z.]+)\1", command)
    value = parse_size_to_bytes(match.group(2)) if match else None
    if value is None:
        errors.append("PREFLIGHT: у redis не разбирается значение maxmemory")
    elif limit_bytes is not None and value > limit_bytes:
        errors.append("PREFLIGHT: maxmemory redis выше лимита памяти контейнера")
    if "--maxmemory-policy" not in command:
        errors.append("PREFLIGHT: у redis нет политики вытеснения maxmemory-policy")


def check_prometheus(errors: list[str], block: str) -> None:
    command = service_command(block)
    if "--storage.tsdb.retention.time=" not in command:
        errors.append("PREFLIGHT: у prometheus нет времени ретеншна (retention.time)")
    if "--storage.tsdb.retention.size=" not in command:
        errors.append("PREFLIGHT: у prometheus нет размера ретеншна (retention.size)")


def check_clamav(errors: list[str], block: str) -> None:
    """Диапазон ClamAV 1–2 ГиБ (история 39/G42): вне диапазона — до сборки."""
    if not block:
        return
    memory = find_limit(block, "memory")
    if memory is None:
        return
    size = parse_size_to_bytes(memory)
    if size is None:
        return
    mib = (size + 1024**2 - 1) // 1024**2
    if mib < CLAMAV_MIN_MIB:
        errors.append(
            f"PREFLIGHT: лимит памяти clamav {mib} МиБ < 1 ГиБ "
            "(история 39/G42, Решения: ClamAV 1–2 ГиБ; замер 7 МиБ "
            "с нездорового демона нерепрезентативен) — до сборки"
        )
    elif mib > CLAMAV_MAX_MIB:
        errors.append(
            f"PREFLIGHT: лимит памяти clamav {mib} МиБ > 2 ГиБ "
            "(история 39/G42, Решения: ClamAV 1–2 ГиБ; замер 7 МиБ "
            "с нездорового демона нерепрезентативен) — до сборки"
        )


def main() -> int:
    errors: list[str] = []
    try:
        check_machine(errors)
        check_compose_budget(errors)
    except Exception as exc:  # fail-closed: непонятное состояние — не деплоить.
        print(f"PREFLIGHT: внутренняя ошибка гейта: {exc}", file=sys.stderr)
        return 2
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(
        f"PREFLIGHT OK: {MIN_CPUS} vCPU / {MIN_MEM_GIB} ГиБ / "
        f"{MIN_DISK_FREE_GB} ГБ свободно; сумма лимитов <= 8 ГиБ / 6 vCPU",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
