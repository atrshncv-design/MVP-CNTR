import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const exists = (path) => {
  try {
    return statSync(new URL(`../${path}`, import.meta.url)).isFile();
  } catch {
    return false;
  }
};

// ─── Пять кабинетов тикета 02 ────────────────────────────────────────────
// ugt_expert: роль отсутствует в коде (roles.ts/backend) и маршрута нет —
// честная карточка в verification-report (см. тест ниже).
const CABINETS = [
  "cntr_manager",
  "cntr_admin",
  "gk_customer",
  "rd_executor",
];

test("маршруты 4 кабинетов существуют; ugt_expert маршрута НЕТ (честно)", () => {
  for (const role of CABINETS) {
    assert.ok(
      exists(`src/app/dashboard/${role}/page.tsx`),
      `кабинет /dashboard/${role} должен существовать`
    );
  }
  // Эксперт: в MVP роль ugt_expert отсутствует — маршрута нет и не создаём.
  assert.ok(
    !exists("src/app/dashboard/ugt_expert/page.tsx"),
    "маршрута /dashboard/ugt_expert быть не должно (роль не в коде)"
  );
  const roles = read("src/lib/roles.ts");
  assert.doesNotMatch(roles, /ugt_expert/, "роль ugt_expert не определена в roles.ts");
});

test("страницы кабинетов используют API-клиент (нет inline mock-массивов)", () => {
  const client = read("src/lib/api-client.ts");
  for (const role of CABINETS) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.match(
      page,
      /from ["']@\/lib\/api-client["']/,
      `страница ${role} должна импортировать API-клиент`
    );
    // Никаких mock-массивов и захардкоженных данных в production UI.
    assert.doesNotMatch(page, /mock/i, `страница ${role} не содержит mock-данных`);
    assert.doesNotMatch(
      page,
      /\{\s*id:\s*\d+\s*,\s*name:/,
      `страница ${role} не содержит inline-массивов данных (id/name)`
    );
  }
  assert.match(client, /if \(!response\.ok\)/, "клиент проверяет response.ok");
  assert.match(client, /throw new ApiError/, "клиент бросает ApiError на ошибку");
});

test("API-клиент покрывает реальные эндпоинты 5 кабинетов (контракты backend)", () => {
  const client = read("src/lib/api-client.ts");
  // Менеджер: очереди и решения (cntr_manager + cntr_admin на backend).
  assert.match(client, /\/manager\/queue\/drafts/);
  assert.match(client, /\/manager\/queue\/drafts\/\$\{projectId\}\/decide/);
  assert.match(client, /\/manager\/queue\/promotions/);
  // Администратор: пользователи и аудит (только cntr_admin).
  assert.match(client, /\/users"/);
  assert.match(client, /\/users\/\$\{userId\}/);
  assert.match(client, /\/admin\/audit/);
  // Общие: проекты, исполнители.
  assert.match(client, /getProjects/);
  assert.match(client, /getExecutors/);
  // Ошибки: human-readable detail из FastAPI + статус.
  assert.match(client, /detail/);
  assert.match(client, /status/);
});

test("submit-действия обрабатывают ошибки: нет catch → success", () => {
  for (const role of CABINETS) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    // catch-блоки пишут ошибку (setError), а не «успех».
    assert.match(
      page,
      /catch\s*\([^)]*\)\s*\{[^}]*setError/,
      `страница ${role}: catch должен показывать ошибку`
    );
    assert.doesNotMatch(
      page,
      /catch\s*\([^)]*\)\s*\{\s*set[A-Z][a-zA-Z]*\((?:true|["'](?:Сохранено|Готово|Успешно))["']?\)/,
      `страница ${role}: catch не должен сообщать об успехе`
    );
  }
  // Сам клиент не глотает ошибки (бросает ApiError; 400/403/429 — поведенческий тест).
  const client = read("src/lib/api-client.ts");
  assert.doesNotMatch(client, /catch\s*\([^)]*\)\s*\{\s*return\s+\[\]\s*\}/);
});

test("ролевые действия ограничены: у роли нет кнопок/вызовов чужих эндпоинтов", () => {
  // Функции клиента, доступные только менеджеру/админу.
  const managerFns = /getManagerDraftQueue|getManagerPromotions|decideManagerDraft|decideManagerPromotion/;
  const adminFns = /getAdminUsers|updateAdminUser|getAdminAudit/;

  const manager = read("src/app/dashboard/cntr_manager/page.tsx");
  assert.match(manager, managerFns, "менеджер: очереди/решения");
  assert.doesNotMatch(manager, adminFns, "менеджер не вызывает админ-эндпоинты");

  const admin = read("src/app/dashboard/cntr_admin/page.tsx");
  assert.match(admin, adminFns, "администратор: пользователи/аудит");
  assert.doesNotMatch(admin, managerFns, "администратор не вызывает очередь менеджера");

  // Заказчик и исполнитель: только свои данные, без действий менеджера/админа.
  for (const role of ["gk_customer", "rd_executor"]) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.doesNotMatch(page, managerFns, `${role} без действий менеджера`);
    assert.doesNotMatch(page, adminFns, `${role} без действий администратора`);
  }
});

test("gk_customer: ошибка API → ErrorState (не «пусто» и не «0»)", () => {
  const page = read("src/app/dashboard/gk_customer/page.tsx");
  assert.match(page, /ErrorState/, "страница рендерит ErrorState");
  assert.doesNotMatch(page, /catch\s*\{\s*\/\//, "нет «заглушки» в catch");
  // Статистика при ошибке — честный прочерк, а не 0.
  assert.match(page, /error \? \(\s*\/\/ Ошибка API/);
  assert.doesNotMatch(page, /projectsRes\.ok \? /, "нет ветки «ok ? данные : []»");
});

test("все 4 страницы кабинетов используют общие states из shell (тикет 01)", () => {
  for (const role of CABINETS) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.match(
      page,
      /CardSkeleton|LoadingState|ErrorState|EmptyState/,
      `страница ${role} должна использовать общие состояния`
    );
  }
});
