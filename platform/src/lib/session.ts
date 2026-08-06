/**
 * T-013. Формализованная mock-авторизация (P0; NextAuth — на интеграции).
 *
 * Поверхность API зеркалит будущий AuthAdapter, чтобы страницы не
 * переписывались при переходе на реальный auth:
 *   - getSession()        — текущая сессия (email + роль + организация);
 *   - signIn(email, pass) — проверка демо-аккаунтов, состояния invalid
 *     credentials / locked, маршрут после входа (участник → /app,
 *     роль Центра → /operations);
 *   - signOut()           — выход в публичный сайт;
 *   - registerDraft / completeRegistration — черновик и заявка регистрации
 *     в localStorage (статусы pending/rejected/clarification).
 *
 * Совместимость с T-003 сохранена: getMockSession / setMockRole /
 * clearSession — синонимы новых функций (их используют shell'ы /app и
 * /operations, роль-свитчер и профиль-меню).
 *
 * Клиентский модуль: только компоненты с директивой "use client";
 * на сервере (SSR) все функции возвращают нейтральные значения.
 */

import {
  getRoleDefinition,
  isBackendRoleId,
  isCenterRole,
  type BackendRoleId,
} from "./roles.ts";
import type { RegistrationDraftData } from "./registration.ts";

/* ------------------------------------------------------------------ */
/* Ключи хранилища                                                      */
/* ------------------------------------------------------------------ */

/** Ключ демо-роли (T-003, роль-свитчер). */
export const MOCK_ROLE_KEY = "nfr-mock-role";
/** Ключ полной mock-сессии (T-013: email + роль + организация). */
export const SESSION_KEY = "nfr-session";
/** Ключ черновика регистрации (5 шагов). */
export const REGISTRATION_DRAFT_KEY = "nfr-registration-draft";
/** Ключ поданной заявки на регистрацию (pending/rejected/clarification). */
export const REGISTRATION_APPLICATION_KEY = "nfr-registration-application";
/** Ключ счётчика неудачных входов (состояние locked). */
const LOGIN_LOCK_KEY = "nfr-login-lock";

/* ------------------------------------------------------------------ */
/* Сессия                                                               */
/* ------------------------------------------------------------------ */

export interface MockSession {
  role: BackendRoleId;
  email: string;
  /** Имя пользователя (демо-аккаунты — «Демо-пользователь»). */
  name?: string;
  /** Организация (демо-аккаунты — роль + «(демо)»). */
  org?: string;
}

/** Демо-пароль для всех демо-аккаунтов (mock, без реальных секретов). */
export const DEMO_PASSWORD = "demo1234";

/** Демо-аккаунты (спека §2, зеркало бэкенда). */
export const DEMO_ACCOUNTS: readonly {
  email: string;
  role: BackendRoleId;
  password: string;
}[] = [
  { email: "demo.gk@example.com", role: "gk_customer", password: DEMO_PASSWORD },
  { email: "demo.rd@example.com", role: "rd_executor", password: DEMO_PASSWORD },
  { email: "demo.manager@example.com", role: "cntr_manager", password: DEMO_PASSWORD },
  { email: "demo.admin@example.com", role: "cntr_admin", password: DEMO_PASSWORD },
  { email: "demo.investor@example.com", role: "investor", password: DEMO_PASSWORD },
] as const;

const safeStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Стартовый маршрут кабинета: роль Центра → /operations, участник → /app. */
export function getSessionHome(role: BackendRoleId): string {
  if (isCenterRole(role)) return "/operations";
  return getRoleDefinition(role)?.home ?? "/app";
}

function writeSession(session: MockSession): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* недоступное хранилище не роняет вход в dev-режиме */
  }
}

function readSession(): MockSession | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MockSession>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !isBackendRoleId(parsed.role) ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }
    return {
      role: parsed.role,
      email: parsed.email,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      org: typeof parsed.org === "string" ? parsed.org : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Прочитать mock-сессию. Приоритет — полная сессия (T-013), иначе —
 * унаследованный ключ демо-роли (T-003, email из определения роли).
 * null — сессия отсутствует или хранилище недоступно.
 */
export function getMockSession(): MockSession | null {
  const rich = readSession();
  if (rich) return rich;
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(MOCK_ROLE_KEY);
    if (!raw || !isBackendRoleId(raw)) return null;
    const definition = getRoleDefinition(raw);
    return {
      role: raw,
      email: definition?.demoEmail ?? `${raw}@example.com`,
      name: "Демо-пользователь",
      org: definition ? `${definition.label} (демо)` : undefined,
    };
  } catch {
    return null;
  }
}

/** Синоним getMockSession (интерфейс будущего AuthAdapter). */
export function getSession(): MockSession | null {
  return getMockSession();
}

/** Выбрать демо-роль (вход под mock-аккаунтом через роль-свитчер). */
export function setMockRole(role: BackendRoleId): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(MOCK_ROLE_KEY, role);
    const definition = getRoleDefinition(role);
    writeSession({
      role,
      email: definition?.demoEmail ?? `${role}@example.com`,
      name: "Демо-пользователь",
      org: definition ? `${definition.label} (демо)` : undefined,
    });
  } catch {
    /* noop */
  }
}

/** Выйти: удалить mock-сессию. */
export function clearSession(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(MOCK_ROLE_KEY);
    storage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

/** Синоним clearSession (интерфейс будущего AuthAdapter). */
export function signOut(): void {
  clearSession();
}

/* ------------------------------------------------------------------ */
/* signIn: проверка демо-аккаунтов, invalid credentials, locked         */
/* ------------------------------------------------------------------ */

export type SignInErrorCode = "invalid_credentials" | "locked";

export type SignInResult =
  | { ok: true; session: MockSession; home: string }
  | {
      ok: false;
      error: SignInErrorCode;
      message: string;
      retryAfterSeconds?: number;
    };

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

interface LoginLock {
  count: number;
  until: number; // epoch ms, 0 — нет активной блокировки
}

function readLoginLock(): LoginLock | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(LOGIN_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoginLock>;
    if (typeof parsed.count !== "number" || typeof parsed.until !== "number") {
      return null;
    }
    return { count: parsed.count, until: parsed.until };
  } catch {
    return null;
  }
}

function writeLoginLock(lock: LoginLock): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(LOGIN_LOCK_KEY, JSON.stringify(lock));
  } catch {
    /* noop */
  }
}

function clearLoginLock(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(LOGIN_LOCK_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Вход по email+паролю. Проверяет демо-аккаунты; после 5 неудачных попыток
 * подряд вход блокируется на 60 секунд (состояние locked из ROUTES.md).
 * При успехе пишет сессию и возвращает стартовый маршрут кабинета.
 */
export function signIn(email: string, password: string): SignInResult {
  if (typeof window === "undefined") {
    return {
      ok: false,
      error: "invalid_credentials",
      message: "Авторизация доступна только в браузере.",
    };
  }
  const normalizedEmail = email.trim().toLowerCase();

  const lock = readLoginLock();
  if (lock && lock.until > Date.now()) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((lock.until - Date.now()) / 1000),
    );
    return {
      ok: false,
      error: "locked",
      message: `Слишком много неудачных попыток входа. Повторите через ${retryAfterSeconds} сек.`,
      retryAfterSeconds,
    };
  }

  const account = DEMO_ACCOUNTS.find((a) => a.email === normalizedEmail);

  if (!account || password !== account.password) {
    const baseCount = lock && lock.until > Date.now() ? lock.count : 0;
    const count = baseCount + 1;
    const nextLock: LoginLock =
      count >= MAX_ATTEMPTS
        ? { count, until: Date.now() + LOCK_SECONDS * 1000 }
        : { count, until: 0 };
    writeLoginLock(nextLock);
    return {
      ok: false,
      error: "invalid_credentials",
      message:
        "Неверный email или пароль. Проверьте данные и попробуйте снова — либо воспользуйтесь демо-доступом ниже.",
    };
  }

  clearLoginLock();
  const definition = getRoleDefinition(account.role);
  const session: MockSession = {
    role: account.role,
    email: account.email,
    name: "Демо-пользователь",
    org: definition ? `${definition.label} (демо)` : undefined,
  };
  writeSession(session);
  const storage = safeStorage();
  if (storage) {
    try {
      storage.setItem(MOCK_ROLE_KEY, account.role);
    } catch {
      /* noop */
    }
  }
  return { ok: true, session, home: getSessionHome(account.role) };
}

/* ------------------------------------------------------------------ */
/* Регистрация: черновик и заявка                                       */
/* ------------------------------------------------------------------ */

export type RegistrationStatus =
  | "pending"
  | "rejected"
  | "clarification";

export interface RegistrationApplication {
  id: string;
  status: RegistrationStatus;
  /** Причина отклонения / что уточнить (для rejected/clarification). */
  reason?: string;
  submittedAt: string;
  updatedAt: string;
  email: string;
  orgName: string;
  roleId: string;
  /** Снимок черновика — для восстановления после отклонения/уточнений. */
  draft: RegistrationDraftData;
}

function writeRegistrationDraft(data: RegistrationDraftData): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

/** Сохранить черновик регистрации (каждое изменение шага). */
export function registerDraft(data: RegistrationDraftData): void {
  writeRegistrationDraft(data);
}

/** Прочитать черновик регистрации (null, если нет/повреждён). */
export function readRegistrationDraft(): RegistrationDraftData | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(REGISTRATION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegistrationDraftData>;
    if (!parsed || typeof parsed !== "object") return null;
    // Черновик валиден, если в нём есть хотя бы строковые поля шага 1.
    if (typeof parsed.firstName !== "string") return null;
    return parsed as RegistrationDraftData;
  } catch {
    return null;
  }
}

/** Удалить черновик (после подачи). */
export function clearRegistrationDraft(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(REGISTRATION_DRAFT_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Подать заявку на регистрацию: создаёт запись со статусом pending
 * (зеркало модерации бэкенда), сохраняет снимок черновика для
 * восстановления после отклонения/уточнений, очищает черновик.
 */
export function completeRegistration(
  data: RegistrationDraftData,
): RegistrationApplication {
  const now = new Date().toISOString();
  const application: RegistrationApplication = {
    id: `reg-${Date.now().toString(36)}`,
    status: "pending",
    submittedAt: now,
    updatedAt: now,
    email: data.email.trim().toLowerCase(),
    orgName: data.orgName.trim(),
    roleId: data.roleId,
    draft: data,
  };
  const storage = safeStorage();
  if (storage) {
    try {
      storage.setItem(
        REGISTRATION_APPLICATION_KEY,
        JSON.stringify(application),
      );
      storage.removeItem(REGISTRATION_DRAFT_KEY);
    } catch {
      /* noop */
    }
  }
  return application;
}

/** Прочитать поданную заявку на регистрацию (null, если нет/повреждена). */
export function getRegistrationApplication(): RegistrationApplication | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(REGISTRATION_APPLICATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegistrationApplication>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.id !== "string" ||
      typeof parsed.status !== "string" ||
      (parsed.status !== "pending" &&
        parsed.status !== "rejected" &&
        parsed.status !== "clarification") ||
      !parsed.draft ||
      typeof parsed.draft !== "object"
    ) {
      return null;
    }
    return parsed as RegistrationApplication;
  } catch {
    return null;
  }
}

/**
 * Обновить статус заявки (dev-симуляция решения модератора; на интеграции
 * статус приходит с бэкенда). Возвращает обновлённую заявку или null.
 */
export function setRegistrationApplicationStatus(
  status: RegistrationStatus,
  reason?: string,
): RegistrationApplication | null {
  const storage = safeStorage();
  if (!storage) return null;
  const current = getRegistrationApplication();
  if (!current) return null;
  const next: RegistrationApplication = {
    ...current,
    status,
    reason: reason && reason.trim() !== "" ? reason.trim() : undefined,
    updatedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(REGISTRATION_APPLICATION_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}
