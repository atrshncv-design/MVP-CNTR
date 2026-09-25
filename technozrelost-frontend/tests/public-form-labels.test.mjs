import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public filters expose localized accessible names for search and both UGT selects", () => {
  const projects = read("src/components/landing/projects-showcase.tsx");
  const searchInput = projects.match(/<input\s+type="search"[\s\S]*?\/>/)?.[0];
  assert.ok(searchInput, "/projects search input not found");
  assert.match(searchInput, /placeholder=\{t\("searchPlaceholder"\)\}/);
  assert.match(searchInput, /aria-label=\{t\("searchAria"\)\}/);

  const roadmap = read("src/components/landing/roadmap-content.tsx");
  const ugtSelect = roadmap.match(/function UgtSelect\([\s\S]*?\n}\n\nfunction PresetPill/)?.[0];
  assert.ok(ugtSelect, "/roadmap UGT select not found");
  const labelTag = ugtSelect.match(/<label\b[^>]*>/)?.[0];
  const selectTag = ugtSelect.match(/<select\b[^>]*>/)?.[0];
  assert.ok(labelTag, "/roadmap UGT label not found");
  assert.ok(selectTag, "/roadmap UGT select not found");
  assert.match(ugtSelect, /<label\b[^>]*>\s*\{label\}\s*<\/label>/);
  const labelFor = labelTag.match(/\bhtmlFor=\{([^}]+)\}/)?.[1];
  const selectId = selectTag.match(/\bid=\{([^}]+)\}/)?.[1];
  assert.ok(labelFor, "/roadmap UGT label has no native control reference");
  assert.ok(selectId, "/roadmap UGT select has no id");
  assert.equal(labelFor, selectId, "/roadmap UGT label and select must share one id expression");

  const expected = {
    ru: "Поиск проектов",
    en: "Search projects",
    zh: "搜索项目",
  };
  for (const [locale, label] of Object.entries(expected)) {
    const messages = JSON.parse(read(`src/messages/${locale}.json`)).projectsLanding;
    assert.equal(messages.searchAria, label);
    assert.notEqual(messages.searchAria, messages.ariaSearch);
  }
});
