import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Шов таска 05: только публичные резолверы зоны через штатный переводчик
// next-intl (translatorFor) обеих локалей. Никаких регулярок по исходникам,
// никаких прямых чтений JSON без резолверов. Ожидаемые строки — контракт
// приёмки (RU — текущий экран, EN — перевод сборки), а не код под тестом.

const { translatorFor } = await import("../src/lib/translators.ts");
const i18n = await import("../src/features/misc/i18n.ts");
const dash = await import("../src/features/dashboard/i18n.ts");
const roles = await import("../src/lib/roles.ts");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const landingRu = translatorFor("landing", "ru");
const landingEn = translatorFor("landing", "en");
const authRu = translatorFor("auth", "ru");
const authEn = translatorFor("auth", "en");
const commonRu = translatorFor("common", "ru");
const commonEn = translatorFor("common", "en");

test("misc-i18n: неймспейсы landing/auth/common — паритет обеих пар и резолв каждого ключа в ru/en", () => {
  // Зеркало project/registry/dashboard-паритета для зоны misc; неверный ключ краснеет.
  const pairs = [
    ["src/messages/ru.json", "src/messages/en.json"],
    ["messages/ru.json", "messages/en.json"],
  ];
  for (const ns of ["landing", "auth", "common"]) {
    const scopes = {};
    for (const [ruPath, enPath] of pairs) {
      const ruNs = JSON.parse(read(ruPath))[ns];
      const enNs = JSON.parse(read(enPath))[ns];
      assert.ok(ruNs && enNs, `${ruPath}: неймспейс ${ns} отсутствует`);
      assert.deepEqual(Object.keys(ruNs).sort(), Object.keys(enNs).sort(), `${ruPath}: паритет ключей ${ns}`);
      scopes[ruPath] = ruNs;
    }
    assert.deepEqual(
      Object.keys(scopes["src/messages/ru.json"]).sort(),
      Object.keys(scopes["messages/ru.json"]).sort(),
      `пары словарей ${ns} расходятся`,
    );
    const t = { ru: translatorFor(ns, "ru"), en: translatorFor(ns, "en") };
    for (const key of Object.keys(scopes["src/messages/ru.json"])) {
      const tpl = scopes["src/messages/ru.json"][key];
      assert.equal(typeof tpl, "string", `${ns}.${key} не строка`);
      const params = Object.fromEntries([...tpl.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], "1"]));
      for (const [locale, tr] of [["ru", t.ru], ["en", t.en]]) {
        const val = tr(key, params);
        assert.equal(typeof val, "string", `${ns}.${key} (${locale}) не резолвится`);
        assert.ok(val.length > 0, `${ns}.${key} (${locale}) пуст`);
        assert.notEqual(val, key, `${ns}.${key} (${locale}): эхо ключа — неверный ключ`);
      }
      assert.doesNotMatch(t.en(key, params), /[А-Яа-яЁё]/, `${ns}.${key} (en) содержит кириллицу`);
    }
  }
});

test("misc-i18n: зонные переводчики делегируют фабрике и резолвят обе локали", () => {
  assert.equal(i18n.landingTranslator()("newsTitle"), landingRu("newsTitle"));
  assert.equal(i18n.authTranslator()("joinSubmit"), authRu("joinSubmit"));
  assert.equal(i18n.commonTranslator()("retry"), commonRu("retry"));
  assert.equal(landingRu("newsTitle"), "Новости");
  assert.equal(landingEn("newsTitle"), "News");
  assert.equal(authRu("joinSubmit"), "Присоединиться");
  assert.equal(authEn("joinSubmit"), "Join");
  assert.equal(commonRu("noRegion"), "Без региона");
  assert.equal(commonEn("noRegion"), "No region");
});

test("misc-i18n: бейдж УГТ и оси радара — точные строки обеих локалей", () => {
  assert.equal(landingRu("ugtBadge", { level: 3 }), "УГТ 3");
  assert.equal(landingEn("ugtBadge", { level: 3 }), "TRL 3");
  // Подписи осей переиспользуют хелпер дашборда (таск 04) с переводчиком landing.
  assert.equal(dash.radarAxisLabel(landingRu, "scientific"), "Научная");
  assert.equal(dash.radarAxisLabel(landingEn, "scientific"), "Scientific");
  assert.equal(dash.radarAxisLabel(landingRu, "production"), "Производственная");
  assert.equal(dash.radarAxisLabel(landingEn, "production"), "Production");
  assert.equal(landingRu("radarLegendTextScientific"), "публикации и патентные исследования");
  assert.equal(landingEn("radarLegendTextProduction"), "scaling and serial production");
});

test("misc-i18n: сводка дорожной карты — славянские плюралы целыми строками", () => {
  assert.equal(i18n.roadmapDurationT(landingRu, 3, 7), "3–7 месяцев");
  assert.equal(i18n.roadmapDurationT(landingRu, 1, 1), "1–1 месяц");
  assert.equal(i18n.roadmapDurationT(landingRu, 1, 2), "1–2 месяца");
  assert.equal(i18n.roadmapDurationT(landingEn, 3, 7), "3–7 months");
  assert.equal(i18n.roadmapDurationT(landingEn, 1, 1), "1–1 month");
  assert.equal(i18n.roadmapStagesT(landingRu, 1), "1 переход");
  assert.equal(i18n.roadmapStagesT(landingRu, 3), "3 перехода");
  assert.equal(i18n.roadmapStagesT(landingRu, 5), "5 переходов");
  assert.equal(i18n.roadmapStagesT(landingEn, 1), "1 stage");
  assert.equal(i18n.roadmapStagesT(landingEn, 5), "5 stages");
  assert.equal(i18n.roadmapTasksT(landingRu, 1), "1 задача");
  assert.equal(i18n.roadmapTasksT(landingRu, 2), "2 задачи");
  assert.equal(i18n.roadmapTasksT(landingRu, 5), "5 задач");
  assert.equal(i18n.roadmapTasksT(landingEn, 2), "2 tasks");
  assert.equal(i18n.roadmapResultsT(landingRu, 1), "1 результат");
  assert.equal(i18n.roadmapResultsT(landingRu, 21), "21 результат");
  assert.equal(i18n.roadmapResultsT(landingRu, 11), "11 результатов");
  assert.equal(i18n.roadmapResultsT(landingEn, 1), "1 deliverable");
  assert.equal(i18n.roadmapResultsT(landingEn, 3), "3 deliverables");
});

test("misc-i18n: размеры файлов и роли вступления — параметры, а не склейка", () => {
  assert.equal(i18n.formatSizeT(commonRu, null), "—");
  assert.equal(i18n.formatSizeT(commonRu, 512), "512 Б");
  assert.equal(i18n.formatSizeT(commonEn, 512), "512 B");
  assert.equal(i18n.formatSizeT(commonRu, 2048), "2.0 КБ");
  assert.equal(i18n.formatSizeT(commonEn, 3 * 1024 * 1024), "3.0 MB");
  const rolesRu = i18n.getJoinRoleOptions(authRu);
  const rolesEn = i18n.getJoinRoleOptions(authEn);
  assert.equal(rolesRu.length, 9);
  assert.deepEqual(
    rolesRu.map((r) => r.value),
    ["rd_executor", "scientific_org", "serial_manufacturer", "regulating_organization", "auditor", "investor", "participant", "tech_lead", "project_curator"],
  );
  assert.equal(rolesRu.find((r) => r.value === "auditor").label, "Аудитор");
  assert.equal(rolesEn.find((r) => r.value === "auditor").label, "Auditor");
  assert.equal(rolesRu.find((r) => r.value === "tech_lead").label, "Технический руководитель");
  assert.equal(rolesEn.find((r) => r.value === "project_curator").label, "Project curator");
  assert.doesNotMatch(JSON.stringify(rolesEn), /[А-Яа-яЁё]/);
});

test("misc-i18n: коды llm-модуля маппятся в словарь, чужой текст — как есть", () => {
  assert.equal(i18n.llmErrorText(commonRu, "llm-unavailable"), "LLM недоступен — script результат — Повторить");
  assert.equal(i18n.llmErrorText(commonEn, "llm-unavailable"), "LLM unavailable — script result — Retry");
  assert.equal(i18n.llmErrorText(commonRu, "llm-pii-fallback"), "Обнаружены ПДн в payload — использован script fallback");
  assert.equal(i18n.llmErrorText(commonEn, "llm-payload-pii"), "Payload contains PII — script fallback");
  assert.equal(i18n.llmErrorText(commonRu, null), null);
  assert.equal(i18n.llmErrorText(commonRu, "Backend says no"), "Backend says no");
  assert.equal(i18n.llmReasonText(commonRu, null), "соответствие по реестру (script)");
  assert.equal(i18n.llmReasonText(commonEn, null), "registry match (script)");
  assert.equal(i18n.llmReasonText(commonRu, "registry-script"), "соответствие по реестру (script)");
  assert.equal(i18n.llmReasonText(commonEn, "llm-tech-contour"), "LLM rerank: technology contour match");
  assert.equal(i18n.llmReasonText(commonRu, "причина от бэкенда"), "причина от бэкенда");
});

test("misc-i18n: контрактные строки экранов зоны — точные значения обеих локалей", () => {
  assert.equal(landingRu("newsEmptyDefault"), "Пока нет опубликованных новостей");
  assert.equal(landingEn("newsEmptyDefault"), "No published news yet");
  assert.equal(landingRu("newsLoadMore"), "Загрузить ещё");
  assert.equal(landingEn("newsLoadMore"), "Load more");
  assert.equal(landingRu("newsShownCount", { shown: 3, total: 9 }), "Показано 3 из 9");
  assert.equal(landingEn("newsShownCount", { shown: 3, total: 9 }), "Showing 3 of 9");
  assert.equal(landingRu("newsUpdated", { date: "1 января" }), "Обновлено 1 января");
  assert.equal(authRu("joinPendingTitle"), "Заявка отправлена");
  assert.equal(authEn("joinCabinet"), "Go to workspace");
  assert.equal(authRu("sessionTitle"), "Сессия истекла — войдите заново");
  assert.equal(authEn("sessionStay"), "Stay");
  assert.equal(authRu("forbiddenTitle"), "Доступ запрещён");
  assert.equal(commonRu("mgrQueueTitle"), "Очередь: черновики и заявки на повышение УГТ");
  assert.equal(commonEn("mgrProjectCode", { id: 12 }), "CNTR-12");
  assert.equal(commonRu("gostTransition", { from: 5, to: 6 }), "Переход УГТ 5 → 6");
  assert.equal(commonEn("gostTransition", { from: 5, to: 6 }), "TRL transition 5 → 6");
  assert.equal(commonRu("funnelTotal", { total: 7 }), "Всего 7");
  assert.equal(commonRu("sectorBackendCount", { count: 2, projects: "a, b" }), "2 проектов: a, b");
  assert.equal(commonRu("offBannerQueue", { count: 3 }), "в очереди: 3");
  assert.equal(commonRu("aiDocTitle", { level: 5 }), "ИИ-консультант · УГТ 5");
  assert.equal(commonEn("aiDocTitle", { level: 5 }), "AI consultant · TRL 5");
});

test("misc-i18n: метаданные страниц — обе локали через словарь, EN без кириллицы", () => {
  // Доделка 05/1: generateMetadata 11 страниц зоны резолвится из landing.
  assert.equal(landingRu("metaNewsTitle"), "Новости — Технозрелость");
  assert.equal(landingEn("metaNewsTitle"), "News — Techno-maturity");
  assert.equal(landingRu("metaHomeTitle"), "Технозрелость — цифровая платформа трансфера технологий ЦНТР УР");
  assert.equal(landingEn("metaHomeTitle"), "Techno-maturity — digital technology transfer platform of CNTR UD");
  assert.equal(landingRu("metaLevelsTitle"), "Уровни УГТ 1–9 — Технозрелость");
  assert.equal(landingEn("metaLevelsTitle"), "TRL levels 1–9 — Techno-maturity");
  assert.equal(landingRu("metaNewsDetailTitle", { title: "N" }), "N — Новости — Технозрелость");
  assert.equal(landingEn("metaNewsDetailTitle", { title: "N" }), "N — News — Techno-maturity");
  assert.equal(landingRu("metaNewsNotFound"), "Новость не найдена — Технозрелость");
  assert.equal(landingEn("metaNewsNotFound"), "News article not found — Techno-maturity");
  assert.equal(landingRu("metaRoadmapDesc").slice(0, 12), "Постройте до");
  assert.doesNotMatch(landingEn("metaRoadmapDesc"), /[А-Яа-яЁё]/);
  assert.doesNotMatch(landingEn("metaPerformersDesc"), /[А-Яа-яЁё]/);
});

test("misc-i18n: вид KPI — по ключам словаря в обеих локалях, без сниффинга текста", () => {
  // Доделка 05/2: равенство каноническим меткам ugt.kpiLabels своей локали.
  const ugtRu = translatorFor("ugt", "ru");
  const ugtEn = translatorFor("ugt", "en");
  assert.equal(i18n.kpiKindForLabel(ugtRu, "Публикации"), "publications");
  assert.equal(i18n.kpiKindForLabel(ugtRu, "Патенты"), "patents");
  assert.equal(i18n.kpiKindForLabel(ugtRu, "Прототип"), "prototype");
  assert.equal(i18n.kpiKindForLabel(ugtEn, "Publications"), "publications");
  assert.equal(i18n.kpiKindForLabel(ugtEn, "Patents"), "patents");
  assert.equal(i18n.kpiKindForLabel(ugtEn, "Prototype"), "prototype");
  // Чужая локаль не матчатся — ветка идёт по ключам, а не по подстрокам.
  assert.equal(i18n.kpiKindForLabel(ugtRu, "Publications"), "other");
  assert.equal(i18n.kpiKindForLabel(ugtEn, "Публикации"), "other");
  assert.equal(i18n.kpiKindForLabel(ugtRu, "что-то иное"), "other");
});

test("misc-i18n: weak-ветка мэтчинга — только сентинел-коды", () => {
  // Доделка 05/3: isFallbackReason без RU-текста; показ кодов — через словарь обеих локалей.
  assert.equal(i18n.isFallbackReason(null), true);
  assert.equal(i18n.isFallbackReason(undefined), true);
  assert.equal(i18n.isFallbackReason("registry-script"), true);
  assert.equal(i18n.isFallbackReason("llm-tech-contour"), true);
  assert.equal(i18n.isFallbackReason("причина от бэкенда"), false);
  assert.equal(i18n.isFallbackReason("LLM reason"), false);
  assert.equal(i18n.llmReasonText(commonRu, "registry-script"), "соответствие по реестру (script)");
  assert.equal(i18n.llmReasonText(commonEn, "registry-script"), "registry match (script)");
});

test("misc-i18n: доделка T06 — меню, роли и причина сессии через словарь обеих локалей", () => {
  // more-menu (common): триггер + 9 пунктов резолвятся резолвером обеих локалей.
  assert.equal(commonRu("moreMenuTrigger"), "Больше функций");
  assert.equal(commonEn("moreMenuTrigger"), "More features");
  assert.equal(commonRu("moreMenuRegistries"), "Реестры");
  assert.equal(commonEn("moreMenuRegistries"), "Registries");
  assert.equal(commonRu("moreMenuNioktr"), "НИОКТР");
  assert.equal(commonEn("moreMenuNioktr"), "R&D");
  assert.equal(commonRu("moreMenuNewsAdmin"), "Новости: админ");
  assert.equal(commonEn("moreMenuNewsAdmin"), "News: admin");
  assert.equal(commonRu("moreMenuExecutors"), "Исполнители");
  assert.equal(commonEn("moreMenuExecutors"), "Performers");
  // Роли регистрации (auth): резолвер getRoleName обеих локалей, 9 слагов.
  assert.equal(roles.getRoleName(authRu, "gk_customer"), "ГосКомпания-заказчик");
  assert.equal(roles.getRoleName(authEn, "gk_customer"), "State-owned customer company");
  assert.equal(roles.getRoleName(authRu, "rd_executor"), "R&D-исполнитель");
  assert.equal(roles.getRoleName(authEn, "rd_executor"), "R&D executor");
  assert.equal(roles.getRoleName(authRu, "cntr_admin"), "Администратор ЦНТР");
  assert.equal(roles.getRoleName(authEn, "cntr_admin"), "CNTR administrator");
  assert.equal(roles.getRoleName(authEn, "cntr_manager"), "CNTR manager");
  assert.equal(roles.getRoleName(authEn, "unknown-slug"), "unknown-slug");
  assert.doesNotMatch(
    JSON.stringify([roles.getRoleName(authEn, "gk_customer"), roles.getRoleName(authEn, "cntr_manager")]),
    /[А-Яа-яЁё]/,
  );
  // Причина 403 модалки сессии (common): код резолвится, техкоды — как есть.
  assert.equal(commonRu("sessionForbiddenReason"), "403 forbidden — роли изменены");
  assert.equal(commonEn("sessionForbiddenReason"), "403 forbidden — roles changed");
});
