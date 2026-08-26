import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("login exposes the approved product identity and explicit form states", () => {
  const source = read("src/app/login/page.tsx");

  // Approved-дизайн (c4f0794): в login-странице нет навязчивого брендинга
  // (ТЕХНОЗРЕЛОСТЬ/ГОСТ Р 58048-2017 удалены из снапшота) — тест проверяет
  // фактическую идентичность approved-контента, а не требует его возврата.
  assert.match(source, /Цифровая платформа ЦНТР/);
  assert.match(source, /Один процесс — от заявки до внедрения технологии/);
  assert.match(source, /Центр научно-технологического развития Удмуртской Республики/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Вход…/);
  assert.match(source, /Неверный email или пароль/);
  assert.match(source, /\[1, 2, 3, 4, 5, 6, 7, 8, 9\]/);
});

test("dashboard shell uses compact header with menu button instead of link row", () => {
  const layout = read("src/app/dashboard/layout.tsx");

  // Требование владельца: в шапке — кнопка-меню, а не длинный ряд ссылок.
  // В layout остаются только core-пункты (источник internal-ux-redesign),
  // остальное уезжает в выпадающее меню «Больше функций».
  assert.match(layout, /import HeaderNav from "@\/components\/dashboard\/header-nav"/);
  assert.match(layout, /import MobileNav from "@\/components\/dashboard\/mobile-nav"/);
  for (const label of ["Рабочий стол", "Проекты", "Заявки"]) {
    assert.match(layout, new RegExp(label));
  }
  assert.match(layout, /ТЕХНОЗРЕЛОСТЬ/);
  assert.match(layout, /Перейти к основному содержимому/);
});

test("more-functions menu covers every dashboard route with role filtering", () => {
  const moreMenu = read("src/lib/more-menu.ts");

  // Все страницы кабинета платформы, включая новые (новости, админ-раздел
  // новостей, профиль с «Моими достижениями», исполнители).
  for (const href of [
    "/dashboard/technologies",
    "/dashboard/nioktr",
    "/dashboard/organizations",
    "/dashboard/news",
    "/dashboard/news/admin",
    "/dashboard/executors",
    "/dashboard/ai-assistant",
    "/dashboard/profile",
  ]) {
    assert.ok(
      moreMenu.includes(`href: "${href}"`),
      `пункт меню обязан вести на ${href}`,
    );
  }
  // Фильтрация по ролям — тот же источник истины, что у middleware.
  assert.match(moreMenu, /allowedRolesFor/);
});

test("more-functions menu is least-privileged when session roles are unknown", () => {
  const moreMenu = read("src/lib/more-menu.ts");
  const menuComponent = read("src/components/dashboard/more-functions-menu.tsx");
  const roles = read("src/lib/roles.ts");

  // Пустые/неизвестные роли — не повод показывать всё: getVisibleMenuItems
  // принимает undefined/null и трактует их как «ролей нет» → unrestricted-only.
  assert.match(moreMenu, /getVisibleMenuItems\(userRoles\?:\s*string\[\]\s*\|\s*null\)/);
  const body = moreMenu.slice(moreMenu.indexOf("export function getVisibleMenuItems"));
  assert.match(body, /const known = userRoles \?\? \[\];/);

  // Компонент не имеет фолбэка на полный список: фильтрация вызывается
  // всегда, импорт MORE_MENU_ITEMS в компоненте отсутствует.
  assert.match(menuComponent, /getVisibleMenuItems\(userRoles\)/);
  assert.doesNotMatch(menuComponent, /MORE_MENU_ITEMS/);
  assert.doesNotMatch(menuComponent, /\?\s*getVisibleMenuItems[\s\S]{0,120}:\s*MORE_MENU_ITEMS/);

  // Админ-пункт «Новости: админ» ограничен картой ролей и без явной роли
  // cntr_admin/cntr_manager не появится даже при пустом списке ролей.
  assert.match(roles, /"\/dashboard\/news\/admin":\s*\["cntr_admin",\s*"cntr_manager"\]/);
  assert.match(
    body,
    /allowed !== null && allowed\.some/,
    "fail-closed: пункт без записи в матрице скрыт, restricted-пункты требуют явного совпадения роли",
  );
});

test("customer P0 workspace is honest when no project API is connected", () => {
  const source = read("src/app/dashboard/gk_customer/page.tsx");

  assert.match(source, /Проектов пока нет/);
  assert.match(source, /Создать первую заявку/);
  // Значения карточек приходят из API-состояния (нули при недоступности API),
  // а не захардкожены: ни одна карточка не содержит литерального числового value.
  assert.doesNotMatch(source, /value:\s*['"]\d+['"]/);
});
