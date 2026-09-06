import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Шов таска 04: только публичные резолверы зоны через штатный переводчик
// next-intl (translatorFor) обеих локалей. Никаких регулярок по исходникам,
// никаких прямых чтений JSON без резолверов. Ожидаемые строки — контракт
// приёмки (RU — текущий экран, EN — перевод сборки), а не код под тестом.

const { translatorFor } = await import("../src/lib/translators.ts");
const i18n = await import("../src/features/dashboard/i18n.ts");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const ru = translatorFor("dashboard", "ru");
const en = translatorFor("dashboard", "en");

test("dashboard-i18n: неймспейс dashboard — паритет обеих пар и резолв каждого ключа в ru/en", () => {
  // Зеркало project/registry-паритета для dashboard; неверный ключ краснеет.
  const pairs = [
    ["src/messages/ru.json", "src/messages/en.json"],
    ["messages/ru.json", "messages/en.json"],
  ];
  const scopes = {};
  for (const [ruPath, enPath] of pairs) {
    const ruNs = JSON.parse(read(ruPath)).dashboard;
    const enNs = JSON.parse(read(enPath)).dashboard;
    assert.ok(ruNs && enNs, `${ruPath}: неймспейс dashboard отсутствует`);
    assert.deepEqual(Object.keys(ruNs).sort(), Object.keys(enNs).sort(), `${ruPath}: паритет ключей dashboard`);
    scopes[ruPath] = ruNs;
  }
  assert.deepEqual(
    Object.keys(scopes["src/messages/ru.json"]).sort(),
    Object.keys(scopes["messages/ru.json"]).sort(),
    "пары словарей dashboard расходятся",
  );
  for (const key of Object.keys(scopes["src/messages/ru.json"])) {
    const tpl = scopes["src/messages/ru.json"][key];
    assert.equal(typeof tpl, "string", `dashboard.${key} не строка`);
    const params = Object.fromEntries([...tpl.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], "1"]));
    for (const [locale, t] of [["ru", ru], ["en", en]]) {
      const val = t(key, params);
      assert.equal(typeof val, "string", `dashboard.${key} (${locale}) не резолвится`);
      assert.ok(val.length > 0, `dashboard.${key} (${locale}) пуст`);
      assert.notEqual(val, key, `dashboard.${key} (${locale}): эхо ключа — неверный ключ`);
    }
    // ICU-плюралы ({count, plural...}) содержат латиницу — проверяем отсутствие
    // кириллицы только вне plural-шаблонов: EN-значения без кириллицы вообще.
    assert.doesNotMatch(en(key, params), /[А-Яа-яЁё]/, `dashboard.${key} (en) содержит кириллицу`);
  }
});

test("dashboard-i18n: зонный переводчик делегирует фабрике и резолвит обе локали", () => {
  const t = i18n.dashboardTranslator();
  assert.equal(typeof t, "function");
  assert.equal(t("newsTitle"), ru("newsTitle"));
  assert.equal(en("newsTitle"), "News");
  assert.equal(ru("newsTitle"), "Новости");
});

test("dashboard-i18n: подписи осей радара и aria — через перевод с параметрами", () => {
  assert.equal(i18n.radarAxisLabel(ru, "scientific"), "Научная");
  assert.equal(i18n.radarAxisLabel(en, "scientific"), "Scientific");
  assert.equal(i18n.radarAxisLabel(ru, "production"), "Производственная");
  assert.equal(i18n.radarAxisLabel(en, "production"), "Production");
  assert.equal(
    i18n.radarAria(ru, { scientific: "5", technical: "7", organizational: "3", production: "9" }),
    "Радар готовности проекта: научная 5, техническая 7, организационная 3, производственная 9 из 9",
  );
  assert.equal(
    i18n.radarAria(en, { scientific: "5", technical: "7", organizational: "3", production: "9" }),
    "Project readiness radar: scientific 5, technical 7, organizational 3, production 9 out of 9",
  );
});

test("dashboard-i18n: статусы новостей и сканирования — точные строки обеих локалей", () => {
  assert.equal(i18n.getNewsStatusLabel(ru, "draft"), "Черновик");
  assert.equal(i18n.getNewsStatusLabel(en, "scheduled"), "Scheduled");
  assert.equal(i18n.getNewsStatusLabel(en, "published"), "Published");
  assert.equal(i18n.getNewsStatusLabel(ru, "unknown"), "unknown");
  assert.equal(i18n.getScanLabel(ru, "clean"), "Проверен");
  assert.equal(i18n.getScanLabel(en, "infected"), "Infected");
  assert.equal(i18n.getScanLabel(ru, "pending"), "На проверке");
});

test("dashboard-i18n: доделка T06 — NEWS_STATUS_LABELS удалён, путь через резолвер", async () => {
  // lib/news-types.ts больше не держит RU-подписи: экраны идут через
  // getNewsStatusLabel(t, status) со словарём dashboard обеих локалей.
  const newsTypes = await import("../src/lib/news-types.ts");
  assert.equal(newsTypes.NEWS_STATUS_LABELS, undefined, "константа NEWS_STATUS_LABELS должна быть удалена");
  assert.equal(i18n.getNewsStatusLabel(ru, "scheduled"), "Запланирована");
  assert.equal(i18n.getNewsStatusLabel(en, "published"), "Published");
  assert.equal(i18n.getNewsStatusLabel(ru, "unknown-status"), "unknown-status");
});

test("dashboard-i18n: группы достижений и роли вступления — через перевод", () => {
  assert.equal(i18n.getAchievementGroupLabel(ru, "documents"), "Документы");
  assert.equal(i18n.getAchievementGroupLabel(en, "documents"), "Documents");
  assert.equal(i18n.getAchievementGroupLabel(ru, "secret"), "Секретные");
  assert.equal(i18n.getAchievementGroupLabel(en, "ugt"), "TRL");
  const rolesRu = i18n.getJoinRoles(ru);
  const rolesEn = i18n.getJoinRoles(en);
  assert.equal(rolesRu.length, 7);
  assert.deepEqual(
    rolesRu.map((r) => r.value),
    ["rd_executor", "scientific_org", "serial_manufacturer", "regulating_organization", "auditor", "investor", "participant"],
  );
  assert.equal(rolesRu.find((r) => r.value === "auditor").label, "Аудитор");
  assert.equal(rolesEn.find((r) => r.value === "auditor").label, "Auditor");
  assert.equal(rolesEn.find((r) => r.value === "scientific_org").label, "Scientific organization");
  assert.doesNotMatch(JSON.stringify(rolesEn), /[А-Яа-яЁё]/);
});

test("dashboard-i18n: общий UI-кит — точные строки обеих локалей, подстановки параметрами", () => {
  // Контракт доделки 04: ui-кит в неймспейсе dashboard (common не трогаем),
  // склейки нет — каждая фраза целая строка словаря с параметрами.
  assert.equal(ru("uiConfirmDefault"), "Подтвердить");
  assert.equal(en("uiConfirmDefault"), "Confirm");
  assert.equal(ru("uiCancel"), "Отмена");
  assert.equal(en("uiCancel"), "Cancel");
  assert.equal(ru("uiDrawerClose"), "Закрыть боковую панель");
  assert.equal(en("uiDrawerClose"), "Close side panel");
  assert.equal(ru("uiDialogClose"), "Закрыть модальное окно");
  assert.equal(en("uiDialogClose"), "Close dialog");
  assert.equal(ru("uiLoadFailed"), "Не удалось загрузить");
  assert.equal(en("uiLoadFailed"), "Failed to load");
  assert.equal(ru("uiRetryLoad"), "Повторить загрузку");
  assert.equal(ru("uiLoadMore"), "Показать ещё");
  assert.equal(en("uiLoadMore"), "Show more");
  assert.equal(ru("uiLoadMoreAria"), "Загрузить ещё записи");
  assert.equal(ru("uiPageNavAria"), "Навигация по страницам");
  assert.equal(en("uiPageNavAria"), "Page navigation");
  assert.equal(ru("uiPagePrev"), "Предыдущая страница");
  assert.equal(en("uiPageNext"), "Next page");
  assert.equal(ru("uiPageBack"), "Назад");
  assert.equal(ru("uiPageNextShort"), "Далее");
  assert.equal(ru("uiReset"), "Сбросить");
  assert.equal(en("uiReset"), "Reset");
  assert.equal(ru("uiSearchLabel"), "Поиск");
  assert.equal(en("uiSearchLabel"), "Search");
  assert.equal(ru("uiLoading"), "Загрузка…");
  assert.equal(ru("uiFilePickAria"), "Выбрать файлы для загрузки");
  assert.equal(ru("uiFileUploadAria"), "Загрузка файлов");
  assert.equal(ru("uiFileTooLarge", { name: "a.pdf", size: 25 }), "Файл a.pdf превышает 25 МБ");
  assert.equal(en("uiFileTooLarge", { name: "a.pdf", size: 25 }), "File a.pdf exceeds 25 MB");
  assert.equal(ru("uiFileLimits", { accept: ".pdf", size: 25 }), ".pdf до 25 МБ");
  assert.equal(en("uiFileLimits", { accept: ".pdf", size: 25 }), ".pdf up to 25 MB");
  assert.equal(ru("uiPageIndicator", { page: 3 }), "Стр. 3");
  assert.equal(en("uiPageIndicator", { page: 3 }), "Page 3");
  assert.equal(ru("uiProgressLabel", { value: 42 }), "Прогресс 42%");
  assert.equal(en("uiProgressLabel", { value: 42 }), "Progress 42%");
  assert.equal(ru("uiUgtBadge", { level: 3 }), "УГТ 3");
  assert.equal(en("uiUgtBadge", { level: 3 }), "TRL 3");
});

test("dashboard-i18n: размеры файлов и счётчики — параметры, а не склейка", () => {
  assert.equal(i18n.formatSizeT(ru, null), "—");
  assert.equal(i18n.formatSizeT(ru, 512), "512 Б");
  assert.equal(i18n.formatSizeT(en, 512), "512 B");
  assert.equal(i18n.formatSizeT(ru, 2048), "2.0 КБ");
  assert.equal(i18n.formatSizeT(en, 3 * 1024 * 1024), "3.0 MB");
  assert.equal(i18n.achieveCountT(ru, 1), "1 медаль");
  assert.equal(i18n.achieveCountT(ru, 3), "3 медали");
  assert.equal(i18n.achieveCountT(ru, 5), "5 медалей");
  assert.equal(i18n.achieveCountT(en, 1), "1 medal");
  assert.equal(i18n.achieveCountT(en, 5), "5 medals");
  assert.equal(ru("assessDrafts", { count: 2 }), "Черновики: 2");
  assert.equal(en("assessDrafts", { count: 2 }), "Drafts: 2");
  assert.equal(ru("stageTitle", { from: 3, to: 4 }), "Этап УГТ 3 → 4");
  assert.equal(en("stageTitle", { from: 3, to: 4 }), "TRL stage 3 → 4");
  assert.equal(ru("projectCode", { id: 12 }), "ЦНТР-12");
  assert.equal(en("verifyProjectOption", { id: 5, name: "N", level: 7 }), "CNTR-5 · N · TRL 7");
});
