import assert from "node:assert/strict";
import test from "node:test";

// Шов task 01 — только публичные резолверы lib со штатным переводчиком
// next-intl (translatorFor) обеих локалей. Прямых чтений исходников и JSON нет.
const { translatorFor, contentMessages } = await import("../src/lib/translators.ts");
const ugt = await import("../src/lib/ugt-data.ts");
const show = await import("../src/lib/showcase.ts");
const tax = await import("../src/lib/types.ts");

const tUgtRu = translatorFor("ugt", "ru");
const tUgtEn = translatorFor("ugt", "en");
const tShowRu = translatorFor("showcase", "ru");
const tShowEn = translatorFor("showcase", "en");
const tTaxRu = translatorFor("taxonomy", "ru");
const tTaxEn = translatorFor("taxonomy", "en");

/**
 * Таск 01 (R01–R03): контент lib резолвится через текущую локаль.
 * Неверный ключ в lib даёт эхо ключа вместо строки и краснит проверки ниже.
 */
test("content-dictionaries: методология УГТ резолвится в обеих локалях", () => {
  const ru = ugt.getUgtLevels(tUgtRu);
  const en = ugt.getUgtLevels(tUgtEn);
  assert.equal(ru.length, 9);
  assert.equal(en.length, 9);
  assert.equal(ru[0].code, "УГТ 1");
  assert.equal(en[0].code, "TRL 1");
  assert.equal(ru[0].name, "Базовые принципы");
  assert.notEqual(en[0].name, ru[0].name);
  assert.equal(ru[8].requirements.length, 5);
  assert.equal(en[8].requirements.length, 5);
  assert.equal(ru[0].deliverableDocs[0].template, "Шаблон_научной_статьи.docx");
  assert.equal(ru[8].risks[1].probability, "low");
  assert.equal(en[8].risks[1].probability, "low");
  assert.equal(ugt.getUgpLevels(tUgtRu).length, 10);
  assert.equal(ugt.getUgiLevels(tUgtEn).length, 9);
  assert.equal(ugt.getUgsLevels(tUgtRu).length, 5);
  assert.equal(ugt.getUgsLevels(tUgtEn)[0].code, "SRL 1");
  const trRu = ugt.getRoadmapTransitions(tUgtRu);
  const trEn = ugt.getRoadmapTransitions(tUgtEn);
  assert.equal(trRu.length, 8);
  assert.equal(trEn.length, 8);
  assert.equal(trEn[7].estimatedTime, "2-4 months");
  assert.equal(trRu[7].risks[1].probability, "low");
  assert.equal(ugt.getUgtLevel(tUgtEn, 99).id, 1);
  assert.deepEqual(ugt.getTransitionMonths(4, 5), { min: 1, max: 3 });
  // эхо ключа вместо строки — неверный ключ в lib
  for (const blob of [JSON.stringify(en), JSON.stringify(trEn)]) {
    assert.doesNotMatch(blob, /levels\.l\d|transitions\.from\d/);
  }
});

test("content-dictionaries: витрина и таксономия резолвятся в обеих локалях", () => {
  const ru = show.getShowcaseProjects(tShowRu);
  const en = show.getShowcaseProjects(tShowEn);
  assert.equal(ru.length, 9);
  assert.equal(en.length, 9);
  assert.equal(ru[2].category, "manufacturing");
  assert.equal(en[2].category, "manufacturing");
  assert.equal(en[2].name, "Robotic system for agriculture");
  assert.equal(ru[2].region, "Воткинск");
  assert.deepEqual(show.getShowcaseCategories(tShowEn), ["AI/ML", "R&D", "Manufacturing", "Medicine"]);
  assert.equal(show.getShowcaseCategoryLabel(tShowRu, "nioktr"), "НИОКТР");
  const tagsRu = tax.getProjectTags(tTaxRu);
  const tagsEn = tax.getProjectTags(tTaxEn);
  assert.equal(tagsRu.length, 32);
  assert.equal(tagsEn.length, 32);
  assert.equal(tagsRu[0], "AI/ML");
  assert.equal(tagsEn[1], "Computer vision");
  assert.equal(tax.getTagLabel(tTaxRu, "Медицина"), "Медицина");
  assert.equal(tax.getTagLabel(tTaxEn, "Медицина"), "Medicine");
  assert.equal(tax.getTagLabel(tTaxEn, "unknown-value"), "unknown-value");
  assert.equal(tax.validateTags(tTaxEn, []), "Select at least 1 tag");
  assert.equal(tax.validateTags(tTaxRu, ["AI/ML", "oops"]), "Неизвестные теги: oops");
  assert.equal(tax.validateTags(tTaxRu, ["AI/ML"]), null);
  assert.deepEqual(tax.categoryToTags("НИОКТР"), ["Промышленные технологии"]);
});

test("content-dictionaries: в EN-словаре нет кириллицы нигде", () => {
  const enText = JSON.stringify(contentMessages("en"));
  assert.doesNotMatch(enText, /[А-Яа-яЁё]/);
});
