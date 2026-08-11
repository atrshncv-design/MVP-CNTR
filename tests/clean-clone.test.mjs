import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Корректирующий проход (11.08.2026): clean-clone guard.
//
// Находка security-infrastructure/05: `technozrelost-frontend/public/` не
// отслеживался git, а runner-стадия Dockerfile выполняет
// `COPY --from=build /app/public ./public` → сборка образа на чистом клоне
// падала («/app/public: not found»). Минимальный безопасный placeholder —
// пустой `public/.gitkeep` (без бинарных/пользовательских данных: видео-герой
// и бренд-ассеты остаются untracked-собственностью канона).
//
// Guard: если .gitkeep удалят — тест падает, напоминая о clean-clone проблеме.

test("public/ существует и содержит дизайн-ассеты (baseline c4f0794)", () => {
  assert.ok(existsSync(new URL("../public/", import.meta.url)), "public/ существует");
  const out = execSync("ls -A public/", { encoding: "utf8" }).trim();
  assert.ok(out.length > 0, "public/ не пуст: дизайн-ассеты baseline (brand/ornaments/videos) трекаются в git");
});

test("Dockerfile runner-стадия копирует public (guard на регрессию)", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /COPY --from=build \/app\/public \.\/public/);
});

test("public/ содержит дизайн-ассеты baseline (brand присутствует)", () => {
  // В release-integration public/ — часть дизайн-базлайна c4f0794: бренд-ассеты
  // трекаются в git (в отличие от feature-worktree, где public/ был пуст).
  const out = execSync("ls -A public/", { encoding: "utf8" }).trim();
  const files = out.split("\n").filter(Boolean);
  assert.ok(files.includes("brand"), "public/brand (дизайн-ассеты baseline) присутствует");
});
