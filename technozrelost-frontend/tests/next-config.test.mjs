import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const FRONTEND_DIR = fileURLToPath(new URL("..", import.meta.url));

function runConfig(env) {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "const { default: config } = await import('./next.config.ts'); " +
        "console.log(JSON.stringify(await config.rewrites()));",
    ],
    { cwd: FRONTEND_DIR, env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("production next.config.ts без API_URL_INTERNAL завершается понятной ошибкой", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", "import('./next.config.ts')"],
    { cwd: FRONTEND_DIR, env: { NODE_ENV: "production" }, encoding: "utf8" },
  );

  assert.notEqual(result.status, 0, "production-конфиг не должен включать rewrite fallback");
  assert.match(`${result.stdout}\n${result.stderr}`, /API_URL_INTERNAL/);
});

test("dev next.config.ts без API_URL_INTERNAL использует localhost rewrite", () => {
  const [rewrite] = runConfig({ NODE_ENV: "development" });

  assert.equal(rewrite.destination, "http://127.0.0.1:8000/api/v1/:path*");
});

test("production next.config.ts нормализует API_URL_INTERNAL в rewrite", () => {
  const [rewrite] = runConfig({
    NODE_ENV: "production",
    API_URL_INTERNAL: "http://backend:8000/",
  });

  assert.equal(rewrite.destination, "http://backend:8000/api/v1/:path*");
});
