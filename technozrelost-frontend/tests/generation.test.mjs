import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test("generation ui: GenerationPanel exists in project zone and is exported", () => {
  assert.ok(exists("src/features/project/GenerationPanel.tsx"), "missing GenerationPanel");
  const barrel = read("src/features/project/index.ts");
  assert.match(barrel, /GenerationPanel/);
});

test("generation ui: api-client exposes generateProjectDocument POST generate + rag template", () => {
  const src = read("src/lib/api-client.ts");
  assert.match(src, /generateProjectDocument/);
  assert.match(src, /\/generate\//);
  assert.match(src, /POST/);
  assert.match(src, /GeneratedDocumentOut/);
  assert.match(src, /generateTzDocument/);
  assert.match(src, /generatePassportDocument/);
  assert.match(src, /generateTeoDocument/);
  assert.match(src, /getRagTemplate/);
  assert.match(src, /\/rag\/templates\//);
  assert.match(src, /Authorization.*Bearer/);
});

test("generation ui: GenerationPanel renders ТЗ/Паспорт/ТЭО buttons, real endpoint, download, 404-masking", () => {
  const src = read("src/features/project/GenerationPanel.tsx");
  assert.match(src, /generate-\$\{docType\}/);
  assert.match(src, /"tz", "passport", "teo"/);
  assert.match(src, /generateProjectDocument/);
  assert.match(src, /tz.*passport.*teo|DOC_TYPES/s);
  assert.match(src, /Blob/);
  assert.match(src, /createObjectURL/);
  assert.match(src, /404/);
  assert.match(src, /generationNotFound/);
  assert.match(src, /generationDone/);
  assert.match(src, /data-testid="generation-panel"/);
  assert.match(src, /useTranslations\("docs"\)/);
});

test("generation ui: ProjectCard integrates GenerationPanel", () => {
  const card = read("src/features/project/ProjectCard.tsx");
  assert.match(card, /GenerationPanel/);
  assert.match(card, /project\.id/);
});

test("generation ui: template.ts downloads server /rag/templates/{id} without BLOCKED on 200", () => {
  const tmpl = read("src/features/project/template.ts");
  assert.match(tmpl, /\/rag\/templates\//);
  assert.match(tmpl, /raw_text/);
  assert.match(tmpl, /blocked: false/);
  assert.match(tmpl, /source: "backend"/);
  // fallback с BLOCKED — только при не-200/сети
  assert.match(tmpl, /BLOCKED_REASON/);
  assert.match(tmpl, /BLOCKED: templates/);
  assert.match(tmpl, /local blob/);
  assert.match(tmpl, /fallback/);
  assert.match(tmpl, /__TZ_BLOCKED_templates/);
  assert.match(tmpl, /GET \/templates\/\{id\}/);
  assert.match(tmpl, /template_version/);
});

test("generation ui: docs dictionaries have generation keys in ru/en/zh, both pairs in sync", () => {
  for (const base of ["src/messages", "messages"]) {
    const ru = JSON.parse(read(`${base}/ru.json`)).docs;
    const en = JSON.parse(read(`${base}/en.json`)).docs;
    const zh = JSON.parse(read(`${base}/zh.json`)).docs;
    for (const key of [
      "generationTitle", "generationAria", "generationDesc",
      "generateTz", "generatePassport", "generateTeo", "generating",
      "generationDone", "generationNotFound", "generationFailed",
    ]) {
      assert.equal(typeof ru[key], "string", `${base} ru.docs.${key} missing`);
      assert.equal(typeof en[key], "string", `${base} en.docs.${key} missing`);
      assert.equal(typeof zh[key], "string", `${base} zh.docs.${key} missing`);
    }
    assert.doesNotMatch(en.generateTz, /[А-Яа-яЁё]/);
    assert.doesNotMatch(en.generationNotFound, /[А-Яа-яЁё]/);
  }
  const srcRu = JSON.parse(read("src/messages/ru.json")).docs;
  const rootRu = JSON.parse(read("messages/ru.json")).docs;
  assert.deepEqual(Object.keys(srcRu).sort(), Object.keys(rootRu).sort(), "docs ru pair out of sync");
  const srcEn = JSON.parse(read("src/messages/en.json")).docs;
  const rootEn = JSON.parse(read("messages/en.json")).docs;
  assert.deepEqual(Object.keys(srcEn).sort(), Object.keys(rootEn).sort(), "docs en pair out of sync");
});

test("generation ui mock: generate POSTs /generate/{doc} with Bearer, getTemplate unwraps server raw_text", async () => {
  process.env.API_URL_INTERNAL ??= "http://api.test:9999";
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes("/generate/tz")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          doc_type: "tz",
          title: "Техническое задание",
          content: "ТЗ проекта Альфа",
          template_id: 7,
          variables: { project_name: "Альфа" },
          document_id: 42,
        }),
      };
    }
    if (u.includes("/rag/templates/7")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 7,
          title: "Шаблон ТЗ",
          doc_type: "tz",
          raw_text: "серверный текст шаблона",
          template_metadata: { version: "v2" },
        }),
        blob: async () => new Blob(["unused"]),
      };
    }
    if (u.includes("/rag/templates/")) {
      return { ok: false, status: 404, json: async () => ({}), blob: async () => new Blob([]) };
    }
    return { ok: false, status: 404, json: async () => ({}), blob: async () => new Blob([]) };
  };
  try {
    const { generateProjectDocument, getTemplate, getRagTemplate } = await import("../src/lib/api-client.ts");
    const doc = await generateProjectDocument(5, "tz", "token-gen");
    assert.equal(doc.doc_type, "tz");
    assert.equal(doc.document_id, 42);
    assert.match(doc.content, /Альфа/);
    const genCall = calls.find((c) => c.url.includes("/generate/tz"));
    assert.ok(genCall, "no POST /generate/tz call");
    assert.equal(genCall.init?.method, "POST");
    assert.equal(genCall.init?.headers?.Authorization, "Bearer token-gen");
    assert.match(genCall.url, /\/projects\/5\/generate\/tz/);

    const blob = await getTemplate(7, "token-gen");
    assert.ok(blob instanceof Blob);
    assert.equal(await blob.text(), "серверный текст шаблона");

    const tpl = await getRagTemplate(7, "token-gen");
    assert.equal(tpl.id, 7);
    assert.equal(tpl.raw_text, "серверный текст шаблона");

    await assert.rejects(() => getTemplate(999, "token-gen"), (err) => err.status === 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
