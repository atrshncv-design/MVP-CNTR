import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("login exposes the approved product identity and explicit form states", () => {
  const source = read("src/app/login/page.tsx");

  assert.match(source, /ТЕХНОЗРЕЛОСТЬ/);
  assert.match(source, /ГОСТ Р 58048-2017/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Вход…/);
  assert.match(source, /Неверный email или пароль/);
  assert.match(source, /\[1, 2, 3, 4, 5, 6, 7, 8, 9\]/);
});

test("dashboard shell uses process-first global navigation", () => {
  const layout = read("src/app/dashboard/layout.tsx");
  const menu = read("src/lib/more-menu.ts");

  // Процессные пункты — в шапке (тикет 01: только логотип + 3 пункта + «Больше функций»)
  for (const label of ["Рабочий стол", "Проекты", "Заявки"]) {
    assert.match(layout, new RegExp(label));
  }
  // Остальные функции переехали в dropdown «Больше функций» (src/lib/more-menu.ts)
  assert.match(menu, /Больше функций/);
  for (const label of ["Реестры", "НИОКТР", "Организации", "Документы", "Профиль"]) {
    assert.match(menu, new RegExp(label));
  }
  assert.match(layout, /ТЕХНОЗРЕЛОСТЬ/);
  assert.match(layout, /Перейти к основному содержимому/);
});

test("«Больше функций» и mobile-меню реализуют dropdown-поведение", () => {
  const more = read("src/components/dashboard/more-functions-menu.tsx");
  assert.match(more, /aria-expanded/);
  assert.match(more, /aria-haspopup/);
  assert.match(more, /Escape/);
  assert.match(more, /pointerdown/);
  assert.match(more, /В разработке/);

  const mobile = read("src/components/dashboard/mobile-nav.tsx");
  assert.match(mobile, /aria-label="Меню"/);
  assert.match(mobile, /Escape/);
});

test("«Больше функций» фильтруется ролевой картой маршрутов (тикет 02)", () => {
  const menu = read("src/lib/more-menu.ts");
  const more = read("src/components/dashboard/more-functions-menu.tsx");
  const header = read("src/components/dashboard/header-nav.tsx");
  const layout = read("src/app/dashboard/layout.tsx");

  // Источник истины — карта маршрутов src/lib/roles.ts (allowedRolesFor),
  // та же, что использует middleware; меню не показывает запрещённые ссылки.
  assert.match(menu, /allowedRolesFor/);
  assert.match(menu, /isReady: false/);
  assert.match(menu, /Исполнители/);
  // Сессионные роли доезжают из серверного layout до клиентского dropdown.
  assert.match(header, /userRoles/);
  assert.match(layout, /userRoles/);
  assert.match(more, /getVisibleMenuItems/);
  // Бейдж «В разработке» — маленький вторичный (базовый класс tz-badge).
  assert.match(more, /tz-badge tz-badge-neutral/);
});

test("customer P0 workspace is honest when no project API is connected", () => {
  const source = read("src/app/dashboard/gk_customer/page.tsx");

  assert.match(source, /Проектов пока нет/);
  assert.match(source, /Создать первую заявку/);
  // Значения карточек приходят из API-состояния (нули при недоступности API),
  // а не захардкожены: ни одна карточка не содержит литерального числового value.
  assert.doesNotMatch(source, /value:\s*['"]\d+['"]/);
});

test("тикет 03: единый breadcrumb, сворачиваемые панели, честные состояния", () => {
  const layout = read("src/app/dashboard/layout.tsx");
  const breadcrumb = read("src/components/dashboard/breadcrumb.tsx");
  const breadcrumbClient = read("src/components/dashboard/dashboard-breadcrumb.tsx");
  const sidebar = read("src/components/dashboard/collapsible-sidebar.tsx");
  const loading = read("src/app/dashboard/loading.tsx");
  const error = read("src/app/dashboard/error.tsx");

  // Обязательный единый breadcrumb в общем layout: цепочка по умолчанию
  // генерируется из pathname (usePathname), страницы могут переопределить
  // через useBreadcrumb; последний элемент — текущая страница.
  assert.match(layout, /DashboardBreadcrumb/);
  assert.match(layout, /BreadcrumbProvider/);
  assert.match(breadcrumb, /aria-label="Хлебные крошки"/);
  assert.match(breadcrumb, /aria-current="page"/);
  assert.match(breadcrumbClient, /usePathname/);

  // Сворачиваемые боковые панели: состояние в localStorage (tz-sidebar-<id>),
  // кнопка-триггер с aria-expanded.
  assert.match(sidebar, /tz-sidebar-/);
  assert.match(sidebar, /localStorage/);
  assert.match(sidebar, /aria-expanded/);

  // Честные loading/error без mock-success: skeleton с пульсацией
  // (reduced-motion — motion-reduce:animate-none), ошибка с повторной попыткой.
  assert.match(loading, /animate-pulse/);
  assert.match(loading, /motion-reduce/);
  assert.match(error, /reset/);
  assert.match(error, /Повторить/);
  assert.doesNotMatch(loading, /успешн/i);
});

test("тикет 05: реестры — таблица/карточки, поиск, фильтры, пагинация, сохранение", () => {
  const technologies = read("src/app/dashboard/technologies/page.tsx");
  const nioktr = read("src/app/dashboard/nioktr/page.tsx");
  const organizations = read("src/app/dashboard/organizations/page.tsx");
  const executors = read("src/app/dashboard/executors/page.tsx");
  const apiClient = read("src/lib/api-client.ts");

  // Общие паттерны для всех четырёх реестров: переключатель вида
  // (aria-pressed + localStorage), поиск, фильтры, сортировка, пагинация,
  // сохранение состояния (URL через history.replaceState + localStorage).
  for (const source of [technologies, nioktr, organizations, executors]) {
    assert.match(source, /aria-pressed/);
    assert.match(source, /localStorage/);
    assert.match(source, /type="search"/);
    assert.match(source, /aria-label="Сортировка"/);
    assert.match(source, /aria-label="Пагинация"/);
    assert.match(source, /history\.replaceState/);
    assert.match(source, /tz-table/);
    assert.match(source, /Сбросить фильтры/);
    // Компактные карточки без радара: ни один реестр не импортирует радар
    // (ProjectRadar / RadarChart) и не использует тёмную тему.
    assert.doesNotMatch(source, /ProjectRadar|RadarChart|recharts/);
    assert.doesNotMatch(source, /dark:/);
  }

  // Типы реестров вынесены в общий клиентский модуль api-client.ts.
  assert.match(apiClient, /export interface NioktrCard/);
  assert.match(apiClient, /export interface OrganizationSummary/);
  assert.match(apiClient, /export interface ExecutorSummary/);
  assert.match(apiClient, /export interface RegistryProject/);
  // Существующий экспорт не сломан.
  assert.match(apiClient, /export interface ProjectSummary/);
  assert.match(apiClient, /export function getProjects/);

  // Технологии: без выдуманного status — API реестра его не отдаёт.
  assert.doesNotMatch(technologies, /status:\s*["']published["']/);
  assert.match(technologies, /Технологии УГТ 7\+/);
  assert.match(technologies, /aria-label="Вид реестра"/);

  // НИОКТР: ссылки на отдельные подробные маршруты.
  assert.match(nioktr, /dashboard\/nioktr\/\$\{encodeURIComponent\(card\.registration_number\)\}/);
  assert.match(nioktr, /Честный лимит окна/);

  // Организации: ссылки на карточку по ОГРН.
  assert.match(organizations, /dashboard\/organizations\/\$\{encodeURIComponent\(org\.ogrn\)\}/);
  assert.match(organizations, /Фильтр по типу организации/);
  assert.match(organizations, /Фильтр по региону/);
});

test("тикет 05: реестр исполнителей — без mock-данных, честные пустые состояния", () => {
  const executors = read("src/app/dashboard/executors/page.tsx");

  // Данные приходят из реальных API-эндпоинтов, а не захардкожены.
  assert.match(executors, /\/api\/v1\/executors\/specialists/);
  assert.match(executors, /\/api\/v1\/executors\/organizations/);
  assert.doesNotMatch(executors, /full_name:\s*["']/);
  assert.match(executors, /Раздел пока пуст/);
  assert.match(executors, /Подтверждённых профилей специалистов в каталоге пока нет/);
});

test("тикет 05: подробные страницы НИОКТР и организаций — светлая карточка с breadcrumb", () => {
  const nioktrDetail = read("src/app/dashboard/nioktr/[registration_number]/page.tsx");
  const orgDetail = read("src/app/dashboard/organizations/[ogrn]/page.tsx");

  for (const source of [nioktrDetail, orgDetail]) {
    // Единый обязательный breadcrumb через useBreadcrumb.
    assert.match(source, /useBreadcrumb/);
    assert.match(source, /Рабочий стол/);
    // Светлая тема: никаких тёмных градиентных блоков и dark:-классов.
    assert.doesNotMatch(source, /dark:/);
    assert.doesNotMatch(source, /from-\[#2a1518\]/);
    assert.doesNotMatch(source, /text-white/);
    // Карточки-секции на токенах, честные состояния.
    assert.match(source, /tz-surface/);
    assert.match(source, /Карточка не найдена|Организация не найдена/);
  }

  assert.match(nioktrDetail, /tz-page-title break-words/);
  assert.match(orgDetail, /tz-page-title break-words/);
});

test("тикет 04: список проектов — таблица/карточки, поиск, фильтры, пагинация, без радаров", () => {
  const page = read("src/app/dashboard/projects/page.tsx");
  const explorer = read("src/app/dashboard/projects/projects-explorer.tsx");
  const client = read("src/lib/api-client.ts");

  // Страница остаётся серверной и честной: error состояние сохраняется,
  // интерактив вынесен в клиентский проводник; пустое состояние живёт
  // в проводнике (рендерится всегда — тикет 04/07).
  assert.match(page, /ProjectsExplorer/);
  assert.match(page, /Не удалось загрузить проекты/);
  assert.match(explorer, /Проектов пока нет/);
  assert.match(explorer, /Ничего не найдено/);
  // Радаров в карточках списка нет — компонент радара не используется.
  assert.doesNotMatch(page, /ProjectRadar/);
  assert.doesNotMatch(explorer, /ProjectRadar/);

  // Переключатель «карточки / таблица» с сохранением выбора в localStorage.
  assert.match(explorer, /tz-projects-view/);
  assert.match(explorer, /aria-pressed/);
  assert.match(explorer, />Карточки</);
  assert.match(explorer, />Таблица</);

  // Поиск, фильтры (статус, УГТ), сортировка.
  assert.match(explorer, /type="search"/);
  assert.match(explorer, /Поиск по названию/);
  assert.match(explorer, /Фильтр по статусу/);
  assert.match(explorer, /Фильтр по уровню УГТ/);
  assert.match(explorer, /Сортировка/);

  // Таблица: требуемые колонки + горизонтальный скролл в контейнере с tabindex.
  for (const column of ["Название", "Категория", "УГТ", "Статус", "Обновлён"]) {
    assert.match(explorer, new RegExp(`>\\s*${column}\\s*<`));
  }
  assert.match(explorer, /overflow-x-auto/);
  assert.match(explorer, /tabIndex=\{0\}/);

  // Пагинация.
  assert.match(explorer, /aria-label="Пагинация"/);
  assert.match(explorer, /Предыдущая страница/);
  assert.match(explorer, /Следующая страница/);

  // Сохранение фильтров: localStorage + URL-параметры (URL приоритетнее).
  assert.match(explorer, /tz-projects-filters/);
  assert.match(explorer, /useSearchParams/);
  assert.match(explorer, /router\.replace/);

  // Честное пустое состояние при фильтрах без результата.
  assert.match(explorer, /Ничего не найдено/);
  assert.match(explorer, /Сбросить фильтры/);

  // Типы карточки проекта — в едином api-client (без поломки существующих export).
  assert.match(client, /export interface ProjectDetail/);
  assert.match(client, /export interface ProjectSummary/);
});

test("тикет 04: карточка проекта — порядок блоков и траектория УГТ только в сайдбаре", () => {
  const source = read("src/app/dashboard/project/[id]/page.tsx");

  // Строгий порядок: сводка → статус/УГТ → документы → команда → история → аналитика.
  const headings = ["Сводка", "Статус и УГТ", "Документы", "Команда", "История", "Аналитика"];
  const positions = headings.map((h) => source.indexOf(`>${h}<`));
  assert.ok(positions.every((p) => p >= 0), `все заголовки блоков найдены: ${headings.join(", ")}`);
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(
      positions[i] > positions[i - 1],
      `блок «${headings[i]}» идёт после «${headings[i - 1]}»`,
    );
  }

  // UgtTrajectory — ровно один раз и только внутри боковой колонки (aside).
  assert.equal(source.split("<UgtTrajectory").length - 1, 1);
  const asideStart = source.indexOf("<aside");
  const asideEnd = source.indexOf("</aside>");
  const radarPos = source.indexOf("<UgtTrajectory");
  assert.ok(asideStart >= 0 && asideEnd > asideStart, "боковая колонка <aside> присутствует");
  assert.ok(radarPos > asideStart && radarPos < asideEnd, "радар находится внутри aside");

  // Хлебные крошки с названием проекта (тикет 03: useBreadcrumb).
  assert.match(source, /useBreadcrumb/);
  assert.match(source, /Проекты', href: '\/dashboard\/projects'/);
});
