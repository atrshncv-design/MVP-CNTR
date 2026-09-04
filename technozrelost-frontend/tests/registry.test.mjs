import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test("registry unification: core files exist", () => {
  for (const f of [
    "src/features/registry/index.ts",
    "src/features/registry/useRegistry.ts",
    "src/features/registry/useRealtime.ts",
    "src/features/registry/FilterBar.tsx",
    "src/features/registry/RegistryGrid.tsx",
    "src/features/registry/RegistryCard.tsx",
    "src/features/registry/FavoriteStar.tsx",
    "src/features/registry/favorites.ts",
  ]) {
    assert.ok(exists(f), `missing ${f}`);
  }
});

test("registry api-client: getRegistry with tags → URL contains tags, limit 20, after_id", () => {
  const src = read("src/lib/api-client.ts");
  assert.match(src, /getRegistry/);
  assert.match(src, /tags/);
  assert.match(src, /after_id/);
  assert.match(src, /limit/);
  // должен пробрасывать tags как repeated или category
  assert.match(src, /qs\.append\("tags"/);
});

test("registry filters: 30+ tags справочник, 1-5 выбор", () => {
  const types = read("src/lib/types.ts");
  assert.match(types, /PROJECT_TAGS/);
  // 32 тега живут в словаре taxonomy (обе локали), lib резолвит их через перевод
  const ru = JSON.parse(read("src/messages/ru.json"));
  const en = JSON.parse(read("src/messages/en.json"));
  assert.ok(Array.isArray(ru.taxonomy.tags) && ru.taxonomy.tags.length >= 30, "должно быть 30+ тегов");
  assert.equal(ru.taxonomy.tags.length, en.taxonomy.tags.length);
  assert.equal(ru.taxonomy.tags[0], "AI/ML");
  assert.match(types, /TAGS_MAX = 5/);
  assert.match(types, /TAGS_MIN = 1/);
  assert.match(types, /getProjectTags|taxonomy/);

  const filterBar = read("src/features/registry/FilterBar.tsx");
  assert.match(filterBar, /PROJECT_TAGS/);
  assert.match(filterBar, /1-5|5/);
  assert.match(filterBar, /Поиск по тегам/);
});

test("registry filters serialization: search+tags+ugt+status+region+budget in URL", () => {
  const filters = read("src/lib/filters.ts");
  assert.match(filters, /serializeRegistryParams/);
  assert.match(filters, /search/);
  assert.match(filters, /tags/);
  assert.match(filters, /ugt_min/);
  assert.match(filters, /ugt_max/);
  assert.match(filters, /status/);
  assert.match(filters, /region/);
  assert.match(filters, /budget_min/);
  assert.match(filters, /budget_max/);
  assert.match(filters, /after_id/);
  // дебаунс 300ms
  assert.match(filters, /useDebouncedValue/);
  assert.match(filters, /300/);
});

test("registry useRegistry: limit 20, keyset after_id, status TODO, realtime, сортировка по дате", () => {
  const src = read("src/features/registry/useRegistry.ts");
  assert.match(src, /LIMIT = 20/);
  assert.match(src, /after_id/);
  assert.match(src, /getRegistry/);
  assert.match(src, /sortByUpdatedDesc|updated_at/);
  assert.match(src, /TODO.*status/);
  assert.match(src, /useRealtime/);
  assert.match(src, /useDebouncedValue.*300/);
});

test("registry favorites: localStorage tz:favorites:{registry} + FavoriteStar", () => {
  const fav = read("src/features/registry/favorites.ts");
  assert.match(fav, /tz:favorites:/);
  assert.match(fav, /localStorage/);
  assert.match(fav, /toggleFavorite/);
  assert.match(fav, /useFavorites/);

  const star = read("src/features/registry/FavoriteStar.tsx");
  assert.match(star, /aria-pressed/);
  assert.match(star, /Star/);

  const card = read("src/features/registry/RegistryCard.tsx");
  assert.match(card, /FavoriteStar/);
  assert.match(card, /isFavorite/);
});

test("registry grid: skeleton 6, empty tz-empty CTA, error Retry, 403, drawer, 1 колонка", () => {
  const grid = read("src/features/registry/RegistryGrid.tsx");
  assert.match(grid, /RegistrySkeleton/);
  assert.match(grid, /count = 6/);
  assert.match(grid, /tz-empty/);
  assert.match(grid, /Пока нет проектов — создайте заявку/);
  assert.match(grid, /ErrorState/);
  assert.match(grid, /onRetry/);
  assert.match(grid, /403/);
  assert.match(grid, /grid-cols-1/);
  assert.match(grid, /md:grid-cols-2/);
  assert.match(grid, /Показать ещё/);

  const errorComp = read("src/components/ui/error.tsx");
  assert.match(errorComp, /Повторить/);

  const fb = read("src/features/registry/FilterBar.tsx");
  assert.match(fb, /Drawer/);
  assert.match(fb, /lg:hidden/);
  assert.match(fb, /Фильтры/);
});

test("registry realtime: SSE /notifications/stream + fallback polling 5s", () => {
  const rt = read("src/features/registry/useRealtime.ts");
  assert.match(rt, /EventSource/);
  assert.match(rt, /\/notifications\/sse-ticket/);
  assert.match(rt, /\/notifications\/stream/);
  assert.match(rt, /5000|5_000|intervalMs/);
  assert.match(rt, /setInterval/);
});

test("technologies = projects: ugt_min 7, без мок CATEGORIES, бюджет, дата 31.03.2027 + тултип 2 дня назад, лимит 20", () => {
  const tech = read("src/app/dashboard/technologies/page.tsx");
  assert.match(tech, /ugt_min.*7/);
  assert.doesNotMatch(tech, /const CATEGORIES = \[.*"AI\/ML".*"НИОКТР"/);
  assert.match(tech, /RegistryCard/);
  assert.match(tech, /RegistryGrid/);
  assert.match(tech, /FilterBar/);
  assert.match(tech, /useRegistry/);

  const card = read("src/features/registry/RegistryCard.tsx");
  assert.match(card, /formatBudget|budget/);
  assert.match(card, /formatShortDate/);
  assert.match(card, /formatRelative/);
  // тултип 2 дня назад через title
  assert.match(card, /title=\{relative/);
});

test("projects registry: uses unified components, no STATUS_LABELS dup, budget, sorting", () => {
  const proj = read("src/app/dashboard/projects/page.tsx");
  assert.match(proj, /FilterBar/);
  assert.match(proj, /RegistryGrid/);
  assert.match(proj, /RegistryCard/);
  assert.match(proj, /useRegistry/);
  assert.match(proj, /useFavorites/);
  // STATUS_LABELS должен быть из lib/status, а не локальный
  assert.doesNotMatch(proj, /const STATUS_LABELS/);
  const card = read("src/features/registry/RegistryCard.tsx");
  assert.match(card, /getStatusBadge|getStatusLabel/);
  assert.match(card, /from "@\/lib\/status"/);
});

test("organizations/nioktr/executors use unified registry grid + filter + realtime + favorites + 1 колонка", () => {
  for (const p of [
    "src/app/dashboard/organizations/page.tsx",
    "src/app/dashboard/nioktr/page.tsx",
    "src/app/dashboard/executors/page.tsx",
  ]) {
    const src = read(p);
    assert.match(src, /RegistryGrid/, `${p} должен использовать RegistryGrid`);
    assert.match(src, /FilterBar/, `${p} должен использовать FilterBar`);
    assert.match(src, /useRealtime/, `${p} должен использовать useRealtime`);
    assert.match(src, /useFavorites|tz:favorites/, `${p} должен использовать избранное`);
    assert.match(src, /LIMIT = 20/, `${p} лимит 20`);
    assert.match(src, /Показать ещё|hasMore|loadMore/);
    // мобилка 1 колонка обеспечивается grid внутри RegistryGrid, а drawer в FilterBar
  }
});

test("lib deps: registry uses types/status/filters/api-client from 01", () => {
  const ur = read("src/features/registry/useRegistry.ts");
  assert.match(ur, /from "@\/lib\/api-client"/);
  assert.match(ur, /from "@\/lib\/filters"/);
  assert.match(ur, /from "@\/lib\/types"/);
  const fb = read("src/features/registry/FilterBar.tsx");
  assert.match(fb, /from "@\/lib\/types"/);
  assert.match(fb, /from "@\/lib\/status"/);
  const card = read("src/features/registry/RegistryCard.tsx");
  assert.match(card, /from "@\/lib\/status"/);
  assert.match(card, /from "@\/lib\/format-date"/);
});
