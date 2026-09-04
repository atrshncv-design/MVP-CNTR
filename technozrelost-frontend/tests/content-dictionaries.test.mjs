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
  assert.equal(ru[2].category, "Производство");
  assert.equal(en[2].category, "Manufacturing");
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
  assert.equal(tax.validateTagsT(tTaxEn, []), "Select at least 1 tag");
  assert.equal(tax.validateTagsT(tTaxRu, ["AI/ML", "oops"]), "Неизвестные теги: oops");
  assert.equal(tax.validateTagsT(tTaxRu, ["AI/ML"]), null);
  assert.deepEqual(tax.categoryToTags("НИОКТР"), ["Промышленные технологии"]);
});

test("content-dictionaries: в EN-словаре нет кириллицы нигде", () => {
  const enText = JSON.stringify(contentMessages("en"));
  assert.doesNotMatch(enText, /[А-Яа-яЁё]/);
});

test("content-dictionaries: ПОЛНЫЙ protocol.json соответствует словарю", () => {
  // protocol.json — проверяемый артефакт; словарь — только через резолверы.
  return import("../src/lib/protocol.json", { with: { type: "json" } }).then(({ default: protocol }) => {
    const dictTagsRu = tTaxRu.raw("tags");
    const dictTagsEn = tTaxEn.raw("tags");
    // теги: полное множество слагов и полный порядок значений
    assert.deepEqual(Object.keys(protocol.tags), Object.keys(dictTagsRu));
    assert.deepEqual(Object.keys(protocol.tags), Object.keys(dictTagsEn));
    assert.deepEqual(tax.getProjectTags(tTaxRu), Object.values(protocol.tags));
    assert.equal(tax.getProjectTags(tTaxEn).length, 32);
    for (const label of tax.getProjectTags(tTaxEn)) {
      assert.ok(label.length > 0 && !/[А-Яа-яЁё]/.test(label), `плохая EN-метка: ${label}`);
    }
    // legacy: каждая запись целиком через резолвер
    const legacyKeys = Object.keys(protocol.legacy);
    assert.ok(legacyKeys.length > 0);
    for (const slug of legacyKeys) {
      const { match, tag } = protocol.legacy[slug];
      assert.deepEqual(tax.categoryToTags(match), [protocol.tags[tag]], `legacy ${slug}`);
    }
    // шаблоны: каждый уровень и каждый переход целиком
    const levels = ugt.getUgtLevels(tUgtRu);
    assert.equal(levels.length, Object.keys(protocol.levelDocTemplates).length);
    levels.forEach((lvl, i) => {
      const key = `l${i + 1}`;
      const dictDocs = tUgtRu.raw(`levels.${key}.docs`);
      assert.equal(lvl.deliverableDocs.length, protocol.levelDocTemplates[key].length, key);
      assert.equal(lvl.deliverableDocs.length, dictDocs.length, key);
      lvl.deliverableDocs.forEach((doc, j) => {
        assert.equal(doc.template, protocol.levelDocTemplates[key][j], `${key} doc ${j}`);
        assert.match(doc.template, /\.(docx|xlsx)$/);
      });
    });
    const transitions = ugt.getRoadmapTransitions(tUgtRu);
    assert.equal(transitions.length, Object.keys(protocol.transitionDocTemplates).length);
    transitions.forEach((tr) => {
      const key = `from${tr.from}to${tr.to}`;
      const dictDocs = tUgtRu.raw(`transitions.${key}.docs`);
      assert.equal(tr.documents.length, protocol.transitionDocTemplates[key].length, key);
      assert.equal(tr.documents.length, dictDocs.length, key);
      tr.documents.forEach((doc, j) => {
        assert.equal(doc.template, protocol.transitionDocTemplates[key][j], `${key} doc ${j}`);
      });
    });
  });
});

test("content-dictionaries: шимы идут через текущую локаль без RU-default", () => {
  // node без document: локаль приложения по умолчанию
  assert.equal(ugt.UGT_LEVELS[0].code, "УГТ 1");
  assert.equal(ugt.UGT_LEVELS.length, 9);
  assert.equal(show.SHOWCASE_PROJECTS[2].category, "Производство");
  assert.ok(show.SHOWCASE_CATEGORIES.includes("НИОКТР"));
  assert.equal(tax.validateTags([]), "Выберите хотя бы 1 тег");
  const prevDocument = globalThis.document;
  globalThis.document = { cookie: "NEXT_LOCALE=en" };
  try {
    assert.equal(ugt.UGT_LEVELS[0].code, "TRL 1");
    assert.equal(ugt.UGP_LEVELS.length, 10);
    assert.equal(ugt.ROADMAP_TRANSITIONS[7].estimatedTime, "2-4 months");
    assert.equal(show.SHOWCASE_PROJECTS[2].category, "Manufacturing");
    assert.ok(show.SHOWCASE_CATEGORIES.includes("R&D"));
    assert.equal(tax.validateTags([]), "Select at least 1 tag");
  } finally {
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
  }
  assert.equal(ugt.UGT_LEVELS[0].code, "УГТ 1");
});
