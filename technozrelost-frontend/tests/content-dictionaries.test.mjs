import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));
const json = (p) => JSON.parse(read(p));

/**
 * Таск 01 (R01–R03): словарный фундамент + контентные данные.
 * Шов dictionaries: t(<неймспейс>.<ключ>[, параметры]) -> строка.
 * Неймспейсы таска: ugt, showcase, taxonomy — в ОБЕИХ парах словарей.
 */
test("content-dictionaries: неймспейсы ugt/showcase/taxonomy есть в ru+en обеих пар", () => {
  for (const f of ["src/messages/ru.json", "src/messages/en.json", "messages/ru.json", "messages/en.json"]) {
    assert.ok(exists(f), `missing ${f}`);
    const d = json(f);
    for (const ns of ["ugt", "showcase", "taxonomy"]) {
      assert.ok(d[ns] && typeof d[ns] === "object", `${f}: отсутствует неймспейс ${ns}`);
    }
    assert.ok(d.ugt.levels && typeof d.ugt.levels === "object", `${f}: ugt.levels отсутствует`);
    assert.ok(
      d.ugt.ugp && d.ugt.ugi && d.ugt.ugs && d.ugt.transitions,
      `${f}: ugt.ugp/ugi/ugs/transitions отсутствуют`,
    );
  }
});

function flat(o, pre = "") {
  const out = {};
  if (Array.isArray(o)) o.forEach((v, i) => Object.assign(out, flat(v, `${pre}.${i}`)));
  else if (o && typeof o === "object")
    for (const [k, v] of Object.entries(o)) Object.assign(out, flat(v, pre ? `${pre}.${k}` : k));
  else out[pre] = o;
  return out;
}

const CYR = /[А-Яа-яЁё]/;

test("content-dictionaries: ключи резолвятся в обеих локалях, EN без кириллицы, подстановки параметрами", () => {
  const ru = json("src/messages/ru.json");
  const en = json("messages/en.json");
  // spot-значения (факты данных, не код под тестом)
  assert.equal(ru.taxonomy.tags[0], "AI/ML");
  assert.equal(ru.taxonomy.tags.length, 32);
  assert.equal(ru.showcase.categories[1], "НИОКТР");
  assert.equal(en.showcase.categories[1], "R&D");
  assert.equal(ru.ugt.levels.l1.code, "УГТ 1");
  assert.equal(en.ugt.levels.l1.code, "TRL 1");
  assert.equal(ru.ugt.levels.l9.requirements.length, 5);
  assert.equal(en.ugt.levels.l9.requirements.length, 5);
  assert.equal(ru.showcase.projects.p3.region, "Воткинск");
  // EN отличается от RU там, где есть перевод (не тождественная копия)
  assert.notEqual(en.ugt.levels.l1.name, ru.ugt.levels.l1.name);
  assert.notEqual(en.taxonomy.tags[1], ru.taxonomy.tags[1]);
  // EN без кириллицы (кроме taxonomy.legacy — значения данных бэкенда,
  // и template — имена файлов-шаблонов, одинаковые в обеих локалях)
  for (const [ns, skip] of [["ugt", ["template"]], ["showcase", []], ["taxonomy", ["legacy"]]]) {
    for (const [k, v] of Object.entries(flat(en[ns]))) {
      if (typeof v !== "string" || skip.some((s) => k.split(".").includes(s))) continue;
      assert.ok(!CYR.test(v), `EN ${ns}.${k} содержит кириллицу: ${v.slice(0, 60)}`);
    }
  }
  // подстановки — ICU-параметрами, одинаково в обеих локалях
  for (const k of ["minTags", "maxTags", "unknownTags"]) {
    assert.match(ru.taxonomy.validation[k], /\{\w+\}/, `ru validation.${k} без параметра`);
    assert.match(en.taxonomy.validation[k], /\{\w+\}/, `en validation.${k} без параметра`);
  }
  assert.match(ru.taxonomy.validation.minTags, /\{min\}/);
  assert.match(ru.taxonomy.validation.unknownTags, /\{list\}/);
});

test("content-dictionaries: в src/lib/ugt-data.ts, showcase.ts, types.ts нет кириллических литералов", () => {
  for (const f of ["src/lib/ugt-data.ts", "src/lib/showcase.ts", "src/lib/types.ts"]) {
    const src = read(f);
    assert.ok(!CYR.test(src), `${f} содержит кириллицу вне словарей`);
  }
});

test("content-dictionaries: резолверы выставлены, подстановки параметрами, legacy-маппинг замкнут", () => {
  const ugt = read("src/lib/ugt-data.ts");
  const show = read("src/lib/showcase.ts");
  const types = read("src/lib/types.ts");
  for (const [f, src, names] of [
    ["ugt-data.ts", ugt, ["getUgtLevels", "getUgtLevel", "getUgpLevels", "getUgiLevels", "getUgsLevels", "getRoadmapTransitions", "getTransitionMonths"]],
    ["showcase.ts", show, ["getShowcaseProjects", "getShowcaseCategories", "getShowcaseCategoryLabel", "SHOWCASE_CATEGORY_SLUGS"]],
    ["types.ts", types, ["getProjectTags", "getTagLabel", "validateTagsT", "asTranslateFn", "TranslateFn"]],
  ]) {
    for (const n of names) assert.match(src, new RegExp(`export (const|function|type) ${n}`), `${f}: нет экспорта ${n}`);
  }
  // validateTagsT — через параметры t(), без склейки
  assert.match(types, /t\("validation\.minTags", \{[^}]*min[^}]*\}\)/);
  assert.match(types, /t\("validation\.unknownTags", \{[^}]*list[^}]*\}\)/);
  // замок индексов: legacy-значения указывают на позиции каталога
  const ru = json("src/messages/ru.json");
  assert.equal(ru.taxonomy.tags[11], "Промышленные технологии");
  assert.equal(ru.taxonomy.tags[19], "IT-системы");
  assert.equal(ru.taxonomy.tags[13], "Электроника");
  for (const [slug, idx] of [["nioktr", "11"], ["software", "19"], ["hardware", "13"], ["infosystems", "19"]]) {
    assert.match(types, new RegExp(`\\["${slug}", ${idx}\\]`), `legacy ${slug}->${idx} не замкнут`);
  }
});
