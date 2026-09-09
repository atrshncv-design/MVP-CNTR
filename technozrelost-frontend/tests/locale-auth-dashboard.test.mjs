import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/**
 * T22 (G04, история 27): тот же тоггл RU/EN/ZH — на экранах /login и /register
 * и в шапке dashboard. Правки аддитивны: существующий тоггл переиспользуется,
 * поведение ru/en/zh по умолчанию не меняется (demo-guard).
 */
test("locale-auth-dashboard: тоггл на /login, /register и в шапке dashboard", () => {
  for (const f of [
    "src/app/login/page.tsx",
    "src/app/register/page.tsx",
    "src/app/dashboard/layout.tsx",
  ]) {
    const src = read(f);
    assert.match(src, /from "@\/i18n\/LocaleToggle"/, `${f}: нет импорта тоггла`);
    assert.match(src, /<LocaleToggle \/>/, `${f}: тоггл не отрендерен`);
  }
});

test("locale-auth-dashboard: строки входа из словарей активной локали, включая ошибки", async () => {
  // Шов: экраны резолвят строки через useTranslations("auth") — захардкоженный
  // литерал в setError вернул бы русский при любой локали.
  const login = read("src/app/login/page.tsx");
  assert.match(login, /useTranslations\("auth"\)/, "login: строки не из словаря auth");
  assert.match(login, /t\("invalidCredentials"\)/, "login: ошибка входа не из словаря");
  assert.doesNotMatch(login, /setError\("[^"]/, "login: захардкоженная ошибка мимо словаря");
  const register = read("src/app/register/page.tsx");
  assert.match(register, /useTranslations\("auth"\)/, "register: строки не из словаря auth");
  assert.match(register, /t\("registerError(Service|Generic)"\)/, "register: ошибки не из словаря");
  // Ожидаемые величины — известные строки словарей (данные, не код под тестом).
  const { translatorFor } = await import("../src/lib/translators.ts");
  const expected = {
    ru: "Неверный email или пароль",
    en: "Invalid email or password",
    zh: "电子邮箱或密码错误",
  };
  for (const locale of ["ru", "en", "zh"]) {
    const t = translatorFor("auth", locale);
    assert.equal(t("invalidCredentials"), expected[locale], `auth.invalidCredentials (${locale})`);
    for (const key of ["loginTitle", "registerPageTitle", "workEmail", "password"]) {
      const val = t(key);
      assert.equal(typeof val, "string", `auth.${key} (${locale}) не резолвится`);
      assert.ok(val.length > 0, `auth.${key} (${locale}) пуст`);
    }
  }
  assert.notEqual(expected.ru, expected.en, "ru/en ошибки обязаны различаться");
  assert.notEqual(expected.en, expected.zh, "en/zh ошибки обязаны различаться");
});
