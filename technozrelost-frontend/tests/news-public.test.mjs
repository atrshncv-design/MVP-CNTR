/**
 * Тесты публичного новостного раздела (тикет 07, спека §3.7):
 * маршруты /news и /news/[id], честные состояния, api-client без токена,
 * человекочитаемые даты.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatRuDate, formatRuDateTime } from "../src/lib/format-date.ts";

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

test("навигация: «Новости» в публичном меню и футере", () => {
  const nav = read("src/components/landing/landing-nav.tsx");
  const footer = read("src/components/landing/landing-footer.tsx");

  assert.match(nav, /href: "\/news", label: "Новости"/);
  assert.match(footer, /href: "\/news", label: "Новости"/);
});

test("format-date: человекочитаемые даты по-русски (UTC)", () => {
  assert.equal(formatRuDate("2026-08-14T10:00:00+00:00"), "14 августа 2026 г.");
  assert.equal(formatRuDate(null), "");
  assert.equal(formatRuDate("not-a-date"), "");
  assert.equal(
    formatRuDateTime("2026-08-14T10:00:00+00:00"),
    "14 августа 2026 г. в 10:00",
  );
});
