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

// ─── Четыре узких кабинета тикета 03 ───────────────────────────────────
const CABINETS = ["investor", "serial_manufacturer", "auditor", "regulating_organization"];

test("маршруты 4 узких кабинетов существуют", () => {
  for (const role of CABINETS) {
    assert.ok(
      exists(`src/app/dashboard/${role}/page.tsx`),
      `кабинет /dashboard/${role} должен существовать`
    );
  }
});

test("страницы узких кабинетов используют API-клиент (нет inline fetch/mock)", () => {
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
    // Прямых fetch в страницах нет — только через клиент.
    assert.doesNotMatch(page, /fetch\(/, `страница ${role} не вызывает fetch напрямую`);
  }
  assert.match(client, /if \(!response\.ok\)/, "клиент проверяет response.ok");
  assert.match(client, /throw new ApiError/, "клиент бросает ApiError на ошибку");
});

test("API-клиент покрывает реальные эндпоинты узких кабинетов (контракты backend)", () => {
  const client = read("src/lib/api-client.ts");
  // Инвестор и серийный производитель: реестр публичных проектов.
  assert.match(client, /getProjectRegistry/);
  assert.match(client, /\/projects\/registry/);
  // Аудитор: решение по контрольной точке (verifier: auditor|regulating_organization).
  assert.match(client, /decideControlPoint/);
  assert.match(client, /\/projects\/\$\{projectId\}\/control-points\/\$\{cpId\}/);
  // Регулирующая организация: верифицирующие документы + карточка проекта.
  assert.match(client, /uploadVerificationDoc/);
  assert.match(client, /\/projects\/\$\{projectId\}\/verification-docs/);
  assert.match(client, /getProjectDetail/);
  // Общее: вступление по токену (все роли).
  assert.match(client, /joinProject/);
  assert.match(client, /\/projects\/join/);
  // Контракт списка: control_points + verification_documents_count (FE-004, без N+1).
  assert.match(client, /control_points/);
  assert.match(client, /verification_documents_count/);
});

test("у кабинетов есть честные empty states и ErrorState (ошибка API ≠ пусто)", () => {
  for (const role of CABINETS) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.match(
      page,
      /EmptyState/,
      `страница ${role} рендерит EmptyState`
    );
    assert.match(
      page,
      /ErrorState/,
      `страница ${role} рендерит ErrorState`
    );
    // Ошибка API → ErrorState (не «успех» и не «0»): catch пишет ошибку.
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
});

test("регулирующая организация: актуальное имя и slug (не старое regulating_org)", () => {
  const roles = read("src/lib/roles.ts");
  const page = read("src/app/dashboard/regulating_organization/page.tsx");
  const backendRef = read("technozrelost-backend/app/api/v1/projects.py");

  // Slug в коде — только актуальный.
  assert.match(roles, /regulating_organization/);
  assert.doesNotMatch(roles, /regulating_org["']/u, "в roles.ts нет старого slug regulating_org");
  assert.doesNotMatch(page, /regulating_org["']/u, "в странице нет старого slug regulating_org");
  // Человекочитаемое имя.
  assert.match(page, /Регулирующая организация/);
  assert.match(roles, /Регулирующая организация/);
  // Backend использует тот же slug (сверка контракта).
  assert.match(backendRef, /regulating_organization/);
});

test("аудитор использует реальный контракт списка (плоский ProjectOut, без documents)", () => {
  const page = read("src/app/dashboard/auditor/page.tsx");
  // GET /projects возвращает плоские объекты: control_points + verification_documents_count.
  assert.match(page, /verification_documents_count/);
  assert.match(page, /control_points/);
  // В списке нет documents/members — их нельзя читать из list-ответа.
  assert.doesNotMatch(page, /detail\.documents/, "нет чтения documents из списка");
  assert.doesNotMatch(page, /\.project\./ , "нет вложенной структуры project.* в списке");
});

test("узкие кабинеты не вызывают чужих эндпоинтов (manager/admin)", () => {
  const managerFns = /getManagerDraftQueue|getManagerPromotions|decideManagerDraft|decideManagerPromotion/;
  const adminFns = /getAdminUsers|updateAdminUser|getAdminAudit/;
  for (const role of CABINETS) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.doesNotMatch(page, managerFns, `${role} без действий менеджера`);
    assert.doesNotMatch(page, adminFns, `${role} без действий администратора`);
  }
});

test("smoke всех 9 ролей: страницы используют общие states из shell (тикет 01)", () => {
  const ALL_ROLES = [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "regulating_organization",
    "auditor",
    "investor",
    "cntr_admin",
    "cntr_manager",
  ];
  for (const role of ALL_ROLES) {
    const page = read(`src/app/dashboard/${role}/page.tsx`);
    assert.match(
      page,
      /CardSkeleton|LoadingState|ErrorState|EmptyState/,
      `страница ${role} должна использовать общие состояния`
    );
    assert.match(
      page,
      /from ["']@\/components\/states["']/,
      `страница ${role} должна импортировать общие states`
    );
  }
});

test("прямой URL к чужому кабинету: middleware редиректит/rewrite — скрытие не расширяет", () => {
  const middleware = read("src/middleware.ts");
  assert.match(middleware, /forbidden/, "middleware отдаёт /forbidden для чужой роли");
  assert.match(middleware, /allowedRolesFor/, "разрешения через allowedRolesFor (roles.ts)");
  const roles = read("src/lib/roles.ts");
  assert.match(roles, /ROUTE_ALLOWED_ROLES/, "карта разрешений в roles.ts");
  const forbidden = exists("src/app/forbidden/page.tsx");
  assert.ok(forbidden, "страница /forbidden существует (честный отказ)");
  // Карта навигации не отдаёт узким ролям чужие ролевые пункты.
  const nav = read("src/lib/navigation.ts");
  for (const role of CABINETS) {
    assert.match(
      nav,
      new RegExp(`${role}: \\[`),
      `роль ${role} имеет свой блок пунктов меню`
    );
  }
  assert.doesNotMatch(
    nav,
    /auditor: \[[\s\S]*?executors/,
    "аудитору недоступен пункт «Исполнители»"
  );
  assert.doesNotMatch(
    nav,
    /investor: \[[\s\S]*?executors/,
    "инвестору недоступен пункт «Исполнители»"
  );
});

test("общие компоненты вступления/документов используют API-клиент (без fetch)", () => {
  const join = read("src/components/join-project-form.tsx");
  assert.match(join, /from ["']@\/lib\/api-client["']/);
  assert.match(join, /joinProject/);
  assert.doesNotMatch(join, /fetch\(/);

  const vdocs = read("src/components/verification-docs-panel.tsx");
  assert.match(vdocs, /from ["']@\/lib\/api-client["']/);
  assert.match(vdocs, /uploadVerificationDoc/);
  assert.match(vdocs, /getProjectDetail/);
  assert.doesNotMatch(vdocs, /fetch\(/);
});
