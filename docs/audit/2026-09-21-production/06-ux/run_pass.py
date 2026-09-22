"""Ticket 06 UX/UI production pass (read-only, low-rate, no /tmp).

Runs a browser pass of public production over 1920/768/375, saves
screenshots + DOM/a11y/interaction evidence inside this zone only.
Browser profile/TMPDIR are zone-local (.tmp-ux/). No auth, no mutations,
no form submits. Aborts on 5xx.
"""
import csv
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ZONE = Path(__file__).parent
SHOTS = ZONE / "screenshots"
TMP = ZONE / ".tmp-ux"
OUT = ZONE / "pass-results.json"

BASE = "https://technozrelost.atrshnjc.beget.tech"
ROUTES = [
    ("home", "/"),
    ("about", "/about"),
    ("customers", "/customers"),
    ("levels", "/levels"),
    ("methodology", "/methodology"),
    ("news", "/news"),
    ("nioktr", "/nioktr"),
    ("performers", "/performers"),
    ("projects", "/projects"),
    ("roadmap", "/roadmap"),
    ("login", "/login"),
    ("register", "/register"),
    ("forbidden", "/forbidden"),
]
VIEWPORTS = [(1920, 1080), (768, 1024), (375, 667)]
GAP_SECONDS = 2.0
STOP_ON_5XX = True

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def health_probe():
    req = urllib.request.Request(BASE + "/api/v1/health", method="GET")
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=15) as r:
        body = r.read(200).decode("utf-8", "replace")
    return r.status, round(time.time() - t0, 2), body


DOM_JS = """() => {
  const cs = (el, p) => getComputedStyle(el).getPropertyValue(p);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const px = (v) => { const m = /([\\d.]+)/.exec(v || ''); return m ? parseFloat(m[1]) : 0; };
  function lum(rgb) {
    const m = rgb.match(/[\\d.]+/g); if (!m) return null;
    let [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(fg, bg) {
    const a = lum(fg), b = lum(bg);
    if (a === null || b === null) return null;
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  }
  function effBg(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = cs(n, 'background-color');
      const m = bg.match(/[\\d.]+/g);
      if (m && parseFloat(m[3] ?? '1') > 0 && !(parseFloat(m[0]) === 0 && parseFloat(m[1]) === 0 && parseFloat(m[2]) === 0 && parseFloat(m[3] ?? '1') === 0))
        return bg;
      n = n.parentElement;
    }
    return cs(document.body, 'background-color') || 'rgb(255,255,255)';
  }
  const els = [...document.querySelectorAll('body, h1, h2, p, a, button')].filter(visible).slice(0, 60);
  const samples = els.map((el) => ({
    tag: el.tagName.toLowerCase(),
    text: (el.innerText || '').slice(0, 60),
    ratio: contrast(cs(el, 'color'), effBg(el)),
  }));
  const imgs = [...document.querySelectorAll('img')];
  const imgsNoAlt = imgs.filter((i) => visible(i) && (i.getAttribute('alt') === null || i.getAttribute('alt') === '')).length;
  const inputs = [...document.querySelectorAll('input, select, textarea')];
  const unlabeled = inputs.filter((i) => {
    if (i.type === 'hidden') return false;
    const id = i.id;
    const byLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const wrap = i.closest('label');
    const aria = i.getAttribute('aria-label') || i.getAttribute('aria-labelledby');
    return !(byLabel || wrap || aria);
  }).length;
  const required = inputs.filter((i) => i.required).length;
  const posTab = document.querySelectorAll('[tabindex]').length
    ? [...document.querySelectorAll('[tabindex]')].filter((e) => parseInt(e.getAttribute('tabindex')) > 0).length : 0;
  const focusable = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length;
  const stuck = [...document.querySelectorAll('*')].filter((e) => {
    if (!visible(e)) return false;
    const p = cs(e, 'position');
    return (p === 'fixed' || p === 'sticky');
  }).length;
  const zIdx = [...document.querySelectorAll('*')].filter((e) => {
    const z = cs(e, 'z-index');
    return z !== 'auto' && parseInt(z) >= 1000;
  }).length;
  const modals = document.querySelectorAll('[role="dialog"], [data-state="open"]').length;
  return {
    lang: document.documentElement.getAttribute('lang'),
    title: document.title,
    samples,
    minRatio: Math.min(...samples.map((s) => s.ratio).filter((r) => r !== null)),
    imgs: imgs.length, imgsNoAlt,
    inputs: inputs.length, unlabeled, required,
    focusable, posTab, stuck, zIdx, modals,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyText: (document.body.innerText || '').slice(0, 400),
  };
}"""


def main():
    from playwright.sync_api import sync_playwright

    SHOTS.mkdir(exist_ok=True)
    TMP.mkdir(exist_ok=True)
    os.environ["TMPDIR"] = str(TMP)

    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        status, dt, body = health_probe()
    except Exception as exc:  # noqa: BLE001
        print(f"ABORT: health probe failed: {exc}")
        return 2
    print(f"health {status} {dt}s {body}")
    if status >= 500:
        print("ABORT: 5xx on health")
        return 3

    results, aborted = [], False
    with sync_playwright() as p:
        for w, h in VIEWPORTS:
            ctx = p.chromium.launch_persistent_context(
                str(TMP / f"profile-{w}"),
                executable_path=CHROME,
                args=["--no-sandbox"],
                viewport={"width": w, "height": h},
                locale="ru-RU",
            )
            page = ctx.new_page()
            for slug, route in ROUTES:
                url = BASE + route
                rec = {"slug": slug, "route": route, "viewport": w, "url": url}
                try:
                    t0 = time.time()
                    resp = page.goto(url, timeout=30000, wait_until="domcontentloaded")
                    try:
                        page.wait_for_load_state("networkidle", timeout=10000)
                    except Exception:  # noqa: BLE001
                        rec["networkidle"] = "timeout"
                    rec["status"] = resp.status if resp else None
                    rec["ms"] = int((time.time() - t0) * 1000)
                    if rec["status"] and rec["status"] >= 500:
                        rec["note"] = "5xx-stop"
                        results.append(rec)
                        if STOP_ON_5XX:
                            aborted = True
                            break
                    shot = SHOTS / f"{slug}-{w}.png"
                    page.screenshot(path=str(shot), full_page=True)
                    rec["screenshot"] = f"screenshots/{shot.name}"
                    rec["dom"] = page.evaluate(DOM_JS)
                except Exception as exc:  # noqa: BLE001
                    rec["error"] = f"{type(exc).__name__}: {str(exc)[:200]}"
                results.append(rec)
                time.sleep(GAP_SECONDS)
            ctx.close()
            if aborted:
                break

    OUT.write_text(json.dumps(
        {"started": started,
         "finished": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
         "base": BASE, "aborted_5xx": aborted, "pages": results},
        ensure_ascii=False, indent=2))
    ok = sum(1 for r in results if r.get("status") == 200)
    print(f"pages={len(results)} ok200={ok} aborted={aborted} -> {OUT.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
