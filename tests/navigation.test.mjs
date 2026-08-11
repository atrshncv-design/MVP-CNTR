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
    return readdirSync(url);
  } catch {
    return [];
  }
};

// ─── Роли и маршруты (реальные, из кода) ────────────────────────────────
const ROLE_SLUGS = [
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

// Директории маршрутов внутри src/app (dashboard и корневые страницы).
const APP_DIRS = listDir("src/app");

test("navigation.ts определяет кабинет для каждой из 9 ролей", () => {
  // ROLE_DASHBOARD (src/lib/roles.ts): роль -> /dashboard/<роль>
  const roles = read("src/lib/roles.ts");
  for (const role of ROLE_SLUGS) {
    assert.match(
      roles,
      new RegExp(`${role}:\\s*["'\`]/dashboard/${role}`),
      `роль ${role} должна иметь кабинет /dashboard/${role}`
    );
  }
});

test("каждый пункт меню роли ведёт на существующую страницу (нет мёртвых href)", () => {
  const source = read("src/lib/navigation.ts");
  // Все href в навигации: /dashboard/... и корневые (/, /levels, /methodology...)
  const hrefs = [...source.matchAll(/href:\s*["'`]([^"'`]+)["'`]/g)].map(
    (m) => m[1]
  );
  const pages = new Set(APP_DIRS);
  for (const href of hrefs) {
    if (href === "/") continue;
    const seg = href.split("/")[1];
    assert.ok(
      pages.has(seg),
      `href ${href} должен указывать на существующий сегмент src/app/${seg}`
    );
  }
});

test("каждая роль имеет свой кабинет и не получает чужих маршрутов (скрытие не расширяет)", () => {
  const source = read("src/lib/navigation.ts");
  const roles = read("src/lib/roles.ts");
  // Скрытие UI не заменяет backend: карта ограничена ROUTE_ALLOWED_ROLES.
  assert.match(source, /ROUTE_ALLOWED_ROLES/);
  assert.match(source, /isRouteAllowedForRole/);
  // У каждой роли пункт «Мой кабинет» указывает на её ROLE_DASHBOARD.
  for (const role of ROLE_SLUGS) {
    assert.match(
      source,
      new RegExp(`ROLE_DASHBOARD\\.${role}[^}]*Мой кабинет`),
      `роль ${role}: «Мой кабинет» -> ROLE_DASHBOARD.${role}`
    );
    assert.match(
      roles,
      new RegExp(`${role}:\\s*["'\`]/dashboard/${role}`),
      `кабинет ${role} существует`
    );
  }
});

test("ROLE_DASHBOARD содержит 9 уникальных кабинетов без чужих дублей", () => {
  const roles = read("src/lib/roles.ts");
  const block = roles.match(/ROLE_DASHBOARD[\s\S]*?\n\};/)?.[0] ?? "";
  for (const role of ROLE_SLUGS) {
    const count = (block.match(new RegExp(`dashboard/${role}`, "g")) ?? [])
      .length;
    assert.equal(count, 1, `маршрут /dashboard/${role} встречается ровно 1 раз`);
  }
});

test("shell.tsx реализует единый layout: skip-link, landmarks, aria-current", () => {
  const shell = read("src/components/dashboard/shell.tsx");
  assert.match(shell, /#main-content|main-content/);
  assert.match(shell, /<header/);
  assert.match(shell, /<main/);
  assert.match(shell, /aria-current/);
  const nav = read("src/components/dashboard/nav.tsx");
  assert.match(nav, /<nav/);
  assert.match(nav, /aria-current/);
  assert.match(nav, /aria-expanded/);
  assert.match(nav, /aria-controls/);
  assert.match(nav, /Escape|onKeyDown/);
});

test("layout.tsx подключает DashboardShell с ролями из сессии", () => {
  const layout = read("src/app/dashboard/layout.tsx");
  assert.match(layout, /DashboardShell/);
  assert.match(layout, /user\?\.roles/);
  assert.match(layout, /auth\(\)/);
});

test("dashboard/loading.tsx и error.tsx — единые состояния для сегмента", () => {
  assert.ok(exists("src/app/dashboard/loading.tsx"), "loading.tsx существует");
  assert.ok(exists("src/app/dashboard/error.tsx"), "error.tsx существует");
  const loading = read("src/app/dashboard/loading.tsx");
  const error = read("src/app/dashboard/error.tsx");
  assert.match(loading, /Skeleton|LoadingState/);
  assert.match(error, /ErrorState|reset/);
});

test("states.tsx предоставляет LoadingState/ErrorState/EmptyState с ролями доступности", () => {
  const states = read("src/components/states.tsx");
  assert.match(states, /LoadingState/);
  assert.match(states, /ErrorState/);
  assert.match(states, /EmptyState/);
  assert.match(states, /role="status"/);
  assert.match(states, /role="alert"/);
});

test("все 9 страниц ролей используют общие состояния (нет дублирования)", () => {
  const states = read("src/components/states.tsx");
  assert.match(states, /CardSkeleton/);
  for (const role of ROLE_SLUGS) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.match(
      page,
      /CardSkeleton|LoadingState|ErrorState|EmptyState/,
      `страница ${role} должна использовать общие состояния`
    );
  }
});
