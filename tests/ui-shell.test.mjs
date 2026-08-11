import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("login exposes the approved product identity and explicit form states", () => {
  const source = read("src/app/login/page.tsx");

  // Дизайн-базлайн c4f0794: бренд ЦНТР УР + честные состояния формы.
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Вход…|Войти в платформу/);
  assert.match(source, /Удмуртской Республики|ЦНТР/);
  assert.match(source, /Неверный email или пароль/);
});

test("dashboard shell uses process-first global navigation", () => {
  // Тикет 01: навигация вынесена в карту роль→пункты (src/lib/navigation.ts)
  // и общий shell (src/components/dashboard/shell.tsx); layout — тонкая обёртка.
  const shell = read("src/components/dashboard/shell.tsx");
  const navMap = read("src/lib/navigation.ts");

  for (const label of ["Рабочий стол", "Проекты", "Заявки", "Реестры", "НИОКТР", "Организации", "Профиль", "Документы"]) {
    assert.match(navMap, new RegExp(label));
  }
  assert.match(shell, /ТЕХНОЗРЕЛОСТЬ/);
  assert.match(shell, /Перейти к основному содержимому/);

  const layout = read("src/app/dashboard/layout.tsx");
  assert.match(layout, /DashboardShell/);
  assert.match(layout, /auth\(\)/);
});

test("customer P0 workspace is honest when no project API is connected", () => {
  const source = read("src/app/dashboard/gk_customer/page.tsx");

  assert.match(source, /Проектов пока нет/);
  assert.match(source, /Создать первую заявку/);
  // Значения карточек приходят из API-состояния (нули при недоступности API),
  // а не захардкожены: ни одна карточка не содержит литерального числового value.
  assert.doesNotMatch(source, /value:\s*['"]\d+['"]/);
});
