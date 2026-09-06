/**
 * Тесты публичного новостного раздела (тикет 07, спека §3.7):
 * маршруты /news и /news/[id], честные состояния, api-client без токена,
 * человекочитаемые даты.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatDateLocale, formatDateTimeLocale } from "../src/lib/format-date.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("news feed page: публичная лента с фильтрами, пагинацией и честным empty-state", () => {
  const source = read("src/app/(landing)/news/page.tsx");

  assert.match(source, /getPublicNewsFeed/);
  assert.match(source, /getPublicNewsCategories/);
  assert.match(source, /NewsFeed/);
  assert.match(source, /title: "Новости — Технозрелость"/);
});

test("news feed client: скелетон, ошибка, «Загрузить ещё» и пустое состояние", () => {
  const source = read("src/components/landing/news-feed.tsx");

  assert.match(source, /Пока нет опубликованных новостей/);
  assert.match(source, /Загрузить ещё/);
  assert.match(source, /animate-pulse/); // скелетон
  assert.match(source, /CLIENT_API_BASE as API_URL/); // единый URL-модуль
  assert.match(source, /fetch\(`\$\{API_URL\}\/api\/v1\/news/);
  assert.match(source, /cache: "no-store"/);
});

test("news detail page: 404 для неопубликованной/невалидной, полная карточка", () => {
  const pageSource = read("src/app/(landing)/news/[id]/page.tsx");
  const viewSource = read("src/components/landing/news-detail.tsx");

  assert.match(pageSource, /getPublicNewsDetail/);
  assert.match(pageSource, /notFound\(\)/);
  assert.match(pageSource, /generateMetadata/);
  // Полная публикация: HTML-контент, галерея, вложения, теги, автор.
  assert.match(viewSource, /dangerouslySetInnerHTML/);
  assert.match(viewSource, /kind === "gallery"/);
  assert.match(viewSource, /kind === "attachment"/);
  assert.match(viewSource, /author_name/);
});

test("public api client: новости без токена, no-store, фильтры category/tag", () => {
  const source = read("src/lib/api-client.ts");

  assert.match(source, /getPublicNewsFeed/);
  assert.match(source, /getPublicNewsDetail/);
  assert.match(source, /getPublicNewsCategories/);
  assert.match(source, /query\.set\("category", params\.category\)/);
  assert.match(source, /query\.set\("tag", params\.tag\)/);
  // Публичные эндпоинты не требуют Authorization.
  assert.doesNotMatch(source, /Authorization[\s\S]{0,120}\/news/);
});

test("навигация: «Новости» в публичном меню и футере", async () => {
  // Шов таска 07: подпись пункта меню — резолвером обеих локалей без регулярок
  // по исходникам; маркер-комментарий со строкой экрана из кода убран сканером.
  const { translatorFor } = await import("../src/lib/translators.ts");
  assert.equal(translatorFor("nav", "ru")("news"), "Новости");
  assert.equal(translatorFor("nav", "en")("news"), "News");
  const footer = read("src/components/landing/landing-footer.tsx");

  assert.match(footer, /href: "\/news", label: "Новости"/);
});

test("news admin api: фолбэк ошибки запроса — через словарь обеих локалей", async () => {
  // Шов таска 07: extractApiError отдаёт detail бэкенда как есть (R04), а фолбэк
  // без detail резолвится из news.admin.requestError с кодом статуса параметром.
  const { translatorFor } = await import("../src/lib/translators.ts");
  assert.equal(
    translatorFor("news", "ru")("admin.requestError", { status: 500 }),
    "Запрос не выполнен (500).",
  );
  assert.equal(
    translatorFor("news", "en")("admin.requestError", { status: 500 }),
    "Request failed (500).",
  );
});

test("format-date: человекочитаемые даты под локалью (UTC, доделка T06)", () => {
  // RU-шимы удалены: экраны идут через formatDateLocale/formatDateTimeLocale
  // с текущей локалью (ru → ru-RU, иначе en-GB).
  assert.equal(formatDateLocale("ru", "2026-08-14T10:00:00+00:00"), "14 августа 2026 г.");
  assert.equal(formatDateLocale("en", "2026-08-14T10:00:00+00:00"), "14 August 2026");
  assert.equal(formatDateLocale("ru", null), "");
  assert.equal(formatDateLocale("ru", "not-a-date"), "");
  assert.equal(
    formatDateTimeLocale("ru", "2026-08-14T10:00:00+00:00"),
    "14 августа 2026 г. в 10:00",
  );
  assert.doesNotMatch(formatDateTimeLocale("en", "2026-08-14T10:00:00+00:00"), /[А-Яа-яЁё]/);
});
