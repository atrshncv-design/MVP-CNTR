import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("login exposes the approved product identity and explicit form states", () => {
  const source = read("src/app/login/page.tsx");

  // Approved-дизайн (c4f0794): в login-странице нет навязчивого брендинга
  // (ТЕХНОЗРЕЛОСТЬ/ГОСТ Р 58048-2017 удалены из снапшота) — тест проверяет
  // фактическую идентичность approved-контента, а не требует его возврата.
  assert.match(source, /Цифровая платформа ЦНТР/);
  assert.match(source, /Один процесс — от заявки до внедрения технологии/);
  assert.match(source, /Центр научно-технологического развития Удмуртской Республики/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Вход…/);
  assert.match(source, /Неверный email или пароль/);
  assert.match(source, /\[1, 2, 3, 4, 5, 6, 7, 8, 9\]/);
});

test("dashboard shell uses process-first global navigation", () => {
  const source = read("src/app/dashboard/layout.tsx");

  for (const label of ["Рабочий стол", "Проекты", "Заявки", "Реестры", "Документы"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /ТЕХНОЗРЕЛОСТЬ/);
  assert.match(source, /Перейти к основному содержимому/);
});

test("customer P0 workspace is honest when no project API is connected", () => {
  const source = read("src/app/dashboard/gk_customer/page.tsx");

  assert.match(source, /Проектов пока нет/);
  assert.match(source, /Создать первую заявку/);
  // Значения карточек приходят из API-состояния (нули при недоступности API),
  // а не захардкожены: ни одна карточка не содержит литерального числового value.
  assert.doesNotMatch(source, /value:\s*['"]\d+['"]/);
});
