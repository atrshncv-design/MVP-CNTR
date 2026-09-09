import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

function leaves(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") leaves(v, p, out);
    else out[p] = v;
  }
  return out;
}

function keyPaths(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && v !== null) out.push(...keyPaths(v, p));
    else out.push(p);
  }
  return out.sort();
}

// Явный allowlist: слаги/данные, обязанные совпадать с EN
// (категории витрины — ключи фильтров, тег ai, прочерки пустых значений,
// snake_case ключи метрик — как в ru). Всё остальное обязано отличаться.
const ALLOW_KEYS = new Set([
  "showcase.projects.p1.category",
  "showcase.projects.p2.category",
  "showcase.projects.p3.category",
  "showcase.projects.p4.category",
  "showcase.projects.p5.category",
  "showcase.projects.p6.category",
  "showcase.projects.p7.category",
  "showcase.projects.p8.category",
  "showcase.projects.p9.category",
  "taxonomy.tags.ai",
  "verification.rolesEmpty",
  "verification.competenciesEmpty",
  "analytics.perWeekHint",
  "analytics.uniqueUsersHint",
]);

// Устоявшиеся термины и коды: после вычета плейсхолдеров остаются только
// они + числа/пунктуация (TRL, GOST, CNTR, единицы B/KB/MB, email, даты).
const TERMS = new Set([
  "TRL", "MRL", "IRL", "SRL", "UGT", "UGP", "UGI", "UGS",
  "CNTR", "GOST", "UR", "AI", "R", "D", "KT", "OGRN", "ID",
  "TUNO", "TZ", "XXXXXX", "X", "B", "KB", "MB", "API",
]);
const PUNCT = /^[\s\d\-–—+.,/:%()×→↓…·"«»'!?;|°§#№•]+$/;

function allowedValue(v) {
  if (typeof v !== "string") return true;
  const s = v.trim();
  if (s === "" || s === "RU" || s === "EN") return true;
  if (/^•+$/.test(s)) return true;
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(s)) return true;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return true;
  if (PUNCT.test(s)) return true;
  const bare = s.replace(/\{[^}]*\}/g, "");
  if (bare === "" || PUNCT.test(bare)) return true;
  const toks = bare.match(/[A-Za-z]+/g) || [];
  if (toks.length > 0 && toks.every((t) => TERMS.has(t.toUpperCase()))) {
    const rest = bare.replace(/[A-Za-z]+/g, "");
    if (rest === "" || PUNCT.test(rest)) return true;
  }
  return false;
}

/**
 * T17 (G01, история 22) + доделка: словарь zh покрывает 100% ключей EN,
 * и ни одно значение не совпадает с EN вне allowlist (fallback как
 * «перевод» запрещён — именно он дал английскую /methodology при zh).
 * Правки аддитивны: ru/en и default ru не меняются (demo-guard).
 */
test("locale-zh: словари zh существуют в обоих зеркалах и идентичны", () => {
  assert.ok(exists("src/messages/zh.json"), "missing src/messages/zh.json");
  assert.ok(exists("messages/zh.json"), "missing messages/zh.json");
  const a = JSON.parse(read("src/messages/zh.json"));
  const b = JSON.parse(read("messages/zh.json"));
  assert.deepEqual(a, b, "зеркала zh расходятся");
});

test("locale-zh: паритет ключей zh = EN 100% в обоих зеркалах, ru/en не тронуты", () => {
  const enKeys = keyPaths(JSON.parse(read("src/messages/en.json")));
  assert.ok(enKeys.length >= 300, `EN должно иметь 300+ ключей, сейчас ${enKeys.length}`);
  for (const p of ["src/messages/zh.json", "messages/zh.json"]) {
    assert.deepEqual(keyPaths(JSON.parse(read(p))), enKeys, `${p}: ключи расходятся с EN`);
  }
  assert.deepEqual(
    keyPaths(JSON.parse(read("messages/en.json"))),
    enKeys,
    "зеркало messages/en.json тронуто",
  );
  const zhTop = Object.keys(JSON.parse(read("src/messages/zh.json"))).sort();
  assert.deepEqual(zhTop, Object.keys(JSON.parse(read("src/messages/en.json"))).sort());
});

test("locale-zh: ни одно значение zh не совпадает с EN вне allowlist", () => {
  const en = leaves(JSON.parse(read("src/messages/en.json")));
  const zh = leaves(JSON.parse(read("src/messages/zh.json")));
  for (const k of ALLOW_KEYS) {
    assert.ok(k in en, `allowlist-ключ пропал из EN: ${k}`);
    assert.equal(zh[k], en[k], `allowlist-ключ ${k} обязан совпадать (слаг/данные)`);
  }
  const bad = Object.keys(en).filter((k) => zh[k] === en[k] && !ALLOW_KEYS.has(k) && !allowedValue(en[k]));
  assert.deepEqual(bad, [], `zh совпадает с EN вне allowlist (${bad.length}): ${bad.slice(0, 10).join(", ")}`);
});

test("locale-zh: конфиг — zh в списке, default ru, parseLocale fail-closed", async () => {
  const { locales, defaultLocale, parseLocale } = await import("../src/i18n/config.ts");
  assert.ok([...locales].includes("zh"), "locales без zh");
  assert.ok([...locales].includes("ru") && [...locales].includes("en"), "ru/en пропали");
  assert.equal(defaultLocale, "ru", "default должен остаться ru");
  assert.equal(parseLocale("zh"), "zh");
  assert.equal(parseLocale("en"), "en");
  assert.equal(parseLocale("ru"), "ru");
  assert.equal(parseLocale(undefined), "ru");
  assert.equal(parseLocale("fr"), "ru", "неизвестная локаль должна падать в ru");
});

test("locale-zh: переключатель предлагает zh, ru/en на месте", () => {
  const src = read("src/i18n/LocaleToggle.tsx");
  assert.match(src, /locale-zh/);
  assert.match(src, /data-testid="locale-toggle"/);
  assert.match(src, /data-testid="locale-ru"/);
  assert.match(src, /data-testid="locale-en"/);
  assert.ok(src.includes("RU") && src.includes("EN") && src.includes("ZH"));
});

test("locale-zh: layout отдаёт zh, дефолт ru прежний", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /zh/);
  assert.match(layout, /NextIntlClientProvider/);
  assert.match(layout, /LOCALE_COOKIE|parseLocale/);
});

test("locale-zh: контентные страницы без хардкода — всё через словарь", () => {
  for (const f of [
    "src/components/landing/methodology-content.tsx",
    "src/components/landing/roadmap-content.tsx",
  ]) {
    const src = read(f);
    assert.ok(!src.includes("Template will be available"), `${f}: английский хардкод`);
    assert.match(src, /useTranslations/, `${f}: должен использовать useTranslations`);
  }
});

test("locale-zh: переводчик резолвит zh на контентных неймспейсах, недостающий ключ — fallback", async () => {
  const { translatorFor } = await import("../src/lib/translators.ts");
  const tZh = translatorFor("common", "zh");
  // Ожидаемые величины — из глоссария таска, не из кода под тестом.
  assert.equal(tZh("save"), "保存");
  assert.equal(tZh("cancel"), "取消");
  assert.equal(tZh("language"), "语言");
  assert.equal(tZh("search"), "搜索");
  // Контентные страницы из скриншота провала — заголовки обязаны быть китайскими.
  assert.equal(translatorFor("methodology", "zh")("heroTitle"), "技术成熟度评估方法");
  assert.equal(translatorFor("roadmap", "zh")("heroTitle"), "发展路线图");
  assert.equal(translatorFor("levels", "zh")("title"), "技术成熟度 1–9 级");
  assert.equal(translatorFor("landing", "zh")("finalTitle"), "准备好评估您的技术了吗？");
  const heroDesc = translatorFor("methodology", "zh")("heroDesc").replace(
    /\b(TRL|MRL|IRL|SRL|GOST|CNTR|R&D|DT&E|OT&E|CTE|UD|AI)\b/g,
    "",
  );
  assert.ok(
    !/[A-Za-z]/.test(heroDesc),
    `heroDesc методологии содержит английские слова: ${heroDesc.slice(0, 80)}`,
  );
  const tPag = translatorFor("pagination", "zh");
  const page = tPag("page", { page: "2", total: "9" });
  assert.ok(page.includes("2") && page.includes("9"), `ICU-параметры потеряны: ${page}`);
  // Недостающий ключ: fallback (строка EN или эхо ключа), а не пустота и не бросок.
  const miss = tZh("definitelyAbsentKey_xyz_999");
  assert.equal(typeof miss, "string");
  assert.ok(miss.length > 0, "недостающий ключ дал пустое место");
});

test("locale-zh-final: ключи витрины showcaseEmpty*/emptyRegistry*/loadError*/liveDesc переведены (T19)", () => {
  // Ключей витрины не было на момент T17; собираем из свежего EN —
  // будущие рассинхроны EN→zh ловятся здесь же, а не молчаливым fallback.
  const pats = ["showcaseEmpty", "emptyRegistry", "loadError", "liveDesc"];
  const mirrors = [
    ["src/messages/en.json", "src/messages/zh.json"],
    ["messages/en.json", "messages/zh.json"],
  ];
  let pinned = 0;
  for (const [enPath, zhPath] of mirrors) {
    const en = leaves(JSON.parse(read(enPath)));
    const zh = leaves(JSON.parse(read(zhPath)));
    const keys = Object.keys(en).filter((k) => pats.some((s) => k.includes(s)));
    assert.ok(keys.length >= 8, `${enPath}: ожидалось 8+ ключей витрины, сейчас ${keys.length}`);
    if (enPath.startsWith("src/")) pinned = keys.length;
    for (const k of keys) {
      const zv = zh[k];
      assert.equal(typeof zv, "string", `${zhPath}: нет перевода ${k}`);
      assert.ok(zv.length > 0, `${zhPath}: ${k} пуст`);
      assert.notEqual(zv, en[k], `${zhPath}: ${k} — fallback на EN`);
      assert.doesNotMatch(en[k], /[А-Яа-яЁё]/, `${enPath}: ${k} с кириллицей`);
    }
  }
  assert.ok(pinned >= 8, `пинов витрины меньше 8: ${pinned}`);
});

test("locale-zh-final: живой рендер методологии/уровней/лендинга/roadmap без английских строк", () => {
  // Интерфейс — 100% zh: после вычета плейсхолдеров и устоявшихся кодов
  // (TRL/MRL/IRL/SRL, GOST, CNTR, AI, TRL-шкала) латиницы быть не должно.
  const zh = JSON.parse(read("src/messages/zh.json"));
  const en = JSON.parse(read("src/messages/en.json"));
  const strip = (s) =>
    s
      .replace(/\{[^}]*\}/g, "")
      .replace(
        /\b(TRL|MRL|IRL|SRL|GOST|CNTR|UGT|UGP|UGI|UGS|AI|R&D|DT&E|OT&E|CTE|UD|KT|ID|API|LPWAN|PVA|ML|LLM|ISO)\b/g,
        "",
      )
      .replace(/[0-9]/g, "");
  for (const ns of ["methodology", "levels", "landing", "roadmap"]) {
    const enLeaves = leaves(en[ns] ?? {});
    const zhLeaves = leaves(zh[ns] ?? {});
    assert.deepEqual(
      Object.keys(zhLeaves).sort(),
      Object.keys(enLeaves).sort(),
      `${ns}: ключи zh расходятся со свежим EN`,
    );
    for (const [k, v] of Object.entries(zhLeaves)) {
      if (typeof v !== "string" || v.trim() === "") continue;
      const lat = strip(v).match(/[A-Za-z]{2,}/g) || [];
      assert.deepEqual(lat, [], `${ns}.${k}: английские строки при zh: ${lat.slice(0, 3).join(", ")}`);
    }
  }
});

test("locale-zh-final: данные пользователей на языке ввода — карточка витрины не пустует", async () => {
  // Решение заказчика 2026-09-09 (как в EN): интерфейс — 100% zh, а
  // названия/тексты из БД остаются на языке ввода — карточка показывает
  // исходный текст, а не пустоту и не выдуманный перевод.
  const { toShowcaseCard } = await import("../src/lib/landing-registry.ts");
  const apiItem = {
    id: 7,
    name: "Стенд испытаний",
    category: "Промышленные технологии",
    current_level: 5,
    preliminary_level: null,
    target_level: 7,
    budget: null,
    organization: "Завод",
    is_public: true,
    show_preliminary: false,
    published_at: "2026-09-01T00:00:00",
    created_at: "2026-08-01T00:00:00",
  };
  const card = toShowcaseCard(apiItem);
  assert.equal(card.name, "Стенд испытаний", "имя проекта обязано остаться на языке ввода");
  assert.equal(card.org, "Завод", "организация обязана остаться на языке ввода");
  assert.equal(card.description, null, "описания нет в API — null, а не пустота и не выдумка");
  assert.ok(
    String(card.name).length > 0 && String(card.org).length > 0,
    "карточка не должна пустовать при zh",
  );
  // Рамка вокруг данных при этом китайская (значения — из глоссария таска).
  const { translatorFor } = await import("../src/lib/translators.ts");
  assert.equal(translatorFor("projectsShowcase", "zh")("title"), "项目展示");
  assert.equal(translatorFor("projectsLanding", "zh")("emptyRegistryTitle"), "暂无已发布的项目");
});
