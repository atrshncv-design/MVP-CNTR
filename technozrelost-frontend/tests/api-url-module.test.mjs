/**
 * FE-02 / истории R03, R03.1: единый модуль адреса API (src/lib/public-api.ts).
 *
 * Гарантии:
 * - в src/ не осталось литералов http://127.0.0.1:8000 и http://localhost:8000
 *   (в клиентский бандл физически не может зашиться чужой localhost);
 * - переменные окружения адреса API читаются ТОЛЬКО в едином модуле;
 * - браузерная база по умолчанию относительная (тот же origin через rewrites),
 *   NEXT_PUBLIC_API_URL — опциональный оверрайд;
 * - serverApiBase() без API_URL_INTERNAL падает с понятной ошибкой —
 *   production-сборка без конфигурации не должна «работать» на fallback.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));

function collectSources(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectSources(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("в src/ нет литералов localhost/127.0.0.1:8000", () => {
  const offenders = collectSources(SRC_DIR).filter((path) =>
    /(127\.0\.0\.1|localhost):8000/.test(readFileSync(path, "utf8")),
  );
  assert.deepEqual(
    offenders,
    [],
    "адрес API берётся из src/lib/public-api.ts, а не зашивается в файлы",
  );
});

test("переменные адреса API читаются только в едином модуле", () => {
  const modulePath = join(SRC_DIR, "lib", "public-api.ts");
  const offenders = collectSources(SRC_DIR).filter(
    (path) =>
      path !== modulePath &&
      /process\.env\.(NEXT_PUBLIC_API_URL|API_URL_INTERNAL)/.test(
        readFileSync(path, "utf8"),
      ),
  );
  assert.deepEqual(offenders, [], "импорт адреса API — только из lib/public-api.ts");
});

test("браузерная база: по умолчанию тот же origin, оверрайд учитывается", async () => {
  delete process.env.NEXT_PUBLIC_API_URL;
  const sameOrigin = await import("../src/lib/public-api.ts?same-origin");
  assert.equal(sameOrigin.CLIENT_API_BASE, "");

  process.env.NEXT_PUBLIC_API_URL = "  https://api.example.com/// ";
  try {
    const overridden = await import("../src/lib/public-api.ts?override");
    assert.equal(overridden.CLIENT_API_BASE, "https://api.example.com");
  } finally {
    delete process.env.NEXT_PUBLIC_API_URL;
  }
});

test("serverApiBase(): без API_URL_INTERNAL — понятная ошибка вместо fallback", async () => {
  delete process.env.API_URL_INTERNAL;
  const mod = await import("../src/lib/public-api.ts?no-env");
  assert.throws(() => mod.serverApiBase(), /API_URL_INTERNAL/);
});

test("serverApiBase(): возвращает внутренний адрес без хвостового слэша", async () => {
  process.env.API_URL_INTERNAL = "http://backend:8000/";
  try {
    const mod = await import("../src/lib/public-api.ts?with-env");
    assert.equal(mod.serverApiBase(), "http://backend:8000");
  } finally {
    delete process.env.API_URL_INTERNAL;
  }
});

test("клиентские consumers не обходят базу API", () => {
  const modulePath = join(SRC_DIR, "lib", "public-api.ts");
  const consumerSources = collectSources(SRC_DIR).filter((path) => path !== modulePath);
  const directFetches = consumerSources.filter((path) =>
    /fetch\s*\(\s*[`'"]\/api\/v1/.test(readFileSync(path, "utf8")),
  );
  const directAssignments = consumerSources.filter((path) =>
    /(?:const|let)\s+\w+\s*=\s*[^;\n]*[`'"]\/api\/v1/.test(
      readFileSync(path, "utf8"),
    ),
  );

  assert.deepEqual(directFetches, [], "fetch URL должен начинаться с CLIENT_API_BASE");
  assert.deepEqual(
    directAssignments,
    [],
    "путь API нельзя собирать из сырого /api/v1 без модуля",
  );
});
