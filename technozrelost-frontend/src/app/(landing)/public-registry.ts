/**
 * P3: анонимное чтение публичного реестра для витрины (таск 09, G04/G35/G49/G59).
 * Почему отдельный модуль в src/app: backend-ручка GET /projects/registry уже
 * анонимна (CurrentUserOptional) — серверный компонент читает проверенные данные
 * без токена; gated-заглушка getPublicRegistry в api-client (P2, таск 02) не
 * тронута. Authorization не отправляется по построению — приватные поля
 * и действия (публикация, модерация, контакты) анонимно недоступны.
 * Пагинация keyset: первая страница limit=SHOWCASE_PAGE_SIZE, дальше after_id
 * (продолжает клиентский ProjectsShowcase через mergeRegistryPage).
 */

import { serverApiBase } from "@/lib/public-api";
import { SHOWCASE_PAGE_SIZE, buildPublicRegistryQuery } from "@/lib/landing-registry";
import type { RegistryProjectOut } from "@/lib/types";

/** Карточек в тизере витрины на главной: реестр целиком живёт на /projects. */
export const SHOWCASE_TEASER_SIZE = 3;

export interface PublicRegistryResult {
  items: RegistryProjectOut[];
  failed: boolean;
  status: number | null;
}

/**
 * Первая страница публичного реестра без токена. Ошибка не бросается —
 * возвращается флагом, чтобы страница показала честное состояние
 * (пустое — при пустом реестре, ошибку — при сбое), а не упала в 500.
 * search — серверный поиск бэкенда (таск 03), пустое — без фильтра.
 */
export async function fetchPublicRegistryPage(
  afterId?: number,
  search?: string,
): Promise<PublicRegistryResult> {
  try {
    const trimmed = search?.trim() ? search.trim() : undefined;
    const qs = buildPublicRegistryQuery(
      afterId == null
        ? { limit: SHOWCASE_PAGE_SIZE, ...(trimmed ? { search: trimmed } : {}) }
        : { limit: SHOWCASE_PAGE_SIZE, after_id: afterId, ...(trimmed ? { search: trimmed } : {}) },
    );
    const response = await fetch(`${serverApiBase()}/api/v1/projects/registry${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return { items: [], failed: true, status: response.status };
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      return { items: [], failed: true, status: null };
    }
    return { items: data as RegistryProjectOut[], failed: false, status: null };
  } catch {
    return { items: [], failed: true, status: null };
  }
}
