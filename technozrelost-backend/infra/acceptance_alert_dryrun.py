#!/usr/bin/env python3
"""Dry-run синтетического алерта до Telegram БЕЗ секретов (таск 10, G45).

Строит синтетический failing-набор проверок, рендерит текст, который ушёл
бы в Telegram, и останавливается ДО точки ввода секретов: сеть не
используется, значения TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID не читаются
и не печатаются (только имена). Реальная доставка — по чек-листу
в `infra/README-ACCEPTANCE.md` (раздел 3), значения вводит владелец.

Шов: код возврата + stdout. 0 — dry-run собран, отправки не было.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

INFRA_ROOT = Path(__file__).resolve().parent
ALERTER_PATH = INFRA_ROOT / "alerter" / "alerter.py"


def load_alerter():
    spec = importlib.util.spec_from_file_location("tz_alerter", ALERTER_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["tz_alerter"] = module  # dataclasses требует записи в sys.modules.
    spec.loader.exec_module(module)
    return module


def exploding_send(message: str) -> bool:
    raise AssertionError("dry-run must never touch the network")


def run() -> int:
    alerter = load_alerter()
    synthetic = [
        alerter.CheckResult("readiness", alerter.CRITICAL, "synthetic probe: http_status=500"),
        alerter.CheckResult("backup_freshness", alerter.OK, "synthetic probe: age=1.0h"),
    ]
    text = alerter.format_message(synthetic)
    state, event = alerter.process_checks(
        synthetic, alerter.AlertState(), telegram_configured=False, send=exploding_send
    )
    print("DRY-RUN synthetic Telegram alert (не отправлено, сети не было):")
    print(text)
    print(f"DRY-RUN event={event} active={state.active}")
    print(
        "DRY-RUN next: владелец вводит TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID "
        "в infra/.env.production на сервере (значения — только туда, "
        "не в переписку и не в git), затем — живая проверка по разделу 3 "
        "infra/README-ACCEPTANCE.md."
    )
    return 0


def main() -> int:
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
