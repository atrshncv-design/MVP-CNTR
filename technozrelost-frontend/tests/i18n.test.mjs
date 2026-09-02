import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

function countKeys(obj) {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") n += countKeys(v);
    else n += 1;
  }
  return n;
}

/**
 * P3 R01 — RU↔EN перевод всего интерфейса (next-intl, cookie, default RU).
 */
test("i18n: зона src/i18n и src/messages существует", () => {
  for (const f of [
    "src/i18n/config.ts",
    "src/i18n/request.ts",
    "src/i18n/LocaleToggle.tsx",
    "src/i18n/routing.ts",
    "src/messages/ru.json",
    "src/messages/en.json",
    "messages/ru.json",
    "messages/en.json",
  ]) {
    assert.ok(exists(f), `missing ${f}`);
  }
});

test("i18n: config — ru/en, default ru, cookie NEXT_LOCALE", () => {
  const cfg = read("src/i18n/config.ts");
  assert.match(cfg, /locales.*ru.*en/s);
  assert.match(cfg, /defaultLocale.*ru/);
  assert.match(cfg, /LOCALE_COOKIE/);
  assert.match(cfg, /NEXT_LOCALE/);
  assert.match(cfg, /parseLocale/);
});

test("i18n: request.ts — getRequestConfig, cookie, messages", () => {
  const req = read("src/i18n/request.ts");
  assert.match(req, /getRequestConfig/);
  assert.match(req, /cookies\(\)/);
  assert.match(req, /LOCALE_COOKIE|parseLocale/);
  assert.match(req, /messages/);
});

test("i18n: LocaleToggle — RU↔EN тумблер, cookie, reload без потери страницы", () => {
  const src = read("src/i18n/LocaleToggle.tsx");
  assert.match(src, /LocaleToggle/);
  assert.match(src, /useTranslations/);
  assert.match(src, /NEXT_LOCALE|LOCALE_COOKIE/);
  assert.match(src, /document\.cookie/);
  assert.match(src, /max-age=31536000/);
  assert.match(src, /SameSite=Lax/);
  assert.match(src, /window\.location\.reload/);
  assert.match(src, /aria-pressed/);
  assert.match(src, /data-testid="locale-toggle"/);
  assert.match(src, /data-testid="locale-ru"/);
  assert.match(src, /data-testid="locale-en"/);
  assert.match(src, /role="group"/);
  // должен содержать оба языка
  assert.ok(src.includes("RU") && src.includes("EN"), "тумблер должен содержать RU и EN");
});

test("i18n: messages 300+ ключей, ru/en синхронны", () => {
  const ru = JSON.parse(read("src/messages/ru.json"));
  const en = JSON.parse(read("src/messages/en.json"));
  const ruCount = countKeys(ru);
  const enCount = countKeys(en);
  assert.ok(ruCount >= 300, `ru.json должно иметь 300+ ключей, сейчас ${ruCount}`);
  assert.ok(enCount >= 300, `en.json должно иметь 300+ ключей, сейчас ${enCount}`);
  // одинаковая структура ключей верхнего уровня
  const ruTop = Object.keys(ru).sort();
  const enTop = Object.keys(en).sort();
  assert.deepEqual(ruTop, enTop, "ru/en должны иметь одинаковые топик-ключи");
  // ключевые неймспейсы
  for (const ns of ["common", "nav", "dashboard", "registry", "auth"]) {
    assert.ok(ru[ns], `ru отсутствует неймспейс ${ns}`);
    assert.ok(en[ns], `en отсутствует неймспейс ${ns}`);
  }
  // дубликат в messages/ корне
  const ruRoot = JSON.parse(read("messages/ru.json"));
  const enRoot = JSON.parse(read("messages/en.json"));
  assert.deepEqual(ru, ruRoot, "src/messages/ru.json и messages/ru.json должны совпадать");
  assert.deepEqual(en, enRoot, "src/messages/en.json и messages/en.json должны совпадать");
});

test("i18n: layout — NextIntlClientProvider, locale из cookie, default ru", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /NextIntlClientProvider/);
  assert.match(layout, /from "next-intl"/);
  assert.match(layout, /cookies\(\)/);
  assert.match(layout, /LOCALE_COOKIE|parseLocale/);
  assert.match(layout, /ruMessages|enMessages|messages/);
  assert.match(layout, /locale/);
  // должен сохранять lang="ru" для теста wcag (статичный)
  assert.match(layout, /lang="ru"/);
});

test("i18n: тумблер в топбаре dashboard и landing", () => {
  const dash = read("src/app/dashboard/layout.tsx");
  assert.match(dash, /LocaleToggle/);
  assert.match(dash, /from "@\/i18n\/LocaleToggle"/);

  const landing = read("src/components/landing/landing-nav.tsx");
  assert.match(landing, /LocaleToggle/);
});

test("i18n: next.config — createNextIntlPlugin", () => {
  const cfg = read("next.config.ts");
  assert.match(cfg, /createNextIntlPlugin/);
  assert.match(cfg, /next-intl\/plugin/);
  assert.match(cfg, /src\/i18n\/request\.ts/);
});

test("i18n: useTranslations используется в UI (300+ ключей via hook)", () => {
  // проверяем что несколько ключевых UI файлов используют next-intl
  const files = [
    "src/i18n/LocaleToggle.tsx",
    "src/features/dashboard/RoleDashboardShell.tsx",
    "src/features/registry/RegistryTable.tsx",
    "src/features/registry/RegistryViewToggle.tsx",
    "src/app/login/page.tsx",
    "src/components/landing/landing-nav.tsx",
  ];
  for (const f of files) {
    const src = read(f);
    assert.match(src, /useTranslations/, `${f} должен использовать useTranslations`);
  }
});
