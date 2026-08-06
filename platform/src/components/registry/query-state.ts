/**
 * T-006. URL-состояние реестров (Design.md §11.4 «URL-persisted filter state»).
 *
 * searchParams: ?search=&filters=&sort=&page=
 *   - search  — свободный текст (название, ключевые слова, исполнитель, № рег.);
 *   - filters — JSON-объект фильтров (is_ai_area / is_ai_usage / year / nioktr_types);
 *   - sort    — ключ из SORT_OPTIONS;
 *   - page    — номер страницы (≥1).
 *
 * Модуль чистый (без React) — используется серверными страницами и
 * клиентскими контролами. Фильтр-опции (годы, типы работ) — реальные
 * значения из датасета НИОКТР (400 карточек, импорт 06.08.2026);
 * при обновлении источника данных их нужно перегенерировать.
 */

import type { ListQuery } from "@/lib/adapter/types.ts";

export interface RegistryFilters {
  /** Только записи с тематикой ИИ. */
  is_ai_area?: string;
  /** Только записи, где ИИ используется. */
  is_ai_usage?: string;
  /** Год создания записи (YYYY). */
  year?: string;
  /** Тип работ (одно значение из NIOKTR_TYPES). */
  nioktr_types?: string;
}

export interface RegistryQueryState {
  search: string;
  filters: RegistryFilters;
  sort: string;
  page: number;
}

/** Сортировка по умолчанию — сначала новые (как в исходных данных). */
export const DEFAULT_SORT = "created_date_desc";

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_date_desc", label: "Сначала новые" },
  { value: "created_date_asc", label: "Сначала старые" },
  { value: "name_asc", label: "По названию (А–Я)" },
  { value: "name_desc", label: "По названию (Я–А)" },
];

export function sortLabel(value: string): string {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Сначала новые";
}

/**
 * Годы записей реестра — реальные значения created_date из датасета
 * (src/data/nioktr-fixtures.json, 400 карточек, импорт 06.08.2026).
 */
export const NIOKTR_YEARS: string[] = ["2025", "2024", "2023"];

/**
 * Типы работ — реальный словарь nioktr_types датасета (10 значений).
 */
export const NIOKTR_TYPES: string[] = [
  "Фундаментальное исследование",
  "Поисковое (ориентированные фундаментальные) исследование",
  "Опытно-конструкторские работы",
  "Технологические работы",
  "Проектные работы",
  "Опытное производство и испытания",
  "Разработка и лабораторная проверка ключевых элементов технологии",
  "Разработка новых материалов, научно-методических материалов, продуктов, процессов, программ, устройств, типов, элементов, услуг, систем, методов, методик, рекомендаций, предложений, прогнозов",
  "Разработка нормативных и (или) нормативно-технических документов",
  "Выбор технологической концепции",
];

/* ------------------------------------------------------------------ */
/* Парсинг/сериализация URL-состояния                                  */
/* ------------------------------------------------------------------ */

const clampPage = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Разобрать searchParams в состояние реестра (устойчиво к мусору в URL). */
export function parseRegistryState(
  searchParams: Record<string, string | string[] | undefined>,
): RegistryQueryState {
  const filters: RegistryFilters = {};
  const rawFilters = firstParam(searchParams.filters);
  if (rawFilters) {
    try {
      const parsed = JSON.parse(rawFilters) as unknown;
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        for (const key of [
          "is_ai_area",
          "is_ai_usage",
          "year",
          "nioktr_types",
        ] as const) {
          const v = obj[key];
          if (typeof v === "string" && v.length > 0) {
            filters[key] = v;
          }
        }
      }
    } catch {
      // Некорректный JSON в filters — игнорируем, фильтры пустые.
    }
  }

  const sort = firstParam(searchParams.sort) ?? DEFAULT_SORT;
  const pageRaw = Number(firstParam(searchParams.page) ?? 1);

  return {
    search: (firstParam(searchParams.search) ?? "").trim(),
    filters,
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort : DEFAULT_SORT,
    page: clampPage(pageRaw),
  };
}

/** Есть ли активные фильтры (кроме поиска). */
export function hasActiveFilters(state: RegistryQueryState): boolean {
  return Object.values(state.filters).some((v) => v !== undefined && v !== "");
}

/** Число активных фильтров (для бейджа на кнопке «Фильтры»). */
export function activeFilterCount(state: RegistryQueryState): number {
  return Object.values(state.filters).filter(
    (v) => v !== undefined && v !== "",
  ).length;
}

/** RegistryQueryState → ListQuery адаптера. */
export function toListQuery(state: RegistryQueryState): ListQuery {
  return {
    search: state.search || undefined,
    filters: { ...state.filters },
    sort: state.sort !== DEFAULT_SORT ? state.sort : undefined,
    page: state.page,
    pageSize: REGISTRY_PAGE_SIZE,
  };
}

/** Размер страницы реестра (≤ MAX_PAGE_SIZE=100 адаптера). */
export const REGISTRY_PAGE_SIZE = 20;

/**
 * Собрать href реестра из состояния. Пустые параметры не пишутся,
 * поэтому URL остаётся коротким и восстанавливается из history.
 */
export function buildRegistryHref(
  base: string,
  state: RegistryQueryState,
): string {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (hasActiveFilters(state)) {
    params.set("filters", JSON.stringify(state.filters));
  }
  if (state.sort && state.sort !== DEFAULT_SORT) {
    params.set("sort", state.sort);
  }
  if (state.page > 1) params.set("page", String(state.page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Сменить состояние (patch) и вернуть href; page сбрасывается при изменении поиска/фильтров/сортировки. */
export function patchRegistryHref(
  base: string,
  state: RegistryQueryState,
  patch: Partial<RegistryQueryState>,
): string {
  const next: RegistryQueryState = { ...state, ...patch };
  if (patch.search !== undefined || patch.filters !== undefined || patch.sort !== undefined) {
    next.page = 1;
  }
  return buildRegistryHref(base, next);
}
