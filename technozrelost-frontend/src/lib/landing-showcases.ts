/**
 * Живые витрины исполнителей, организаций и НИОКТР (таск 02, R01/R03).
 * Почему отдельный модуль: GET /executors/specialists, /executors/organizations
 * и /nioktr — публичные (CurrentUserOptional на бэке), как и GET
 * /projects/registry у витрины проектов. Пагинация — как у витрины проектов:
 * специалисты — keyset after_id/limit, организации и НИОКТР — limit/offset
 * (так отдают бэкенд-ручки); поиск — серверный ?search= (таск 03) по всей
 * базе, а не по загруженному в браузер. Чистые функции ниже — шов для
 * тестов витрин.
 */

import type { NioktrCardOut, OrganizationOut } from "./types";

/** Исполнитель из публичного каталога (форма backend ExecutorOut). */
export interface PublicExecutor {
  id: number;
  full_name: string;
  organization: string | null;
  role_slug: string;
  role_name: string;
  competencies: string[];
  completed_projects: number;
  /** ОГРН организации (таск 03, ссылка на /customers/[ogrn]); у людей — null. */
  ogrn?: string | null;
}

/** Организация из публичного каталога (та же форма ExecutorOut, id < 0). */
export type PublicOrg = PublicExecutor;

/** Карточка НИОКТР из публичного реестра (подмножество NioktrCardOut). */
export type PublicNioktrCard = Pick<
  NioktrCardOut,
  | "id"
  | "registration_number"
  | "name"
  | "annotation"
  | "keywords"
  | "nioktr_types"
  | "executor_name"
  | "customer_name"
  | "created_date"
  | "is_ai_area"
>;

/** Размер страницы витрин-каталогов: сетка 3 колонки, бэкенд держит limit ≤ 100/200. */
export const SHOWCASE_DIRECTORY_PAGE_SIZE = 9;

/* ─── Query-строки (только параметры, которые понимает бэкенд) ─── */

export interface SpecialistsQuery {
  after_id?: number;
  limit?: number;
  /** Серверный поиск (таск 03): ФИО и организация, пустое — без фильтра. */
  search?: string;
}

/**
 * Query для GET /executors/specialists: keyset after_id + limit + search.
 * Поиск идёт на сервере по всей базе (таск 03), а не по загруженной странице.
 */
export function buildSpecialistsQuery(query: SpecialistsQuery): string {
  const qs = new URLSearchParams();
  if (query.after_id != null) qs.set("after_id", String(query.after_id));
  const search = query.search?.trim();
  if (search) qs.set("search", search);
  qs.set("limit", String(query.limit ?? SHOWCASE_DIRECTORY_PAGE_SIZE));
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

export interface OrganizationsQuery {
  limit?: number;
  offset?: number;
  /** Серверный поиск (таск 03): название организации, пустое — без фильтра. */
  search?: string;
}

/** Query для GET /executors/organizations: limit + offset + search (так отдаёт ручка). */
export function buildOrganizationsQuery(query: OrganizationsQuery): string {
  const qs = new URLSearchParams();
  qs.set("limit", String(query.limit ?? SHOWCASE_DIRECTORY_PAGE_SIZE));
  if (query.offset) qs.set("offset", String(query.offset));
  const search = query.search?.trim();
  if (search) qs.set("search", search);
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

export interface NioktrQuery {
  limit?: number;
  offset?: number;
  /** Серверный поиск (таск 03): название, аннотация, исполнитель, заказчик, регномер. */
  search?: string;
}

/** Query для GET /nioktr: limit + offset + search (поиск — серверный, таск 03). */
export function buildNioktrQuery(query: NioktrQuery): string {
  const qs = new URLSearchParams();
  qs.set("limit", String(query.limit ?? SHOWCASE_DIRECTORY_PAGE_SIZE));
  if (query.offset) qs.set("offset", String(query.offset));
  const search = query.search?.trim();
  if (search) qs.set("search", search);
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

/* ─── Слияние страниц ─── */

export interface KeysetPageMerge<T> {
  items: T[];
  nextAfterId: number | undefined;
  hasMore: boolean;
}

/**
 * Слияние страницы keyset-пагинации (специалисты) с уже загруженными.
 * Семантика — как у mergeRegistryPage витрины проектов: hasMore — по длине
 * сырой страницы, пустая страница закрывает пагинацию не трогая items,
 * пересечения страниц дедупятся по id.
 */
export function mergeKeysetPage<T extends { id: number }>(
  prev: T[],
  page: T[],
  limit: number = SHOWCASE_DIRECTORY_PAGE_SIZE,
): KeysetPageMerge<T> {
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

export interface OffsetPageMerge<T> {
  items: T[];
  nextOffset: number;
  hasMore: boolean;
}

/**
 * Слияние страницы offset-пагинации (организации, НИОКТР).
 * nextOffset считается от сырой страницы (offset + длина ответа), а не от
 * merged-массива, иначе дедуп пересечений сдвинет окно и пропустит записи;
 * hasMore — по длине сырой страницы, пустая страница закрывает пагинацию.
 */
export function mergeOffsetPage<T extends { id: number }>(
  prev: T[],
  page: T[],
  offset: number,
  limit: number = SHOWCASE_DIRECTORY_PAGE_SIZE,
): OffsetPageMerge<T> {
  const seen = new Set<number>(prev.map((p) => p.id));
  const items = [...prev];
  for (const item of page) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return {
    items,
    nextOffset: offset + page.length,
    hasMore: page.length >= limit,
  };
}

/* ─── Карточки витрин: только поля API, отсутствующие — null, не выдумка ─── */

export interface ExecutorShowcaseCard {
  id: number;
  name: string;
  org: string | null;
  role: string | null;
  competencies: string[];
  completedProjects: number;
  isOrg: boolean;
  /** ОГРН для ссылки на деталку /customers/[ogrn]; у людей — null. */
  ogrn: string | null;
}

/**
 * ExecutorOut → карточка витрины. Отрицательный id — организация
 * (контракт _organizations_as_executors на бэке), не человек.
 */
export function toExecutorCard(item: PublicExecutor): ExecutorShowcaseCard {
  return {
    id: item.id,
    name: item.full_name,
    org: item.organization ?? null,
    role: item.role_name ?? null,
    competencies: Array.isArray(item.competencies) ? item.competencies : [],
    completedProjects: item.completed_projects ?? 0,
    isOrg: item.id < 0,
    ogrn: item.ogrn ?? null,
  };
}

export interface NioktrShowcaseCard {
  id: number;
  regNumber: string;
  name: string;
  annotation: string | null;
  keywords: string[];
  types: string[];
  executor: string | null;
  customer: string | null;
  createdDate: string | null;
  isAi: boolean;
}

/** NioktrCardOut → карточка витрины; бюджетов/смет нет — их не показываем. */
export function toNioktrCard(item: PublicNioktrCard): NioktrShowcaseCard {
  return {
    id: item.id,
    regNumber: item.registration_number,
    name: item.name,
    annotation: item.annotation ?? null,
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
    types: Array.isArray(item.nioktr_types) ? item.nioktr_types : [],
    executor: item.executor_name ?? null,
    customer: item.customer_name ?? null,
    createdDate: item.created_date ?? null,
    isAi: Boolean(item.is_ai_area),
  };
}

/** Совместимость: OrganizationOut бэка тоже ложится в карточку исполнителя. */
export function organizationToExecutorCard(item: OrganizationOut): ExecutorShowcaseCard {
  return {
    id: -item.id,
    name: item.short_name || item.name,
    org: item.name,
    role: null,
    competencies: Array.isArray(item.competencies) ? item.competencies : [],
    completedProjects: item.projects_count ?? 0,
    isOrg: true,
    ogrn: item.ogrn ?? null,
  };
}
