import assert from "node:assert/strict";
import test from "node:test";

// Шов таска 03: только публичные резолверы зоны через штатный переводчик
// next-intl (translatorFor) обеих локалей. Никаких регулярок по исходникам,
// никаких прямых чтений JSON без резолверов. Ожидаемые строки — контракт
// приёмки (RU — текущий экран, EN — перевод сборки), а не код под тестом.

const { translatorFor } = await import("../src/lib/translators.ts");
const i18n = await import("../src/features/registry/i18n.ts");
const xlsx = await import("../src/features/registry/export/exportXlsx.ts");

const ru = translatorFor("registry", "ru");
const en = translatorFor("registry", "en");

test("registry-i18n: заголовки экспорта проектов резолвятся в обеих локалях", () => {
  assert.deepEqual(xlsx.getProjectHeaders(ru), [
    "ID",
    "Название",
    "Описание",
    "Теги",
    "УГТ текущий",
    "УГТ целевой",
    "Бюджет, ₽",
    "Организация",
    "Статус",
    "Создан",
    "Обновлён",
  ]);
  assert.deepEqual(xlsx.getOrganizationHeaders(en), [
    "ID",
    "Name",
    "Short name",
    "OGRN",
    "Type",
    "Region",
    "Projects",
    "Competencies",
  ]);
  assert.deepEqual(xlsx.getNioktrHeaders(ru)[1], "Рег. номер");
  assert.deepEqual(xlsx.getNioktrHeaders(en)[1], "Reg. number");
  assert.equal(xlsx.getNioktrHeaders(ru).length, 10);
  assert.equal(xlsx.getNioktrHeaders(en).length, 10);
  assert.doesNotMatch(JSON.stringify(xlsx.getProjectHeaders(en)), /[А-Яа-яЁё]/);
  assert.doesNotMatch(JSON.stringify(xlsx.getOrganizationHeaders(en)), /[А-Яа-яЁё]/);
  assert.doesNotMatch(JSON.stringify(xlsx.getNioktrHeaders(en)), /[А-Яа-яЁё]/);
});

test("registry-i18n: воркбук пишет переведённые заголовки и статусы", async () => {
  const wbRu = await xlsx.buildProjectWorkbook([], { t: ru });
  const headRu = wbRu.getWorksheet(1).getRow(1).values.slice(1);
  assert.deepEqual(headRu, xlsx.getProjectHeaders(ru));

  const wbEn = await xlsx.buildProjectWorkbook(
    [
      {
        id: 7,
        name: "Demo",
        description: null,
        tags: [],
        category: null,
        current_level: 3,
        target_level: 7,
        budget: null,
        organization: null,
        status: "active",
        created_at: null,
        updated_at: null,
      },
    ],
    { t: en },
  );
  const ws = wbEn.getWorksheet(1);
  assert.deepEqual(ws.getRow(1).values.slice(1), xlsx.getProjectHeaders(en));
  const body = ws.getRow(2).values.slice(1);
  assert.equal(body[8], "Active");

  const wbNioktr = await xlsx.buildNioktrWorkbook(
    [
      {
        id: 1,
        registration_number: "R-1",
        name: "N",
        annotation: null,
        keywords: [],
        nioktr_types: [],
        executor_name: null,
        customer_name: null,
        created_date: null,
        is_ai_area: true,
      },
    ],
    { t: en },
  );
  assert.equal(wbNioktr.getWorksheet(1).getRow(2).values.slice(1)[9], "Yes");
});

test("registry-i18n: описание сохранённого фильтра — через перевод с параметрами", () => {
  const filters = {
    search: "foo",
    tags: ["a", "b"],
    ugt_min: 7,
    ugt_max: 9,
    status: "active",
    region: "Удмуртия",
    budget_min: 10,
    budget_max: 20,
  };
  assert.equal(
    i18n.describeFiltersT(ru, filters),
    "поиск:foo · теги:a,b · УГТ 7…9 · статус:active · регион:Удмуртия · бюджет 10…20",
  );
  assert.equal(
    i18n.describeFiltersT(en, filters),
    "search:foo · tags:a,b · TRL 7…9 · status:active · region:Удмуртия · budget 10…20",
  );
  assert.equal(i18n.describeFiltersT(ru, {}), "без параметров");
  assert.equal(i18n.describeFiltersT(en, {}), "no parameters");
});

test("registry-i18n: ключевые подписи таблицы и звезды — точные строки обеих локалей", () => {
  assert.equal(ru("emptyDefaultTitle"), "Пока нет проектов — создайте заявку");
  assert.equal(en("emptyDefaultTitle"), "No projects yet — create a request");
  assert.equal(ru("forbiddenTitle"), "Доступ запрещён");
  assert.equal(en("forbiddenTitle"), "Access denied");
  assert.equal(ru("tableSortBy", { label: "Бюджет" }), "Сортировка по Бюджет");
  assert.equal(en("tableSortBy", { label: "Budget" }), "Sort by Budget");
  assert.equal(ru("cntrId", { id: 12 }), "ЦНТР-12");
  assert.equal(en("cntrId", { id: 12 }), "CNTR-12");
  assert.equal(ru("ugtShort", { level: 3 }), "УГТ 3");
  assert.equal(en("ugtShort", { level: 3 }), "TRL 3");
  assert.equal(ru("favAdd", { label: "X" }), "В избранное: X");
  assert.equal(en("favRemove", { label: "X" }), "Remove from favorites: X");
  assert.equal(ru("viewCardsLabel"), "Вид: карточки");
  assert.equal(en("exportLabel"), "Export XLSX");
  assert.equal(ru("exportError"), "Экспорт XLSX не удался");
  assert.equal(en("exportError"), "XLSX export failed");
});
