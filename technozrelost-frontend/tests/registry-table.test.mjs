import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test("registry table view: core files exist (P3 R02)", () => {
  for (const f of [
    "src/features/registry/RegistryTable.tsx",
    "src/features/registry/RegistryViewToggle.tsx",
    "src/features/registry/useRegistryView.ts",
  ]) {
    assert.ok(exists(f), `missing ${f}`);
  }
});

test("registry table: колонки ID/Название/УГТ/Статус/Бюджет/Действия", () => {
  const src = read("src/features/registry/RegistryTable.tsx");
  for (const col of ["ID", "Название", "УГТ", "Статус", "Бюджет", "Действия"]) {
    assert.ok(src.includes(col), `колонка ${col} не найдена`);
  }
  // таблица рендерит те же данные что карточки — принимает items как RegistryGrid
  assert.match(src, /items/);
  assert.match(src, /RegistryProjectOut|getName|getId/);
  // бюджет формат
  assert.match(src, /formatBudget|Intl\.NumberFormat/);
  // статус бейдж
  assert.match(src, /getStatusBadge|getStatusLabel/);
  // избранное
  assert.match(src, /FavoriteStar|isFavorite|onToggleFavorite/);
  // пагинация Показать ещё
  assert.match(src, /Показать ещё|hasMore|onLoadMore/);
  // обработка loading/error/empty/403 как у grid
  assert.match(src, /RegistryTableSkeleton|Skeleton/);
  assert.match(src, /ErrorState/);
  assert.match(src, /Empty|tz-empty/);
  assert.match(src, /403/);
});

test("registry table: сортировка кликом по заголовку", () => {
  const src = read("src/features/registry/RegistryTable.tsx");
  // клик по заголовку меняет сортировку
  assert.match(src, /handleSort|onClick.*handleSort/);
  assert.match(src, /sortKey|sortDir/);
  assert.match(src, /aria-sort/);
  // ключи сортировки
  assert.match(src, /"id"|sort.*id/);
  assert.match(src, /"name"|getName/);
  assert.match(src, /"ugt"|getUgtCurrent/);
  assert.match(src, /"status"|getStatus/);
  assert.match(src, /"budget"|getBudgetValue/);
  // индикатор сортировки
  assert.match(src, /ChevronUp|ChevronDown|ArrowUpDown/);
  // localeCompare для имени, numeric для бюджета
  assert.match(src, /localeCompare/);
});

test("registry view toggle: карточки ↔ таблица", () => {
  const toggle = read("src/features/registry/RegistryViewToggle.tsx");
  assert.match(toggle, /RegistryViewToggle/);
  assert.match(toggle, /cards/);
  assert.match(toggle, /table/);
  assert.match(toggle, /Карточки/);
  assert.match(toggle, /Таблица/);
  assert.match(toggle, /aria-pressed/);
  assert.match(toggle, /LayoutGrid/);
  assert.match(toggle, /Table/);
  // роль group для доступности
  assert.match(toggle, /role="group"/);

  const hook = read("src/features/registry/useRegistryView.ts");
  assert.match(hook, /useRegistryView/);
  assert.match(hook, /tz:registry:view:/);
  assert.match(hook, /localStorage/);
  // per-registry изоляция
  assert.match(hook, /registryKey/);
});

test("registry index: реэкспорт RegistryTable + Toggle + hook", () => {
  const idx = read("src/features/registry/index.ts");
  assert.match(idx, /RegistryTable/);
  assert.match(idx, /RegistryViewToggle/);
  assert.match(idx, /useRegistryView/);
  assert.match(idx, /RegistryView/);
});

test("registry pages: projects + technologies используют toggle и table (те же данные что карточки)", () => {
  for (const p of [
    "src/app/dashboard/projects/page.tsx",
    "src/app/dashboard/technologies/page.tsx",
  ]) {
    const src = read(p);
    assert.match(src, /RegistryViewToggle/, `${p} должен импортировать RegistryViewToggle`);
    assert.match(src, /RegistryTable/, `${p} должен импортировать RegistryTable`);
    assert.match(src, /useRegistryView/, `${p} должен использовать useRegistryView`);
    assert.match(src, /RegistryGrid/, `${p} должен сохранить RegistryGrid для карточек`);
    // переключение view === "cards" ? grid : table
    assert.match(src, /view === "cards"/, `${p} переключение карточки ↔ таблица`);
    assert.match(src, /displayItems/, `${p} таблица рендерит те же данные что карточки (displayItems)`);
    // сортировка по дате ↓ остаётся в useRegistry, таблица добавляет свою
    assert.match(src, /isFavorite|onToggleFavorite/, `${p} избранное прокидывается в таблицу`);
  }
});

test("registry pages: organizations/nioktr/executors также имеют toggle (изолированно per-registry)", () => {
  for (const p of [
    "src/app/dashboard/organizations/page.tsx",
    "src/app/dashboard/nioktr/page.tsx",
    "src/app/dashboard/executors/page.tsx",
  ]) {
    const src = read(p);
    assert.match(src, /RegistryViewToggle/, `${p} должен иметь тумблер`);
    assert.match(src, /useRegistryView/, `${p} должен использовать useRegistryView`);
    assert.match(src, /RegistryTable/, `${p} должен иметь табличный вид`);
    assert.match(src, /RegistryGrid/, `${p} должен сохранить карточки`);
  }
});
