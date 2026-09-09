/**
 * Публичная витрина лендинга на живых данных реестра (таск 13, R06i).
 * Почему отдельный модуль: GET /projects/registry — публичный
 * (CurrentUserOptional на бэке) с keyset-пагинацией after_id/limit и
 * фильтрами ugt_min/ugt_max; поиск и категория — клиентские, бэкенд
 * их не понимает. Чистые функции ниже — шов для тестов витрины.
 */

import type { RegistryProjectOut } from "./types";

/** Размер страницы витрины: сетка 3 колонки, бэкенд держит limit ≤ 100. */
export const SHOWCASE_PAGE_SIZE = 9;

export interface PublicRegistryQuery {
  ugt_min?: number;
  ugt_max?: number;
  after_id?: number;
  limit?: number;
}

/**
 * Query-строка из параметров, которые понимает бэкенд
 * (ugt_min/ugt_max/after_id/limit). Поиск сюда не входит —
 * он применяется клиентской фильтрацией в компоненте.
 */
export function buildPublicRegistryQuery(query: PublicRegistryQuery): string {
  const qs = new URLSearchParams();
  if (query.ugt_min != null) qs.set("ugt_min", String(query.ugt_min));
  if (query.ugt_max != null) qs.set("ugt_max", String(query.ugt_max));
  if (query.after_id != null) qs.set("after_id", String(query.after_id));
  qs.set("limit", String(query.limit ?? SHOWCASE_PAGE_SIZE));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

export interface RegistryPageMerge {
  items: RegistryProjectOut[];
  nextAfterId: number | undefined;
  hasMore: boolean;
}

/**
 * Слияние страницы keyset-пагинации с уже загруженными.
 * Почему так: hasMore — по длине сырой страницы (истина бэкенда),
 * а не merged-массива, иначе точное кратное PAGE_SIZE даёт вечную
 * кнопку «Показать ещё»; пустая страница закрывает пагинацию,
 * не трогая items; пересечения страниц дедупятся по id.
 */
export function mergeRegistryPage(
  prev: RegistryProjectOut[],
  page: RegistryProjectOut[],
  limit: number = SHOWCASE_PAGE_SIZE,
): RegistryPageMerge {
  const seen = new Set<number>(prev.map((p) => p.id));
  const items = [...prev];
  for (const item of page) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  const lastPageId = page.length > 0 ? page[page.length - 1].id : undefined;
  const lastPrevId = prev.length > 0 ? prev[prev.length - 1].id : undefined;
  return {
    items,
    nextAfterId: lastPageId ?? lastPrevId,
    hasMore: page.length >= limit,
  };
}

/** Карточка витрины: только поля реестра, отсутствующие — null, не выдумка. */
export interface ShowcaseCard {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  current_level: number;
  status: string | null;
  budget: number | null;
  org: string | null;
}

/**
 * Проект API → карточка витрины. Бэкенд не отдаёт description/status/tags
 * (см. RegistryProjectOut в app/schemas.py) — такие поля остаются null,
 * компонент их скрывает вместо подстановки выдуманных строк.
 */
export function toShowcaseCard(item: RegistryProjectOut): ShowcaseCard {
  const tags = item.tags ?? [];
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? tags[0] ?? null,
    description: item.description ?? null,
    current_level: item.current_level,
    status: item.status ?? null,
    budget: item.budget ?? null,
    org: item.organization ?? null,
  };
}
