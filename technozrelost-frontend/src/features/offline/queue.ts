/**
 * Очередь offline-действий — localStorage (P3, R04).
 * Почему отдельный модуль: действия пользователя офлайн (POST/PUT/PATCH)
 * должны сохраняться в `tz:offline:queue` и повторно отправляться после
 * восстановления сети (online event + Background Sync via SyncManager fallback).
 * Хук `useOfflineQueue` выставляет очередь, а sync скрыт внутри.
 * Background Sync: если доступен `SyncManager` через `navigator.serviceWorker`,
 * регистрируем `tz-offline-queue-sync`; иначе fallback на `window online` event.
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
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    // Уведомляем другие вкладки/хуки через storage-событие (не срабатывает в той же вкладке,
    // поэтому хук также вызывает refresh вручную, но событие нужно для cross-tab).
    // Для same-tab — диспатчим кастомное событие tz:offline:queue:updated
    window.dispatchEvent(new CustomEvent("tz:offline:queue:updated", { detail: { queue } }));
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
    headers: payload.headers,
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
 */
export async function syncOfflineQueue(
  fetcher: (action: QueuedAction) => Promise<Response> = defaultFetcher,
): Promise<{ succeeded: string[]; failed: string[] }> {
  const queue = getOfflineQueue();
  const succeeded: string[] = [];
  const failed: string[] = [];
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    // Пропускаем превысившие лимит — оставляем для ручного retry
    if (action.retries >= OFFLINE_MAX_RETRIES) {
      remaining.push(action);
      failed.push(action.id);
      continue;
    }
    try {
      const res = await fetcher(action);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      succeeded.push(action.id);
      // не пушим в remaining — успешно синхронизировано
    } catch {
      // Ошибка сети или HTTP — инкремент retries и оставляем
      const updated: QueuedAction = { ...action, retries: action.retries + 1 };
      remaining.push(updated);
      failed.push(action.id);
    }
  }

  // Перезаписываем очередь оставшимися (неуспешными)
  setOfflineQueue(remaining);
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
 * fallback на `online` event в `useOfflineQueue`.
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
