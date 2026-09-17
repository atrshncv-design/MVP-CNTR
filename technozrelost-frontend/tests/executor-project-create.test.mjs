/**
 * Таск 01 (R02, R02.1): создание проектов исполнителем.
 * Швы: страницы /dashboard/*\/projects/new, матрица ролей (fail-closed),
 * CTA кабинетов, PUT /publish (общие правила), словари подсказок.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const EXECUTOR_NEW_PAGES = [
  "src/app/dashboard/rd_executor/projects/new/page.tsx",
  "src/app/dashboard/scientific_org/projects/new/page.tsx",
  "src/app/dashboard/serial_manufacturer/projects/new/page.tsx",
];

test("executor-create: в кабинете исполнителя есть страница создания той же анкетой УГТ", () => {
  for (const page of EXECUTOR_NEW_PAGES) {
    const src = read(page);
    assert.match(src, /QuestionnaireWizardClient/, `${page}: нет анкеты УГТ`);
    assert.match(src, /OrgVerificationHint/, `${page}: нет подсказки про организацию`);
    assert.match(src, /PublishRulesNote/, `${page}: нет правил публикации`);
    assert.doesNotMatch(src, /gk_customer/, `${page}: страница исполнителя ведёт в чужой кабинет`);
  }
  // Кабинет заказчика не сломан: та же анкета + те же подсказки.
  const gk = read("src/app/dashboard/gk_customer/projects/new/page.tsx");
  assert.match(gk, /QuestionnaireWizardClient/);
  assert.match(gk, /OrgVerificationHint/);
  assert.match(gk, /PublishRulesNote/);
});

test("executor-create: матрица ролей покрывает новые маршруты, чужим закрыто", async () => {
  const { allowedRolesFor } = await import("../src/lib/roles.ts");
  assert.deepEqual(allowedRolesFor("/dashboard/rd_executor/projects/new"), ["rd_executor"]);
  assert.deepEqual(allowedRolesFor("/dashboard/scientific_org/projects/new"), ["scientific_org"]);
  assert.deepEqual(allowedRolesFor("/dashboard/serial_manufacturer/projects/new"), ["serial_manufacturer"]);
  // Чужие кабинеты по-прежнему закрыты.
  assert.ok(!allowedRolesFor("/dashboard/rd_executor/projects/new")?.includes("gk_customer"));
  assert.ok(!allowedRolesFor("/dashboard/scientific_org/projects/new")?.includes("auditor"));
  // Универсальный опросник заказчика доступен и исполнителям (обратная совместимость).
  for (const role of ["rd_executor", "scientific_org", "serial_manufacturer"]) {
    assert.ok(
      allowedRolesFor("/dashboard/gk_customer/projects/new")?.includes(role),
      `универсальный опросник закрыт для ${role}`,
    );
  }
});

test("executor-create: дашборды исполнителей ведут на свои страницы создания", () => {
  const shell = read("src/features/dashboard/RoleDashboardShell.tsx");
  assert.match(shell, /\/dashboard\/rd_executor\/projects\/new/);
  assert.match(shell, /\/dashboard\/scientific_org\/projects\/new/);
  assert.match(shell, /\/dashboard\/serial_manufacturer\/projects\/new/);
  // Остальным ролям — универсальный опросник заказчика.
  assert.match(shell, /getNewRequestHref/);
  assert.match(shell, /\/dashboard\/gk_customer\/projects\/new/);
});

test("executor-create: публикация тем же PUT /publish без ролевых различий", () => {
  const api = read("src/lib/api-client.ts");
  assert.match(api, /export function togglePublish\(/);
  assert.match(api, /\/publish/);
  assert.match(api, /method: "PUT"/);
  const actions = read("src/features/project/ActionsPanel.tsx");
  assert.match(actions, /togglePublish/);
});

test("executor-create: подсказка про организацию и правила публикации в словарях ru/en/zh", async () => {
  const { translatorFor } = await import("../src/lib/translators.ts");
  const ru = translatorFor("dashboard", "ru");
  const en = translatorFor("dashboard", "en");
  const zh = translatorFor("dashboard", "zh");
  for (const key of [
    "orgHintTitle",
    "orgHintNoOrg",
    "orgHintUnverified",
    "orgHintVerified",
    "orgHintLoadFailed",
    "orgHintProfileLink",
    "publishRulesTitle",
    "publishRulesText",
  ]) {
    const ruVal = ru(key);
    const enVal = en(key);
    assert.notEqual(ruVal, key, `dashboard.${key} (ru): эхо ключа`);
    assert.notEqual(enVal, key, `dashboard.${key} (en): эхо ключа`);
    assert.ok(ruVal.length > 10, `dashboard.${key} (ru) пуст`);
    assert.doesNotMatch(enVal, /[А-Яа-яЁё]/, `dashboard.${key} (en) содержит кириллицу`);
    // zh-перевод на месте: при отсутствии ключа translatorFor падает в EN.
    assert.notEqual(zh(key), enVal, `dashboard.${key} (zh) отсутствует — fallback в EN`);
  }
  // Подстановки имени и статуса резолвятся без эха ключей.
  assert.doesNotMatch(ru("orgHintUnverified", { name: "1", state: "1" }), /orgHint/);
  assert.doesNotMatch(en("orgHintVerified", { name: "1" }), /orgHint/);
});
