import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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

test("shell предоставляет skip-link и семантические landmarks (header/main)", () => {
  const shell = read("src/components/dashboard/shell.tsx");
  assert.match(shell, /skip/);
  assert.match(shell, /main-content/);
  assert.match(shell, /<header/);
  assert.match(shell, /<main/);
  // Навигация — в компоненте DashboardNav (nav.tsx), рендерится из shell.
  const nav = read("src/components/dashboard/nav.tsx");
  assert.match(nav, /<nav/);
});

test("навигация: aria-current для активного пункта, aria-expanded/controls для меню", () => {
  const nav = read("src/components/dashboard/nav.tsx");
  assert.match(nav, /aria-current/);
  assert.match(nav, /aria-expanded/);
  assert.match(nav, /aria-controls/);
  assert.match(nav, /Escape/);
});

test("общие состояния помечены role=status/alert (loading/error)", () => {
  const states = read("src/components/states.tsx");
  assert.match(states, /role="status"/);
  assert.match(states, /role="alert"/);
});

test("dashboard/loading.tsx объявляет loading-состояние", () => {
  const loading = read("src/app/dashboard/loading.tsx");
  assert.match(loading, /Skeleton|LoadingState/);
});

test("dashboard/error.tsx объявляет error-состояние с ролью alert и повтором", () => {
  const error = read("src/app/dashboard/error.tsx");
  assert.match(error, /ErrorState/);
  assert.match(error, /reset|Повторить/);
});

test("focus-visible определён в глобальных стилях", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /focus-visible/);
});

test("страницы ролей используют общие состояния (единообразие)", () => {
  for (const role of ROLE_SLUGS) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.match(
      page,
      /CardSkeleton|LoadingState|ErrorState|EmptyState/,
      `${role} должна использовать общие состояния`
    );
  }
});
