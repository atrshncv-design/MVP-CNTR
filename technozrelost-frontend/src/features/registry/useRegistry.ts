"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { ApiError, getRegistry } from "@/lib/api-client";
import { useDebouncedValue, useRegistryFilters } from "@/lib/filters";
import type { RegistryParams, RegistryProjectOut } from "@/lib/types";

import { useRealtime } from "./useRealtime";

/**
 * Хук реестра — единый стандарт для всех витрин (тикет 04, R20-R22, G14, G45-G47).
 * Почему один хук: фильтры → URL → запрос дебаунс 300ms, пагинация keyset
 * limit=20 after_id, сортировка по дате ↓, избранное localStorage, realtime.
 * Использует lib/api-client getRegistry с RegistryParams и фильтры из 01.
 *
 * TODO(status): бэк `projects/registry` игнорирует `status` — фильтр status
 * делаем клиентским до бэк-фикса. См. issue #registry-status-filter.
 */
const LIMIT = 20;

function sortByUpdatedDesc(a: RegistryProjectOut, b: RegistryProjectOut): number {
  const da = a.updated_at ?? a.created_at ?? "";
  const db = b.updated_at ?? b.created_at ?? "";
  if (da === db) return b.id - a.id;
  return db.localeCompare(da);
}

export function useRegistry(opts?: {
  initial?: RegistryParams;
  registryKey?: string;
  enabled?: boolean;
  realtime?: boolean;
}) {
  const initial = opts?.initial;
  const registryKey = opts?.registryKey ?? "projects";
  const realtimeEnabled = opts?.realtime ?? true;

  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  // Фильтры → URL (источник 01, G55 шаринг)
  const { filters, setFilters, queryString } = useRegistryFilters(initial);
  // Дебаунс поиска 300ms via filters.ts хук, но useRegistryFilters уже дебаунсит
  // search внутри — effective значение в queryString. Для запроса используем
  // debouncedSearch отдельно чтобы не дергать fetch на каждый символ.
  const rawSearch = filters.search ?? "";
  const debouncedSearch = useDebouncedValue(rawSearch, 300);

  const effective = useMemo<RegistryParams>(() => {
    const e: RegistryParams = { ...filters };
    if (debouncedSearch) e.search = debouncedSearch;
    else delete e.search;
    e.limit = LIMIT;
    // after_id управляется пагинацией, не фильтрами
    delete e.after_id;
    return e;
  }, [filters, debouncedSearch]);

  const [items, setItems] = useState<RegistryProjectOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const afterIdRef = useRef<number | undefined>(undefined);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(
    async (afterId: number | undefined, replace: boolean) => {
      if (!token) return;
      const reqId = ++requestIdRef.current;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      setErrorStatus(null);
      try {
        const params: RegistryParams = { ...effective, after_id: afterId, limit: LIMIT };
        const data = await getRegistry(params, token);
        if (reqId !== requestIdRef.current) return;
        // Сортировка по дате обновления ↓ default (G46)
        const sorted = [...data].sort(sortByUpdatedDesc);
        // Клиентский фильтр status до бэк-фикса (игнор бэком)
        // TODO: убрать когда бэк начнёт фильтровать status
        const filtered =
          effective.status && effective.status !== "all"
            ? sorted.filter((p) => (p.status ?? "") === effective.status)
            : sorted;
        if (replace) {
          setItems(filtered);
          afterIdRef.current = sorted.length ? sorted[sorted.length - 1].id : undefined;
        } else {
          setItems((prev) => {
            const merged = [...prev, ...filtered];
            // дедуп по id на случай realtime дубля
            const seen = new Set<number>();
            const dedup: RegistryProjectOut[] = [];
            for (const it of merged) {
              if (!seen.has(it.id)) {
                seen.add(it.id);
                dedup.push(it);
              }
            }
            return dedup.sort(sortByUpdatedDesc);
          });
          if (sorted.length) afterIdRef.current = sorted[sorted.length - 1].id;
        }
        setHasMore(data.length >= LIMIT);
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить реестр";
        setError(msg);
        if (e instanceof ApiError) setErrorStatus(e.status);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [token, effective],
  );

  // Перезагрузка при смене фильтров (debounced search уже учтён)
  useEffect(() => {
    afterIdRef.current = undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс пагинации
    setHasMore(true);
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchPage(undefined, true);
  }, [token, effective, fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    void fetchPage(afterIdRef.current, false);
  }, [loadingMore, loading, hasMore, fetchPage]);

  const refresh = useCallback(() => {
    afterIdRef.current = undefined;
    void fetchPage(undefined, true);
  }, [fetchPage]);

  // Realtime обновление без ручного refresh (G56)
  useRealtime(refresh, { enabled: realtimeEnabled && !!token });

  return {
    items,
    loading,
    loadingMore,
    error,
    errorStatus,
    hasMore,
    loadMore,
    refresh,
    filters,
    setFilters,
    debouncedSearch,
    queryString,
    limit: LIMIT,
    registryKey,
  };
}
