import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test("saved-filters: module files exist with correct zone", () => {
  for (const f of [
    "src/features/registry/saved-filters/index.ts",
    "src/features/registry/saved-filters/storage.ts",
    "src/features/registry/saved-filters/useSavedFilters.ts",
    "src/features/registry/saved-filters/SavedFilters.tsx",
  ]) {
    assert.ok(exists(f), `missing ${f}`);
  }
  // barrel exposes useSavedFilters and hides backend/localStorage
  const barrel = read("src/features/registry/saved-filters/index.ts");
  assert.match(barrel, /useSavedFilters/);
  assert.match(barrel, /SAVED_FILTERS_KEY|SavedFilters/);
});

test("saved-filters: api-client exposes getSavedFilters/saveFilter/deleteFilter with /filters/saved", () => {
  const src = read("src/lib/api-client.ts");
  assert.match(src, /getSavedFilters/);
  assert.match(src, /saveFilter/);
  assert.match(src, /deleteFilter/);
  assert.match(src, /\/filters\/saved/);
  // POST and DELETE variants
  assert.match(src, /method:\s*"POST"/);
  assert.match(src, /method:\s*"DELETE"/);
  assert.match(src, /SavedFilterOut/);
  assert.match(src, /SavedFilterIn/);
  // aliases for ticket criterion
  assert.match(src, /createSavedFilter|deleteSavedFilter|getSavedFiltersList/);
});

test("saved-filters: storage fallback localStorage tz:saved-filters without limit", () => {
  const storage = read("src/features/registry/saved-filters/storage.ts");
  assert.match(storage, /tz:saved-filters/);
  assert.match(storage, /SAVED_FILTERS_KEY/);
  assert.match(storage, /localStorage/);
  assert.match(storage, /readLocalSavedFilters/);
  assert.match(storage, /writeLocalSavedFilters/);
  assert.match(storage, /addLocalSavedFilter/);
  assert.match(storage, /removeLocalSavedFilter/);
  assert.match(storage, /BLOCKED_REASON/);
  assert.match(storage, /BLOCKED: filters\/saved/);
  // без лимита — не должно быть slice/truncate/limit 5 etc
  assert.doesNotMatch(storage, /slice\(0,\s*5\)/);
  assert.doesNotMatch(storage, /slice\(0,\s*20\)/);
  assert.doesNotMatch(storage, /MAX.*5/);
  // ensure json parse and array filter
  assert.match(storage, /JSON\.parse/);
  assert.match(storage, /JSON\.stringify/);
});

test("saved-filters: useSavedFilters tries api-client then fallback on 404 with BLOCKED mark and hides backend vs localStorage", () => {
  const hook = read("src/features/registry/saved-filters/useSavedFilters.ts");
  assert.match(hook, /useSavedFilters/);
  assert.match(hook, /getSavedFilters/);
  assert.match(hook, /saveFilter/);
  assert.match(hook, /deleteFilter/);
  assert.match(hook, /404/);
  assert.match(hook, /isFallback/);
  assert.match(hook, /blockedReason/);
  assert.match(hook, /BLOCKED_REASON/);
  assert.match(hook, /localStorage|readLocalSavedFilters/);
  assert.match(hook, /tz:saved-filters/);
  // hides backend vs localStorage — должен импортировать из storage и api-client
  assert.match(hook, /from "@\/lib\/api-client"/);
  assert.match(hook, /from ".\/storage"/);
  // без лимита — не обрезает массив
  assert.doesNotMatch(hook, /\.slice\(0,.*5\)/);
  // помечает BLOCKED в отчёте — window flag + console.warn
  assert.match(hook, /__TZ_BLOCKED_filters_saved/);
  assert.match(hook, /console\.warn/);
  // api error handling via ApiError
  assert.match(hook, /ApiError/);
});

test("saved-filters: UI — кнопка Сохранить фильтр → ввод имени → список Мои фильтры → клик применяет, крестик удаляет, без лимита", () => {
  const ui = read("src/features/registry/saved-filters/SavedFilters.tsx");
  assert.match(ui, /Сохранить фильтр/);
  assert.match(ui, /saved-filters-input/);
  assert.match(ui, /Имя фильтра|Название фильтра/);
  assert.match(ui, /Мои фильтры/);
  assert.match(ui, /saved-filters-list/);
  assert.match(ui, /saved-filter-apply/);
  assert.match(ui, /saved-filter-delete/);
  // крестик — X icon
  assert.match(ui, /<X /);
  assert.match(ui, /onApply/);
  assert.match(ui, /handleApply|onApply/);
  assert.match(ui, /handleDelete|remove/);
  // без лимита — не ограничивает рендер
  assert.doesNotMatch(ui, /slice\(0,\s*5\)/);
  assert.doesNotMatch(ui, /slice\(0,\s*10\)/);
  // data-testid for saved filter item
  assert.match(ui, /saved-filter-item/);
  // fallback badge BLOCKED
  assert.match(ui, /saved-filters-blocked/);
  assert.match(ui, /BLOCKED|local/);
  // uses useSavedFilters hook
  assert.match(ui, /useSavedFilters/);
});

test("saved-filters: FilterBar integrates SavedFilters and registry/index re-exports", () => {
  const fb = read("src/features/registry/FilterBar.tsx");
  assert.match(fb, /SavedFilters/);
  assert.match(fb, /from ".\/saved-filters"/);

  const idx = read("src/features/registry/index.ts");
  assert.match(idx, /SavedFilters/);
  assert.match(idx, /useSavedFilters/);
  assert.match(idx, /SAVED_FILTERS_KEY/);
});

test("saved-filters mock: getSavedFilters 404 → fallback localStorage tz:saved-filters, save without limit", async () => {
  // Поведенческий мок — проверяем api-client бросает 404 и storage fallback работает без лимита
  process.env.API_URL_INTERNAL ??= "http://api.test:9999";

  // Mock fetch for api-client
  const originalFetch = globalThis.fetch;
  let fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    // Simulate 404 for /filters/saved
    if (String(url).includes("/filters/saved")) {
      return { ok: false, status: 404, json: async () => ({ detail: "Not Found" }) };
    }
    return { ok: true, status: 200, json: async () => [] };
  };

  // Dynamic import after mock — need to import fresh? Use already cached module but fetch mock affects calls
  const { ApiError, getSavedFilters, saveFilter, deleteFilter } = await import("../src/lib/api-client.ts");

  try {
    // getSavedFilters should throw ApiError 404
    await assert.rejects(
      () => getSavedFilters("token-123"),
      (err) => err instanceof ApiError && err.status === 404,
    );
    // saveFilter also 404
    await assert.rejects(
      () => saveFilter({ name: "test", filters: { search: "foo" } }, "token-123"),
      (err) => err instanceof ApiError && err.status === 404,
    );
    await assert.rejects(
      () => deleteFilter("123", "token-123"),
      (err) => err instanceof ApiError && err.status === 404,
    );

    // Verify fetch was called with Bearer and /filters/saved
    assert.ok(fetchCalls.some((c) => c.url.includes("/filters/saved")));
    const authHeader = fetchCalls.find((c) => c.url.includes("/filters/saved"))?.init?.headers?.Authorization;
    assert.equal(authHeader, "Bearer token-123");

    // Now test localStorage fallback without limit — simulate storage behavior
    // Mock window.localStorage for storage helpers
    const store = new Map();
    // @ts-expect-error emulate window for storage module
    globalThis.window = {
      localStorage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    // Also need window as global for storage import (it already imported but functions read window at call time)
    const { addLocalSavedFilter, readLocalSavedFilters, removeLocalSavedFilter, SAVED_FILTERS_KEY } = await import(
      "../src/features/registry/saved-filters/storage.ts"
    );
    assert.equal(SAVED_FILTERS_KEY, "tz:saved-filters");

    // Save without limit — add 10 filters, ensure all stored
    for (let i = 0; i < 10; i++) {
      addLocalSavedFilter(`Фильтр ${i}`, { search: `q${i}` });
    }
    let list = readLocalSavedFilters();
    assert.equal(list.length, 10, "без лимита — должно сохраниться 10");
    // Add 5 more — total 15, still without limit
    for (let i = 10; i < 15; i++) {
      addLocalSavedFilter(`Фильтр ${i}`, { search: `q${i}` });
    }
    list = readLocalSavedFilters();
    assert.equal(list.length, 15, "без лимита — должно сохраниться 15");
    // Remove one — deletes via крестик
    const firstId = list[0].id;
    removeLocalSavedFilter(firstId);
    list = readLocalSavedFilters();
    assert.equal(list.length, 14);
    assert.ok(!list.some((f) => String(f.id) === String(firstId)), "удаление через крестик");

    // Ensure raw localStorage key is tz:saved-filters
    assert.ok(store.has("tz:saved-filters"));
    const raw = store.get("tz:saved-filters");
    assert.ok(raw.includes("Фильтр"));

    // Verify storage file still marks BLOCKED reason
    const storageSrc = read("src/features/registry/saved-filters/storage.ts");
    assert.match(storageSrc, /BLOCKED: filters\/saved/);
  } finally {
    globalThis.fetch = originalFetch;
    // cleanup window mock if set
    // @ts-expect-error cleanup
    if (globalThis.window?.localStorage) delete globalThis.window;
  }
});
