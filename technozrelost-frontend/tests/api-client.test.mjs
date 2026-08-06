import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("project API client sends the session token and never serves stale project state", () => {
  const source = read("src/lib/api-client.ts");

  assert.match(source, /Authorization.*Bearer/);
  assert.match(source, /cache:\s*"no-store"/);
  assert.match(source, /AbortSignal\.timeout\(5_000\)/);
  assert.match(source, /throw new ApiError/);
  assert.match(source, /getProjects/);
});

test("shared projects route renders loading-independent empty and error states", () => {
  const source = read("src/app/dashboard/projects/page.tsx");

  assert.match(source, /Проектов пока нет/);
  assert.match(source, /Не удалось загрузить проекты/);
  assert.match(source, /getProjects/);
});
