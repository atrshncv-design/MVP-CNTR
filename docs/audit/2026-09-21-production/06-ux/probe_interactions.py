"""Ticket 06 follow-up interaction probe (read-only, zone-local TMPDIR).

- Keyboard: Tab 8x on /login@1920, record focused tag/label (no submits).
- Mobile menu: open hamburger on /@375, screenshot, close.
- Language: click EN on /@1920, record html lang + screenshot; back to RU.
All artifacts stay inside the ticket zone.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ZONE = Path(__file__).parent
SHOTS = ZONE / "screenshots"
TMP = ZONE / ".tmp-ux"
OUT = ZONE / "pass-interactions.json"
BASE = "https://technozrelost.atrshnjc.beget.tech"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def main():
    from playwright.sync_api import sync_playwright

    os.environ["TMPDIR"] = str(TMP)
    out = {"started": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "checks": []}

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(TMP / "profile-interact"), executable_path=CHROME,
            args=["--no-sandbox"], viewport={"width": 1920, "height": 1080}, locale="ru-RU")
        page = ctx.new_page()

        # 1. Keyboard walk on login
        page.goto(BASE + "/login", timeout=30000, wait_until="domcontentloaded")
        time.sleep(1.5)
        foci = []
        for _ in range(8):
            page.keyboard.press("Tab")
            time.sleep(0.2)
            foci.append(page.evaluate(
                "() => { const a = document.activeElement; if (!a) return 'none';"
                " const l = a.getAttribute('aria-label') || a.innerText || a.value || a.name || a.id || ''; "
                " return a.tagName.toLowerCase() + '|' + l.slice(0, 40); }"))
        out["checks"].append({"name": "keyboard-tab-login-1920", "focus_sequence": foci})
        time.sleep(2.0)

        # 2. Language switch EN
        page.goto(BASE + "/", timeout=30000, wait_until="domcontentloaded")
        time.sleep(1.5)
        before = page.evaluate("() => document.documentElement.lang")
        try:
            page.get_by_role("button", name="EN").click(timeout=5000)
            time.sleep(2.0)
        except Exception as exc:  # noqa: BLE001
            out["checks"].append({"name": "language-en", "error": str(exc)[:200]})
        else:
            after = page.evaluate("() => document.documentElement.lang")
            title = page.title()
            page.screenshot(path=str(SHOTS / "home-en-1920.png"))
            out["checks"].append({"name": "language-en", "lang_before": before,
                                  "lang_after": after, "title": title,
                                  "screenshot": "screenshots/home-en-1920.png"})
        time.sleep(2.0)
        ctx.close()

        # 3. Mobile hamburger on 375
        ctx2 = p.chromium.launch_persistent_context(
            str(TMP / "profile-mobile"), executable_path=CHROME,
            args=["--no-sandbox"], viewport={"width": 375, "height": 667}, locale="ru-RU")
        m = ctx2.new_page()
        m.goto(BASE + "/", timeout=30000, wait_until="domcontentloaded")
        time.sleep(1.5)
        try:
            btn = m.locator("header button").last
            btn.click(timeout=5000)
            time.sleep(1.0)
            m.screenshot(path=str(SHOTS / "home-menu-375.png"))
            state = m.evaluate(
                "() => ({ dialogs: document.querySelectorAll('[role=\"dialog\"]').length,"
                " expanded: [...document.querySelectorAll('[aria-expanded]')].map(e => e.getAttribute('aria-expanded')) })")
            out["checks"].append({"name": "mobile-menu-375", "state": state,
                                  "screenshot": "screenshots/home-menu-375.png"})
        except Exception as exc:  # noqa: BLE001
            out["checks"].append({"name": "mobile-menu-375", "error": str(exc)[:200]})
        ctx2.close()

    out["finished"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(json.dumps(out, ensure_ascii=False, indent=2)[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
