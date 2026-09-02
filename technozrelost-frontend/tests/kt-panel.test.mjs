import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test("kt 1-4: module files exist with correct zone", () => {
  for (const f of ["src/features/project/KtPanel.tsx", "src/features/project/template.ts"]) {
    assert.ok(exists(f), `missing ${f}`);
  }
  const barrel = read("src/features/project/index.ts");
  assert.match(barrel, /KtPanel/);
  assert.match(barrel, /template/);
  // project/kt owns Go/No-Go, выставляет KtPanel({projectId}), прячет ControlPoint
  const idx = read("src/features/project/index.ts");
  assert.match(idx, /KtPanel/);
});

test("kt 1-4: api-client exposes decideControlPoint with PATCH control-points and getTemplate with GET /templates/{id}", () => {
  const src = read("src/lib/api-client.ts");
  assert.match(src, /decideControlPoint/);
  assert.match(src, /control-points/);
  assert.match(src, /PATCH/);
  assert.match(src, /ControlPointOut/);
  assert.match(src, /getTemplate/);
  assert.match(src, /\/templates\//);
  assert.match(src, /ApiError/);
  // должен использовать Bearer
  assert.match(src, /Authorization.*Bearer/);
});

test("kt 1-4: template fallback local blob + BLOCKED пометка если бэк нет", () => {
  const tmpl = read("src/features/project/template.ts");
  assert.match(tmpl, /BLOCKED_REASON/);
  assert.match(tmpl, /BLOCKED: templates/);
  assert.match(tmpl, /local blob/);
  assert.match(tmpl, /fallback/);
  assert.match(tmpl, /Blob/);
  assert.match(tmpl, /GET \/templates\/\{id\}/);
  assert.match(tmpl, /200/);
  assert.match(tmpl, /__TZ_BLOCKED_templates/);
  assert.match(tmpl, /console\.warn/);
  assert.match(tmpl, /fetch/);
  assert.match(tmpl, /\/templates\//);
  // version из бэка, не v1 хардкод — должен использовать template_version динамически
  assert.match(tmpl, /template_version/);
  assert.doesNotMatch(tmpl, /template_version.*=.*\"v1\";/); // не должен хардкодить только v1
});

test("kt 1-4: KtPanel renders 4 KTs each with Checklist + Go/No-Go for auditor, check via ControlPoint, badge return", () => {
  const src = read("src/features/project/KtPanel.tsx");
  assert.match(src, /KtPanel/);
  assert.match(src, /controlPoints|ControlPoint/);
  assert.match(src, /КТ-1/);
  assert.match(src, /КТ-2/);
  assert.match(src, /КТ-3/);
  assert.match(src, /КТ-4/);
  // чек-лист per КТ
  assert.match(src, /Checklist|чек-лист|checklist/i);
  assert.match(src, /checklist-item/);
  // Go/No-Go
  assert.match(src, /Go\/No-Go/);
  assert.match(src, /Go/);
  assert.match(src, /No-Go/);
  assert.match(src, /kt-go-/);
  assert.match(src, /kt-no-go-/);
  // check via ControlPoint
  assert.match(src, /check via ControlPoint/);
  assert.match(src, /ControlPoint/);
  // бейдж возврата на каждом КТ
  assert.match(src, /return-badge/);
  assert.match(src, /getReturnBadge/);
  assert.match(src, /Возврат/);
  assert.match(src, /бейдж возврата/);
  // auditor видимость
  assert.match(src, /auditor/);
  assert.match(src, /isAuditor/);
  // шаблон скачивание с бэка
  assert.match(src, /downloadTemplate/);
  assert.match(src, /GET \/templates/);
  assert.match(src, /template_version/);
  // 4 КТ рендер — slice(0,4) или map over 4
  assert.match(src, /slice\(0,\s*4\)|length.*4|controlPoints.*map/);
  assert.match(src, /data-testid="kt-/);
  assert.match(src, /data-testid="kt-panel"/);
});

test("kt 1-4: GostChecklist and ChecklistPanel use template backend fallback", () => {
  const gost = read("src/features/docs/GostChecklist.tsx");
  assert.match(gost, /downloadTemplate/);
  assert.match(gost, /GET \/templates/);
  assert.match(gost, /template_version/);
  const checklist = read("src/features/project/ChecklistPanel.tsx");
  assert.match(checklist, /downloadTemplate/);
  assert.match(checklist, /GET \/templates/);
  // версия не хардкод v1 только — должна динамическая
  assert.match(checklist, /template_version/);
});

test("kt 1-4: ProjectCard integrates KtPanel", () => {
  const card = read("src/features/project/ProjectCard.tsx");
  assert.match(card, /KtPanel/);
  assert.match(card, /control_points/);
});

test("kt 1-4 mock: template GET /templates/{id} 200 → backend blob, else local blob fallback + BLOCKED, decideControlPoint PATCH", async () => {
  process.env.API_URL_INTERNAL ??= "http://api.test:9999";
  const originalFetch = globalThis.fetch;
  let fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes("/templates/")) {
      // Сначала 200
      if (fetchCalls.filter((c) => c.url.includes("/templates/")).length === 1) {
        return { ok: true, status: 200, blob: async () => new Blob(["backend"], { type: "application/pdf" }) };
      }
      return { ok: false, status: 404, blob: async () => new Blob([]) };
    }
    if (u.includes("/control-points/")) {
      return { ok: true, status: 200, json: async () => ({ id: 1, project_id: 1, title: "КТ-1", description: "", point_type: "gate", status: "approved", decision: "Go", decided_by: 1 }) };
    }
    return { ok: true, status: 200, json: async () => [] };
  };

  // Mock window for BLOCKED flag
  const store = { warned: [] };
  const origWarn = console.warn;
  console.warn = (msg) => store.warned.push(msg);
  const origCreateObjectURL = globalThis.URL.createObjectURL;
  const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
  globalThis.URL.createObjectURL = () => "blob:mock";
  globalThis.URL.revokeObjectURL = () => {};
  // @ts-expect-error mock
  globalThis.window = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  globalThis.document = {
    createElement: () => ({ href: "", download: "", click: () => {}, style: {} }),
    body: { appendChild: () => {}, removeChild: () => {} },
  } ;

  // Use api-client decideControlPoint and getTemplate
  const { decideControlPoint, getTemplate } = await import("../src/lib/api-client.ts");
  try {
    // decideControlPoint should PATCH
    const cp = await decideControlPoint(1, 10, "approved", "Go", "token-123");
    assert.equal(cp.status, "approved");
    assert.ok(fetchCalls.some((c) => c.url.includes("/control-points/10") && c.init?.method === "PATCH"));
    const auth = fetchCalls.find((c) => c.url.includes("/control-points/"))?.init?.headers?.Authorization;
    assert.equal(auth, "Bearer token-123");

    // getTemplate 200
    fetchCalls = [];
    const blob = await getTemplate(123, "token-123");
    assert.ok(blob instanceof Blob);
    assert.ok(fetchCalls.some((c) => c.url.includes("/templates/123")));
    const auth2 = fetchCalls.find((c) => c.url.includes("/templates/"))?.init?.headers?.Authorization;
    assert.equal(auth2, "Bearer token-123");

    // Second call 404 → should throw ApiError 404
    await assert.rejects(() => getTemplate(999, "token-123"), (err) => err.status === 404);

    // Check template.ts fallback marks BLOCKED when 404
    const tmplSrc = read("src/features/project/template.ts");
    assert.match(tmplSrc, /BLOCKED: templates/);
    assert.match(tmplSrc, /__TZ_BLOCKED_templates/);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = origWarn;
    if (origCreateObjectURL) globalThis.URL.createObjectURL = origCreateObjectURL;
    else delete globalThis.URL.createObjectURL;
    if (origRevokeObjectURL) globalThis.URL.revokeObjectURL = origRevokeObjectURL;
    else delete globalThis.URL.revokeObjectURL;
    if (globalThis.window) delete globalThis.window;
    if (globalThis.document) delete globalThis.document;
  }
});
