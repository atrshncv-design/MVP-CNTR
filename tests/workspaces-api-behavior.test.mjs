/**
 * Поведенческие тесты API-клиента кабинетов (тикет 02):
 * реальные вызовы fetch (mock) — ошибки 400/403/429 → ApiError со статусом,
 * успешный путь возвращает данные. «Ошибка никогда не выглядит как успех».
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  decideManagerDraft,
  getAdminAudit,
  getAdminUsers,
  updateAdminUser,
} from "../src/lib/api-client.ts";

function mockFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

test("decideManagerDraft: 400 → ApiError(400) с detail backend (не «успех»)", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 400,
    json: async () => ({ detail: "Уровень УГТ вне диапазона 1–9" }),
  }));
  try {
    await assert.rejects(
      decideManagerDraft("token", 42, { approve: true, level: 99 }),
      (err) =>
        err instanceof ApiError &&
        err.status === 400 &&
        /УГТ/.test(err.message),
    );
  } finally {
    restore();
  }
});

test("updateAdminUser: 403 → ApiError(403) — роль без прав не «сохраняется»", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 403,
    json: async () => ({ detail: "Недостаточно прав" }),
  }));
  try {
    await assert.rejects(
      updateAdminUser("token", 7, { roles: ["cntr_admin"], is_active: true }),
      (err) => err instanceof ApiError && err.status === 403,
    );
  } finally {
    restore();
  }
});

test("getAdminAudit: 429 → ApiError(429) (rate limit не выглядит как успех)", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 429,
    json: async () => ({ detail: "Too Many Requests" }),
  }));
  try {
    await assert.rejects(
      getAdminAudit("token"),
      (err) => err instanceof ApiError && err.status === 429,
    );
  } finally {
    restore();
  }
});

test("getAdminUsers: 200 → список пользователей из JSON", async () => {
  const restore = mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { id: 1, email: "a@example.com", full_name: "А", is_active: true, roles: [] },
    ],
  }));
  try {
    const users = await getAdminUsers("token");
    assert.equal(users.length, 1);
    assert.equal(users[0].email, "a@example.com");
  } finally {
    restore();
  }
});

test("decideManagerDraft: 200 → отправляет POST c approve/level и Bearer-токеном", async () => {
  let captured = null;
  const restore = mockFetch(async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 42, name: "Проект", status: "published" }),
    };
  });
  try {
    const draft = await decideManagerDraft("secret", 42, {
      approve: true,
      level: 5,
    });
    assert.equal(draft.id, 42);
    assert.equal(captured.init.method, "POST");
    assert.equal(captured.init.headers.Authorization, "Bearer secret");
    const body = JSON.parse(captured.init.body);
    assert.equal(body.approve, true);
    assert.equal(body.level, 5);
  } finally {
    restore();
  }
});
