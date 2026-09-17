#!/usr/bin/env python3
"""Гейт маршрутизации nginx перед переключением (REPAIR 2026-09-17).

Авария с продакшена: legacy-include (`include /etc/nginx/legacy/*.conf`)
стоит раньше основных server-блоков, а основные блоки — `server_name _`
без `default_server`. nginx отдаёт SNI без точного совпадения в ПЕРВЫЙ
блок порта — им стал legacy-443: любое неизвестное имя (включая новое
каноническое) получало 301 на новое имя = петля, сайт лёг полностью.
Старое имя (точное совпадение) редиректило корректно и маскировало баг.
Откат шёл тем же путём (конфиг на диске уже новый) и петлю не ловил.

Гейт проверяет склейку целиком (nginx.prod.conf + файл, сгенерированный
render_legacy_redirect.sh) ДО переключения — вызывается из deploy.sh
в ветках deploy и rollback после рендера legacy-файла:
  0 — неизвестные имена идут в основной сайт, legacy — 301 на новое имя,
      порядок инклудов не влияет (смоделированы оба порядка);
  1 — петля или нарушение контракта (нет default_server у основных,
      default_server у legacy, stale-файл, 301 в себя);
  2 — внутренняя ошибка (нет прод-конфига, конфиг не парсится).

Входы (env, секретов нет — только публичные имена DNS):
  PUBLIC_HOST — новое (каноническое) имя, обязательно;
  LEGACY_PUBLIC_HOST — старое имя переходного периода (опционально;
      задано — обязан существовать 301 на новое);
  NGINX_PROD_CONF — путь к прод-конфигу (дефолт: nginx/nginx.prod.conf);
  LEGACY_REDIRECT_FILE / LEGACY_REDIRECT_OUT — сгенерированный 301-файл
      (дефолт: nginx/legacy/redirect.conf).

Шов: код возврата + stdout/stderr. К живому серверу и docker не ходит.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

INFRA_ROOT = Path(__file__).resolve().parent
DEFAULT_PROD_CONF = INFRA_ROOT / "nginx" / "nginx.prod.conf"
DEFAULT_LEGACY_FILE = INFRA_ROOT / "nginx" / "legacy" / "redirect.conf"

LEGACY_INCLUDE_MARK = "include /etc/nginx/legacy/"
# Зонд неизвестного имени: никогда не совпадает ни с одним server_name,
# поэтому обязан попасть в основной сайт (default_server), а не в 301.
UNKNOWN_PROBE_HOST = "unknown-probe.invalid"
CHECKED_PORTS = (80, 443)

_SERVER_RE = re.compile(r"server\s*\{")
_LISTEN_RE = re.compile(r"listen\s+([^;]+);")
_NAME_RE = re.compile(r"server_name\s+([^;]+);")
_RETURN_301_RE = re.compile(r"return\s+301\s+(\S+)\s*;")
_DYNAMIC_TARGETS = ("$host", "$hostname", "$server_name", "$http_host")


class ServerBlock:
    """Один server-блок: порты, default-флаг, имена, фиксированный 301-таргет."""

    def __init__(
        self,
        source: str,
        ports: frozenset[int],
        default: bool,
        names: tuple[str, ...],
        fixed_301_host: str | None,
        has_proxy: bool,
    ) -> None:
        self.source = source
        self.ports = ports
        self.default = default
        self.names = names
        self.fixed_301_host = fixed_301_host
        self.has_proxy = has_proxy

    def label(self) -> str:
        return f"{self.source} (порты {sorted(self.ports)})"


def fail(errors: list[str]) -> int:
    for error in errors:
        print(error, file=sys.stderr)
    return 1


def strip_comments(text: str) -> str:
    """Вырезать `#`-комментарии с учётом кавычек (log_format с `$` цел)."""
    out: list[str] = []
    for line in text.splitlines():
        buf: list[str] = []
        quote: str | None = None
        for char in line:
            if quote is not None:
                buf.append(char)
                if char == quote:
                    quote = None
            elif char in ("'", '"'):
                quote = char
                buf.append(char)
            elif char == "#":
                break
            else:
                buf.append(char)
        out.append("".join(buf))
    return "\n".join(out)


def extract_server_blocks(text: str, source: str) -> list[ServerBlock] | None:
    """Достать server-блоки верхнего уровня; None — несбалансированные скобки."""
    blocks: list[ServerBlock] = []
    for match in _SERVER_RE.finditer(text):
        depth = 0
        body_start = -1
        end = -1
        for pos in range(match.end() - 1, len(text)):
            char = text[pos]
            if char == "{":
                depth += 1
                if depth == 1:
                    body_start = pos + 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    end = pos
                    break
        if body_start < 0 or end < 0:
            return None
        blocks.append(parse_block(text[body_start:end], source))
    return blocks


def parse_listen_params(params: str) -> tuple[frozenset[int], bool]:
    ports: set[int] = set()
    tokens = params.split()
    if tokens:
        first = tokens[0].strip("[]")
        if ":" in first and not first.startswith(":"):
            first = first.rsplit(":", 1)[-1].strip("[]")
        matched = re.match(r"(\d+)", first)
        if matched is not None:
            ports.add(int(matched.group(1)))
    return frozenset(ports), "default_server" in tokens[1:]


def fixed_301_host(target: str) -> str | None:
    """Фиксированный хост 301-таргета; None — динамический ($host) или не https."""
    lowered = target.lower()
    if not lowered.startswith("https://"):
        return None
    rest = target[len("https://"):]
    host = rest.split("$", 1)[0].split("/", 1)[0].strip().lower()
    if not host or host in _DYNAMIC_TARGETS:
        return None
    return host


def parse_block(body: str, source: str) -> ServerBlock:
    ports: set[int] = set()
    default = False
    for match in _LISTEN_RE.finditer(body):
        block_ports, block_default = parse_listen_params(match.group(1))
        ports |= set(block_ports)
        default = default or block_default
    names: tuple[str, ...] = ()
    name_match = _NAME_RE.search(body)
    if name_match is not None:
        names = tuple(item.lower() for item in name_match.group(1).split())
    target: str | None = None
    return_match = _RETURN_301_RE.search(body)
    if return_match is not None:
        target = fixed_301_host(return_match.group(1))
    return ServerBlock(source, frozenset(ports), default, names, target, "proxy_pass" in body)


def select(blocks: list[ServerBlock], port: int, host: str) -> ServerBlock | None:
    """Выбор блока по семантике nginx: точное имя > default_server > первый."""
    lowered = host.lower()
    for block in blocks:
        if port in block.ports and lowered in block.names:
            return block
    for block in blocks:
        if port in block.ports and block.default:
            return block
    for block in blocks:
        if port in block.ports:
            return block
    return None


def check(
    prod_text: str,
    prod_blocks: list[ServerBlock],
    legacy_blocks: list[ServerBlock],
    public: str,
    legacy: str | None,
) -> list[str]:
    errors: list[str] = []
    lowered_public = public.lower()
    lowered_legacy = legacy.lower() if legacy else None

    if LEGACY_INCLUDE_MARK not in prod_text:
        errors.append(
            "ROUTING-GATE: прод-конфиг не инклюдит legacy-директорию "
            f"({LEGACY_INCLUDE_MARK}) — 301 со старого имени не загрузится"
        )
    if legacy is not None and lowered_legacy == lowered_public:
        errors.append("ROUTING-GATE: LEGACY_PUBLIC_HOST совпадает с PUBLIC_HOST — 301 в себя")

    combined = prod_blocks + legacy_blocks
    for port in CHECKED_PORTS:
        defaults = [block for block in combined if port in block.ports and block.default]
        prod_defaults = [block for block in defaults if block.source == "prod"]
        if len(prod_defaults) != 1 or len(defaults) != 1:
            errors.append(
                f"ROUTING-GATE: порту {port} нужен ровно один default_server "
                "в основном блоке (сейчас это не так — неизвестное SNI уйдёт "
                "в первый блок порта, см. аварию 2026-09-17)"
            )
        legacy_defaults = [
            block for block in legacy_blocks if port in block.ports and block.default
        ]
        if legacy_defaults:
            errors.append(
                f"ROUTING-GATE: legacy-блок не должен быть default_server (порт {port})"
            )

    if legacy is None:
        if legacy_blocks:
            errors.append(
                "ROUTING-GATE: LEGACY_PUBLIC_HOST пуст, но 301-файл содержит "
                "server-блоки — stale-файл, перегенерируйте (render_legacy_redirect.sh)"
            )
    else:
        if not legacy_blocks:
            errors.append(
                "ROUTING-GATE: LEGACY_PUBLIC_HOST задан, но 301-файл пуст — "
                "сначала render_legacy_redirect.sh (fail-closed)"
            )
        for block in legacy_blocks:
            if block.names != (lowered_legacy,):
                errors.append(
                    f"ROUTING-GATE: legacy-блок {block.label()} обслуживает "
                    f"{' '.join(block.names) or 'без имени'} вместо {legacy}"
                )
            if block.fixed_301_host != lowered_public:
                errors.append(
                    f"ROUTING-GATE: legacy-блок {block.label()} ведёт "
                    f"в {block.fixed_301_host or 'динамический таргет'} "
                    f"вместо https://{public}"
                )

    # Маршрутизация в обоих порядках инклудов: legacy-блок может грузиться
    # как до, так и после основных — результат обязан совпадать.
    orders = {
        "legacy-first": legacy_blocks + prod_blocks,
        "legacy-last": prod_blocks + legacy_blocks,
    }
    probes = [public, UNKNOWN_PROBE_HOST]
    if legacy is not None:
        probes.append(legacy)
    for order_name, ordered in orders.items():
        for port in CHECKED_PORTS:
            for host in probes:
                selected = select(ordered, port, host)
                if selected is None:
                    errors.append(
                        f"ROUTING-GATE [{order_name}]: порту {port} нечего "
                        f"отдать {host} — нет server-блока"
                    )
                    continue
                lowered_host = host.lower()
                if legacy is not None and lowered_host == lowered_legacy:
                    if selected.source != "legacy":
                        errors.append(
                            f"ROUTING-GATE [{order_name}]: старое имя {host} "
                            f"на порту {port} попало в {selected.label()} "
                            "вместо 301 на новое имя"
                        )
                elif selected.source != "prod":
                    errors.append(
                        f"ROUTING-GATE [{order_name}]: {host} на порту {port} "
                        f"попало в {selected.label()} вместо основного сайта "
                        "— неизвестное SNI обязано идти в default_server"
                    )
                if selected.fixed_301_host == lowered_host:
                    errors.append(
                        f"ROUTING-GATE [{order_name}]: ПЕТЛЯ: {host} на порту "
                        f"{port} получает 301 на само себя ({selected.label()})"
                    )
    return errors


def main() -> int:
    public = os.environ.get("PUBLIC_HOST", "").strip().strip("\"'")
    legacy_raw = os.environ.get("LEGACY_PUBLIC_HOST", "").strip().strip("\"'")
    legacy = legacy_raw or None
    prod_path = Path(os.environ.get("NGINX_PROD_CONF", str(DEFAULT_PROD_CONF)))
    legacy_path = Path(
        os.environ.get("LEGACY_REDIRECT_FILE", os.environ.get("LEGACY_REDIRECT_OUT", ""))
        or str(DEFAULT_LEGACY_FILE)
    )
    errors: list[str] = []
    if not public:
        return fail(["ROUTING-GATE: PUBLIC_HOST не задан"])
    if not prod_path.is_file():
        print(f"ROUTING-GATE: внутренняя ошибка гейта: нет {prod_path}", file=sys.stderr)
        return 2
    if not legacy_path.is_file():
        return fail(
            [
                "ROUTING-GATE: нет сгенерированного 301-файла "
                f"({legacy_path}) — сначала render_legacy_redirect.sh (fail-closed)"
            ]
        )
    try:
        prod_text = strip_comments(prod_path.read_text(encoding="utf-8"))
        legacy_text = strip_comments(legacy_path.read_text(encoding="utf-8"))
    except OSError as exc:
        print(f"ROUTING-GATE: внутренняя ошибка гейта: {exc}", file=sys.stderr)
        return 2
    prod_blocks = extract_server_blocks(prod_text, "prod")
    legacy_parsed = extract_server_blocks(legacy_text, "legacy")
    if prod_blocks is None or legacy_parsed is None:
        print("ROUTING-GATE: внутренняя ошибка гейта: скобки не сбалансированы", file=sys.stderr)
        return 2
    errors.extend(check(prod_text, prod_blocks, legacy_parsed, public, legacy))
    if errors:
        return fail(errors)
    if legacy is not None:
        print(
            f"ROUTING-GATE OK: {public} в основном сайте, "
            f"301 с {legacy} (порядок инклудов не влияет)"
        )
    else:
        print(f"ROUTING-GATE OK: {public} в основном сайте, legacy-редирект выключен")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
