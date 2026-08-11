/**
 * Поведенческие тесты API-клиента узких кабинетов (тикет 03):
 * реальные вызовы fetch (mock) — ошибки 403/404 → ApiError со статусом,
 * успешный путь возвращает данные. «Ошибка никогда не выглядит как успех».
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  decideControlPoint,
  getProjectRegistry,
  joinProject,
  uploadVerificationDoc,
} from "../src/lib/api-client.ts";

function mockFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

test("decideControlPoint: 403 → ApiError(403) с detail backend (не «успех»)", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 403,
    json: async () => ({ detail: "Недостаточно прав для решения по КТ" }),
  }));
  try {
    await assert.rejects(
      decideControlPoint("token", 1, 2, { status: "approved", decision: "ТЭО обосновано" }),
      (err) =>
        err instanceof ApiError &&
        err.status === 403 &&
        /Недостаточно прав/.test(err.message),
    );
  } finally {
    restore();
  }
});

test("decideControlPoint: 404 → ApiError(404) (чужая/несуществующая КТ)", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ detail: "Контрольная точка не найдена" }),
  }));
  try {
    await assert.rejects(
      decideControlPoint("token", 1, 999, { status: "rejected" }),
      (err) => err instanceof ApiError && err.status === 404,
    );
  } finally {
    restore();
  }
});

test("uploadVerificationDoc: 403 до вступления по токену → ApiError(403)", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 403,
    json: async () => ({ detail: "Сначала присоединитесь к проекту по токену TZ-XXXXXX" }),
  }));
  try {
    await assert.rejects(
      uploadVerificationDoc("token", 5, { title: "Акт внедрения" }),
      (err) =>
        err instanceof ApiError &&
        err.status === 403 &&
        /присоединитесь/.test(err.message),
    );
  } finally {
    restore();
  }
});

test("joinProject: неверный токен → ApiError(404) «Токен недействителен»", async () => {
  const restore = mockFetch(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ detail: "Токен недействителен" }),
  }));
  try {
    await assert.rejects(
      joinProject("token", { token: "TZ-000000", role_in_project: "auditor" }),
      (err) =>
        err instanceof ApiError &&
        err.status === 404 &&
        /Токен/.test(err.message),
    );
  } finally {
    restore();
  }
});

test("getProjectRegistry: 200 → список RegistryProject из JSON", async () => {
  const restore = mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => [
      {
        id: 1,
        name: "Технология",
        category: null,
        current_level: 7,
        preliminary_level: null,
        target_level: 9,
        budget: 120.5,
        organization: "ООО РД",
        is_public: true,
        show_preliminary: false,
        published_at: null,
        created_at: "2026-08-01T10:00:00",
      },
    ],
  }));
  try {
    const list = await getProjectRegistry("token", { ugt_min: 7 });
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Технология");
    assert.equal(list[0].current_level, 7);
  } finally {
    restore();
  }
});

test("joinProject: 200 active → JoinProjectResult с project (успешный путь)", async () => {
  const restore = mockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      status: "active",
      project: { id: 42, name: "Проект" },
    }),
  }));
  try {
    const result = await joinProject("token", {
      token: "TZ-ABC123",
      role_in_project: "serial_manufacturer",
    });
    assert.equal(result.status, "active");
    assert.equal(result.project?.id, 42);
  } finally {
    restore();
  }
});
