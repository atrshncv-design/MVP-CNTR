"use client";

/**
 * Хук сохранённых фильтров без лимита (P2, R02, тикет 02).
 * Почему один хук: скрывает бэкенд vs localStorage fallback, выставляет
 * useSavedFilters для FilterBar/страниц, помечает BLOCKED при 404.
 * Пробует GET/POST/DELETE /filters/saved через api-client, при 404
 * (или 405/501 когда эндпоинт не задеплоен) — fallback localStorage
 * `tz:saved-filters` и выставляет isFallback=true + blockedReason.
 * Без лимита — не ограничивает количество.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { ApiError, deleteFilter, getSavedFilters, saveFilter } from "@/lib/api-client";
import type { SavedFilterIn, SavedFilterOut } from "@/lib/api-client";
import type { RegistryParams } from "@/lib/types";

import {
  BLOCKED_REASON,
  addLocalSavedFilter,
  readLocalSavedFilters,
  removeLocalSavedFilter,
  writeLocalSavedFilters,
} from "./storage";

export interface UseSavedFiltersReturn {
  items: SavedFilterOut[];
  loading: boolean;
  error: string | null;
  isFallback: boolean;
  blockedReason: string | null;
  refresh: () => Promise<void>;
  save: (name: string, filters: RegistryParams) => Promise<SavedFilterOut | null>;
  remove: (id: string | number) => Promise<void>;
}

function isNotFoundError(e: unknown): boolean {
  if (e instanceof ApiError) {
    return e.status === 404 || e.status === 405 || e.status === 501;
  }
  return false;
}

export function useSavedFilters(): UseSavedFiltersReturn {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [items, setItems] = useState<SavedFilterOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const loadFromLocal = useCallback(() => {
    const local = readLocalSavedFilters();
    setItems(local);
    setIsFallback(true);
    setBlockedReason(BLOCKED_REASON);
    // Пометка BLOCKED в рантайме для отчётов — window флаг + console.warn
    try {
      if (typeof window !== "undefined") {
        const w = window as unknown as Record<string, unknown>;
        w["__TZ_BLOCKED_filters_saved"] = true;
        console.warn(BLOCKED_REASON);
      }
    } catch {
      // ignore
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Без токена — сразу fallback localStorage (не гоним 401)
    if (!token) {
      loadFromLocal();
      setLoading(false);
      return;
    }
    try {
      const data = await getSavedFilters(token);
      setItems(Array.isArray(data) ? data : []);
      setIsFallback(false);
      setBlockedReason(null);
      // Успешный бэк — снимаем BLOCKED флаг если был
      try {
        if (typeof window !== "undefined") {
          const w = window as unknown as Record<string, unknown>;
          delete w["__TZ_BLOCKED_filters_saved"];
        }
      } catch {
        // ignore
      }
    } catch (e) {
      if (isNotFoundError(e)) {
        // 404 → fallback localStorage + пометка BLOCKED
        loadFromLocal();
      } else {
        const msg = e instanceof Error ? e.message : "Не удалось загрузить фильтры";
        setError(msg);
        // При других ошибках тоже пробуем показать локальные, но не помечаем fallback как основной
        // Сохраняем локальные как дополнение к ошибке
        const local = readLocalSavedFilters();
        if (local.length) {
          setItems(local);
          setIsFallback(true);
          setBlockedReason(BLOCKED_REASON);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [token, loadFromLocal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка при монтировании вызывает setState
    void refresh();
  }, [refresh]);

  // Синхронизация между вкладками для localStorage fallback
  useEffect(() => {
    if (!isFallback) return;
    const handler = (e: StorageEvent) => {
      if (e.key === "tz:saved-filters") {
        setItems(readLocalSavedFilters());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [isFallback]);

  const save = useCallback(
    async (name: string, filters: RegistryParams): Promise<SavedFilterOut | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      // Пробуем бэк
      if (token && !isFallback) {
        try {
          const payload: SavedFilterIn = { name: trimmed, filters };
          const created = await saveFilter(payload, token);
          setItems((prev) => [...prev, created]);
          return created;
        } catch (e) {
          if (isNotFoundError(e)) {
            // Переходим в fallback режим
            const entry = addLocalSavedFilter(trimmed, filters);
            setItems(readLocalSavedFilters());
            setIsFallback(true);
            setBlockedReason(BLOCKED_REASON);
            return entry;
          }
          const msg = e instanceof Error ? e.message : "Не удалось сохранить";
          setError(msg);
          return null;
        }
      }
      // Fallback — localStorage без лимита
      const entry = addLocalSavedFilter(trimmed, filters);
      setItems(readLocalSavedFilters());
      if (!isFallback) {
        setIsFallback(true);
        setBlockedReason(BLOCKED_REASON);
      }
      // Если токен был но бэк недоступен — уже помечаем BLOCKED
      if (token) {
        try {
          if (typeof window !== "undefined") {
            const w = window as unknown as Record<string, unknown>;
            w["__TZ_BLOCKED_filters_saved"] = true;
          }
        } catch {
          // ignore
        }
      }
      return entry;
    },
    [token, isFallback],
  );

  const remove = useCallback(
    async (id: string | number): Promise<void> => {
      if (token && !isFallback) {
        try {
          await deleteFilter(id, token);
          setItems((prev) => prev.filter((f) => String(f.id) !== String(id)));
          return;
        } catch (e) {
          if (isNotFoundError(e)) {
            const next = removeLocalSavedFilter(id);
            setItems(next);
            setIsFallback(true);
            setBlockedReason(BLOCKED_REASON);
            return;
          }
          const msg = e instanceof Error ? e.message : "Не удалось удалить";
          setError(msg);
          return;
        }
      }
      const next = removeLocalSavedFilter(id);
      setItems(next);
      // Также синхронизируем запись в storage — writeLocal...
      writeLocalSavedFilters(next);
    },
    [token, isFallback],
  );

  return { items, loading, error, isFallback, blockedReason, refresh, save, remove };
}
