/**
 * Фильтры реестров + дебаунс (тикет 01, G55 URL-шаринг, G14 теги).
 * Почему отдельный модуль: состояние фильтров сериализуется в URL,
 * чтобы шаринг работал — копирование URL восстанавливает фильтры.
 * Дебаунс 300ms не спамит API при вводе в поиск.
 */

"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { RegistryParams } from "./types";

// ─── Дебаунс ─────────────────────────────────────────────────────────────

/**
 * Дебаунс значения — возвращает обновлённое значение спустя 300ms после стабилизации.
 * Используется для поискового поля, чтобы не дергать API на каждый символ.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Сериализация URL ────────────────────────────────────────────────────

/**
 * Сериализация фильтров реестра в query string.
 * Ключи совместимы с backend GET /projects/registry и фронтом
 * (search, tags, ugt_min/max, status, region, budget_min/max, after_id, limit).
 * Теги сериализуются как повторяющийся параметр `tags` или запятая — поддерживаем оба при парсе.
 */
export function serializeRegistryParams(params: RegistryParams): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.tags && params.tags.length) {
    // repeated tags param (предпочтительно для читаемости URL)
    for (const t of params.tags) qs.append("tags", t);
  } else if (params.category) {
    qs.set("category", params.category);
  }
  if (params.ugt_min != null) qs.set("ugt_min", String(params.ugt_min));
  if (params.ugt_max != null) qs.set("ugt_max", String(params.ugt_max));
  if (params.status) qs.set("status", params.status);
  if (params.region) qs.set("region", params.region);
  if (params.budget_min != null) qs.set("budget_min", String(params.budget_min));
  if (params.budget_max != null) qs.set("budget_max", String(params.budget_max));
  if (params.after_id != null) qs.set("after_id", String(params.after_id));
  if (params.limit != null) qs.set("limit", String(params.limit));
  return qs;
}

export function serializeFiltersToQuery(params: RegistryParams): string {
  const qs = serializeRegistryParams(params);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function parseRegistryParams(searchParams: URLSearchParams): RegistryParams {
  const out: RegistryParams = {};
  const search = searchParams.get("search");
  if (search) out.search = search;
  // tags: поддержка repeated + comma-separated + legacy category
  const tagsRepeated = searchParams.getAll("tags");
  if (tagsRepeated.length) {
    // если есть повторяющиеся теги — собираем, иначе пробуем запятую
    if (tagsRepeated.length === 1 && tagsRepeated[0].includes(",")) {
      out.tags = tagsRepeated[0]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      out.tags = tagsRepeated.filter(Boolean);
    }
  } else {
    const tagsCSV = searchParams.get("tags");
    if (tagsCSV) out.tags = tagsCSV.split(",").map((s) => s.trim()).filter(Boolean);
    else {
      const cat = searchParams.get("category");
      if (cat) out.category = cat;
    }
  }
  const ugtMin = searchParams.get("ugt_min");
  if (ugtMin != null && ugtMin !== "") out.ugt_min = Number(ugtMin);
  const ugtMax = searchParams.get("ugt_max");
  if (ugtMax != null && ugtMax !== "") out.ugt_max = Number(ugtMax);
  const status = searchParams.get("status");
  if (status) out.status = status;
  const region = searchParams.get("region");
  if (region) out.region = region;
  const bMin = searchParams.get("budget_min");
  if (bMin != null && bMin !== "") out.budget_min = Number(bMin);
  const bMax = searchParams.get("budget_max");
  if (bMax != null && bMax !== "") out.budget_max = Number(bMax);
  const after = searchParams.get("after_id");
  if (after != null && after !== "") out.after_id = Number(after);
  const lim = searchParams.get("limit");
  if (lim != null && lim !== "") out.limit = Number(lim);
  return out;
}

// ─── Хук URL-синхронизации ───────────────────────────────────────────────

/**
 * Хук синхронизации фильтров с URL (шаринг).
 * Читает начальные фильтры из URL, дебаунсит search на 300ms,
 * при изменении пушит новый URL без перезагрузки страницы.
 *
 * Возвращает [filters, setFilters, debouncedSearch].
 */
export function useRegistryFilters(initial?: RegistryParams): {
  filters: RegistryParams;
  setFilters: (patch: Partial<RegistryParams>) => void;
  debouncedSearch: string;
  queryString: string;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFiltersState] = useState<RegistryParams>(() => {
    const fromUrl = parseRegistryParams(new URLSearchParams(searchParams.toString()));
    return { ...fromUrl, ...initial };
  });

  const debouncedSearch = useDebouncedValue(filters.search ?? "", 300);

  // Синхронизация дебаунсированного search + остальных фильтров в URL
  const effective = React.useMemo<RegistryParams>(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  useEffect(() => {
    const qs = serializeRegistryParams(effective);
    const current = searchParams.toString();
    const next = qs.toString();
    if (current === next) return;
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [effective, pathname, router, searchParams]);

  const setFilters = useCallback((patch: Partial<RegistryParams>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const queryString = serializeFiltersToQuery(effective);

  return { filters, setFilters, debouncedSearch, queryString };
}
