/**
 * Security-заголовки next.config.ts (OWASP-базовая линия, тикет 03).
 * Проверяем через публичный интерфейс конфига: headers() возвращает набор,
 * обязательный для B2G-деплоя.
 */
import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../next.config.ts";

function headerMap(entries) {
  return new Map(entries.map((h) => [h.key.toLowerCase(), h.value]));
}

test("headers(): заданы обязательные защитные заголовки для всех маршрутов", async () => {
  const entries = await nextConfig.headers();
  const all = entries.flatMap((e) => e.headers);
  const map = headerMap(all);

  for (const key of [
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "strict-transport-security",
    "content-security-policy",
    "permissions-policy",
  ]) {
    assert.ok(map.has(key), `нет заголовка ${key}`);
    assert.ok(map.get(key).length > 0, `пустое значение ${key}`);
  }
});

test("headers(): CSP запрещает фрейминг, объекты и чужие скрипты кроме self", async () => {
  const entries = await nextConfig.headers();
  const all = entries.flatMap((e) => e.headers);
  const csp = headerMap(all).get("content-security-policy") ?? "";

  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /default-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*https?:\/\//, "чужие хосты в script-src");
});

test("headers(): заголовки покрывают все маршруты", async () => {
  const entries = await nextConfig.headers();
  assert.ok(entries.length >= 1);
  assert.equal(entries[0].source, "/:path*");
});
