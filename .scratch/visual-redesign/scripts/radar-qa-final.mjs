// D-03 final QA: reduced-motion + mobile 390px (скролл, центрирование).
const CDP_HTTP = "http://localhost:9222";
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
  throw new Error("no page target");
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
    width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await send("Page.navigate", { url: "http://localhost:3001/dev/radar" });
  await sleep(1500);

  // 1) reduced-motion: reduce → animation должна быть отключена
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await sleep(200);
  let r = await send("Runtime.evaluate", {
    expression: `(() => {
      const g = document.querySelector('g.radar-data');
      const cs = g ? getComputedStyle(g) : null;
      const styleEl = document.querySelector('svg style');
      return {
        animationName: cs ? cs.animationName : null,
        animationDuration: cs ? cs.animationDuration : null,
        hasReduceQuery: styleEl ? styleEl.textContent.includes('prefers-reduced-motion') : false,
      };
    })()`,
    returnByValue: true,
  });
  console.log("reduced-motion=reduce ->", JSON.stringify(r.result.result.value));

  // 2) без reduced-motion → fade разрешён
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await send("Page.reload", { ignoreCache: true });
  await sleep(1500);
  r = await send("Runtime.evaluate", {
    expression: `(() => {
      const g = document.querySelector('g.radar-data');
      return { animationName: getComputedStyle(g).animationName };
    })()`,
    returnByValue: true,
  });
  console.log("no-preference      ->", JSON.stringify(r.result.result.value));

  // 3) mobile 390px: горизонтальный скролл? радары по центру?
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await sleep(800);
  r = await send("Runtime.evaluate", {
    expression: `(() => {
      const de = document.documentElement;
      const svg = document.querySelector('svg[role="img"]');
      const rect = svg.getBoundingClientRect();
      const card = svg.closest('.rounded-panel');
      const cardRect = card.getBoundingClientRect();
      return {
        scrollW: de.scrollWidth, clientW: de.clientWidth,
        hOverflow: de.scrollWidth > de.clientWidth,
        radarCenterInCard: Math.abs((rect.left + rect.width/2) - (cardRect.left + cardRect.width/2)) < 2,
        radarSize: Math.round(rect.width),
      };
    })()`,
    returnByValue: true,
  });
  console.log("mobile 390          ->", JSON.stringify(r.result.result.value));

  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
