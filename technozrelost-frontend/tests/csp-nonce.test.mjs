/**
 * P3 (таск 15, R06i): CSP-nonce в SSR — скрипты грузятся без нарушений.
 * Шов — публичный интерфейс next.config (buildCsp/headers) + исходник
 * middleware как носитель per-request nonce (SPEC-06: CSP — единственный
 * носитель, x-nonce удалён по TICKET-13).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import nextConfig, { buildCsp } from "../next.config.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function scriptSrc(csp) {
  const m = csp.match(/script-src[^;]*/);
  assert.ok(m, "нет script-src в CSP");
  return m[0];
}

test("buildCsp(nonce): script-src с nonce, без unsafe-inline, со strict-dynamic", () => {
  const csp = buildCsp("dGVzdG5vbmNlMTIzNDU2");
  const script = scriptSrc(csp);
  assert.match(script, /'nonce-dGVzdG5vbmNlMTIzNDU2'/);
  assert.match(script, /'strict-dynamic'/);
  assert.match(script, /'self'/);
  assert.doesNotMatch(script, /unsafe-inline/, "инлайн-скрипты запрещены (только nonce)");
});

test("headers(): fallback CSP без unsafe-inline в script-src", async () => {
  const entries = await nextConfig.headers();
  const csp = entries.flatMap((e) => e.headers).find((h) => h.key === "Content-Security-Policy").value;
  const script = scriptSrc(csp);
  assert.doesNotMatch(script, /unsafe-inline/);
  assert.match(script, /'strict-dynamic'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /upgrade-insecure-requests/);
});

test("middleware: per-request nonce в CSP, x-nonce отсутствует", () => {
  const source = read("src/middleware.ts");
  assert.match(source, /makeNonce\(\)/);
  assert.match(source, /buildCsp\(nonce\)/);
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /nonce-\$\{nonce\}/);
  assert.doesNotMatch(source, /x-nonce/, "TICKET-13: x-nonce удалён, носитель — только CSP");
  // ADR-0014: unsafe-inline разрешён только в style-src (Tailwind); в script-src его быть не должно.
  const scriptLine = source.split("\n").find((l) => l.includes("script-src"));
  assert.ok(scriptLine, "нет script-src в middleware");
  assert.doesNotMatch(scriptLine, /unsafe-inline/, "инлайн-скрипты запрещены (только nonce)");
});
