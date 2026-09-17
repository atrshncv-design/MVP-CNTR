/**
 * Таск 03 (R01/R03, истории 5–7): деталки, серверный поиск, описание+статус.
 * Швы: registry-api (публичные деталки + ?search=), registry-ui
 * (деталки в (landing)/ + серверный поиск витрин).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

// ─── lib: серверный поиск в query-строках ───

test("detail-search lib: buildPublicRegistryQuery несёт search на бэкенд", async () => {
  const { buildPublicRegistryQuery, SHOWCASE_PAGE_SIZE } = await import(
    "../src/lib/landing-registry.ts"
  );
  const qs = buildPublicRegistryQuery({ search: "композит", limit: 9 });
  assert.match(qs, /search=%D0%BA%D0%BE%D0%BC%D0%BF%D0%BE%D0%B7%D0%B8%D1%82/);
  assert.match(qs, /limit=9/);
  // Пустой поиск — без параметра (как раньше, старые тесты целы).
  assert.equal(buildPublicRegistryQuery({}), `?limit=${SHOWCASE_PAGE_SIZE}`);
  assert.equal(
    buildPublicRegistryQuery({ search: "   ", limit: 9 }),
    "?limit=9",
  );
  assert.equal(
    buildPublicRegistryQuery({ ugt_min: 7, search: "x", after_id: 5, limit: 9 }),
    "?ugt_min=7&search=x&after_id=5&limit=9",
  );
});

test("detail-search lib: витрины понимают search (specialists/orgs/nioktr)", async () => {
  const lib = await import("../src/lib/landing-showcases.ts");
  assert.equal(
    lib.buildSpecialistsQuery({ search: "Иван", limit: 9 }),
    "?search=%D0%98%D0%B2%D0%B0%D0%BD&limit=9",
  );
  assert.equal(lib.buildSpecialistsQuery({}), "?limit=9");
  assert.equal(lib.buildOrganizationsQuery({}), "?limit=9");
  assert.match(lib.buildOrganizationsQuery({ search: "ИПИИ" }), /search=/);
  assert.equal(lib.buildNioktrQuery({}), "?limit=9");
  assert.match(lib.buildNioktrQuery({ search: "1250101" }), /search=1250101/);
});

// ─── lib: маппинг новых полей без выдуманных данных ───

test("detail-search lib: карточка проекта несёт описание и статус из API", async () => {
  const { toShowcaseCard } = await import("../src/lib/landing-registry.ts");
  const apiItem = {
    id: 7,
    name: "Стенд испытаний",
    description: "Живое описание",
    category: "Промышленные технологии",
    current_level: 5,
    status: "auto_confirmed",
    budget: null,
    organization: "Завод",
  };
  assert.deepEqual(toShowcaseCard(apiItem), {
    id: 7,
    name: "Стенд испытаний",
    category: "Промышленные технологии",
    description: "Живое описание",
    current_level: 5,
    status: "auto_confirmed",
    budget: null,
    org: "Завод",
  });
  // Старая форма без полей — null, не выдумка (обратная совместимость).
  const legacy = { ...apiItem };
  delete legacy.description;
  delete legacy.status;
  const card = toShowcaseCard(legacy);
  assert.equal(card.description, null);
  assert.equal(card.status, null);
});

test("detail-search lib: карточка исполнителя несёт ОГРН организации", async () => {
  const { toExecutorCard } = await import("../src/lib/landing-showcases.ts");
  const org = {
    id: -3,
    full_name: "ИПИИ РАН",
    organization: "ИНСТИТУТ",
    role_slug: "scientific_org",
    role_name: "Научная организация",
    competencies: [],
    completed_projects: 2,
    ogrn: "1027700132195",
  };
  assert.equal(toExecutorCard(org).ogrn, "1027700132195");
  const person = { ...org, id: 9, ogrn: undefined };
  assert.equal(toExecutorCard(person).ogrn, null);
});

// ─── ui: деталки в (landing)/ — те же URL, без токена, мусор — 404 ───

test("detail-search ui: три деталки существуют и читают публичные ручки без токена", () => {
  for (const page of [
    "src/app/(landing)/projects/[id]/page.tsx",
    "src/app/(landing)/nioktr/[regNumber]/page.tsx",
    "src/app/(landing)/customers/[ogrn]/page.tsx",
  ]) {
    assert.ok(exists(page), `нет деталки ${page}`);
    const src = read(page);
    assert.match(src, /serverApiBase/, `${page}: не через единый URL-модуль`);
    assert.match(src, /cache: "no-store"/, `${page}: нет no-store`);
    assert.match(src, /notFound\(\)/, `${page}: мусор не уходит в 404`);
    // Токен — только как реальный заголовок запроса, не словом в комментарии.
    assert.doesNotMatch(src, /Authorization:\s*`Bearer/, `${page}: токен на публичной деталке`);
    assert.doesNotMatch(src, /headers:\s*\{[^}]*Authorization/, `${page}: заголовок auth на деталке`);
  }
  assert.match(
    read("src/app/(landing)/projects/[id]/page.tsx"),
    /\/api\/v1\/projects\/registry\//,
  );
  assert.match(
    read("src/app/(landing)/nioktr/[regNumber]/page.tsx"),
    /\/api\/v1\/nioktr\//,
  );
  assert.match(
    read("src/app/(landing)/customers/[ogrn]/page.tsx"),
    /\/api\/v1\/nioktr\/organizations\//,
  );
});

test("detail-search ui: карточки витрин ссылаются на деталки тех же URL", () => {
  assert.match(
    read("src/components/landing/projects-showcase.tsx"),
    /href=\{`\/projects\/\$\{project\.id\}`\}/,
  );
  assert.match(
    read("src/components/landing/nioktr-showcase.tsx"),
    /href=\{`\/nioktr\/\$\{encodeURIComponent\(card\.regNumber\)\}`\}/,
  );
  assert.match(
    read("src/components/landing/customers-showcase.tsx"),
    /href=\{`\/customers\/\$\{encodeURIComponent\(org\.ogrn\)\}`\}/,
  );
});

// ─── ui: поиск витрин — серверный, а не по загруженному ───

test("detail-search ui: витрины шлют поиск на сервер, клиентского haystack нет", () => {
  for (const file of [
    "src/components/landing/projects-showcase.tsx",
    "src/components/landing/performers-showcase.tsx",
    "src/components/landing/customers-showcase.tsx",
    "src/components/landing/nioktr-showcase.tsx",
  ]) {
    const src = read(file);
    assert.match(src, /debouncedSearch/, `${file}: нет дебаунса серверного поиска`);
    assert.doesNotMatch(src, /haystack/, `${file}: остался клиентский поиск по загруженному`);
  }
  const projects = read("src/components/landing/projects-showcase.tsx");
  assert.match(projects, /search: debouncedSearch/);
  assert.match(projects, /buildPublicRegistryQuery\(\{ \.\.\.params, limit/);
});
