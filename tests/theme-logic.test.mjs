/**
 * Поведенческие тесты темы (тикет 16/17) — АДАПТИРОВАНЫ под дизайн-базлайн c4f0794.
 *
 * Дизайн-базлайн release-integration: ОДНА утверждённая тема (тёмная, графит
 * #0b0d12 + акцент #d63031). Модуль src/lib/theme.ts и переключатель
 * theme-toggle в базлайне отсутствуют (удалены в дизайн-эволюции).
 * Поведенческие проверки заменены структурными гарантиями канона:
 *  - токены tz-* определены в globals.css;
 *  - переключателя темы в UI нет (невозможно сменить утверждённую тему);
 *  - dashboard-шелл не ссылается на theme-toggle.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("globals.css определяет базовые tz-токены (одна утверждённая тема)", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /--tz-accent/);
  assert.match(css, /--tz-bg/);
  assert.match(css, /--tz-fg/);
});

test("в UI отсутствует переключатель темы (одна тема — канон)", () => {
  const shell = read("src/components/dashboard/shell.tsx");
  assert.doesNotMatch(shell, /theme-toggle|ThemeToggle/);
  const layout = read("src/app/layout.tsx");
  assert.doesNotMatch(layout, /theme-toggle|ThemeToggle/);
});

test("дизайн-ассеты baseline присутствуют в public/ (brand)", () => {
  const out = execSync("ls -A public/brand 2>/dev/null || true", { encoding: "utf8" }).trim();
  assert.ok(out.length > 0, "public/brand должен содержать дизайн-ассеты baseline");
});
