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

/**
 * R05i история 21: поведенческие швы очереди (без секретов + слияние при sync).
 * Почему runtime, а не static: static-проверки выше не ловят Bearer в localStorage
 * и потерю параллельно добавленных действий — проверяем через публичный интерфейс queue.ts.
 */

function installOfflineDom() {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => void store.clear(),
  };
  const prevWindow = globalThis.window;
  const prevNavigator = globalThis.navigator;
  globalThis.window = {
    localStorage: storage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  try {
    if (typeof globalThis.navigator === "undefined") {
      Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    }
  } catch {}
  return {
    storage,
    restore() {
      if (prevWindow === undefined) delete globalThis.window;
      else globalThis.window = prevWindow;
      if (prevNavigator === undefined) {
        try { delete globalThis.navigator; } catch {}
      }
    },
  };
}

test("offline R05i: в localStorage очереди нет строки Bearer после постановки действия", async () => {
  const dom = installOfflineDom();
  try {
    const q = await import("../src/features/offline/queue.ts");
    q.clearOfflineQueue();
    q.enqueueOfflineAction({
      url: "/api/v1/projects/1/publish",
      method: "PUT",
      body: { is_public: true },
      headers: { Authorization: "Bearer secret-token-xyz", "Content-Type": "application/json" },
    });
    const raw = dom.storage.getItem(q.OFFLINE_QUEUE_KEY);
    assert.ok(raw, "очередь должна быть записана в localStorage");
    assert.ok(!raw.includes("Bearer"), "в localStorage не должно быть строки Bearer");
    assert.ok(!raw.includes("secret-token-xyz"), "значение токена не должно храниться");
    const [item] = q.getOfflineQueue();
    const keys = Object.keys(item.headers ?? {});
    assert.ok(!keys.some((k) => k.toLowerCase() === "authorization"), "headers без Authorization");
    assert.equal(item.headers?.["Content-Type"], "application/json");
  } finally {
    dom.restore();
  }
});

test("offline R05i: синхронизация уходит с актуальным токеном сессии и доходит до API", async () => {
  const dom = installOfflineDom();
  try {
    const q = await import("../src/features/offline/queue.ts");
    q.clearOfflineQueue();
    q.enqueueOfflineAction({ url: "/api/v1/projects/1/publish", method: "PUT", body: { is_public: true } });
    const seen = [];
    const fetcher = async (action) => {
      seen.push(action);
      return { ok: true, status: 200 };
    };
    const result = await q.syncOfflineQueue(fetcher, { accessToken: "fresh-session-token" });
    assert.equal(result.succeeded.length, 1);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].headers?.Authorization, "Bearer fresh-session-token");
    assert.equal(q.getOfflineQueue().length, 0);
  } finally {
    dom.restore();
  }
});

test("offline R05i: действие, добавленное во время sync, сохраняется (слияние по id)", async () => {
  const dom = installOfflineDom();
  try {
    const q = await import("../src/features/offline/queue.ts");
    q.clearOfflineQueue();
    q.enqueueOfflineAction({ url: "/api/v1/projects/1/publish", method: "PUT", body: { a: 1 } });
    let concurrentId = null;
    const fetcher = async () => {
      if (concurrentId === null) {
        const added = q.enqueueOfflineAction({ url: "/api/v1/projects/2/archive", method: "POST" });
        concurrentId = added.id;
      }
      return { ok: true, status: 200 };
    };
    const result = await q.syncOfflineQueue(fetcher, { accessToken: "t" });
    assert.equal(result.succeeded.length, 1);
    assert.ok(concurrentId, "параллельное действие должно быть добавлено");
    const rest = q.getOfflineQueue();
    assert.equal(rest.length, 1);
    assert.equal(rest[0].id, concurrentId);
    assert.equal(rest[0].url, "/api/v1/projects/2/archive");
  } finally {
    dom.restore();
  }
});
