"""REPAIR 2026-09-17: redirect.conf на диске новый, а nginx в памяти — старый.

Зазор с продакшена: deploy.sh перегенерирует
`technozrelost-backend/infra/nginx/legacy/redirect.conf` из env, но образ
nginx — pinned (nginx:1.27-alpine, не IMAGE_TAG), поэтому `compose up`
контейнер не пересоздаёт и 301 со старого имени не применяется до ручного
reload/restart — именно так редирект «не работал» после зелёного деплоя.

Фикс: deploy.sh снимает hash redirect.conf до рендера, а после поднятия
стека вызывает `reload_nginx_if_redirect_changed`: изменился →
`compose exec -T nginx nginx -s reload` (без разрыва соединений, как в
tls_renew.sh), неуспех — fail-closed (rollback в deploy-ветке, fail в
rollback-ветке). Не изменился → код 0 без вызова docker.

Швы — код возврата и вызовы мок-функции `compose` при source deploy.sh
(без docker, без прод-сервера, секретов нет — только пути tmp и синтетика).
Ожидаемые значения — ручные.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
DEPLOY = INFRA_ROOT / "deploy.sh"

# Синтетика, не из кода под тестом: важно лишь, что строки различаются.
OLD_CONF = "server { server_name old-name; return 301 https://new-name; }\n"
NEW_CONF = "server { server_name old-name; return 301 https://other-name; }\n"
RELOAD_CALL = "COMPOSE-CALL:exec -T nginx nginx -s reload"

_HARNESS_LINES = (
    "source ./deploy.sh",
    "compose() {",
    '  printf \'COMPOSE-CALL:%s\\n\' "$*" >> "$COMPOSE_LOG"',
    '  return "$MOCK_EXIT"',
    "}",
    'before="$(redirect_file_hash "$REDIRECT_FILE")"',
    'if [ -n "${MUTATED_FILE:-}" ]; then',
    '  cat "$MUTATED_FILE" > "$REDIRECT_FILE"',
    "fi",
    'if reload_nginx_if_redirect_changed "$before" "$REDIRECT_FILE"; then',
    '  echo "RESULT rc=0"',
    "else",
    '  echo "RESULT rc=1"',
    "fi",
)


def _run_reload(
    tmp_path: Path, initial: str | None, mutated: str | None, mock_exit: int
) -> subprocess.CompletedProcess[str]:
    """Прогон reload-логики: snapshot → (опционально) смена файла → reload."""
    redirect = tmp_path / "redirect.conf"
    log = tmp_path / "compose.log"
    if initial is not None:
        redirect.write_text(initial, encoding="utf-8")
    log.write_text("", encoding="utf-8")
    harness = tmp_path / "harness.sh"
    harness.write_text("\n".join(_HARNESS_LINES) + "\n", encoding="utf-8")
    env = {
        "PATH": os.environ.get("PATH", os.defpath),
        "REDIRECT_FILE": str(redirect),
        "COMPOSE_LOG": str(log),
        "MOCK_EXIT": str(mock_exit),
    }
    if mutated is not None:
        mutated_file = tmp_path / "mutated.conf"
        mutated_file.write_text(mutated, encoding="utf-8")
        env["MUTATED_FILE"] = str(mutated_file)
    return subprocess.run(
        ["bash", str(harness)],
        env=env,
        cwd=INFRA_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_reload_called_when_redirect_changed(tmp_path: Path) -> None:
    result = _run_reload(tmp_path, OLD_CONF, NEW_CONF, mock_exit=0)
    assert "RESULT rc=0" in result.stdout, result.stderr
    assert "изменился" in result.stdout
    assert (tmp_path / "compose.log").read_text(encoding="utf-8") == RELOAD_CALL + "\n"


def test_no_reload_when_redirect_unchanged(tmp_path: Path) -> None:
    result = _run_reload(tmp_path, OLD_CONF, OLD_CONF, mock_exit=0)
    assert result.returncode == 0, result.stderr
    assert "RESULT rc=0" in result.stdout
    assert "не изменился" in result.stdout
    assert (tmp_path / "compose.log").read_text(encoding="utf-8") == ""


def test_missing_file_before_render_triggers_reload(tmp_path: Path) -> None:
    """Первый рендер (файла не было) — тоже изменение, reload нужен."""
    result = _run_reload(tmp_path, None, NEW_CONF, mock_exit=0)
    assert "RESULT rc=0" in result.stdout, result.stderr
    assert (tmp_path / "compose.log").read_text(encoding="utf-8") == RELOAD_CALL + "\n"


def test_reload_failure_is_fail_closed(tmp_path: Path) -> None:
    """Файл изменился, а reload упал — код 1, reload был вызван."""
    result = _run_reload(tmp_path, OLD_CONF, NEW_CONF, mock_exit=1)
    assert "RESULT rc=1" in result.stdout
    assert "ОШИБКА" in result.stderr
    assert (tmp_path / "compose.log").read_text(encoding="utf-8") == RELOAD_CALL + "\n"


def _deploy_branches() -> tuple[str, str]:
    deploy = DEPLOY.read_text(encoding="utf-8")
    dispatch = deploy.rsplit('case "${1:-deploy}" in', 1)[1]
    pre, post = dispatch.split("rollback)", 1)
    rollback_branch = post.split("check-env)", 1)[0]
    return pre, rollback_branch


def test_reload_function_is_fail_closed_without_docker() -> None:
    """Тело функции: сравнение hash, reload через compose, неуспех → 1."""
    source = DEPLOY.read_text(encoding="utf-8")
    fn = source.split("reload_nginx_if_redirect_changed() {", 1)[1].split("\n}\n", 1)[0]
    assert "compose exec -T nginx nginx -s reload" in fn
    assert "return 1" in fn
    assert "redirect_file_hash" in fn
    assert "не изменился" in fn
    snap = source.split("redirect_file_hash() {", 1)[1].split("\n}\n", 1)[0]
    assert "sha256sum" in snap
    assert "missing" in snap


def test_deploy_and_rollback_snapshot_before_render_reload_after_switch() -> None:
    """Обе ветки: snapshot до рендера, reload после переключения, fail-closed."""
    deploy_branch, rollback_branch = _deploy_branches()
    for branch in (deploy_branch, rollback_branch):
        snap = branch.index("LEGACY_REDIRECT_BEFORE=")
        assert "redirect_file_hash" in branch[snap : snap + 120]
        assert snap < branch.index("render_legacy_redirect")
        assert branch.index("render_legacy_redirect") < branch.index("run_routing_gate")
        assert branch.index("run_routing_gate") < branch.index(
            "reload_nginx_if_redirect_changed"
        )
    assert deploy_branch.index("wait_for_healthy") < deploy_branch.index(
        "reload_nginx_if_redirect_changed"
    )
    deploy_tail = deploy_branch[deploy_branch.index("reload_nginx_if_redirect_changed") :]
    assert "automatic_rollback || true" in deploy_tail
    assert "exit 1" in deploy_tail
    assert rollback_branch.index('rollback_to_tag "$2"') < rollback_branch.index(
        "reload_nginx_if_redirect_changed"
    )
    rollback_tail = rollback_branch[rollback_branch.index("reload_nginx_if_redirect_changed") :]
    assert "exit 1" in rollback_tail
    assert "automatic_rollback" not in rollback_tail
