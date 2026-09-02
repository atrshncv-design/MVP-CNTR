/**
 * Регрессионный тест fail-closed матрицы ролей (FE-01, истории R02/R02.1).
 *
 * Обходит реальные маршруты из структуры src/app/dashboard и сверяет каждый
 * с матрицей ROUTE_ALLOWED_ROLES (src/lib/roles.ts): маршрут без записи
 * обязан быть запрещён (запрет по умолчанию). Добавленный разработкой
 * маршрут, которого нет в матрице, валит этот тест — так новые разделы
 * появляются в матрице осознанно.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { allowedRolesFor } from "../src/lib/roles.ts";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const DASHBOARD_DIR = fileURLToPath(new URL("../src/app/dashboard", import.meta.url));

/** Маршрут = каталог с page.tsx; динамические сегменты остаются как [param]. */
function collectRoutes(dir, base = "/dashboard") {
  const routes = [];
  if (existsSync(join(dir, "page.tsx"))) routes.push(base);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    routes.push(...collectRoutes(join(dir, entry.name), `${base}/${entry.name}`));
  }
  return routes.sort();
}

test("обходчик находит критичные разделы, включая свежие и динамические", () => {
  const routes = collectRoutes(DASHBOARD_DIR);
  for (const expected of [
    "/dashboard",
    "/dashboard/nioktr",
    "/dashboard/nioktr/[registration_number]",
    "/dashboard/organizations",
    "/dashboard/organizations/[ogrn]",
    "/dashboard/profile",
    "/dashboard/news/[id]/edit",
    "/dashboard/gk_customer/projects/new",
  ]) {
    assert.ok(routes.includes(expected), `обходчик не нашёл ${expected}`);
  }
});

test("каждый существующий маршрут /dashboard/* покрыт матрицей ролей", () => {
  const uncovered = collectRoutes(DASHBOARD_DIR).filter(
    (route) => allowedRolesFor(route) === null,
  );
  assert.deepEqual(
    uncovered,
    [],
    "маршруты без записи в ROUTE_ALLOWED_ROLES запрещены middleware — добавьте их в матрицу осознанно",
  );
});

test("редактор новости закрыт на уровне маршрута от ролей без права правки", () => {
  // Middleware видит инстанцированный путь: [id] подменён реальным числом.
  assert.deepEqual(allowedRolesFor("/dashboard/news/42/edit"), [
    "cntr_admin",
    "cntr_manager",
  ]);
});

test("маршрут вне матрицы не имеет доступа ни для одной роли (fail-closed данные)", () => {
  assert.equal(allowedRolesFor("/dashboard/definitely-not-in-matrix"), null);
});

test("middleware запрещает непокрытый маршрут вместо пропуска (fail-closed)", () => {
  const source = read("src/middleware.ts");
  // Прежняя семантика `if (allowed && …)` трактовала отсутствие записи как
  // «разрешено всем» — именно эту дыру закрывает запрет по умолчанию.
  assert.doesNotMatch(source, /if\s*\(\s*allowed\s*&&/);
  assert.match(source, /allowedRolesFor/);
  assert.match(source, /\/forbidden/, "нет записи в матрице → rewrite на /forbidden");
});

test("middleware не гонит публичный лендинг на /login из-за RefreshAccessTokenError", () => {
  const source = read("src/middleware.ts");
  // Редирект по ошибке refresh должен быть ограничен защищёнными/auth-маршрутами,
  // иначе протухшая сессия блокирует открытие сайта.
  assert.match(source, /RefreshAccessTokenError[\s\S]{0,400}isProtectedRoute\(pathname\)\s*\|\|\s*isAuthRoute\(pathname\)/);
});

test("SessionExpiryWatcher не вызывает signOut на публичных страницах", () => {
  const source = read("src/components/providers.tsx");
  assert.match(source, /isProtectedRoute\(pathname\)/);
  assert.doesNotMatch(source, /if\s*\(\s*tokenError\s*===\s*["']RefreshAccessTokenError["']\s*\)\s*\{\s*void\s+signOut/);
});
