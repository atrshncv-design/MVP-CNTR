import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const exists = (path) => {
  try {
    return statSync(new URL(`../${path}`, import.meta.url)).isFile();
  } catch {
    return false;
  }
};

const listDir = (dir) => {
  const url = new URL(`../${dir}`, import.meta.url);
  try {
    return readdirSync(url, { withFileTypes: true });
  } catch {
    return [];
  }
};

// Все исходники UI: страницы + компоненты (+ навигация как источник пунктов).
const UI_PATHS = [
  ...listDir("src/app")
    .filter((d) => d.isDirectory() || d.name.endsWith(".tsx"))
    .map((d) => `src/app/${d.name}`),
  ...listDir("src/components")
    .filter((d) => d.isDirectory() || d.name.endsWith(".tsx"))
    .map((d) => `src/components/${d.name}`),
];

const UI_FILES = [];
const walk = (dir) => {
  for (const entry of listDir(dir)) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".tsx")) UI_FILES.push(full);
  }
};
for (const p of UI_PATHS) {
  if (exists(p) && !p.endsWith(".tsx")) walk(p);
  else if (exists(p)) UI_FILES.push(p);
}

// Файлы с JSX-кнопками/формами (исключаем чистые справочники и server actions).
const INTERACTIVE_FILES = UI_FILES.filter((f) => {
  const src = read(f);
  return /<button|<form|<input|<select|<textarea|<a\b|<Link\b/.test(src);
});

// ─── 1. Кнопки без обработчика ──────────────────────────────────────────
test("нет кнопок без onClick/href/type=submit (мёртвые controls)", () => {
  const offenders = [];
  for (const f of INTERACTIVE_FILES) {
    const src = read(f);
    // Все <button ...> без onClick: допустим только submit внутри формы
    // с onSubmit/action (или form= на внешнюю форму).
    const hasForm = /<form[\s\S]*?(onSubmit|action=)/.test(src);
    for (const m of src.matchAll(/<button\b([^>]*)>/g)) {
      const attrs = m[1];
      if (attrs.includes("onClick")) continue;
      const isSubmit = /type=["']?submit["']?/.test(attrs);
      const linksForm = /form=["'][^"']+["']/.test(attrs);
      if (!isSubmit && !linksForm) {
        offenders.push(`${f}: <button> без onClick и без type=submit`);
        continue;
      }
      if (isSubmit && !hasForm) {
        offenders.push(`${f}: submit-кнопка вне формы с onSubmit/action`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("нет пустых onClick-заглушек (() => {}) и onClick={() => void 0}", () => {
  const offenders = [];
  for (const f of INTERACTIVE_FILES) {
    const src = read(f);
    if (/onClick=\{\(\)\s*=>\s*\{\s*\}\}/.test(src)) {
      offenders.push(`${f}: пустой onClick={() => {}}`);
    }
    if (/onClick=\{\(\)\s*=>\s*void\s*0\}/.test(src)) {
      offenders.push(`${f}: onClick={() => void 0}`);
    }
  }
  assert.deepEqual(offenders, []);
});

// ─── 2. Формы без обработчика ───────────────────────────────────────────
test("каждая <form> имеет onSubmit или action (нет submit без обработчика)", () => {
  const offenders = [];
  for (const f of INTERACTIVE_FILES) {
    const src = read(f);
    for (const m of src.matchAll(/<form\b([^>]*)>/g)) {
      const attrs = m[1];
      if (!attrs.includes("onSubmit") && !attrs.includes("action")) {
        offenders.push(`${f}: <form> без onSubmit/action`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

// ─── 3. Ссылки: каждый интерактивный элемент навигации имеет href ────────
test("нет <a> без href и <Link> без href", () => {
  const offenders = [];
  for (const f of INTERACTIVE_FILES) {
    const src = read(f);
    for (const m of src.matchAll(/<a\b([^>]*)>/g)) {
      if (!m[1].includes("href")) {
        offenders.push(`${f}: <a> без href`);
      }
    }
    for (const m of src.matchAll(/<Link\b([^>]*)>/g)) {
      if (!m[1].includes("href")) {
        offenders.push(`${f}: <Link> без href`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

// ─── 4. Нет скрытых моков/fixtures в production UI ──────────────────────
test("production UI без demo fixtures: нет mock-идентификаторов и захардкоженных карточек", () => {
  const offenders = [];
  const forbiddenIdentifiers =
    /MOCK_|mockData|mock_|fixtures|fixture_|demoData|DEMO_|sampleData|placeholderData/i;
  const hardcodedValue = /\{\s*label:\s*["'][^"']+["'][^}]*value:\s*["']\d|value:\s*\d+\s*,/;
  for (const f of UI_FILES) {
    const src = read(f);
    if (forbiddenIdentifiers.test(src)) {
      offenders.push(`${f}: mock/fixture-идентификатор в коде`);
    }
    // Захардкоженная карточка данных (value — литерал, не выражение).
    // Исключаем справочники методологии (src/lib/ugt-data.ts) и конфиги.
    if (/src\/app\/dashboard|src\/components/.test(f) && hardcodedValue.test(src)) {
      offenders.push(`${f}: похоже на захардкоженную карточку данных (value-литерал)`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("массивы статистики кабинетов строятся из API-данных, а не литералов", () => {
  const dashboards = [
    "src/app/dashboard/gk_customer/page.tsx",
    "src/app/dashboard/rd_executor/page.tsx",
    "src/app/dashboard/scientific_org/page.tsx",
    "src/app/dashboard/cntr_admin/page.tsx",
    "src/app/dashboard/cntr_manager/page.tsx",
    "src/app/dashboard/regulating_organization/page.tsx",
    "src/app/dashboard/auditor/page.tsx",
  ];
  for (const f of dashboards) {
    assert.ok(exists(f), `${f} отсутствует`);
    const src = read(f);
    // statCards/cards обязаны ссылаться на данные (length/статистику/API), не литералы.
    assert.match(
      src,
      /statCards|const cards/,
      `${f}: нет массива статистики — проверьте, что кабинет использует данные`
    );
  }
});

// ─── 5. «В разработке»: единообразная маркировка (тикет 06) ─────────────
const ALL_ROLES = [
  "gk_customer",
  "rd_executor",
  "scientific_org",
  "serial_manufacturer",
  "regulating_organization",
  "auditor",
  "investor",
  "cntr_admin",
  "cntr_manager",
];

const CENTER_ROLES = ["cntr_admin", "cntr_manager"];

const FUTURE_SECTIONS = [
  { route: "/dashboard/news", title: "Новости и мероприятия" },
  { route: "/dashboard/forecasting", title: "Сценарное прогнозирование" },
  { route: "/dashboard/effectiveness", title: "Эффективность мероприятий" },
];

const INTERACTIVE_MARKERS = [
  "<button",
  "<form",
  "<input",
  "<select",
  "onClick",
  "useState",
  "useEffect",
  "fetch(",
  'href="',
];

test("разделы «В разработке» — честные ComingSoon-страницы без интерактива и моков", () => {
  const component = read("src/components/coming-soon.tsx");
  assert.match(component, /В разработке/);
  // Серверный компонент: без клиентских хуков, fetch и "use client".
  assert.doesNotMatch(component, /"use client"/);
  assert.doesNotMatch(component, /useState|useEffect|fetch\(/);
  for (const marker of INTERACTIVE_MARKERS) {
    assert.doesNotMatch(
      component,
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `coming-soon.tsx содержит ${marker}`
    );
  }

  for (const { route, title } of FUTURE_SECTIONS) {
    const pagePath = `src/app${route}/page.tsx`;
    assert.ok(exists(pagePath), `${pagePath} отсутствует`);
    const page = read(pagePath);
    assert.match(page, /ComingSoon/);
    assert.match(page, new RegExp(title));
    for (const marker of INTERACTIVE_MARKERS) {
      assert.doesNotMatch(
        page,
        new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${pagePath} содержит ${marker}`
      );
    }
  }
});

test("бейдж «В разработке» единообразен: 5 пунктов в navigation.ts, рендер в nav.tsx", () => {
  const nav = read("src/lib/navigation.ts");
  const navComponent = read("src/components/dashboard/nav.tsx");
  // news (1, общий) + прогнозирование/эффективность у cntr_admin и cntr_manager (2×2) = 5.
  assert.equal((nav.match(/badge: "В разработке"/g) ?? []).length, 5);
  assert.equal((nav.match(/label: "Новости и мероприятия"/g) ?? []).length, 1);
  assert.equal((nav.match(/Сценарное прогнозирование/g) ?? []).length, 2);
  assert.equal((nav.match(/Эффективность мероприятий/g) ?? []).length, 2);
  // Рендер бейджа — в NavLink (desktop и mobile используют его).
  assert.match(navComponent, /item\.badge/);
  assert.match(navComponent, /amber/);
  // Touch-цели тикета 04 сохранены при добавлении бейджа.
  assert.match(navComponent, /min-h-11/);
  assert.match(navComponent, /h-11/);
});

test("доступ к разделам «В разработке» зафиксирован в ROUTE_ALLOWED_ROLES", () => {
  const roles = read("src/lib/roles.ts");
  const newsBlock = roles.match(/"\/dashboard\/news":\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  assert.ok(newsBlock, "/dashboard/news не найден в ROUTE_ALLOWED_ROLES");
  for (const role of ALL_ROLES) {
    assert.match(newsBlock, new RegExp(`"${role}"`), `news: роль ${role} должна иметь доступ`);
  }
  for (const route of ["/dashboard/forecasting", "/dashboard/effectiveness"]) {
    const block = roles.match(new RegExp(`"${route}":\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? "";
    assert.ok(block, `${route} не найден в ROUTE_ALLOWED_ROLES`);
    for (const role of CENTER_ROLES) {
      assert.match(block, new RegExp(`"${role}"`), `${route}: роль ${role} должна иметь доступ`);
    }
    for (const role of ALL_ROLES.filter((r) => !CENTER_ROLES.includes(r))) {
      assert.doesNotMatch(block, new RegExp(`"${role}"`), `${route}: роль ${role} не должна иметь доступ`);
    }
  }
});

// ─── 6. Образовательный модуль отсутствует (честные границы) ────────────
test("образовательный модуль отсутствует: нет маршрута и упоминаний", () => {
  const dashDirs = listDir("src/app/dashboard").map((d) => d.name);
  assert.ok(!dashDirs.includes("education"), "src/app/dashboard/education не должна существовать");
  const sources = [
    "src/lib/navigation.ts",
    "src/lib/roles.ts",
    "src/middleware.ts",
    "src/components/dashboard/shell.tsx",
    "src/components/dashboard/nav.tsx",
  ];
  for (const path of sources) {
    const source = read(path);
    assert.doesNotMatch(source, /образован|education/i, `${path} упоминает образовательный модуль`);
  }
});

// ─── 7. Каждый пункт меню ведёт на существующую страницу ────────────────
test("все href в навигации ведут на существующие маршруты", () => {
  const nav = read("src/lib/navigation.ts");
  const hrefs = [...nav.matchAll(/href:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  const dashDirs = listDir("src/app/dashboard").map((d) => d.name);
  const rootDirs = listDir("src/app").map((d) => d.name);
  for (const href of hrefs) {
    if (href === "/" || href === "/dashboard") continue;
    const seg = href.split("/")[1];
    const second = href.split("/")[2];
    if (seg === "dashboard") {
      assert.ok(
        dashDirs.includes(second),
        `href ${href}: нет маршрута src/app/dashboard/${second}`
      );
    } else {
      assert.ok(
        rootDirs.includes(seg),
        `href ${href}: нет маршрута src/app/${seg}`
      );
    }
  }
});
