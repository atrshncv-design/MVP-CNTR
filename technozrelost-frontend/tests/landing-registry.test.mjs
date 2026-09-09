/**
 * Витрина лендинга на живых данных реестра (таск 13, R06i, история 18).
 * Швы: landing (страница на живых данных реестра), registry (GET /projects/registry).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("landing showcase: живые данные реестра, без demo-заглушки", () => {
  const src = read("src/components/landing/projects-showcase.tsx");
  assert.match(src, /CLIENT_API_BASE as API_URL/); // единый URL-модуль
  assert.match(src, /fetch\(`\$\{API_URL\}\/api\/v1\/projects\/registry/);
  assert.match(src, /cache: "no-store"/);
  assert.match(src, /mergeRegistryPage/);
  assert.match(src, /toShowcaseCard/);
  assert.match(src, /emptyRegistryTitle/);
  assert.match(src, /emptyRegistryHint/);
  assert.doesNotMatch(src, /getShowcaseProjects/);
  assert.doesNotMatch(src, /lib\/showcase/);
});

test("api-client: публичный реестр без токена, keyset-пагинация", () => {
  const src = read("src/lib/api-client.ts");
  assert.match(src, /export function getPublicRegistry/);
  const body = src.slice(
    src.indexOf("export function getPublicRegistry"),
    src.indexOf("export function getPublicRegistry") + 1200,
  );
  assert.match(body, /publicApiRequest/);
  assert.match(body, /\/projects\/registry/);
  assert.match(body, /after_id/);
  assert.match(body, /limit/);
  assert.match(body, /ugt_min/);
  assert.match(body, /ugt_max/);
  assert.doesNotMatch(body, /Authorization/);
  const helper = src.slice(
    src.indexOf("async function publicApiRequest"),
    src.indexOf("async function publicApiRequest") + 500,
  );
  assert.doesNotMatch(helper, /Authorization/);
});

test("landing home: тизер витрины на живых данных, без demo", () => {
  const src = read("src/app/(landing)/page.tsx");
  assert.match(src, /getPublicRegistry/);
  assert.match(src, /showcaseEmptyTitle/);
  assert.match(src, /showcaseEmptyHint/);
  assert.doesNotMatch(src, /getShowcaseProjects/);
  assert.doesNotMatch(src, /lib\/showcase/);
});

test("landing projects page: SSR первой страницы реестра", () => {
  const src = read("src/app/(landing)/projects/page.tsx");
  assert.match(src, /getPublicRegistry/);
  assert.match(src, /initialItems/);
  assert.match(src, /initialError/);
});

test("landing showcase: пустой реестр — честное пустое состояние с CTA", () => {
  const src = read("src/components/landing/projects-showcase.tsx");
  assert.match(src, /href="\/register"/);
  const pairs = [
    ["src/messages/ru.json", "src/messages/en.json"],
    ["messages/ru.json", "messages/en.json"],
  ];
  for (const [ruPath, enPath] of pairs) {
    const ru = JSON.parse(read(ruPath)).projectsLanding;
    const en = JSON.parse(read(enPath)).projectsLanding;
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort(), `${ruPath}: паритет projectsLanding`);
    for (const key of ["emptyRegistryTitle", "emptyRegistryHint", "loadError", "loadErrorStatus"]) {
      assert.equal(typeof ru[key], "string", `${ruPath}: нет ключа ${key}`);
      assert.ok(ru[key].length > 0, `${ruPath}: ${key} пуст`);
      assert.ok(en[key].length > 0, `${enPath}: ${key} пуст`);
      assert.notEqual(en[key], key, `${enPath}: ${key} — эхо ключа`);
    }
    assert.doesNotMatch(en.emptyRegistryTitle, /[А-Яа-яЁё]/);
    assert.doesNotMatch(en.emptyRegistryHint, /[А-Яа-яЁё]/);
    assert.doesNotMatch(en.loadError, /[А-Яа-яЁё]/);
    // liveDesc больше не выдаёт витрину за демо-данные
    assert.doesNotMatch(ru.liveDesc, /демонстрацион/);
    assert.doesNotMatch(en.liveDesc, /demo/i);
  }
});

test("landing home: пустая витрина — честный фолбэк тизера", () => {
  const pairs = [
    ["src/messages/ru.json", "src/messages/en.json"],
    ["messages/ru.json", "messages/en.json"],
  ];
  for (const [ruPath, enPath] of pairs) {
    const ru = JSON.parse(read(ruPath)).landing;
    const en = JSON.parse(read(enPath)).landing;
    for (const key of ["showcaseEmptyTitle", "showcaseEmptyHint"]) {
      assert.equal(typeof ru[key], "string", `${ruPath}: нет ключа landing.${key}`);
      assert.ok(ru[key].length > 0);
      assert.ok(en[key].length > 0);
      assert.notEqual(en[key], key);
      assert.doesNotMatch(en[key], /[А-Яа-яЁё]/, `${enPath}: landing.${key} с кириллицей`);
    }
  }
});

test("landing pagination: граница страниц не ломает витрину", async () => {
  const { mergeRegistryPage, buildPublicRegistryQuery } = await import("../src/lib/landing-registry.ts");
  const p3 = { id: 3, name: "C", category: "AI/ML", current_level: 6, budget: null, organization: "Org" };
  const p2 = { id: 2, name: "B", category: "AI/ML", current_level: 5, budget: null, organization: "Org" };
  const p1 = { id: 1, name: "A", category: "AI/ML", current_level: 4, budget: null, organization: "Org" };
  // Полная страница — есть следующая; пустой ответ закрывает пагинацию без потерь.
  const first = mergeRegistryPage([], [p3, p2], 2);
  assert.deepEqual(first.items, [p3, p2]);
  assert.equal(first.nextAfterId, 2);
  assert.equal(first.hasMore, true);
  const closed = mergeRegistryPage(first.items, [], 2);
  assert.deepEqual(closed.items, [p3, p2]);
  assert.equal(closed.nextAfterId, 2);
  assert.equal(closed.hasMore, false);
  // Неполная страница — последняя, курсор на её хвосте.
  const partial = mergeRegistryPage([p3, p2], [p1], 2);
  assert.deepEqual(partial.items, [p3, p2, p1]);
  assert.equal(partial.nextAfterId, 1);
  assert.equal(partial.hasMore, false);
  // Пересечение страниц не дублирует карточки.
  const overlap = mergeRegistryPage([p3], [p3, p2], 2);
  assert.deepEqual(overlap.items, [p3, p2]);
  assert.equal(overlap.nextAfterId, 2);
  assert.equal(overlap.hasMore, true);
  // Запрос шлёт только параметры, которые понимает бэкенд.
  assert.equal(buildPublicRegistryQuery({ ugt_min: 7, after_id: 5, limit: 9 }), "?ugt_min=7&after_id=5&limit=9");
  assert.equal(buildPublicRegistryQuery({}), "?limit=9");
});

test("landing mapping: карточка соответствует проекту из API, без выдуманных данных", async () => {
  const { toShowcaseCard } = await import("../src/lib/landing-registry.ts");
  // Форма бэкенда: описания/статуса/тегов нет (RegistryProjectOut в app/schemas.py).
  const apiItem = {
    id: 7,
    name: "Стенд испытаний",
    category: "Промышленные технологии",
    current_level: 5,
    preliminary_level: null,
    target_level: 7,
    budget: null,
    organization: "Завод",
    is_public: true,
    show_preliminary: false,
    published_at: "2026-09-01T00:00:00",
    created_at: "2026-08-01T00:00:00",
  };
  assert.deepEqual(toShowcaseCard(apiItem), {
    id: 7,
    name: "Стенд испытаний",
    category: "Промышленные технологии",
    description: null,
    current_level: 5,
    status: null,
    budget: null,
    org: "Завод",
  });
  // Категория из тегов — только если бэкенд прислал теги, иначе null (не выдумываем).
  assert.equal(toShowcaseCard({ ...apiItem, id: 8, category: null, tags: ["Медицина"] }).category, "Медицина");
  assert.equal(toShowcaseCard({ ...apiItem, id: 9, category: null }).category, null);
});
