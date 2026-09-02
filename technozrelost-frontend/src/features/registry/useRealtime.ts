"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { CLIENT_API_BASE } from "@/lib/public-api";

/**
 * Realtime-подписка реестра — SSE + fallback polling (тикет 04, G56).
 * Почему так: реестр должен обновляться без ручного refresh при
 * публикации проекта в другой вкладке (<5с). SSE через одноразовый
 * ticket (как notification-bell), при недоступности SSE — polling.
 * Fallback обязателен: EventSource может быть закрыт балансировщиком.
 */
export function useRealtime(onUpdate: () => void, opts?: { enabled?: boolean; intervalMs?: number }) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const enabled = opts?.enabled ?? true;
  const intervalMs = opts?.intervalMs ?? 5000;
  const ref = useRef(onUpdate);
  useEffect(() => {
    ref.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled || !token) return;
    let es: EventSource | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const startFallback = () => {
      if (timer) return;
      timer = setInterval(() => ref.current(), intervalMs);
    };
    const clearFallback = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    void (async () => {
      try {
        const res = await fetch(`${CLIENT_API_BASE}/api/v1/notifications/sse-ticket`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok || cancelled) {
          startFallback();
          return;
        }
        const body = (await res.json()) as { ticket: string };
        if (cancelled) return;
        es = new EventSource(
          `${CLIENT_API_BASE}/api/v1/notifications/stream?ticket=${encodeURIComponent(body.ticket)}`,
        );
        const handler = () => ref.current();
        es.addEventListener("notification", handler);
        es.addEventListener("project_published", handler);
        es.addEventListener("project_updated", handler);
        es.addEventListener("is_public", handler);
        es.onmessage = handler;
        es.onerror = () => {
          es?.close();
          startFallback();
        };
      } catch {
        startFallback();
      }
    })();

    return () => {
      cancelled = true;
      es?.close();
      clearFallback();
    };
  }, [token, enabled, intervalMs]);
}
