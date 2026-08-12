import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/dashboard/ugt-trajectory.tsx", import.meta.url), "utf8");

test("UGT trajectory exposes nine official levels and the next-step CTA", () => {
  assert.match(source, /const LEVELS = \[/);
  assert.match(source, /Идея/);
  assert.match(source, /Внедрение/);
  assert.match(source, /Добавить документы/);
  assert.match(source, /Подать заявку на УГТ/);
});

test("UGT trajectory keeps review, approval and rejection states explicit", () => {
  assert.match(source, /status === "review"/);
  assert.match(source, /status === "approved"/);
  assert.match(source, /status === "rejected"/);
  assert.match(source, /Переход подтверждён менеджером ЦНТР/);
  assert.match(source, /Комплект требует доработки/);
  assert.match(source, /Ответ появится после проверки менеджером/);
});

test("UGT celebration honours reduced-motion preferences", () => {
  assert.match(source, /MotionConfig reducedMotion="user"/);
  assert.match(source, /PartyPopper/);
});
