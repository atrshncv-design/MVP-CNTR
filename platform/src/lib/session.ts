/**
 * T-003. Минимальный dev-мок сессии (полноценная авторизация — T-013).
 *
 * Сессия — одна выбранная демо-роль в localStorage (ключ nfr-mock-role).
 * Клиентский модуль: используется только компонентами шелла/страницами
 * с директивами "use client"; серверные модули его не импортируют.
 */

import {
  getRoleDefinition,
  isBackendRoleId,
  type BackendRoleId,
} from "./roles.ts";

/** Ключ localStorage для демо-роли. */
export const MOCK_ROLE_KEY = "nfr-mock-role";

export interface MockSession {
  role: BackendRoleId;
  email: string;
}

/**
 * Прочитать mock-сессию. null — сессия отсутствует (нет выбранной роли
 * или хранилище недоступно). На сервере (SSR) всегда null.
 */
export function getMockSession(): MockSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOCK_ROLE_KEY);
    if (!raw || !isBackendRoleId(raw)) return null;
    const definition = getRoleDefinition(raw);
    return {
      role: raw,
      email: definition?.demoEmail ?? `${raw}@example.com`,
    };
  } catch {
    return null;
  }
}

/** Выбрать демо-роль (вход под mock-аккаунтом). */
export function setMockRole(role: BackendRoleId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOCK_ROLE_KEY, role);
  } catch {
    /* недоступное хранилище не роняет вход в dev-режиме */
  }
}

/** Выйти: удалить mock-сессию. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MOCK_ROLE_KEY);
  } catch {
    /* noop */
  }
}
