/**
 * Поведенческие тесты API-клиента: реальные вызовы fetch (mock),
 * успешный путь и ошибка → ApiError со статусом.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, getProjects } from "../src/lib/api-client.ts";

function mockFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

test("getProjects: при 200 возвращает список проектов из JSON", async () => {
  const restore = mockFetch(async () => {
    const body = [{ id: 1, name: "Проект", current_level: 2, status: "published" }];
    return {
      ok: true,
      status: 200,
      json: async () => body,
    };
  });
  try {
    const projects = await getProjects("token");
    assert.equal(projects.length, 1);
    assert.equal(projects[0].name, "Проект");
    assert.equal(projects[0].current_level, 2);
  } finally {
    restore();
  }
});

test("getProjects: при 401 бросает ApiError со статусом", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: "Не авторизован" }),
  }));
  try {
    await assert.rejects(
      getProjects("token"),
      (err) => err instanceof ApiError && err.status === 401,
    );
  } finally {
    restore();
  }
});

test("apiRequest: в запрос передаются заголовок Authorization и no-store", async () => {
  let captured = null;
  const restore = mockFetch(async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, json: async () => [] };
  });
  try {
    await getProjects("secret-token");
    assert.ok(captured, "fetch должен быть вызван");
    assert.equal(captured.init.headers.Authorization, "Bearer secret-token");
    assert.equal(captured.init.cache, "no-store");
  } finally {
    restore();
  }
});
