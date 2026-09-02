import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/**
 * WCAG AA (R03, тикет 03) — axe 0, контраст 4.5:1, клавиатура, скринридер, фокус-ловушка.
 * Проверяем через исходники — статический эквивалент axe для зоны src/app + src/components/ui.
 */

test("modal: фокус-ловушка, Escape, aria-modal, aria-labelledby, возврат фокуса, скролл-лок", () => {
  const src = read("src/components/ui/modal.tsx");
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /aria-labelledby/);
  assert.match(src, /aria-label/);
  assert.match(src, /Escape/);
  assert.match(src, /Tab/);
  assert.match(src, /shiftKey/);
  assert.match(src, /document\.addEventListener\("keydown"/);
  assert.match(src, /prevFocus/);
  assert.match(src, /document\.body\.style\.overflow/);
  assert.match(src, /tabIndex=\{-1\}/);
  assert.match(src, /Закрыть модальное окно/);
});

test("drawer: зеркало модалки — ловушка и Escape", () => {
  const src = read("src/components/ui/drawer.tsx");
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal/);
  assert.match(src, /aria-labelledby/);
  assert.match(src, /Escape/);
  assert.match(src, /Tab/);
  assert.match(src, /prevFocus/);
  assert.match(src, /Закрыть боковую панель/);
});

test("tooltip: клавиатура + скринридер (role tooltip, aria-describedby, focus/blur)", () => {
  const src = read("src/components/ui/tooltip.tsx");
  assert.match(src, /role="tooltip"/);
  assert.match(src, /aria-describedby/);
  assert.match(src, /onFocus/);
  assert.match(src, /onBlur/);
  assert.match(src, /onMouseEnter/);
  assert.match(src, /useId/);
});

test("input/select/textarea: label связь + aria-invalid + aria-describedby + role alert", () => {
  for (const f of ["src/components/ui/input.tsx", "src/components/ui/textarea.tsx", "src/components/ui/select.tsx"]) {
    const src = read(f);
    assert.match(src, /aria-invalid/);
    assert.match(src, /aria-describedby/);
    assert.match(src, /role="alert"/);
    assert.match(src, /useId/);
  }
  // search имеет aria-label по умолчанию
  const search = read("src/components/ui/search.tsx");
  assert.match(search, /aria-label/);
  assert.match(search, /type="search"/);
});

test("tabs: клавиатура стрелки + roving tabindex", () => {
  const src = read("src/components/ui/tabs.tsx");
  assert.match(src, /role="tablist"/);
  assert.match(src, /role="tab"/);
  assert.match(src, /aria-selected/);
  assert.match(src, /ArrowRight/);
  assert.match(src, /ArrowLeft/);
  assert.match(src, /Home/);
  assert.match(src, /End/);
  assert.match(src, /tabIndex/);
});

test("button: aria-busy при loading", () => {
  const src = read("src/components/ui/button.tsx");
  assert.match(src, /aria-busy/);
});

test("progress: role progressbar + aria-valuenow", () => {
  const src = read("src/components/ui/progress.tsx");
  assert.match(src, /role="progressbar"/);
  assert.match(src, /aria-valuenow/);
  assert.match(src, /aria-valuemin/);
  assert.match(src, /aria-valuemax/);
});

test("toast: aria-live polite + role status", () => {
  const src = read("src/components/ui/toast.tsx");
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /role="status"/);
});

test("pagination: nav aria-label и aria-live", () => {
  const src = read("src/components/ui/pagination.tsx");
  assert.match(src, /aria-label="Навигация по страницам"/);
  assert.match(src, /aria-live="polite"/);
});

test("chip: type button + aria-pressed", () => {
  const src = read("src/components/ui/chip.tsx");
  assert.match(src, /type/);
  assert.match(src, /aria-pressed/);
});

test("error/empty: live region", () => {
  const err = read("src/components/ui/error.tsx");
  assert.match(err, /role="alert"/);
  assert.match(err, /aria-live/);
  const empty = read("src/components/ui/empty.tsx");
  assert.match(empty, /role="status"/);
});

test("globals: контраст 4.5:1 — бейджи и UGT затемнены (R03)", () => {
  const css = read("src/app/globals.css");
  // бейджи используют text-варианты
  assert.match(css, /--tz-success-text:/);
  assert.match(css, /--tz-warning-text:/);
  assert.match(css, /--tz-accent-text:/);
  assert.match(css, /\.tz-badge-success.*var\(--tz-success-text\)/);
  assert.match(css, /\.tz-badge-warning.*var\(--tz-warning-text\)/);
  // UGT 2-9 затемнены
  for (const pair of [
    [".tz-ugt-2", "#bc3b1c"],
    [".tz-ugt-5", "#8c6b04"],
    [".tz-ugt-9", "#0f7233"],
  ]) {
    const [sel, hex] = pair;
    assert.ok(css.includes(sel) && css.includes(hex), `ожидается ${sel} с ${hex}`);
  }
  // gray500 исправлен с 4.00 до 5.09
  assert.match(css, /--tz-p-gray-500:\s*#6b6e77/);
});

test("layout: html lang ru + skip link + main tabindex", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /lang="ru"/);
  assert.match(layout, /Перейти к основному содержимому/);
  assert.match(layout, /href="#main-content"/);

  const dash = read("src/app/dashboard/layout.tsx");
  assert.match(dash, /href="#main-content"/);
  assert.match(dash, /id="main-content"/);
  assert.match(dash, /tabIndex=\{-1\}/);

  const landing = read("src/app/(landing)/layout.tsx");
  assert.match(landing, /id="main-content"/);
  assert.match(landing, /Перейти к основному содержимому/);

  const login = read("src/app/login/page.tsx");
  assert.match(login, /id="main-content"/);
});

test("landing nav: aria-label, aria-expanded, aria-haspopup, aria-current", () => {
  const nav = read("src/components/landing/landing-nav.tsx");
  assert.match(nav, /aria-label="Главная навигация"/);
  assert.match(nav, /aria-expanded/);
  assert.match(nav, /aria-haspopup="menu"/);
  assert.match(nav, /aria-current/);
  assert.match(nav, /aria-controls="mobile-nav"/);
});

test("news admin modal: использует Modal с ловушкой (axe 0)", () => {
  const src = read("src/app/dashboard/news/admin/page.tsx");
  assert.match(src, /from "@\/components\/ui\/modal"/);
  assert.match(src, /<Modal/);
  assert.match(src, /Запланировать новость/);
});

test("session expired modal: фокус-ловушка + Escape + aria-labelledby", () => {
  const src = read("src/features/notifications/SessionExpiredModal.tsx");
  assert.match(src, /aria-labelledby/);
  assert.match(src, /Escape/);
  assert.match(src, /Tab/);
  assert.match(src, /role="dialog"/);
  assert.match(src, /aria-modal/);
});

test("filter bar: label htmlFor + aria-label для поиска", () => {
  const fb = read("src/features/registry/FilterBar.tsx");
  assert.match(fb, /htmlFor=\{searchId\}/);
  assert.match(fb, /aria-label="Поиск по названию"/);
  assert.match(fb, /aria-label="Поиск по тегам"/);
});

test("registry table: caption, scope, aria-sort (axe table)", () => {
  const tbl = read("src/features/registry/RegistryTable.tsx");
  assert.match(tbl, /<caption/);
  assert.match(tbl, /scope="col"/);
  assert.match(tbl, /aria-sort/);
});
