import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Пачка D (mvp1-release, доработки родителя): тикеты 15/26/27/28/29.
// Структурный стиль проекта (readFileSync), без импорта TS-модулей.

test("тикет 26: AssessUgTCard доступен в ЛК менеджера", () => {
  const page = read("src/app/dashboard/cntr_manager/page.tsx");
  assert.match(page, /import \{ AssessUgTCard \} from ["']@\/components\/assess-ugt-card["']/);
  assert.match(page, /<AssessUgTCard \/>/);
});

test("тикет 28: история попыток в очереди менеджера", () => {
  const page = read("src/app/dashboard/cntr_manager/page.tsx");
  assert.match(page, /\/api\/v1\/manager\/queue\/history\//);
  assert.match(page, /История попыток/);
});

test("тикет 27: лента заявок в карточке проекта (компонент + эндпоинт)", () => {
  const panel = read("src/components/promotion-history-panel.tsx");
  assert.match(panel, /\/api\/v1\/projects\/\$\{projectId\}\/promotion-history/);
  assert.match(panel, /Заявок пока нет/); // честный empty state
  assert.doesNotMatch(panel, /const (mock|fixture)[A-Za-z]*\s*=|mockArray|mockData/i); // без mock-данных в коде
  const page = read("src/app/dashboard/project/[id]/page.tsx");
  assert.match(page, /<PromotionHistoryPanel projectId=\{p\.id\} \/>/);
  const backend = read("technozrelost-backend/app/api/v1/projects.py");
  assert.match(backend, /promotion-history/);
  assert.match(backend, /require_project_access/);
});

test("тикет 15: смена пароля в профиле", () => {
  const page = read("src/app/dashboard/profile/page.tsx");
  assert.match(page, /\/api\/v1\/users\/me\/password/);
  assert.match(page, /current_password/);
  assert.match(page, /Сменить пароль/);
});

test("тикет 29: категории реестра вычисляются из данных (без хардкода)", () => {
  const page = read("src/app/dashboard/technologies/page.tsx");
  assert.doesNotMatch(page, /const CATEGORIES = \[/);
  assert.match(page, /categories\.map/);
  assert.match(page, /new Set\(projects\.map/);
});
