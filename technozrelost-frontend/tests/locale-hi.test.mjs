import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

function keyPaths(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && v !== null) out.push(...keyPaths(v, p));
    else out.push(p);
  }
  return out.sort();
}

/**
 * T18 (G02, история 23): интерфейс на хинди — словарь hi покрывает 100%
 * ключей EN в обоих зеркалах, локаль доступна через существующий механизм,
 * недостающий ключ даёт fallback, а не пустое место. Правки аддитивны:
 * ru/en/zh и default ru не меняются (demo-guard).
 */
test("locale-hi: словари hi существуют в обоих зеркалах и идентичны", () => {
  assert.ok(exists("src/messages/hi.json"), "missing src/messages/hi.json");
  assert.ok(exists("messages/hi.json"), "missing messages/hi.json");
  const a = JSON.parse(read("src/messages/hi.json"));
  const b = JSON.parse(read("messages/hi.json"));
  assert.deepEqual(a, b, "зеркала hi расходятся");
});

test("locale-hi: паритет ключей hi = EN 100% в обоих зеркалах, ru/en/zh не тронуты", () => {
  const enKeys = keyPaths(JSON.parse(read("src/messages/en.json")));
  assert.ok(enKeys.length >= 300, `EN должно иметь 300+ ключей, сейчас ${enKeys.length}`);
  for (const p of ["src/messages/hi.json", "messages/hi.json"]) {
    assert.deepEqual(keyPaths(JSON.parse(read(p))), enKeys, `${p}: ключи расходятся с EN`);
  }
  assert.deepEqual(
    keyPaths(JSON.parse(read("messages/en.json"))),
    enKeys,
    "зеркало messages/en.json тронуто",
  );
  const hiTop = Object.keys(JSON.parse(read("src/messages/hi.json"))).sort();
  assert.deepEqual(hiTop, Object.keys(JSON.parse(read("src/messages/en.json"))).sort());
});

test("locale-hi: конфиг — hi в списке, default ru, parseLocale fail-closed", async () => {
  const { locales, defaultLocale, parseLocale } = await import("../src/i18n/config.ts");
  assert.ok([...locales].includes("hi"), "locales без hi");
  assert.ok(
    [...locales].includes("ru") && [...locales].includes("en") && [...locales].includes("zh"),
    "ru/en/zh пропали",
  );
  assert.equal(defaultLocale, "ru", "default должен остаться ru");
  assert.equal(parseLocale("hi"), "hi");
  assert.equal(parseLocale("zh"), "zh");
  assert.equal(parseLocale("en"), "en");
  assert.equal(parseLocale("ru"), "ru");
  assert.equal(parseLocale(undefined), "ru");
  assert.equal(parseLocale("fr"), "ru", "неизвестная локаль должна падать в ru");
});

test("locale-hi: переключатель предлагает hi, ru/en/zh на месте", () => {
  const src = read("src/i18n/LocaleToggle.tsx");
  assert.match(src, /locale-hi/);
  assert.match(src, /data-testid="locale-toggle"/);
  assert.match(src, /data-testid="locale-ru"/);
  assert.match(src, /data-testid="locale-en"/);
  assert.match(src, /data-testid="locale-zh"/);
  assert.ok(src.includes("HI"), "тумблер должен содержать HI");
});

test("locale-hi: layout отдаёт hi, дефолт ru прежний", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /hi/);
  assert.match(layout, /NextIntlClientProvider/);
  assert.match(layout, /LOCALE_COOKIE|parseLocale/);
});

test("locale-hi: переводчик резолвит hi (ICU жив), недостающий ключ — fallback", async () => {
  const { translatorFor } = await import("../src/lib/translators.ts");
  const tHi = translatorFor("common", "hi");
  // Ожидаемые величины — из глоссария таска, не из кода под тестом.
  assert.equal(tHi("save"), "सहेजें");
  assert.equal(tHi("cancel"), "रद्द करें");
  assert.equal(tHi("language"), "भाषा");
  assert.equal(tHi("search"), "खोजें");
  const tPag = translatorFor("pagination", "hi");
  const page = tPag("page", { page: "2", total: "9" });
  assert.ok(page.includes("2") && page.includes("9"), `ICU-параметры потеряны: ${page}`);
  // Недостающий ключ: fallback (строка EN или эхо ключа), а не пустота и не бросок.
  const miss = tHi("definitelyAbsentKey_xyz_999");
  assert.equal(typeof miss, "string");
  assert.ok(miss.length > 0, "недостающий ключ дал пустое место");
});

function leafEntries(obj, prefix = "", out = []) {
  if (typeof obj === "string") out.push([prefix, obj]);
  else if (Array.isArray(obj)) obj.forEach((v, i) => leafEntries(v, `${prefix}.${i}`, out));
  else if (obj && typeof obj === "object")
    for (const [k, v] of Object.entries(obj)) leafEntries(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/**
 * T18-доделка: запрет fallback-строк. Каждое строковое значение hi обязано
 * отличаться и от EN, и от RU — кроме явного пинованного allowlist имён
 * собственных и устоявшихся терминов (tests/locale-hi-allowlist.json).
 * Паритет ключей без этого засчитывал непереведённое как успех.
 */
test("locale-hi: нет fallback-строк — значения отличаются от EN/RU, кроме allowlist", () => {
  const en = JSON.parse(read("src/messages/en.json"));
  const hi = JSON.parse(read("src/messages/hi.json"));
  const ru = JSON.parse(read("src/messages/ru.json"));
  const allow = JSON.parse(read("tests/locale-hi-allowlist.json"));
  const enMap = new Map(leafEntries(en));
  const hiMap = new Map(leafEntries(hi));
  const ruMap = new Map(leafEntries(ru));
  assert.deepEqual([...hiMap.keys()].sort(), [...enMap.keys()].sort(), "ключи hi расходятся с EN");
  // allowlist hygiene: пин существует, совпадает с EN и с hi; лишнего нет
  for (const [k, v] of Object.entries(allow)) {
    assert.ok(enMap.has(k), `allowlist stale (нет в EN): ${k}`);
    assert.equal(enMap.get(k), v, `allowlist stale (EN изменился): ${k}`);
    assert.equal(hiMap.get(k), v, `allowlist нарушен (hi изменился): ${k}`);
  }
  assert.ok(
    Object.keys(allow).length <= 200, // 152 пина: коды TRL/MRL/IRL/SRL, GOST, CNTR, единицы, слаги, форматы
    `allowlist раздут (${Object.keys(allow).length}) — переводите, а не разрешайте`,
  );
  const badEn = [];
  const badRu = [];
  for (const [k, ve] of enMap) {
    if (typeof ve !== "string" || ve === "" || k in allow) continue;
    const vh = hiMap.get(k);
    if (vh === ve) badEn.push(k);
    else if (vh === ruMap.get(k)) badRu.push(k);
  }
  assert.deepEqual(
    badEn,
    [],
    `fallback EN (${badEn.length}): ${badEn.slice(0, 10).join(", ")}`,
  );
  assert.deepEqual(
    badRu,
    [],
    `русские строки (${badRu.length}): ${badRu.slice(0, 10).join(", ")}`,
  );
});
