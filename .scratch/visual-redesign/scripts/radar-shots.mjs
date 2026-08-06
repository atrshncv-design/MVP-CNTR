// CDP: screenshot + theme switch + computed contrast for /dev/radar (3 темы).
// Usage: node radar-shots.mjs [outDir]
// Требования: headless Chrome на :9222, dev-сервер :3001.
const CDP_HTTP = "http://localhost:9222";
const OUT_DIR = process.argv[2] || "./.scratch/visual-redesign/shots-radar";
import { mkdirSync, writeFileSync } from "node:fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageTarget() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${CDP_HTTP}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await sleep(300);
  }
  throw new Error("no page target — headless Chrome на :9222 не запущен");
}

async function main() {
  const target = await getPageTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  await new Promise((res) => (ws.onopen = res));
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1360,
    height: 1100,
    deviceScaleFactor: 2,
    mobile: false,
  });

  mkdirSync(OUT_DIR, { recursive: true });

  const THEMES = ["light", "dark", "udmurt"];
  const results = {};

  for (const theme of THEMES) {
    await send("Page.navigate", { url: "http://localhost:3001/dev/radar" });
    await sleep(1500);
    // Установить тему и перезагрузить (localStorage + data-theme скриптом layout)
    await send("Runtime.evaluate", {
      expression: `localStorage.setItem('nfr-theme','${theme}'); document.documentElement.setAttribute('data-theme','${theme}');`,
    });
    await sleep(300);
    await send("Page.reload", { ignoreCache: true });
    await sleep(1800);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT_DIR}/radar-${theme}.png`, Buffer.from(shot.result.data, "base64"));

    // Собранные данные для отчёта: цвета + контраст + геометрия меток.
    const expr = `(() => {
      const svg = document.querySelectorAll('svg[role="img"]')[0];
      const empty = document.querySelectorAll('svg[role="img"]')[3];
      const poly = svg.querySelector('polygon[points]:not([fill="none"])');
      const grid = svg.querySelector('polygon[fill="none"]');
      const dot = svg.querySelector('circle[stroke-width]');
      const ring = empty.querySelector('circle');
      const txt = empty.querySelector('text');
      const labels = [...svg.querySelectorAll('text')].map(t => t.textContent);
      const body = getComputedStyle(document.body);
      const card = svg.closest('.rounded-panel');
      const cardBg = getComputedStyle(card).backgroundColor;
      const cs = (el) => el ? getComputedStyle(el) : null;
      // Выходы меток за пределы viewport/карточки (обрезка?)
      const svgRect = svg.getBoundingClientRect();
      const labelRects = [...svg.querySelectorAll('text')].map(t => {
        const r = t.getBoundingClientRect();
        return { text: t.textContent, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      });
      const overhang = {
        svgLeft: Math.round(svgRect.left), svgRight: Math.round(svgRect.right),
        minLabelLeft: Math.round(Math.min(...labelRects.map(l => l.left))),
        maxLabelRight: Math.round(Math.max(...labelRects.map(l => l.right))),
      };
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        bodyBg: body.backgroundColor,
        cardBg,
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        accentSoft: getComputedStyle(document.documentElement).getPropertyValue('--accent-soft').trim(),
        textMuted: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(),
        textPrimary: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
        textSecondary: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
        polyFill: cs(poly)?.fill, polyStroke: cs(poly)?.stroke, polyFillOpacity: cs(poly)?.fillOpacity,
        gridStroke: cs(grid)?.stroke, gridOpacity: cs(grid)?.strokeOpacity,
        dotFill: cs(dot)?.fill,
        ringStroke: cs(ring)?.stroke, emptyTextFill: cs(txt)?.fill,
        labels,
        overhang,
      };
    })()`;
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    results[theme] = r.result.result.value;
    console.log(`theme=${theme} done`);
  }

  writeFileSync(`${OUT_DIR}/radar-report.json`, JSON.stringify(results, null, 2));
  ws.close();
  console.log("OK ->", OUT_DIR);
  process.exit(0);
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
