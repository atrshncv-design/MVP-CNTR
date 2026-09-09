/**
 * Очередь offline-действий — localStorage (P3, R04; R05i история 21).
 * Почему отдельный модуль: действия пользователя офлайн (POST/PUT/PATCH)
 * должны сохраняться в `tz:offline:queue` и повторно отправляться после
 * восстановления сети (online event + Background Sync via SyncManager fallback).
 * Хук `useOfflineQueue` выставляет очередь, а sync скрыт внутри.
 * Background Sync: если доступен SyncManager через navigator.serviceWorker,
 * регистрируем тэг tz-offline-queue-sync; иначе fallback на online event в хуке.
 *
 * R05i история 21: очередь хранит действия БЕЗ секретов — заголовок
 * Authorization вычищается при записи (enqueue/set), а актуальный токен
 * сессии подставляется в момент отправки (sync), а не из localStorage.
 * Почему так: localStorage читается любым скриптом страницы, токен там —
 * это утечка сессии; токен из сессии всегда свежее сохранённого.
 */

export const OFFLINE_QUEUE_KEY = "tz:offline:queue";

export const OFFLINE_MAX_RETRIES = 3;

export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: string;
  retries: number;
}

/**
 * Провайдер актуального токена сессии для sync (R05i).
 * Почему функция, а не строка: токен берётся в момент отправки каждого
 * действия — за время долгого sync сессия может обновиться (refresh).
 */
export type OfflineTokenProvider = () => string | null | undefined | Promise<string | null | undefined>;

export interface SyncOfflineQueueOptions {
  getAccessToken?: OfflineTokenProvider;
  accessToken?: string | null;
}

/** Заголовки-секреты, которым запрещено храниться в localStorage (R05i). */
const SECRET_HEADER_NAMES = new Set(["authorization", "proxy-authorization"]);

/**
 * Вычищает секреты из заголовков (R05i).
 * Почему case-insensitive: fetch-заголовки регистронезависимы,
 * `authorization` и `Authorization` — один и тот же секрет.
 */
export function sanitizeOfflineHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (SECRET_HEADER_NAMES.has(name.toLowerCase())) continue;
    clean[name] = value;
  }
  return clean;
}

function sanitizeQueuedAction(action: QueuedAction): QueuedAction {
  const clean = sanitizeOfflineHeaders(action.headers);
  if (clean === undefined) {
    if (action.headers === undefined) return action;
    const rest = { ...action };
    delete rest.headers;
    return rest;
  }
  if (action.headers && Object.keys(clean).length === Object.keys(action.headers).length) return action;
  return { ...action, headers: clean };
}

function resolveTokenProvider(
  tokenOrOptions?: OfflineTokenProvider | SyncOfflineQueueOptions | string | null,
): OfflineTokenProvider | null {
  if (!tokenOrOptions) return null;
  if (typeof tokenOrOptions === "function") return tokenOrOptions as OfflineTokenProvider;
  if (typeof tokenOrOptions === "string") {
    const token = tokenOrOptions;
    return () => token;
  }
  const opts = tokenOrOptions as SyncOfflineQueueOptions;
  if (typeof opts.getAccessToken === "function") return opts.getAccessToken;
  if (typeof opts.accessToken === "string" && opts.accessToken.length > 0) {
    const token = opts.accessToken;
    return () => token;
  }
  return null;
}

function isValidQueuedAction(v: unknown): v is QueuedAction {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r["id"] === "string" &&
    typeof r["url"] === "string" &&
    typeof r["method"] === "string" &&
    typeof r["createdAt"] === "string" &&
    typeof r["retries"] === "number"
  );
}

export function getOfflineQueue(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueuedAction);
  } catch {
    return [];
  }
}

export function setOfflineQueue(queue: QueuedAction[]): void {
  if (typeof window === "undefined") return;
  try {
    // R05i: чистим секреты на границе записи — даже прямой вызов
    // setOfflineQueue с Authorization не оставит Bearer в localStorage.
    const sanitized = queue.map(sanitizeQueuedAction);
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(sanitized));
    // Уведомляем другие вкладки/хуки через storage-событие (не срабатывает в той же вкладке,
    // поэтому хук также вызывает refresh вручную, но событие нужно для cross-tab).
    // Для same-tab — диспатчим кастомное событие tz:offline:queue:updated
    window.dispatchEvent(new CustomEvent("tz:offline:queue:updated", { detail: { queue: sanitized } }));
  } catch {
    // ignore quota
  }
}

export function enqueueOfflineAction(
  payload: Omit<QueuedAction, "id" | "createdAt" | "retries">,
): QueuedAction {
  const queue = getOfflineQueue();
  const now = new Date().toISOString();
  const item: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: payload.url,
    method: payload.method.toUpperCase(),
    body: payload.body,
    // R05i: токен из входящих headers не сохраняем — он подставится из сессии в момент sync.
    headers: sanitizeOfflineHeaders(payload.headers),
    createdAt: now,
    retries: 0,
  };
  const next = [...queue, item];
  setOfflineQueue(next);
  // Background Sync: пробуем зарегистрировать sync, fallback — online event в хуке
  tryRegisterBackgroundSync();
  return item;
}

export function dequeueOfflineAction(id: string): QueuedAction[] {
  const queue = getOfflineQueue();
  const next = queue.filter((a) => a.id !== id);
  setOfflineQueue(next);
  return next;
}

export function clearOfflineQueue(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OFFLINE_QUEUE_KEY);
    window.dispatchEvent(new CustomEvent("tz:offline:queue:updated", { detail: { queue: [] } }));
  } catch {
    // ignore
  }
}

export function updateOfflineActionRetry(id: string): QueuedAction[] {
  const queue = getOfflineQueue();
  const next = queue.map((a) => (a.id === id ? { ...a, retries: a.retries + 1 } : a));
  setOfflineQueue(next);
  return next;
}

/**
 * Внутренняя sync-логика (скрыта от публичного API, используется хуком).
 * Почему здесь: повторная отправка после online должна идти через fetch с
 * теми же method/url/body/headers, при успехе — удаление из очереди,
 * при ошибке — инкремент retries (до OFFLINE_MAX_RETRIES).
 *
 * R05i: токен подставляется в момент отправки из провайдера сессии
 * (второй аргумент — функция, `{ accessToken }` или `{ getAccessToken }`);
 * в localStorage токен не хранится и не перезаписывается туда.
 * Слияние по id: действия, добавленные во время sync (параллельный enqueue),
 * не теряются при перезаписи очереди; явно удалённые не воскрешаются.
 */
export async function syncOfflineQueue(
  fetcher: (action: QueuedAction) => Promise<Response> = defaultFetcher,
  tokenOrOptions?: OfflineTokenProvider | SyncOfflineQueueOptions | string | null,
): Promise<{ succeeded: string[]; failed: string[] }> {
  const snapshot = getOfflineQueue().map(sanitizeQueuedAction);
  const snapshotIds = new Set(snapshot.map((a) => a.id));
  const getToken = resolveTokenProvider(tokenOrOptions);
  const succeeded: string[] = [];
  const failed: string[] = [];
  const remaining: QueuedAction[] = [];

  for (const action of snapshot) {
    // Пропускаем превысившие лимит — оставляем для ручного retry
    if (action.retries >= OFFLINE_MAX_RETRIES) {
      remaining.push(action);
      failed.push(action.id);
      continue;
    }
    try {
      // R05i: актуальный токен — в момент отправки, поверх сохранённых (без секретов) заголовков.
      const token = getToken ? await getToken() : null;
      const actionForSend: QueuedAction = token
        ? { ...action, headers: { ...(action.headers ?? {}), Authorization: `Bearer ${token}` } }
        : action;
      const res = await fetcher(actionForSend);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      succeeded.push(action.id);
      // не пушим в remaining — успешно синхронизировано
    } catch {
      // Ошибка сети или HTTP — инкремент retries и оставляем (без секретов)
      const updated: QueuedAction = { ...action, retries: action.retries + 1 };
      remaining.push(updated);
      failed.push(action.id);
    }
  }

  // R05i: слияние по id вместо слепой перезаписи — параллельно добавленные
  // во время sync действия сохраняются; явно удалённые не воскрешаются.
  const remainingById = new Map(remaining.map((a) => [a.id, a] as const));
  const current = getOfflineQueue();
  const merged: QueuedAction[] = [];
  for (const item of current) {
    const updated = remainingById.get(item.id);
    if (updated) {
      merged.push(updated);
      remainingById.delete(item.id);
    } else if (!snapshotIds.has(item.id)) {
      merged.push(item);
    }
    // элемент снапшота без updated — успешно синхронизирован, выкидываем
  }
  // Перезаписываем очередь слиянием (успешные удалены, новые сохранены)
  setOfflineQueue(merged);
  return { succeeded, failed };
}

async function defaultFetcher(action: QueuedAction): Promise<Response> {
  const headers: Record<string, string> = { ...(action.headers ?? {}) };
  let body: string | undefined;
  if (action.body !== undefined && action.body !== null) {
    if (typeof action.body === "string") body = action.body;
    else {
      body = JSON.stringify(action.body);
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    }
  }
  return fetch(action.url, {
    method: action.method,
    headers,
    body,
    cache: "no-store",
  });
}

/**
 * Background Sync регистрация (если доступен SyncManager) — иначе no-op.
 * Почему здесь: современные браузеры поддерживают `SyncManager` для
 * отложенной синхронизации даже при закрытой вкладке; для остальных —
 * fallback на online event в useOfflineQueue.
 */
export function tryRegisterBackgroundSync(): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  try {
    const nav = navigator as unknown as { serviceWorker?: { ready: Promise<{ sync?: { register: (tag: string) => Promise<void> } }> } };
    if (!nav.serviceWorker) return;
    void nav.serviceWorker.ready.then((reg) => {
      if (reg.sync && typeof reg.sync.register === "function") {
        void reg.sync.register("tz-offline-queue-sync");
      }
    });
  } catch {
    // ignore — fallback на online event
  }
}

// Алиас для совместимости с критерием "queue + retry after online"
export const getQueue = getOfflineQueue;
export const enqueue = enqueueOfflineAction;
export const dequeue = dequeueOfflineAction;
export const clearQueue = clearOfflineQueue;
