/**
 * P3: анонимное чтение публичных каталогов для витрин (таск 02, R01/R03).
 * Почему отдельный модуль в src/app: ручки GET /executors/specialists,
 * GET /executors/organizations и GET /nioktr уже анонимны (CurrentUserOptional
 * на бэке) — серверный компонент читает проверенные данные без токена;
 * gated-заглушка getPublicRegistry в api-client (P2) не тронута
 * (matchOrganizations открыт таском 04 — реальный POST /match). Authorization не отправляется по построению — приватные поля
 * и действия (контакты, вступление, модерация) анонимно недоступны.
 */

import { serverApiBase } from "@/lib/public-api";
import {
  SHOWCASE_DIRECTORY_PAGE_SIZE,
  buildNioktrQuery,
  buildOrganizationsQuery,
  buildSpecialistsQuery,
  type PublicExecutor,
  type PublicNioktrCard,
  type PublicOrg,
} from "@/lib/landing-showcases";

export interface PublicDirectoryResult<T> {
  items: T[];
  failed: boolean;
  status: number | null;
}

/**
 * Анонимная страница списка без токена. Ошибка не бросается — возвращается
 * флагом, чтобы страница показала честное состояние (пустое — при пустом
 * реестре, ошибку — при сбое), а не упала в 500.
 */
async function fetchPublicList<T>(path: string, qs: string): Promise<PublicDirectoryResult<T>> {
  try {
    const response = await fetch(`${serverApiBase()}/api/v1${path}${qs}`, {
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
    return { items: data as T[], failed: false, status: null };
  } catch {
    return { items: [], failed: true, status: null };
  }
}

/** Первая страница специалистов (keyset after_id, дальше — клиент). */
export function fetchPublicSpecialistsPage(
  afterId?: number,
  search?: string,
): Promise<PublicDirectoryResult<PublicExecutor>> {
  const trimmed = search?.trim() ? search.trim() : undefined;
  const qs = buildSpecialistsQuery(
    afterId == null
      ? { limit: SHOWCASE_DIRECTORY_PAGE_SIZE, ...(trimmed ? { search: trimmed } : {}) }
      : { limit: SHOWCASE_DIRECTORY_PAGE_SIZE, after_id: afterId, ...(trimmed ? { search: trimmed } : {}) },
  );
  return fetchPublicList<PublicExecutor>("/executors/specialists", qs);
}

/** Первая страница организаций (offset 0, дальше — клиент). */
export function fetchPublicOrganizationsPage(
  offset = 0,
  search?: string,
): Promise<PublicDirectoryResult<PublicOrg>> {
  const trimmed = search?.trim() ? search.trim() : undefined;
  const qs = buildOrganizationsQuery({
    limit: SHOWCASE_DIRECTORY_PAGE_SIZE,
    offset,
    ...(trimmed ? { search: trimmed } : {}),
  });
  return fetchPublicList<PublicOrg>("/executors/organizations", qs);
}

/** Первая страница НИОКТР (offset 0, дальше — клиент). */
export function fetchPublicNioktrPage(
  offset = 0,
  search?: string,
): Promise<PublicDirectoryResult<PublicNioktrCard>> {
  const trimmed = search?.trim() ? search.trim() : undefined;
  const qs = buildNioktrQuery({
    limit: SHOWCASE_DIRECTORY_PAGE_SIZE,
    offset,
    ...(trimmed ? { search: trimmed } : {}),
  });
  return fetchPublicList<PublicNioktrCard>("/nioktr", qs);
}
