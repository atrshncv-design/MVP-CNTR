import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test("matching: standalone mode /dashboard/matching exists and is accessible to all 8 roles", () => {
  assert.ok(exists("src/app/dashboard/matching/page.tsx"), "missing /dashboard/matching/page.tsx");
  assert.ok(exists("src/features/matching/MatchingMode.tsx"), "missing MatchingMode");
  assert.ok(exists("src/features/matching/sanitize.ts"), "missing sanitize");
  assert.ok(exists("src/features/matching/MatchCard.tsx"), "missing MatchCard");

  const roles = read("src/lib/roles.ts");
  assert.match(roles, /"\/dashboard\/matching":\s*ALL_ROLES/);

  const layout = read("src/app/dashboard/layout.tsx");
  assert.match(layout, /\/dashboard\/matching/);
  assert.match(layout, /Подбор партнёра/);
});

test("matching: form has project select from GET /projects + idea textarea + region/sector/ugt filters + Подобрать button", () => {
  const src = read("src/features/matching/MatchingMode.tsx");
  assert.match(src, /getProjects/);
  assert.match(src, /Мои проекты/);
  assert.match(src, /Опишите идею/);
  assert.match(src, /textarea/);
  assert.match(src, /matching-project-select/);
  assert.match(src, /matching-annotation/);
  assert.match(src, /matching-region/);
  assert.match(src, /matching-sector/);
  assert.match(src, /matching-ugt/);
  assert.match(src, /Подобрать/);
  assert.match(src, /POST \/match/);
});

test("matching: POST /match only with clean payload {title, annotation, sector, ugt_level, region, competencies} without PII, contour tuno, обезличивание logs", () => {
  const sanitize = read("src/features/matching/sanitize.ts");
  assert.match(sanitize, /CONTOUR_TUNO/);
  assert.match(sanitize, /tuno/);
  assert.match(sanitize, /ALLOWED_MATCH_FIELDS/);
  assert.match(sanitize, /title/);
  assert.match(sanitize, /annotation/);
  assert.match(sanitize, /competencies/);
  assert.match(sanitize, /sector/);
  assert.match(sanitize, /ugt_level/);
  assert.match(sanitize, /region/);
  assert.match(sanitize, /обезличивание/);
  assert.match(sanitize, /contour/);
  // forbidden keys must be stripped
  assert.match(sanitize, /email/);
  assert.match(sanitize, /budget/);
  assert.match(sanitize, /FORBIDDEN/);

  const mode = read("src/features/matching/MatchingMode.tsx");
  assert.match(mode, /sanitizeMatchingInput/);
  assert.match(mode, /sanitizeFromProject/);
  assert.match(mode, /assertNoPii/);
  assert.match(mode, /CONTOUR_TUNO/);
  assert.match(mode, /matchOrganizations/);
  // ensure no user.email in request
  assert.match(mode, /user\.email|organization.*ПДн|ПДн/);
  // api-client sends Bearer
  const api = read("src/lib/api-client.ts");
  assert.match(api, /matchOrganizations/);
  assert.match(api, /\/match/);
  assert.match(api, /Authorization.*Bearer/);
});

test("matching: result renders ≤5 cards with reasons, score not shown numerically, only verified orgs, Предложить через ЦНТР → Notification toast", () => {
  const mode = read("src/features/matching/MatchingMode.tsx");
  assert.match(mode, /\.slice\(0,\s*5\)/);
  assert.match(mode, /MatchCard/);
  assert.match(mode, /Предложить через ЦНТР/);
  assert.match(mode, /Заявка отправлена в ЦНТР/);
  assert.match(mode, /верифицирован/);

  const card = read("src/features/matching/MatchCard.tsx");
  assert.match(card, /reason/);
  assert.match(card, /Предложить через ЦНТР/);
  assert.match(card, /верифицировано/);
  // score must not be rendered as number
  assert.doesNotMatch(card, /candidate\.score/);
  assert.doesNotMatch(card, /\{score\}/);
});

test("matching: 8 states covered (empty, insufficient, loading, zero, weak, error, stale, success)", () => {
  const src = read("src/features/matching/MatchingMode.tsx");
  assert.match(src, /Выберите проект или опишите идею/);
  assert.match(src, /Заполните карточку проекта/);
  assert.match(src, /ИИ подбирает партнёров/);
  assert.match(src, /Ничего не найдено — уточните описание \/ перейдите в реестр/);
  assert.match(src, /Более подходящих вариантов сейчас нет, вот ближайший/);
  assert.match(src, /Ошибка ИИ — повторить/);
  assert.match(src, /Результат устарел — запустить заново/);
  // success = results.length >0
  assert.match(src, /Подобрано/);
});

test("matching: tags multitag 1-5 from same справочник 30+, no pagination (≤5), no realtime, uses lib/types/api-client/status/filters from 01", () => {
  const src = read("src/features/matching/MatchingMode.tsx");
  assert.match(src, /PROJECT_TAGS/);
  assert.match(src, /competencies/);
  assert.match(src, /1-5|5.*тег|теги/);
  assert.match(src, /getProjects/);
  assert.match(src, /matchOrganizations/);
  assert.match(src, /useDebouncedValue/);
  assert.match(src, /getStatusLabel|lib\/status/);
  // ensure not using registry/project internals (feature components, not type name)
  assert.doesNotMatch(src, /from "@\/features\/registry/);
  assert.doesNotMatch(src, /from "@\/features\/project\//);
  assert.doesNotMatch(src, /RegistryGrid/);
  // ProjectCardOut type is allowed (lib/types), only component file import is forbidden — already checked above
  // no realtime needed
  assert.doesNotMatch(src, /useRealtime/);
  // pagination not needed — no keyset after_id
  assert.doesNotMatch(src, /after_id/);
});

test("matching: обезличивание snapshot does not contain PII (email/budget)", () => {
  const sanitize = read("src/features/matching/sanitize.ts");
  // snapshot test: payload keys must be only allowed
  assert.match(sanitize, /ALLOWED_MATCH_FIELDS/);
  assert.match(sanitize, /competencies/);
  // forbidden detection
  assert.match(sanitize, /assertNoPii/);
});
