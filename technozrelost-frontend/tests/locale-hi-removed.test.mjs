import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import test from "node:test";

const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/**
 * T20 (G03, история 25): хинди отменён пользователем — в интерфейсе его нет:
 * ни кнопки, ни локали, ни fallback-веток, ни словарей hi. Запрос hi ведёт
 * себя как неподдерживаемая локаль (дефолт ru, без падений). ru/en/zh не меняются.
 */
test("locale-hi-removed: словарей, тестов и allowlist hi нет", () => {
  for (const f of [
    "src/messages/hi.json",
    "messages/hi.json",
    "tests/locale-hi.test.mjs",
    "tests/locale-hi-allowlist.json",
  ]) {
    assert.ok(!exists(f), `должен быть удалён: ${f}`);
  }
});

test("locale-hi-removed: реестр — только ru/en/zh, hi даёт дефолт ru", async () => {
  const { locales, defaultLocale, parseLocale, isLocale } = await import("../src/i18n/config.ts");
  assert.deepEqual([...locales], ["ru", "en", "zh"]);
  assert.equal(defaultLocale, "ru");
  assert.equal(parseLocale("hi"), "ru", "запрос hi обязан давать дефолт ru");
  assert.equal(parseLocale(undefined), "ru");
  assert.equal(parseLocale("fr"), "ru");
  assert.equal(isLocale("hi"), false);
  assert.equal(parseLocale("zh"), "zh", "zh прежний");
  assert.equal(parseLocale("en"), "en", "en прежний");
});

test("locale-hi-removed: в коде/тестах нет ссылок на hi-локаль", () => {
  for (const f of [
    "src/i18n/LocaleToggle.tsx",
    "src/i18n/config.ts",
    "src/lib/translators.ts",
    "src/app/layout.tsx",
    "src/i18n/request.ts",
    "src/i18n/routing.ts",
  ]) {
    const src = read(f);
    assert.ok(!src.includes("locale-hi"), `${f}: остался locale-hi`);
    assert.ok(!src.includes("hiMessages"), `${f}: остался hiMessages`);
    assert.ok(!src.includes('"hi"'), `${f}: остался "hi"`);
    assert.ok(!src.includes("'hi'"), `${f}: остался 'hi'`);
    assert.ok(!src.includes("(ru|en|zh|hi)"), `${f}: остался hi в cookie-матче`);
  }
  const toggle = read("src/i18n/LocaleToggle.tsx");
  assert.ok(toggle.includes("locale-zh"), "кнопка ZH обязана остаться");
  assert.ok(toggle.includes("locale-ru") && toggle.includes("locale-en"), "RU/EN обязаны остаться");
});

test("locale-hi-removed: переводчики без hi-веток, ru/en/zh работают без падений", async () => {
  const { translatorFor, shimLocale } = await import("../src/lib/translators.ts");
  assert.equal(translatorFor("common", "ru")("save"), "Сохранить");
  assert.equal(translatorFor("common", "en")("save"), "Save");
  assert.equal(translatorFor("common", "zh")("save"), "保存");
  assert.equal(typeof shimLocale(), "string");
});
