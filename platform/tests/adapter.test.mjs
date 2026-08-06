/**
 * T-004. Юнит-тесты слоя данных (node --test).
 *
 * Правила (см. скилл technozrelost-development, Node 22 strip-types):
 * - .mjs НЕ содержит TS-синтаксиса (аннотации, generics) — SyntaxError;
 * - импорт .ts из .mjs работает (явное расширение .ts);
 * - цепочка адаптера использует относительные импорты (без @/),
 *   поэтому тестируется напрямую из node --test;
 * - ассерты — по ПОВЕДЕНИЮ, не по именам переменных.
 *
 * Запуск: npm test (node --test tests/*.test.mjs) из platform/.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MockPlatformDataAdapter,
} from "../src/lib/adapter/mock-adapter.ts";
import { ApiAdapterStub } from "../src/lib/adapter/api-stub.ts";
import { resolveAdapterMode } from "../src/lib/adapter/mode.ts";
import {
  FIXTURE_LABEL,
  STATUSES,
  isFixtureRecord,
} from "../src/lib/types.ts";
import {
  technologySummaryFixtures,
  customerRequestSummaryFixtures,
  pilotFixtures,
  operationalTaskFixtures,
} from "../src/data/fixtures/index.ts";

/* Реальные 400 карточек НИОКТР (источник: МИНОБРНАУКИ России). */
const dataset = JSON.parse(
  readFileSync(
    new URL("../src/data/nioktr-fixtures.json", import.meta.url),
    "utf8",
  ),
);

const makeAdapter = (options = {}) =>
  new MockPlatformDataAdapter({ dataset, delayMs: 0, ...options });

/** Все id контролируемых фикстур — для проверки «не попадают в публичные методы». */
const fixtureIds = new Set([
  ...technologySummaryFixtures.map((f) => f.id),
  ...customerRequestSummaryFixtures.map((f) => f.id),
  ...pilotFixtures.map((f) => f.id),
  ...operationalTaskFixtures.map((f) => f.id),
]);

const assertNoFixture = (items) => {
  for (const item of items) {
    assert.equal(item.isFixture, undefined, `не-фикстура не должна иметь isFixture: ${item.id ?? item.title}`);
    assert.ok(!fixtureIds.has(item.id), `фикстура ${item.id} попала в публичные данные`);
  }
};

/* ------------------------------------------------------------------ */
/* Реальные данные НИОКТР                                              */
/* ------------------------------------------------------------------ */

test("mock listResearch возвращает 400 реальных карточек (публичный реестр)", async () => {
  const adapter = makeAdapter();
  const page = await adapter.listResearch({});
  assert.equal(page.total, 400);
  assert.equal(page.items.length, 20, "дефолтный pageSize = 20");
  assert.equal(page.page, 1);
  assert.equal(page.totalPages, 20);
  assert.ok(page.hasNext);
  assert.equal(page.hasPrev, false);
  for (const r of page.items) {
    assert.match(r.registrationNumber, /^\d/);
    assert.ok(r.title.length > 0);
    assert.equal(r.publicationStatus, "published");
    assert.equal(r.provenance.source, dataset.provenance.source);
  }
  assertNoFixture(page.items);
});

test("пагинация: страницы и границы", async () => {
  const adapter = makeAdapter();
  const p1 = await adapter.listResearch({ page: 1, pageSize: 50 });
  assert.equal(p1.items.length, 50);
  assert.equal(p1.totalPages, 8);
  assert.ok(p1.hasNext);
  const p8 = await adapter.listResearch({ page: 8, pageSize: 50 });
  assert.equal(p8.items.length, 50, "400 / 50 = ровно 8 полных страниц");
  assert.equal(p8.hasNext, false);
  assert.ok(p8.hasPrev);
  const beyond = await adapter.listResearch({ page: 9, pageSize: 50 });
  assert.equal(beyond.items.length, 0, "за пределами данных — пустая страница");
  assert.equal(beyond.hasNext, false);
});

test("поиск по ключевым словам и названию", async () => {
  const adapter = makeAdapter();
  const keyword = "МАШИННОЕ ОБУЧЕНИЕ";
  const page = await adapter.listResearch({ search: keyword });
  assert.ok(page.total > 0, "по ключевому слову должны быть результаты");
  for (const r of page.items) {
    const haystack = [r.title, r.annotation, r.organizationName, r.customerName, r.registrationNumber, ...r.keywords, ...r.researchTypes].join(" ").toLowerCase();
    assert.ok(haystack.includes(keyword.toLowerCase()), `результат не содержит запрос: ${r.title}`);
  }
  // регистронезависимость
  const lower = await adapter.listResearch({ search: "машинное обучение" });
  assert.equal(lower.total, page.total);
});

test("пустой результат — честное empty-состояние", async () => {
  const adapter = makeAdapter();
  const page = await adapter.listResearch({ search: "zzzzнесуществующая-фраза-12345" });
  assert.equal(page.total, 0);
  assert.deepEqual(page.items, []);
  assert.equal(page.hasNext, false);
});

test("фильтры is_ai_area / is_ai_usage", async () => {
  const adapter = makeAdapter();
  const ai = await adapter.listResearch({ filters: { is_ai_area: "true" }, pageSize: 400 });
  assert.ok(ai.total > 0);
  for (const r of ai.items) assert.equal(r.isAiArea, true);
  const notAi = await adapter.listResearch({ filters: { is_ai_area: "false" }, pageSize: 400 });
  assert.ok(notAi.total > 0);
  for (const r of notAi.items) assert.equal(r.isAiArea, false);
  const usage = await adapter.listResearch({ filters: { is_ai_usage: "true" }, pageSize: 400 });
  for (const r of usage.items) assert.equal(r.isAiUsage, true);
});

test("частичные данные не фабрикуются (state_program/region)", async () => {
  const adapter = makeAdapter();
  // Адаптер клампит pageSize до MAX_PAGE_SIZE=100 — собираем все страницы.
  const items = [];
  let page = await adapter.listResearch({ pageSize: 100 });
  items.push(...page.items);
  while (page.hasNext) {
    page = await adapter.listResearch({ pageSize: 100, page: page.page + 1 });
    items.push(...page.items);
  }
  assert.equal(items.length, 400, "собраны все 400 реальных карточек");
  assert.ok(items.some((r) => r.stateProgram === null), "state_program отсутствует у части карточек — должен оставаться null");
  assert.ok(items.some((r) => r.stateProgram !== null), "state_program заполнен у части карточек");
  // В выборке 400 карточек регион указан ровно у одной (реальная частичная
  // пустота): адаптер не фабрикует регионы, отсутствующие в источнике.
  assert.ok(items.some((r) => r.region !== null), "region известен хотя бы для одной карточки");
  assert.ok(items.every((r) => r.region === null || typeof r.region === "string"), "region — null или строка, не выдуман");
});

test("сортировка по умолчанию — created_date по убыванию", async () => {
  const adapter = makeAdapter();
  const page = await adapter.listResearch({ pageSize: 400 });
  for (let i = 1; i < page.items.length; i += 1) {
    assert.ok(
      page.items[i - 1].createdDate >= page.items[i].createdDate,
      "записи должны идти от свежих к старым",
    );
  }
});

test("getResearch: по registration_number и неизвестный id", async () => {
  const adapter = makeAdapter();
  const page = await adapter.listResearch({ pageSize: 1 });
  const first = page.items[0];
  const found = await adapter.getResearch(first.registrationNumber, "public");
  assert.ok(found);
  assert.equal(found.registrationNumber, first.registrationNumber);
  assert.equal(found.provenance.importedAt, dataset.provenance.importedAt);
  const missing = await adapter.getResearch("nonexistent-0000", "public");
  assert.equal(missing, null);
  // фикстура не резолвится в публичном scope
  const fixtureHit = await adapter.getResearch("fixture-tech-draft-01", "public");
  assert.equal(fixtureHit, null);
});

/* ------------------------------------------------------------------ */
/* Организации (производный справочник из реальных карточек)           */
/* ------------------------------------------------------------------ */

test("listOrganizations — производный справочник, без фикстур", async () => {
  const adapter = makeAdapter();
  const page = await adapter.listOrganizations({ pageSize: 400 });
  assert.ok(page.total > 100, "из 400 карточек получается сотни организаций");
  assertNoFixture(page.items);
  for (const o of page.items) {
    assert.ok(o.name.length > 0);
    assert.ok(["executor", "customer"].includes(o.type));
    assert.ok(o.researchCount >= 1);
    assert.equal(o.source, dataset.provenance.source);
  }
});

test("listOrganizations: поиск и сортировка", async () => {
  const adapter = makeAdapter();
  const found = await adapter.listOrganizations({ search: "стратагемы" });
  assert.ok(found.total >= 1);
  for (const o of found.items) assert.ok(o.name.toLowerCase().includes("стратагемы"));
  const byCount = await adapter.listOrganizations({ sort: "researchCount", pageSize: 3 });
  assert.ok(byCount.items[0].researchCount >= byCount.items[1].researchCount);
});

/* ------------------------------------------------------------------ */
/* Честные пустые публичные реестры + фикстуры только в кабинетах      */
/* ------------------------------------------------------------------ */

test("listTechnologies публичный — пусто, фикстуры не попадают", async () => {
  const adapter = makeAdapter();
  const page = await adapter.listTechnologies({});
  assert.equal(page.total, 0);
  assert.deepEqual(page.items, []);
});

test("listCustomerRequests публичный — пусто", async () => {
  const adapter = makeAdapter();
  const page = await adapter.listCustomerRequests({});
  assert.equal(page.total, 0);
  assert.deepEqual(page.items, []);
});

test("getTechnology: фикстуры только в непубличном scope", async () => {
  const adapter = makeAdapter();
  const publicDossier = await adapter.getTechnology("fixture-tech-draft-01", "public");
  assert.equal(publicDossier, null, "в публичном scope фикстура недоступна");
  const participant = await adapter.getTechnology("fixture-tech-draft-01", "participant");
  assert.ok(participant, "в кабинете участника фикстура доступна");
  assert.equal(participant.isFixture, true);
  assert.equal(participant.label, FIXTURE_LABEL);
  const ops = await adapter.getTechnology("fixture-tech-review-02", "operations");
  assert.ok(ops);
  assert.ok(isFixtureRecord(ops));
  const unknown = await adapter.getTechnology("unknown-tech", "participant");
  assert.equal(unknown, null);
});

test("getCustomerRequest: фикстуры только в непубличном scope", async () => {
  const adapter = makeAdapter();
  assert.equal(await adapter.getCustomerRequest("fixture-request-draft-01", "public"), null);
  const req = await adapter.getCustomerRequest("fixture-request-draft-01", "participant");
  assert.ok(req);
  assert.equal(req.isFixture, true);
  assert.equal(req.label, FIXTURE_LABEL);
});

test("getHomeSummary — реальные счётчики, без фикстур", async () => {
  const adapter = makeAdapter();
  const home = await adapter.getHomeSummary();
  assert.equal(home.researchCount, 400);
  assert.equal(home.technologiesCount, 0);
  assert.equal(home.requestsCount, 0);
  assert.ok(home.organizationsCount > 100);
  assert.equal(home.recentResearch.length, 6);
  assertNoFixture(home.recentResearch);
  assert.equal(home.dataSource, dataset.provenance.source);
  assert.equal(home.lastUpdatedAt, dataset.provenance.importedAt);
});

test("getUgtMethodology — 9 уровней, 4 измерения, диапазоны", async () => {
  const adapter = makeAdapter();
  const m = await adapter.getUgtMethodology();
  assert.equal(m.levels.length, 9);
  assert.equal(m.levels[0].number, 1);
  assert.equal(m.levels[8].number, 9);
  assert.equal(m.levels[0].band, "low");
  assert.equal(m.levels[5].band, "medium");
  assert.equal(m.levels[6].band, "high");
  assert.equal(m.dimensions.length, 4);
  assert.deepEqual(m.bands.map((b) => b.range), [[1, 3], [4, 6], [7, 9]]);
  assert.ok(m.source.includes("ГОСТ"));
});

/* ------------------------------------------------------------------ */
/* Авторизованные кабинеты (фикстуры)                                  */
/* ------------------------------------------------------------------ */

test("getWorkspace: фикстуры в кабинетах ролей, пустые секции у остальных", async () => {
  const adapter = makeAdapter();
  const partner = await adapter.getWorkspace("partner");
  assert.equal(partner.technologies.total, technologySummaryFixtures.length);
  for (const t of partner.technologies.items) {
    assert.equal(t.isFixture, true);
    assert.equal(t.label, FIXTURE_LABEL);
  }
  for (const p of partner.pilots.items) {
    assert.equal(p.isFixture, true);
    assert.equal(p.label, FIXTURE_LABEL);
  }
  const customer = await adapter.getWorkspace("customer");
  assert.equal(customer.requests.total, customerRequestSummaryFixtures.length);
  for (const r of customer.requests.items) {
    assert.equal(r.isFixture, true);
    assert.equal(r.label, FIXTURE_LABEL);
  }
  const manager = await adapter.getWorkspace("center_manager");
  assert.equal(manager.queue.total, operationalTaskFixtures.length);
  for (const t of manager.queue.items) assert.equal(t.isFixture, true);
  const visitor = await adapter.getWorkspace("visitor");
  assert.equal(visitor.technologies.total, 0);
  assert.equal(visitor.requests.total, 0);
  assert.equal(visitor.pilots.total, 0);
  assert.equal(visitor.queue.total, 0);
});

test("getOperationsQueue: фильтры статуса, приоритета, поиск", async () => {
  const adapter = makeAdapter();
  const all = await adapter.getOperationsQueue({ pageSize: 100 });
  assert.equal(all.total, operationalTaskFixtures.length);
  for (const t of all.items) {
    assert.equal(t.isFixture, true);
    assert.equal(t.label, FIXTURE_LABEL);
  }
  const byStatus = await adapter.getOperationsQueue({ status: "action_required" });
  assert.ok(byStatus.total >= 1);
  for (const t of byStatus.items) assert.equal(t.status, "action_required");
  const byPriority = await adapter.getOperationsQueue({ priority: "high" });
  for (const t of byPriority.items) assert.equal(t.priority, "high");
  const bySearch = await adapter.getOperationsQueue({ search: "датчик" });
  assert.ok(bySearch.total >= 1);
});

/* ------------------------------------------------------------------ */
/* Задержка, ошибки, состояния                                         */
/* ------------------------------------------------------------------ */

test("задержка настраивается (skeleton-состояния)", async () => {
  const adapter = makeAdapter({ delayMs: 40 });
  const t0 = performance.now();
  await adapter.listResearch({ pageSize: 5 });
  const elapsed = performance.now() - t0;
  assert.ok(elapsed >= 30, `ожидалась задержка ~40мс, получено ${elapsed.toFixed(1)}мс`);
  adapter.setDelayMs(0);
  const t1 = performance.now();
  await adapter.listResearch({ pageSize: 5 });
  assert.ok(performance.now() - t1 < 30, "после setDelayMs(0) задержки нет");
});

test("ошибка по триггеру (разовая и постоянная)", async () => {
  const adapter = makeAdapter();
  adapter.simulateFailure("listResearch", { once: true });
  await assert.rejects(() => adapter.listResearch({}), /Симулированный/);
  // следующий вызов успешен
  const page = await adapter.listResearch({ pageSize: 3 });
  assert.equal(page.total, 400);
  adapter.simulateFailure("getHomeSummary", { once: false });
  await assert.rejects(() => adapter.getHomeSummary(), /Симулированный/);
  await assert.rejects(() => adapter.getHomeSummary(), /Симулированный/);
  adapter.clearFailures();
  const home = await adapter.getHomeSummary();
  assert.equal(home.researchCount, 400);
});

/* ------------------------------------------------------------------ */
/* Действия пользователя                                               */
/* ------------------------------------------------------------------ */

test("saveDraft / submitForReview / addComment / recordDecision", async () => {
  const adapter = makeAdapter();
  const saved = await adapter.saveDraft({ objectType: "technology", id: "fixture-tech-draft-01", payload: { title: "x" } });
  assert.equal(saved.ok, true);
  assert.equal(saved.status, "draft");
  assert.ok(saved.savedAt);
  const submitted = await adapter.submitForReview({ objectType: "technology", id: "fixture-tech-draft-01", scope: "participant" });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.status, "under_review");
  const comment = await adapter.addComment({ objectType: "technology", objectId: "fixture-tech-draft-01", text: "Тест", scope: "participant" });
  assert.equal(comment.text, "Тест");
  assert.ok(comment.id.startsWith("comment-"));
  const decision = await adapter.recordDecision({ objectType: "technology", objectId: "fixture-tech-review-02", decision: "approved", reason: "Тест", scope: "operations" });
  assert.equal(decision.decision, "approved");
  assert.equal(decision.reason, "Тест");
});

/* ------------------------------------------------------------------ */
/* Фабрика и api-стаб                                                  */
/* ------------------------------------------------------------------ */

test("DATA_ADAPTER=mock|api резолвится (по умолчанию mock)", () => {
  assert.equal(resolveAdapterMode({}), "mock");
  assert.equal(resolveAdapterMode({ DATA_ADAPTER: "mock" }), "mock");
  assert.equal(resolveAdapterMode({ DATA_ADAPTER: "api" }), "api");
  assert.equal(resolveAdapterMode({ DATA_ADAPTER: "API" }), "api");
  assert.equal(resolveAdapterMode({ DATA_ADAPTER: "bogus" }), "mock");
});

test("api-стаб имеет те же сигнатуры и бросает «не подключено»", async () => {
  const api = new ApiAdapterStub();
  const methods = [
    () => api.listResearch({}),
    () => api.getHomeSummary(),
    () => api.getTechnology("x", "public"),
    () => api.listCustomerRequests({}),
    () => api.listOrganizations({}),
    () => api.getResearch("x", "public"),
    () => api.getUgtMethodology(),
    () => api.getWorkspace("partner"),
    () => api.getOperationsQueue({}),
    () => api.saveDraft({ objectType: "technology", id: "x", payload: {} }),
    () => api.submitForReview({ objectType: "technology", id: "x", scope: "participant" }),
    () => api.addComment({ objectType: "technology", objectId: "x", text: "t", scope: "participant" }),
    () => api.recordDecision({ objectType: "technology", objectId: "x", decision: "approved", reason: "r", scope: "operations" }),
  ];
  for (const call of methods) {
    await assert.rejects(call, /не подключён/);
  }
});

/* ------------------------------------------------------------------ */
/* Глобальный инвариант: фикстуры не попадают в публичные методы       */
/* ------------------------------------------------------------------ */

test("НИ ОДНА фикстура не попадает в публичные методы", async () => {
  const adapter = makeAdapter();
  const research = await adapter.listResearch({ pageSize: 400 });
  const orgs = await adapter.listOrganizations({ pageSize: 400 });
  const technologies = await adapter.listTechnologies({ pageSize: 100 });
  const requests = await adapter.listCustomerRequests({ pageSize: 100 });
  const home = await adapter.getHomeSummary();

  const allPublicItems = [
    ...research.items,
    ...orgs.items,
    ...technologies.items,
    ...requests.items,
    ...home.recentResearch,
  ];
  assertNoFixture(allPublicItems);

  for (const id of fixtureIds) {
    assert.equal(await adapter.getResearch(id, "public"), null, `getResearch не должен отдавать фикстуру ${id}`);
    assert.equal(await adapter.getTechnology(id, "public"), null, `getTechnology(public) не должен отдавать фикстуру ${id}`);
    assert.equal(await adapter.getCustomerRequest(id, "public"), null, `getCustomerRequest(public) не должен отдавать фикстуру ${id}`);
  }
});

test("статусы фикстур — из канонического словаря STATES.md", () => {
  const known = new Set(STATUSES);
  const statuses = [
    ...technologySummaryFixtures.map((f) => [f.verificationStatus, f.publicationStatus]),
    ...customerRequestSummaryFixtures.map((f) => [f.status, f.publicationStatus]),
    ...pilotFixtures.map((f) => f.status),
    ...operationalTaskFixtures.map((f) => f.status),
  ].flat();
  for (const s of statuses) {
    assert.ok(known.has(s), `неканонический статус: ${s}`);
  }
});
