/**
 * P2-gating (таск 02, G04/G05/G06/G09/G35/G36): первый релиз — инфоконтур + ЛК
 * одним пакетом; публичные реестры и matching отложены в P3.
 * Швы release-p2: страницы, кабинеты, ролевые действия (публичные границы).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { allowedRolesFor } from "../src/lib/roles.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

// G36: matching скрыт на уровне роутов — маршрута нет, вернуть его может только P3.
test("p2-gating: маршрута /dashboard/matching нет в дереве (matching — P3)", () => {
  assert.equal(
    exists("src/app/dashboard/matching/page.tsx"),
    false,
    "P2 не содержит /dashboard/matching: удалён до P3",
  );
});

// G36 + критерий «матрица не даёт доступа»: записи нет → null → middleware в /forbidden.
test("p2-gating: ролевая матрица не даёт доступа к matching (fail-closed)", () => {
  assert.equal(allowedRolesFor("/dashboard/matching"), null);
  assert.doesNotMatch(read("src/lib/roles.ts"), /\/dashboard\/matching/);
});

// G36: matching скрыт на уровне навигации ЛК — ни одной ссылки (комментарии не в счёт).
test("p2-gating: навигация ЛК не ведёт в matching", () => {
  assert.doesNotMatch(read("src/app/dashboard/layout.tsx"), /href: "\/dashboard\/matching"/);
});

// G36: matching не рекламируется API-клиентом — ни одного вызова POST /match.
test("p2-gating: api-client не шлёт POST /match (matching закрыт до P3)", () => {
  const api = read("src/lib/api-client.ts");
  assert.doesNotMatch(api, /["`]\/match["`]/);
  for (const fn of ["matchOrganizations", "postMatch"]) {
    const at = api.indexOf(`function ${fn}`);
    assert.notEqual(at, -1, `${fn} обязан остаться gated-заглушкой до P3`);
    assert.match(
      api.slice(at, at + 400),
      /P2_GATED|p2GatedMessage/,
      `${fn} обязан бросать P2-gate, а не ходить в сеть`,
    );
  }
});

// G04/G35: анонимный доступ к реестрам закрыт — лендинг не тянет реестр без токена.
test("p2-gating: api-client не отдаёт анонимный реестр (getPublicRegistry закрыт до P3)", () => {
  const api = read("src/lib/api-client.ts");
  const at = api.indexOf("function getPublicRegistry");
  assert.notEqual(at, -1, "getPublicRegistry обязан остаться gated-заглушкой до P3");
  const body = api.slice(at, at + 600);
  assert.match(body, /P2_GATED|p2GatedMessage/);
  assert.doesNotMatch(body, /publicApiRequest/);
});

// G04/G35: внутрь ЛК реестры доступны (ЛК весь) — аутентифицированный клиент цел.
test("p2-gating: аутентифицированный реестр ЛК не затронут (getRegistry с токеном)", () => {
  const api = read("src/lib/api-client.ts");
  assert.match(api, /export function getRegistry\(params: RegistryParams, accessToken: string\)/);
  const from = api.indexOf("export function getRegistry");
  const to = api.indexOf("export function togglePublish");
  const body = api.slice(from, to === -1 ? from + 2500 : to);
  assert.match(body, /\/projects\/registry/);
  assert.match(body, /apiRequest</);
});

// G06/G12 → P3 (таск 09): порядок «инфоконтур → ЛК → реестры» завершён —
// главная ведёт в открытый реестр живым тизером; supersedes P2-гейт
// «навигация не ведёт». landing-nav.tsx вне зоны таска 09 — пункт меню
// реестров остаётся follow-up; gated-заглушка api-client не используется.
test("p3-open: главная ведёт в открытый реестр (P2-гейт навигации снят)", () => {
  const home = read("src/app/(landing)/page.tsx");
  assert.match(home, /fetchPublicRegistryPage/);
  assert.match(home, /href="\/projects"/);
  assert.doesNotMatch(home, /getPublicRegistry/);
});

// G04 → P3 (таск 09): /projects открыт — SSR первой страницы анонимно,
// дальше клиентская пагинация after_id; supersedes P2-гейт «страница закрыта».
test("p3-open: страница /projects читает реестр анонимно (P2-гейт снят)", () => {
  const src = read("src/app/(landing)/projects/page.tsx");
  assert.match(src, /fetchPublicRegistryPage/);
  assert.match(src, /ProjectsShowcase/);
  assert.doesNotMatch(src, /getPublicRegistry/);
  assert.doesNotMatch(src, /Bearer/);
  assert.doesNotMatch(src, /Authorization['"]?\s*:/);
});
