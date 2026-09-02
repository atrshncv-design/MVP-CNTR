import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

/**
 * Offline очередь (P3 R04) — баннер offline, очередь в localStorage, sync после online + retry.
 * Проверяем через исходники (static эквивалент runtime проверки).
 */

test("offline: директория и файлы существуют (P3 R04)", () => {
  for (const f of [
    "src/features/offline/index.ts",
    "src/features/offline/queue.ts",
    "src/features/offline/useOfflineQueue.ts",
    "src/features/offline/OfflineBanner.tsx",
  ]) {
    assert.ok(exists(f), `missing ${f}`);
  }
});

test("offline queue: localStorage ключ tz:offline:queue, enqueue/dequeue/clear", () => {
  const src = read("src/features/offline/queue.ts");
  assert.match(src, /tz:offline:queue/);
  assert.match(src, /OFFLINE_QUEUE_KEY/);
  assert.match(src, /localStorage\.getItem/);
  assert.match(src, /localStorage\.setItem/);
  assert.match(src, /localStorage\.removeItem/);
  assert.match(src, /getOfflineQueue/);
  assert.match(src, /enqueueOfflineAction|enqueue/);
  assert.match(src, /dequeueOfflineAction|dequeue/);
  assert.match(src, /clearOfflineQueue|clearQueue/);
  assert.match(src, /QueuedAction/);
  assert.match(src, /retries/);
  assert.match(src, /OFFLINE_MAX_RETRIES/);
});

test("offline queue: sync logic — fetch + retry после online", () => {
  const src = read("src/features/offline/queue.ts");
  assert.match(src, /syncOfflineQueue/);
  assert.match(src, /fetch/);
  assert.match(src, /retries/);
  // должен обрабатывать неуспешные и успешные
  assert.match(src, /succeeded/);
  assert.match(src, /failed/);
});

test("useOfflineQueue: navigator.onLine + online/offline listeners + retry/sync", () => {
  const src = read("src/features/offline/useOfflineQueue.ts");
  assert.match(src, /useOfflineQueue/);
  assert.match(src, /navigator\.onLine/);
  assert.match(src, /addEventListener\("online"/);
  assert.match(src, /addEventListener\("offline"/);
  assert.match(src, /localStorage|OFFLINE_QUEUE_KEY|getOfflineQueue/);
  assert.match(src, /syncOfflineQueue|sync/);
  assert.match(src, /retry/);
  assert.match(src, /isOnline/);
  assert.match(src, /isOffline/);
  assert.match(src, /queueLength/);
  assert.match(src, /enqueue/);
  assert.match(src, /isSyncing/);
  // автоматический sync после online (retry after online)
  assert.match(src, /online.*sync|sync.*online/s);
});

test("OfflineBanner: role alert/status, aria-live, offline текст, очередь и retry", () => {
  const src = read("src/features/offline/OfflineBanner.tsx");
  assert.match(src, /OfflineBanner/);
  assert.match(src, /role="alert"/);
  assert.match(src, /role="status"/);
  assert.match(src, /aria-live="assertive"/);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /data-testid="offline-banner"/);
  assert.match(src, /data-testid="offline-sync-banner"/);
  // текст офлайн
  assert.ok(
    src.includes("Нет соединения") || src.includes("офлайн") || src.includes("Offline"),
    "баннер должен содержать текст офлайн",
  );
  assert.match(src, /queueLength|в очереди/);
  assert.match(src, /retry|Синхронизировать|Повторить/);
  assert.match(src, /WifiOff|Wifi/);
  // использует хук
  assert.match(src, /useOfflineQueue/);
});

test("offline index: barrel экспортирует useOfflineQueue + OfflineBanner + queue", () => {
  const idx = read("src/features/offline/index.ts");
  assert.match(idx, /useOfflineQueue/);
  assert.match(idx, /OfflineBanner/);
  assert.match(idx, /OFFLINE_QUEUE_KEY/);
  assert.match(idx, /getOfflineQueue|QueuedAction/);
});

test("providers: глобальный OfflineBanner смонтирован", () => {
  const src = read("src/components/providers.tsx");
  assert.match(src, /OfflineBanner/);
  assert.match(src, /from "@\/features\/offline/);
});
