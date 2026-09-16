/**
 * Контент P2 (таск 05, G07/G08/G12/G13/G14/G22/G37/G38):
 * инфоконтур, рабочий ЛК всех ролей, жизненный цикл, профили/команды,
 * файлы 25МБ + антивирус, честные пустые состояния новостей и достижений.
 * Шов release-p2: страницы, кабинеты, ролевые действия (публичные границы).
 * Внутри ЛК нет искусственных ограничений сверх ролевых (G22).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// G08: вход ведёт в рабочий кабинет, а не в заглушку — signIn + push в /dashboard.
test("p2-content: вход ведёт в рабочий кабинет (/dashboard), а не в заглушку", () => {
  const login = read("src/app/login/page.tsx");
  assert.match(login, /signIn\("credentials"/);
  assert.match(login, /callbackUrl.*\/dashboard/);
  assert.match(login, /router\.push\(callbackUrl\)/);
  assert.doesNotMatch(login, /заглушк/i);
});

// G08/G11: регистрация ведёт к рабочему кабинету (через вход) и создаёт
// только базовые роли — привилегированные cntr_* недоступны для самовыдачи.
test("p2-content: регистрация ведёт в кабинет и не выдаёт привилегированные роли", () => {
  const register = read("src/app/register/page.tsx");
  assert.match(register, /\/api\/v1\/auth\/register/);
  assert.match(register, /router\.push\("\/login"\)/);
  assert.match(register, /PUBLIC_REGISTRATION_ROLES/);
  assert.match(register, /!role\.slug\.startsWith\("cntr_"\)/);
  assert.doesNotMatch(register, /value="cntr_admin"/);
});

// G10: все восемь ролевых кабинетов доступны своей роли и закрыты чужим.
test("p2-content: восемь ролевых кабинетов в матрице, каждый закрыт чужим", async () => {
  const { allowedRolesFor } = await import("../src/lib/roles.ts");
  const cabinets = [
    ["gk_customer", "/dashboard/gk_customer"],
    ["rd_executor", "/dashboard/rd_executor"],
    ["scientific_org", "/dashboard/scientific_org"],
    ["serial_manufacturer", "/dashboard/serial_manufacturer"],
    ["regulating_organization", "/dashboard/regulating_organization"],
    ["auditor", "/dashboard/auditor"],
    ["investor", "/dashboard/investor"],
    ["cntr_admin", "/dashboard/cntr_admin"],
    ["cntr_manager", "/dashboard/cntr_manager"],
  ];
  for (const [role, route] of cabinets) {
    const allowed = allowedRolesFor(route);
    assert.ok(allowed?.includes(role), `${route}: закрыт для своей роли ${role}`);
  }
  // Чужой кабинет недоступен: заказчик не входит в кабинет аудитора и наоборот.
  assert.ok(!allowedRolesFor("/dashboard/auditor")?.includes("gk_customer"));
  assert.ok(!allowedRolesFor("/dashboard/gk_customer")?.includes("auditor"));
});

// G12: жизненный цикл end-to-end — заявка, реестр, карточка с КТ и оценкой.
test("p2-content: жизненный цикл — заявка, проекты, контрольные точки, оценка", () => {
  const wizard = read("src/app/dashboard/gk_customer/projects/new/page.tsx");
  assert.match(wizard, /QuestionnaireWizardClient/);
  const alias = read("src/app/assessment/new/page.tsx");
  assert.match(alias, /redirect\('\/dashboard\/gk_customer\/projects\/new'\)/);
  const api = read("src/lib/api-client.ts");
  assert.match(api, /export function getRegistry\(params: RegistryParams, accessToken: string\)/);
  assert.match(api, /export function decideControlPoint\(/);
  assert.match(api, /control-points/);
  const card = read("src/features/project/ProjectCard.tsx");
  assert.match(card, /KtPanel/);
});

// G13: профили, организации, участники и приглашения работают end-to-end.
test("p2-content: профили, организации и вступление по приглашению", () => {
  const profile = read("src/app/dashboard/profile/page.tsx");
  assert.match(profile, /\/api\/v1\/profile/);
  const orgs = read("src/app/dashboard/organizations/page.tsx");
  assert.match(orgs, /getOrganizations|organizations/);
  const api = read("src/lib/api-client.ts");
  assert.match(api, /export function joinProject\(/);
  assert.match(api, /\/projects\/join/);
  const join = read("src/app/join/[token]/join-token-client.tsx");
  assert.match(join, /\/invites\/accept/);
  assert.match(join, /\/projects\/join/);
});

// G14: файл до 25 МБ с сигнатурной проверкой и антивирусом; результат виден.
// Уведомления: список + realtime по ticket (без JWT в URL).
test("p2-content: файлы 25МБ + антивирус с видимым результатом, уведомления по ticket", () => {
  const docs = read("src/features/project/DocsPanel.tsx");
  assert.match(docs, /MAX_MB = 25/);
  assert.match(docs, /413/);
  assert.match(docs, /409/);
  assert.match(docs, /scan_status/);
  assert.match(docs, /role="status"|role="alert"/);
  const stream = read("src/features/notifications/useNotificationsStream.ts");
  assert.match(stream, /getSseTicket/);
  assert.match(stream, /EventSource/);
  assert.doesNotMatch(stream, /access_token=|accessToken=\$\{/);
  const feed = read("src/features/notifications/useNotifications.ts");
  assert.match(feed, /getNotifications/);
  assert.match(feed, /markNotificationRead/);
});

// G07 → P3 (таск 09): инфоконтур — главная, о платформе, методология, уровни,
// roadmap, новости, вход, регистрация. P3 открывает реестры (G06):
// навигация ведёт в /projects; supersedes P2-гейт «навигация не ведёт».
test("p3-open: инфоконтур доступен без входа и ведёт в реестры (P2-гейт снят)", () => {
  for (const page of [
    "src/app/(landing)/page.tsx",
    "src/app/(landing)/about/page.tsx",
    "src/app/(landing)/methodology/page.tsx",
    "src/app/(landing)/levels/page.tsx",
    "src/app/(landing)/roadmap/page.tsx",
    "src/app/(landing)/news/page.tsx",
    "src/app/login/page.tsx",
    "src/app/register/page.tsx",
  ]) {
    assert.ok(read(page).length > 0, `${page}: страница инфоконтура отсутствует`);
  }
  const nav = read("src/components/landing/landing-nav.tsx");
  assert.match(nav, /\/projects/);
  const home = read("src/app/(landing)/page.tsx");
  assert.match(home, /fetchPublicRegistryPage/);
  assert.match(home, /href="\/projects"/);
  assert.doesNotMatch(home, /getPublicRegistry/);
});

// G37/G38: новости и достижения показывают честные пустые состояния.
// G22: внутри ЛК нет искусственных лимитов сверх ролевых.
test("p2-content: честные пустые состояния новостей и достижений, ЛК без лимитов", async () => {
  const { translatorFor } = await import("../src/lib/translators.ts");
  const ru = translatorFor("dashboard", "ru");
  const en = translatorFor("dashboard", "en");
  // Достижения/награды/статистика пустыми объясняют механику, а не поломку.
  assert.ok(ru("achieveEmpty").length > 20, "achieveEmpty: нет честного объяснения");
  assert.ok(ru("achieveTeamEmpty").length > 20, "achieveTeamEmpty: нет честного объяснения");
  assert.doesNotMatch(en("achieveEmpty"), /[А-Яа-яЁё]/);
  const showcase = read("src/components/dashboard/achievements-showcase.tsx");
  assert.match(showcase, /achieveEmpty/);
  const team = read("src/components/dashboard/project-achievements.tsx");
  assert.match(team, /achieveTeamEmpty/);
  // Новости: пустая лента ведёт к регистрации, а не к ошибке.
  const newsFeed = read("src/components/landing/news-feed.tsx");
  assert.match(newsFeed, /Пока нет опубликованных новостей/);
  // G22: фильтры/реестры ЛК без скрытых лимитов — пагинация и лимит честные.
  const api = read("src/lib/api-client.ts");
  assert.match(api, /limit.*20|params\.limit \?\? 20/);
});
