/**
 * Тесты новостного раздела ЛК (тикет 08, спека §3.7):
 * лента /dashboard/news, консоль /dashboard/news/admin, редактор
 * /dashboard/news/new и /dashboard/news/[id]/edit, авторизованный
 * api-клиент, RBAC-навигация.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard news feed: лента всех ролей + управление для автора/админа", () => {
  const page = read("src/app/dashboard/news/page.tsx");
  const card = read("src/components/dashboard/news-card.tsx");

  assert.match(page, /getAdminNewsList/);
  assert.match(page, /publishNews/);
  assert.match(page, /unpublishNews/);
  assert.match(page, /Создать новость/); // CTA для сотрудников ЦНТР
  assert.match(page, /Консоль/);
  assert.match(page, /Пока нет опубликованных новостей/); // честный empty-state
  // Кнопки управления в карточке: редактировать/опубликовать/снять.
  assert.match(card, /Редактировать/);
  assert.match(card, /Опубликовать/);
  assert.match(card, /Снять с публикации/);
  assert.match(card, /NEWS_STATUS_LABELS/);
});

test("admin console: фильтры статуса/категории и все действия", () => {
  const page = read("src/app/dashboard/news/admin/page.tsx");

  assert.match(page, /getAdminNewsList/); // консоль через /news/admin-list
  assert.match(page, /status/); // фильтр по статусу (серверный)
  assert.match(page, /Черновики/);
  assert.match(page, /Запланированные/);
  assert.match(page, /Опубликованные/);
  assert.match(page, /Категория/); // фильтр по категории
  // Действия строки.
  assert.match(page, /publishNews/);
  assert.match(page, /scheduleNews/);
  assert.match(page, /unpublishNews/);
  assert.match(page, /deleteNews/);
  assert.match(page, /datetime-local/); // модалка планирования
  assert.match(page, /Удалить\?/); // подтверждение удаления
  // Менеджер видит только свои (подсказка в hero).
  assert.match(page, /чужие в консоли не показываются/);
});

test("news editor: форма, предпросмотр, медиа, кнопки жизненного цикла", () => {
  const editor = read("src/components/dashboard/news-editor.tsx");

  assert.match(editor, /createNews/); // POST /news для новых
  assert.match(editor, /updateNews/); // PATCH для существующих
  assert.match(editor, /publishNews/);
  assert.match(editor, /scheduleNews/);
  assert.match(editor, /uploadNewsMedia/); // cover/inline/attachment/gallery
  assert.match(editor, /deleteNewsMedia/);
  assert.match(editor, /getNewsCategories/); // select категорий
  assert.match(editor, /dangerouslySetInnerHTML/); // предпросмотр HTML
  assert.match(editor, /Сохранить черновик/);
  assert.match(editor, /Опубликовать сейчас/);
  assert.match(editor, /Запланировать/);
  assert.match(editor, /datetime-local/);
  assert.match(editor, /Категория/); // обязательна
  assert.match(editor, /Обложка/);
  assert.match(editor, /Вложения/);
  assert.match(editor, /Галерея/);
  // Поля source/created_automatically не показываются.
  assert.doesNotMatch(editor, /created_automatically/);
  assert.doesNotMatch(editor, /source:/);
  // Менеджер не может открыть чужую новость (UI-гвард).
  assert.match(editor, /Нет доступа к этой новости/);
});

test("news editor pages: new и [id]/edit используют общий редактор", () => {
  const newPage = read("src/app/dashboard/news/new/page.tsx");
  const editPage = read("src/app/dashboard/news/[id]/edit/page.tsx");

  assert.match(newPage, /NewsEditor/);
  assert.match(newPage, /Новая новость/);
  assert.match(editPage, /NewsEditor/);
  assert.match(editPage, /useParams/);
  assert.match(editPage, /Редактирование новости/);
});

test("authorized api client: консоль, lifecycle и media (Bearer)", () => {
  const api = read("src/lib/news-admin-api.ts");

  assert.match(api, /getAdminNewsList/);
  assert.match(api, /\`Bearer \$\{token\}\`/);
  assert.match(api, /createNews/);
  assert.match(api, /updateNews/);
  assert.match(api, /publishNews/);
  assert.match(api, /scheduleNews/);
  assert.match(api, /unpublishNews/);
  assert.match(api, /deleteNews/);
  assert.match(api, /uploadNewsMedia/);
  assert.match(api, /deleteNewsMedia/);
  assert.match(api, /\/news\/admin-list/);
  assert.match(api, /scheduled_at/); // тело /schedule
});

test("RBAC: лента — всем, консоль и редактор — только сотрудникам ЦНТР", () => {
  const roles = read("src/lib/roles.ts");
  const layout = read("src/app/dashboard/layout.tsx");

  assert.match(roles, /"\/dashboard\/news\/admin": \["cntr_admin", "cntr_manager"\]/);
  assert.match(roles, /"\/dashboard\/news\/new": \["cntr_admin", "cntr_manager"\]/);
  assert.match(roles, /"\/dashboard\/news": \[/); // все роли
  assert.match(layout, /href: "\/dashboard\/news", label: "Новости"/);
});
