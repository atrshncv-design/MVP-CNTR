"""REPAIR 2026-09-17: legacy-include первым на порту давал 301-петлю.

Авария с продакшена: `include /etc/nginx/legacy/*.conf` стоит раньше
основных server-блоков, а основные блоки — `server_name _` без
`default_server`. nginx отдаёт SNI без точного совпадения в ПЕРВЫЙ блок
порта — им стал legacy-443: любое неизвестное имя (включая новое
каноническое) получало 301 на новое имя = петля, сайт лёг полностью.
Старое имя (точное совпадение) редиректило корректно и маскировало баг.

Фикс: основным блокам 80/443 — явный `default_server` (неизвестные имена
идут в основной сайт, а не в legacy). Гейт `nginx_routing_gate.py` ловит
петлю до переключения в deploy И rollback.

Швы — текст конфигов и код возврата гейта как процесса с подменённым env.
К живому серверу и docker не ходим. Ожидаемые значения — ручные
(имена хостов, коды возврата), а не из кода под тестом.
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
PROD_CONF = INFRA_ROOT / "nginx" / "nginx.prod.conf"
RENDER = INFRA_ROOT / "render_legacy_redirect.sh"
GATE = INFRA_ROOT / "nginx_routing_gate.py"

# Ручные значения, не из кода под тестом.
NEW_NAME = "cntr-prod.ru"
OLD_NAME = "1-2-3-4.sslip.io"
UNKNOWN_NAMES = ("unknown-probe.invalid", "some-random-name.example")

_SCRUB_KEYS = (
    "PUBLIC_HOST",
    "LEGACY_PUBLIC_HOST",
    "LEGACY_REDIRECT_OUT",
    "NGINX_PROD_CONF",
    "LEGACY_REDIRECT_FILE",
)


def _strip_comments(text: str) -> str:
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


def _server_bodies(text: str) -> list[str]:
    """Тела server-блоков верхнего уровня (независимый мини-парсер, не гейт)."""
    bodies: list[str] = []
    for match in re.finditer(r"server\s*\{", text):
        depth = 0
        start = -1
        for pos in range(match.end() - 1, len(text)):
            if text[pos] == "{":
                depth += 1
                if depth == 1:
                    start = pos + 1
            elif text[pos] == "}":
                depth -= 1
                if depth == 0:
                    bodies.append(text[start:pos])
                    break
    return bodies


def _listen_directives(body: str) -> list[tuple[int, bool]]:
    found: list[tuple[int, bool]] = []
    for match in re.finditer(r"listen\s+([^;]+);", body):
        tokens = match.group(1).split()
        port = int(re.match(r"(\d+)", tokens[0].rsplit(":", 1)[-1].strip("[]")).group(1))
        found.append((port, "default_server" in tokens[1:]))
    return found


def _names(body: str) -> tuple[str, ...]:
    match = re.search(r"server_name\s+([^;]+);", body)
    return tuple(match.group(1).split()) if match else ()


def _fixed_301_target(body: str) -> str | None:
    match = re.search(r"return\s+301\s+(\S+)\s*;", body)
    if not match or not match.group(1).lower().startswith("https://"):
        return None
    host = match.group(1)[len("https://"):].split("$", 1)[0].split("/", 1)[0].lower()
    return host or None


def _run_render(public: str, legacy: str | None, out: Path) -> subprocess.CompletedProcess[str]:
    env = {k: v for k, v in os.environ.items() if k not in _SCRUB_KEYS}
    env.update({"PUBLIC_HOST": public, "LEGACY_REDIRECT_OUT": str(out)})
    if legacy is not None:
        env["LEGACY_PUBLIC_HOST"] = legacy
    return subprocess.run(
        ["bash", str(RENDER)], env=env, check=False,
        capture_output=True, text=True, timeout=60,
    )


def _run_gate(
    public: str, legacy: str | None, prod_conf: Path, legacy_file: Path
) -> subprocess.CompletedProcess[str]:
    env = {k: v for k, v in os.environ.items() if k not in _SCRUB_KEYS}
    env.update({
        "PUBLIC_HOST": public,
        "NGINX_PROD_CONF": str(prod_conf),
        "LEGACY_REDIRECT_FILE": str(legacy_file),
    })
    if legacy is not None:
        env["LEGACY_PUBLIC_HOST"] = legacy
    return subprocess.run(
        ["python3", str(GATE)], env=env, check=False,
        capture_output=True, text=True, timeout=60,
    )


def _select(
    blocks: list[tuple[str, tuple[str, ...]]], port: int, host: str
) -> tuple[str, tuple[str, ...]]:
    """Выбор блока по семантике nginx: точное имя > default_server > первый.

    blocks — (тело, порядок-источник) уже в порядке загрузки конфига.
    Возвращает (тело, источник); источник: "prod" | "legacy".
    """
    lowered = host.lower()
    port_blocks = [
        (body, source) for body, source in blocks
        if port in [item[0] for item in _listen_directives(body)]
    ]
    for body, source in port_blocks:
        if lowered in [name.lower() for name in _names(body)]:
            return body, source
    for body, source in port_blocks:
        if any(flag for _, flag in _listen_directives(body)):
            return body, source
    assert port_blocks, f"нет server-блока на порту {port}"
    return port_blocks[0]


def _ordered_blocks(prod_text: str, legacy_text: str, legacy_first: bool) -> list:
    prod = [(body, "prod") for body in _server_bodies(prod_text)]
    legacy = [(body, "legacy") for body in _server_bodies(legacy_text)]
    return legacy + prod if legacy_first else prod + legacy


def test_main_blocks_are_default_server_on_80_and_443() -> None:
    """П.1 фикса: основные блоки — явный default_server, catch-all цел."""
    text = _strip_comments(PROD_CONF.read_text(encoding="utf-8"))
    bodies = _server_bodies(text)
    assert len(bodies) == 2
    for port in (80, 443):
        defaults = [
            body for body in bodies
            if any(item == (port, True) for item in _listen_directives(body))
        ]
        assert len(defaults) == 1, f"порту {port} нужен ровно один default_server"
    assert text.count("server_name _;") == 2


def test_rendered_legacy_has_no_default_server(tmp_path: Path) -> None:
    """Legacy-блоки никогда не default: иначе снова станут implicit default."""
    out = tmp_path / "redirect.conf"
    result = _run_render(NEW_NAME, OLD_NAME, out)
    assert result.returncode == 0, result.stderr
    text = _strip_comments(out.read_text(encoding="utf-8"))
    assert "default_server" not in text
    assert f"server_name {OLD_NAME};" in text
    assert f"return 301 https://{NEW_NAME}$request_uri;" in text


def test_unknown_and_canonical_route_to_main_site_in_both_include_orders(
    tmp_path: Path,
) -> None:
    """Ядро регресса: неизвестное SNI/Host → основной сайт, не 301-петля."""
    out = tmp_path / "redirect.conf"
    assert _run_render(NEW_NAME, OLD_NAME, out).returncode == 0
    prod_text = _strip_comments(PROD_CONF.read_text(encoding="utf-8"))
    legacy_text = _strip_comments(out.read_text(encoding="utf-8"))
    for legacy_first in (True, False):
        order = "legacy-first" if legacy_first else "legacy-last"
        blocks = _ordered_blocks(prod_text, legacy_text, legacy_first)
        for host in (NEW_NAME, *UNKNOWN_NAMES):
            for port in (80, 443):
                body, source = _select(blocks, port, host)
                assert source == "prod", f"[{order}] {host}:{port} ушло не в основной сайт"
                assert _fixed_301_target(body) != host.lower(), f"[{order}] ПЕТЛЯ {host}:{port}"
            main_443, _ = _select(blocks, 443, host)
            assert "proxy_pass" in main_443, f"[{order}] {host}:443 не проксируется в сайт"
        for port in (80, 443):
            body, source = _select(blocks, port, OLD_NAME)
            assert source == "legacy", f"[{order}] старое имя {OLD_NAME}:{port} не в 301-блоке"
            target = _fixed_301_target(body)
            assert target == NEW_NAME.lower(), f"[{order}] 301 ведёт не на новое имя"


def test_gate_passes_on_current_tree(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    assert _run_render(NEW_NAME, OLD_NAME, out).returncode == 0
    result = _run_gate(NEW_NAME, OLD_NAME, PROD_CONF, out)
    assert result.returncode == 0, result.stderr
    assert "ROUTING-GATE OK" in result.stdout


def test_gate_passes_without_legacy_redirect(tmp_path: Path) -> None:
    out = tmp_path / "redirect.conf"
    assert _run_render(NEW_NAME, None, out).returncode == 0
    result = _run_gate(NEW_NAME, None, PROD_CONF, out)
    assert result.returncode == 0, result.stderr


def test_gate_catches_prefix_config_loop(tmp_path: Path) -> None:
    """Гейт ловит конфигурацию до фикса (без default_server): петля на каноническом."""
    out = tmp_path / "redirect.conf"
    assert _run_render(NEW_NAME, OLD_NAME, out).returncode == 0
    broken = tmp_path / "nginx.prefix.conf"
    text = PROD_CONF.read_text(encoding="utf-8")
    assert " default_server" in text
    broken.write_text(text.replace(" default_server", ""), encoding="utf-8")
    result = _run_gate(NEW_NAME, OLD_NAME, broken, out)
    assert result.returncode == 1
    assert "ПЕТЛЯ" in result.stderr
    assert NEW_NAME in result.stderr


def test_gate_catches_self_target_loop(tmp_path: Path) -> None:
    """Гейт ловит 301 в себя (legacy-имя редиректит на само себя)."""
    legacy_file = tmp_path / "redirect.conf"
    legacy_file.write_text(
        "server {\n"
        f"    listen 443 ssl;\n    server_name {OLD_NAME};\n"
        "    ssl_certificate     /etc/nginx/certs/fullchain.pem;\n"
        "    ssl_certificate_key /etc/nginx/certs/privkey.pem;\n"
        f"    return 301 https://{OLD_NAME}$request_uri;\n}}\n",
        encoding="utf-8",
    )
    result = _run_gate(NEW_NAME, OLD_NAME, PROD_CONF, legacy_file)
    assert result.returncode == 1
    assert "301" in result.stderr


def test_gate_fails_closed_without_render(tmp_path: Path) -> None:
    """LEGACY задан, а 301-файл пуст (рендер не запускали) — fail-closed."""
    out = tmp_path / "redirect.conf"
    assert _run_render(NEW_NAME, None, out).returncode == 0
    result = _run_gate(NEW_NAME, OLD_NAME, PROD_CONF, out)
    assert result.returncode == 1


def _deploy_branches() -> tuple[str, str]:
    deploy = (INFRA_ROOT / "deploy.sh").read_text(encoding="utf-8")
    assert "nginx_routing_gate.py" in deploy
    dispatch = deploy.rsplit('case "${1:-deploy}" in', 1)[1]
    pre, post = dispatch.split("rollback)", 1)
    rollback_branch = post.split("check-env)", 1)[0]
    return pre, rollback_branch


def test_deploy_and_rollback_gate_loop_before_switch() -> None:
    """П.3: гейт идёт после рендера и до переключения в deploy И rollback."""
    deploy_branch, rollback_branch = _deploy_branches()
    for branch in (deploy_branch, rollback_branch):
        assert "run_routing_gate" in branch
        assert branch.index("run_tls_gate") < branch.index("render_legacy_redirect")
        assert branch.index("render_legacy_redirect") < branch.index("run_routing_gate")
    assert deploy_branch.index("run_routing_gate") < deploy_branch.index("compose up")
    assert rollback_branch.index("run_routing_gate") < rollback_branch.index("rollback_to_tag")
