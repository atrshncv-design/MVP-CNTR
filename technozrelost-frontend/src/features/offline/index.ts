/**
 * Публичный шов модуля offline (P3, R04, spec § Границы).
 * Владеет очередью, выставляет `useOfflineQueue` и `OfflineBanner`, прячет sync.
 * Почему barrel: единый импорт из @/features/offline.
 */

export { OFFLINE_QUEUE_KEY, OFFLINE_MAX_RETRIES, sanitizeOfflineHeaders, syncOfflineQueue } from "./queue";
export type { QueuedAction, OfflineTokenProvider, SyncOfflineQueueOptions } from "./queue";
export { getOfflineQueue, setOfflineQueue, enqueueOfflineAction, dequeueOfflineAction, clearOfflineQueue } from "./queue";
export { useOfflineQueue } from "./useOfflineQueue";
export type { UseOfflineQueueReturn } from "./useOfflineQueue";
export { OfflineBanner } from "./OfflineBanner";
export { default as OfflineBannerDefault } from "./OfflineBanner";
