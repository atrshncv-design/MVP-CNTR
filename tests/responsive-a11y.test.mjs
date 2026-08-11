import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ─── A11y: labels и aria ─────────────────────────────────────────────────────

test("login: поля связаны с ошибкой через aria-describedby", () => {
  const page = read("src/app/login/page.tsx");
  assert.match(page, /aria-describedby/);
  assert.match(page, /login-error/);
  assert.match(page, /role="alert"/);
});

test("register: поля форм имеют labels/aria и общую ошибку", () => {
  const page = read("src/app/register/page.tsx");
  assert.match(page, /aria-describedby/);
  assert.match(page, /register-error/);
});

test("profile: ошибка headline связана и имеет role=alert", () => {
  const page = read("src/app/dashboard/profile/page.tsx");
  assert.match(page, /aria-describedby/);
  assert.match(page, /profile-error/);
  assert.match(page, /role="alert"/);
  // Поля без label получают aria-label
  assert.match(page, /aria-label/);
});

test("notification-bell: aria-expanded/haspopup/controls и Escape", () => {
  const bell = read("src/components/notification-bell.tsx");
  assert.match(bell, /aria-expanded/);
  assert.match(bell, /aria-haspopup/);
  assert.match(bell, /aria-controls/);
  assert.match(bell, /Escape/);
});

test("verification-docs-panel: aria-live у сообщения и aria-describedby", () => {
  const panel = read("src/components/verification-docs-panel.tsx");
  assert.match(panel, /aria-live/);
  assert.match(panel, /aria-describedby/);
});

// ─── Reduced motion ──────────────────────────────────────────────────────────

test("globals.css: prefers-reduced-motion гасит анимации", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /animation-duration:\s*0\.01ms/);
});

test("providers.tsx: MotionConfig reducedMotion=user", () => {
  const providers = read("src/components/providers.tsx");
  assert.match(providers, /reducedMotion="user"|reducedMotion=\{"user"\}/);
});

// ─── Touch-цели ≥44px (11 = 2.75rem = 44px) ─────────────────────────────────

test("globals.css: .tz-btn имеет min-height 2.75rem (44px)", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /tz-btn[\s\S]{0,200}min-height:\s*2\.75rem/);
});

test("ключевые интерактивные элементы имеют min-h-11 (touch-цель)", () => {
  const bell = read("src/components/notification-bell.tsx");
  const nav = read("src/components/dashboard/nav.tsx");
  const wizard = read("src/components/questionnaire/questionnaire-wizard-client.tsx");
  // theme-toggle отсутствует: дизайн-базлайн c4f0794 — одна утверждённая тема.
  assert.match(bell, /min-h-11|h-11/);
  assert.match(nav, /min-h-11|h-11/);
  assert.match(wizard, /min-h-11|h-11/);
});

// ─── Browser support (без mock) ─────────────────────────────────────────────

test("browser-support: страница и детекция несовместимых браузеров", () => {
  const support = read("src/components/browser-support.tsx");
  assert.match(support, /documentMode|ResizeObserver|AbortController/);
  assert.match(support, /role="alert"/);
  const page = read("src/app/browser-support/page.tsx");
  assert.match(page, /Chrome|Firefox|Safari/);
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /BrowserSupport/);
});

// ─── Responsive: нет горизонтального переполнения в ключевых сценариях ─────

test("shell: хедер flex-wrap (нет переполнения на 320px)", () => {
  const shell = read("src/components/dashboard/shell.tsx");
  assert.match(shell, /flex-wrap/);
});

test("notification-bell: панель ограничена viewport (max-w calc)", () => {
  const bell = read("src/components/notification-bell.tsx");
  assert.match(bell, /max-w-\[calc\(100vw/);
});
