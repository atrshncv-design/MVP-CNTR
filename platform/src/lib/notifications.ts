/**
 * T-012. Локальные уведомления участника (localStorage, демо P0).
 *
 * Центр уведомлений (/app/notifications) показывает фикстуры событий
 * (notificationFixtures, STATES.md §5) плюс уведомления, созданные в этом
 * браузере: решения Центра (DecisionForm), события кабинета.
 *
 * Ключи:
 * - `nfr-local-notifications` — массив NotificationEvent, созданных локально;
 * - `nfr-notifications-read` — карта «id → прочитано/не прочитано» для
 *   ПЕРЕОПРЕДЕЛЕНИЯ состояния чтения фикстур и локальных записей
 *   (сами фикстуры не мутируются — состояние чтения живёт отдельно).
 *
 * ВАЖНО: клиентский слой (window). Все функции безопасны при SSR: без window
 * возвращают нейтральные значения, ничего не пишут. Данные не фабрикуются:
 * отсутствие хранилища = честное пустое состояние.
 */

import type {
  NotificationEvent,
  NotificationUrgency,
  OperationalTaskObjectType,
} from "./types";

export const LOCAL_NOTIFICATIONS_KEY = "nfr-local-notifications";
export const NOTIFICATIONS_READ_KEY = "nfr-notifications-read";

const safeStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Прочитать локальные уведомления ([] — нет/повреждено, не фабрикуем). */
export function listLocalNotifications(): NotificationEvent[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LOCAL_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is NotificationEvent =>
        Boolean(item) &&
        typeof item.id === "string" &&
        typeof item.objectId === "string" &&
        typeof item.event === "string" &&
        typeof item.createdAt === "string",
    );
  } catch {
    return [];
  }
}

function writeLocalNotifications(list: NotificationEvent[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(list));
  } catch {
    /* private mode и т.п. — уведомление остаётся в состоянии страницы */
  }
}

/** Входные данные для локального уведомления (остальное заполняется тут). */
export interface LocalNotificationInput {
  objectType: OperationalTaskObjectType | "document" | "decision" | "system";
  objectId: string;
  event: string;
  urgency: NotificationUrgency;
  requiredAction?: string | null;
  deadline?: string | null;
}

/**
 * Создать локальное уведомление (read: false, destination: inbox).
 * id генерируется на клиенте; createdAt — текущее время.
 */
export function appendLocalNotification(
  input: LocalNotificationInput,
): NotificationEvent {
  const notification: NotificationEvent = {
    id: `nfr-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    objectType: input.objectType,
    objectId: input.objectId,
    event: input.event,
    urgency: input.urgency,
    requiredAction: input.requiredAction ?? null,
    deadline: input.deadline ?? null,
    read: false,
    destination: "inbox",
    createdAt: new Date().toISOString(),
  };
  writeLocalNotifications([...listLocalNotifications(), notification]);
  return notification;
}

/* ------------------------------------------------------------------ */
/* Состояние чтения (переопределение для фикстур и локальных записей)   */
/* ------------------------------------------------------------------ */

type ReadState = Record<string, boolean>;

function readReadState(): ReadState {
  const storage = safeStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(NOTIFICATIONS_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ReadState;
  } catch {
    return {};
  }
}

function writeReadState(state: ReadState): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Эффективное состояние чтения с учётом переопределений. */
export function effectiveReadState(
  notifications: readonly NotificationEvent[],
): ReadState {
  const overrides = readReadState();
  const result: ReadState = {};
  for (const item of notifications) {
    result[item.id] = overrides[item.id] ?? item.read;
  }
  return result;
}

/** Отметить уведомление прочитанным/непрочитанным (локально, демо). */
export function setNotificationRead(id: string, read: boolean): void {
  const state = readReadState();
  state[id] = read;
  writeReadState(state);
}

/** Отметить все уведомления прочитанными. */
export function markAllNotificationsRead(ids: readonly string[]): void {
  const state = readReadState();
  for (const id of ids) {
    state[id] = true;
  }
  writeReadState(state);
}
