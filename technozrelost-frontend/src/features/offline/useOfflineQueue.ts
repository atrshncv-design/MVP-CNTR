"use client";

/**
 * Хук offline-очереди (P3, R04).
 * Почему здесь: инкапсулирует navigator.onLine, события online/offline,
 * localStorage очередь `tz:offline:queue` и retry/sync после восстановления сети.
 * Выставляет `useOfflineQueue`, прячет sync-реализацию (внутри хука + queue.ts).
 * Background Sync: пробует `SyncManager` (`navigator.serviceWorker` + `reg.sync.register`),
 * иначе fallback на `window.addEventListener("online")`.
 */

import * as React from "react";

import {
  OFFLINE_QUEUE_KEY,
  type QueuedAction,
  clearOfflineQueue,
  dequeueOfflineAction,
  enqueueOfflineAction,
  getOfflineQueue,
  syncOfflineQueue,
} from "./queue";

export type { QueuedAction } from "./queue";
export { OFFLINE_QUEUE_KEY, OFFLINE_MAX_RETRIES } from "./queue";

export interface UseOfflineQueueReturn {
  isOnline: boolean;
  isOffline: boolean;
  queue: QueuedAction[];
  queueLength: number;
  enqueue: (payload: Omit<QueuedAction, "id" | "createdAt" | "retries">) => QueuedAction;
  remove: (id: string) => void;
  clear: () => void;
  sync: () => Promise<{ succeeded: string[]; failed: string[] }>;
  retry: () => Promise<{ succeeded: string[]; failed: string[] }>;
  isSyncing: boolean;
  refresh: () => void;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    if (typeof navigator !== "undefined") return navigator.onLine;
    return true;
  });
  const [queue, setQueue] = React.useState<QueuedAction[]>(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = React.useState(false);
  const syncingRef = React.useRef(false);

  const refresh = React.useCallback(() => {
    setQueue(getOfflineQueue());
  }, []);

  // Слушаем online/offline + storage + кастомное событие очереди
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Автоматический sync после восстановления сети (retry after online)
      if (syncingRef.current) return;
      syncingRef.current = true;
      setIsSyncing(true);
      void (async () => {
        try {
          await syncOfflineQueue();
        } finally {
          syncingRef.current = false;
          setIsSyncing(false);
          setQueue(getOfflineQueue());
        }
      })();
    };
    const handleOffline = () => setIsOnline(false);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === OFFLINE_QUEUE_KEY) setQueue(getOfflineQueue());
    };
    const handleCustom = () => setQueue(getOfflineQueue());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("tz:offline:queue:updated", handleCustom as EventListener);

    // Инициализация из localStorage при монтировании
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация внешнего состояния localStorage
    setQueue(getOfflineQueue());
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("tz:offline:queue:updated", handleCustom as EventListener);
    };
  }, []);

  const enqueue = React.useCallback(
    (payload: Omit<QueuedAction, "id" | "createdAt" | "retries">) => {
      const item = enqueueOfflineAction(payload);
      setQueue(getOfflineQueue());
      return item;
    },
    [],
  );

  const remove = React.useCallback((id: string) => {
    dequeueOfflineAction(id);
    setQueue(getOfflineQueue());
  }, []);

  const clear = React.useCallback(() => {
    clearOfflineQueue();
    setQueue(getOfflineQueue());
  }, []);

  const sync = React.useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cur = getOfflineQueue();
      return { succeeded: [] as string[], failed: cur.map((q) => q.id) };
    }
    if (typeof window === "undefined") return { succeeded: [] as string[], failed: [] as string[] };
    if (syncingRef.current) return { succeeded: [] as string[], failed: [] as string[] };
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      setQueue(getOfflineQueue());
      return result;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      setQueue(getOfflineQueue());
    }
  }, []);

  // retry — алиас sync для критерия "queue + retry after online"
  const retry = React.useCallback(() => sync(), [sync]);

  return {
    isOnline,
    isOffline: !isOnline,
    queue,
    queueLength: queue.length,
    enqueue,
    remove,
    clear,
    sync,
    retry,
    isSyncing,
    refresh,
  };
}

// Алиас для теста и совместимости
export const useQueue = useOfflineQueue;
export default useOfflineQueue;
