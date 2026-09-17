/**
 * Публичные витрины исполнителей, организаций, НИОКТР (таск 02, R01/R03).
 * Швы: registry-ui (страницы на живых данных), registry-api
 * (GET /executors/specialists, /executors/organizations, /nioktr без токена).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ─── lib: query-строки — только параметры, которые понимает бэкенд ───

test("showcases lib: query-строки специалистов/организаций/НИОКТР", async () => {
  const lib = await import("../src/lib/landing-showcases.ts");
  assert.equal(lib.SHOWCASE_DIRECTORY_PAGE_SIZE, 9);
  assert.equal(
    lib.buildSpecialistsQuery({ after_id: 5, limit: 9 }),
    "?after_id=5&limit=9",
  );
  assert.equal(lib.buildSpecialistsQuery({}), "?limit=9");
  assert.equal(lib.buildOrganizationsQuery({}), "?limit=9");
  assert.equal(
    lib.buildOrganizationsQuery({ limit: 9, offset: 9 }),
    "?limit=9&offset=9",
  );
  assert.equal(lib.buildNioktrQuery({}), "?limit=9");
  assert.equal(lib.buildNioktrQuery({ limit: 9, offset: 18 }), "?limit=9&offset=18");
});

// ─── lib: слияние keyset-страниц (специалисты) ───

test("showcases lib: mergeKeysetPage — границы страниц без дублей", async () => {
  const { mergeKeysetPage } = await import("../src/lib/landing-showcases.ts");
  const p3 = { id: 3, full_name: "C" };
  const p2 = { id: 2, full_name: "B" };
  const p1 = { id: 1, full_name: "A" };
  // Полная страница — есть следующая; пустой ответ закрывает пагинацию без потерь.
  const first = mergeKeysetPage([], [p3, p2], 2);
  assert.deepEqual(first.items, [p3, p2]);
  assert.equal(first.nextAfterId, 2);
  assert.equal(first.hasMore, true);
  const closed = mergeKeysetPage(first.items, [], 2);
  assert.deepEqual(closed.items, [p3, p2]);
  assert.equal(closed.nextAfterId, 2);
  assert.equal(closed.hasMore, false);
  // Неполная страница — последняя, курсор на её хвосте.
  const partial = mergeKeysetPage([p3, p2], [p1], 2);
  assert.deepEqual(partial.items, [p3, p2, p1]);
  assert.equal(partial.nextAfterId, 1);
  assert.equal(partial.hasMore, false);
  // Пересечение страниц не дублирует карточки.
  const overlap = mergeKeysetPage([p3], [p3, p2], 2);
  assert.deepEqual(overlap.items, [p3, p2]);
  assert.equal(overlap.nextAfterId, 2);
  assert.equal(overlap.hasMore, true);
});

// ─── lib: слияние offset-страниц (организации, НИОКТР) ───

test("showcases lib: mergeOffsetPage — курсор от сырой страницы, без дублей", async () => {
  const { mergeOffsetPage } = await import("../src/lib/landing-showcases.ts");
  const a = { id: 1, name: "A" };
  const b = { id: 2, name: "B" };
  const c = { id: 3, name: "C" };
  // Полная страница — есть следующая, курсор сдвинут на длину ответа.
  const first = mergeOffsetPage([], [a, b], 0, 2);
  assert.deepEqual(first.items, [a, b]);
  assert.equal(first.nextOffset, 2);
  assert.equal(first.hasMore, true);
  // Пустая страница закрывает пагинацию, items не трогает, курсор стоит.
  const closed = mergeOffsetPage(first.items, [], 2, 2);
  assert.deepEqual(closed.items, [a, b]);
  assert.equal(closed.nextOffset, 2);
  assert.equal(closed.hasMore, false);
  // Неполная страница — последняя.
  const partial = mergeOffsetPage([a, b], [c], 2, 2);
  assert.deepEqual(partial.items, [a, b, c]);
  assert.equal(partial.nextOffset, 3);
  assert.equal(partial.hasMore, false);
  // Пересечение окон: дедуп по id, курсор всё равно от сырой страницы.
  const overlap = mergeOffsetPage([a], [a, b], 0, 2);
  assert.deepEqual(overlap.items, [a, b]);
  assert.equal(overlap.nextOffset, 2);
  assert.equal(overlap.hasMore, true);
});

// ─── lib: маппинг карточек — только поля API, без выдуманных данных ───

test("showcases lib: toExecutorCard — честные поля, org по знаку id", async () => {
  const { toExecutorCard, organizationToExecutorCard } = await import(
    "../src/lib/landing-showcases.ts"
  );
  const person = {
    id: 7,
    full_name: "Иванова Анна",
    organization: "Завод",
    role_slug: "rd_executor",
    role_name: "R&D-исполнитель",
    competencies: ["ML", "CAD"],
    completed_projects: 3,
  };
  assert.deepEqual(toExecutorCard(person), {
    id: 7,
    name: "Иванова Анна",
    org: "Завод",
    role: "R&D-исполнитель",
    competencies: ["ML", "CAD"],
    completedProjects: 3,
    isOrg: false,
  });
  // Отсутствующие поля — null/пусто, не выдумка; имя на языке ввода.
  const bare = { ...person, id: 8, organization: null, role_name: null };
  delete bare.competencies;
  const bareCard = toExecutorCard({ ...bare, competencies: undefined });
  assert.equal(bareCard.org, null);
  assert.equal(bareCard.role, null);
  assert.deepEqual(bareCard.competencies, []);
  assert.equal(bareCard.isOrg, false);
  // Организация из каталога — отрицательный id → isOrg.
  const org = { ...person, id: -12 };
  assert.equal(toExecutorCard(org).isOrg, true);
  // OrganizationOut бэка ложится в ту же карточку с отрицательным id.
  const orgCard = organizationToExecutorCard({
    id: 12,
    name: "Полное имя завода",
    short_name: "Завод",
    ogrn: null,
    org_type: null,
    competencies: ["Серия"],
    projects_count: 5,
    region: null,
  });
  assert.equal(orgCard.id, -12);
  assert.equal(orgCard.name, "Завод");
  assert.equal(orgCard.isOrg, true);
  assert.equal(orgCard.completedProjects, 5);
});

test("showcases lib: toNioktrCard — только поля реестра, бюджетов нет", async () => {
  const { toNioktrCard } = await import("../src/lib/landing-showcases.ts");
  const apiItem = {
    id: 11,
    registration_number: "12501000000",
    name: "Стенд испытаний",
    annotation: "Аннотация НИОКТР",
    keywords: ["стенд", "испытания"],
    nioktr_types: ["ОКР"],
    executor_name: "Завод",
    customer_name: "ГК Заказчик",
    created_date: "2025-01-15",
    is_ai_area: true,
  };
  assert.deepEqual(toNioktrCard(apiItem), {
    id: 11,
    regNumber: "12501000000",
    name: "Стенд испытаний",
    annotation: "Аннотация НИОКТР",
    keywords: ["стенд", "испытания"],
    types: ["ОКР"],
    executor: "Завод",
    customer: "ГК Заказчик",
    createdDate: "2025-01-15",
    isAi: true,
  });
  // Аннотации/исполнителя нет в API — null, а не пустота и не выдумка.
  const bare = toNioktrCard({ ...apiItem, id: 12, annotation: null, executor_name: null });
  assert.equal(bare.annotation, null);
  assert.equal(bare.executor, null);
  assert.equal(bare.isAi, true);
});

// ─── server: анонимное чтение каталогов без токена ───

test("showcases server: читалки каталогов — без Authorization, живые ручки", () => {
  const src = read("src/app/(landing)/public-showcases.ts");
  for (const fn of [
    "fetchPublicSpecialistsPage",
    "fetchPublicOrganizationsPage",
    "fetchPublicNioktrPage",
  ]) {
    assert.match(src, new RegExp(`export function ${fn}`), `${fn} отсутствует`);
  }
  assert.match(src, /\/executors\/specialists/);
  assert.match(src, /\/executors\/organizations/);
  assert.match(src, /\/nioktr/);
  assert.match(src, /serverApiBase/);
  assert.match(src, /cache: "no-store"/);
  assert.match(src, /after_id/);
  assert.match(src, /buildSpecialistsQuery/);
  assert.match(src, /buildOrganizationsQuery/);
  assert.match(src, /buildNioktrQuery/);
  assert.doesNotMatch(src, /Bearer/);
  assert.doesNotMatch(src, /Authorization['"]?\s*:/);
  assert.doesNotMatch(src, /accessToken|access_token/);
  assert.doesNotMatch(src, /join_token/);
  assert.doesNotMatch(src, /created_by/);
});

// ─── client: три витрины на живых данных с честными состояниями ───

for (const [file, endpoint, merge, card, emptyNs] of [
  [
    "src/components/landing/performers-showcase.tsx",
    "/api/v1/executors/specialists",
    "mergeKeysetPage",
    "toExecutorCard",
    "executors",
  ],
  [
    "src/components/landing/customers-showcase.tsx",
    "/api/v1/executors/organizations",
    "mergeOffsetPage",
    "toExecutorCard",
    "executors",
  ],
  [
    "src/components/landing/nioktr-showcase.tsx",
    "/api/v1/nioktr",
    "mergeOffsetPage",
    "toNioktrCard",
    "nioktr",
  ],
]) {
  test(`showcases client: ${file} — живой fetch, пагинация, честные состояния`, () => {
    const src = read(file);
    assert.match(src, /CLIENT_API_BASE as API_URL/, "единый URL-модуль");
    assert.ok(
      src.includes(`fetch(\`\${API_URL}${endpoint}`),
      `нет живого fetch ${endpoint}`,
    );
    assert.match(src, /cache: "no-store"/);
    assert.ok(src.includes(merge), `нет слияния страниц ${merge}`);
    assert.ok(src.includes(card), `нет маппинга карточек ${card}`);
    assert.match(src, /emptyTitle/);
    assert.match(src, /emptyDesc/);
    assert.match(src, /errorLoad/);
    assert.match(src, /tCommon\("retry"\)/);
    assert.match(src, /tCommon\("showMore"\)/);
    assert.match(src, /href="\/register"/);
    assert.match(src, /href="\/login"/);
    assert.ok(src.includes(`useTranslations("${emptyNs}")`), "словарь пустых состояний");
    assert.doesNotMatch(src, /Bearer/);
    assert.doesNotMatch(src, /Authorization['"]?\s*:/);
    assert.doesNotMatch(src, /accessToken|access_token/);
    assert.doesNotMatch(src, /getShowcaseProjects/);
    assert.doesNotMatch(src, /lib\/showcase/);
    assert.doesNotMatch(src, /join_token/);
    assert.doesNotMatch(src, /created_by/);
    assert.doesNotMatch(src, /passport|inn\b|snils/i);
  });
}

// ─── pages: три витрины отдают живые данные, ноль — честным пустым ───

test("showcases pages: /performers и /customers — живые каталоги поверх маркетинга", () => {
  const performers = read("src/app/(landing)/performers/page.tsx");
  assert.match(performers, /fetchPublicSpecialistsPage/);
  assert.match(performers, /PerformersShowcase/);
  assert.match(performers, /initialError/);
  // Маркетинг возможностей оставлен, но не выдаёт себя за живых людей.
  assert.match(performers, /card1Title/);
  assert.doesNotMatch(performers, /Bearer/);
  assert.doesNotMatch(performers, /Authorization['"]?\s*:/);
  const customers = read("src/app/(landing)/customers/page.tsx");
  assert.match(customers, /fetchPublicOrganizationsPage/);
  assert.match(customers, /CustomersShowcase/);
  assert.match(customers, /initialError/);
  assert.match(customers, /card1Title/);
  assert.doesNotMatch(customers, /Bearer/);
  assert.doesNotMatch(customers, /Authorization['"]?\s*:/);
});

test("showcases pages: /nioktr — новый раздел на живых данных реестра", () => {
  const src = read("src/app/(landing)/nioktr/page.tsx");
  assert.match(src, /fetchPublicNioktrPage/);
  assert.match(src, /NioktrShowcase/);
  assert.match(src, /initialError/);
  assert.match(src, /generateMetadata/);
  assert.doesNotMatch(src, /Bearer/);
  assert.doesNotMatch(src, /Authorization['"]?\s*:/);
  assert.doesNotMatch(src, /accessToken|access_token/);
  assert.doesNotMatch(src, /join_token/);
  assert.doesNotMatch(src, /created_by/);
});

test("showcases nav: раздел НИОКТР discoverable из навигации", () => {
  const nav = read("src/components/landing/landing-nav.tsx");
  assert.match(nav, /href: "\/nioktr"/);
});

// ─── словари: используемые ключи есть в ru/en обоих зеркал, en без кириллицы ───

test("showcases i18n: ключи витрин в паритете ru/en, без новых ключей", () => {
  const needs = {
    executors: [
      "tabSpecialists",
      "tabOrganizations",
      "badgeUser",
      "badgeOrganization",
      "competencies",
      "errorLoad",
      "emptyTitle",
      "emptyDesc",
      "projectOne",
      "projectFew",
      "projectMany",
    ],
    nioktr: ["title", "badgeNioktr", "badgeAi", "errorLoad", "emptyTitle", "emptyDesc"],
    projectsLanding: ["searchPlaceholder", "register", "login"],
    common: ["search", "retry", "loading", "showMore"],
    nav: ["nioktr", "customers", "performers"],
  };
  const pairs = [
    ["src/messages/ru.json", "src/messages/en.json"],
    ["messages/ru.json", "messages/en.json"],
  ];
  for (const [ruPath, enPath] of pairs) {
    const ru = JSON.parse(read(ruPath));
    const en = JSON.parse(read(enPath));
    for (const [ns, keys] of Object.entries(needs)) {
      for (const key of keys) {
        assert.equal(typeof ru[ns]?.[key], "string", `${ruPath}: нет ключа ${ns}.${key}`);
        assert.ok(ru[ns][key].length > 0, `${ruPath}: ${ns}.${key} пуст`);
        assert.equal(typeof en[ns]?.[key], "string", `${enPath}: нет ключа ${ns}.${key}`);
        assert.ok(en[ns][key].length > 0, `${enPath}: ${ns}.${key} пуст`);
        assert.notEqual(en[ns][key], key, `${enPath}: ${ns}.${key} — эхо ключа`);
        assert.doesNotMatch(en[ns][key], /[А-Яа-яЁё]/, `${enPath}: ${ns}.${key} с кириллицей`);
      }
    }
  }
});
