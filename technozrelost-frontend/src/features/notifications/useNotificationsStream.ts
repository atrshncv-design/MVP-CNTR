// SSE подписка на GET /notifications/stream + fallback polling 30с (G56, R26.1)
// Почему отдельный хук: колокольчик и реестр используют один и тот же стрим.
// Backoff при разрыве чтобы не спамить сервер.

"use client";

import * as React from "react";
import { useSession } from "next-auth/react";

import { CLIENT_API_BASE } from "@/lib/public-api";

export function useNotificationsStream(onEvent: () => void, opts?: { enabled?: boolean; pollMs?: number }) {
  const enabled = opts?.enabled ?? true;
  const pollMs = opts?.pollMs ?? 30_000;
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const cbRef = React.useRef(onEvent);
  React.useEffect(() => {
    cbRef.current = onEvent;
  }, [onEvent]);

  React.useEffect(() => {
    if (!enabled || !token) return;
    let es: EventSource | null = null;
    let closed = false;
    let backoffMs = 1_000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => cbRef.current(), pollMs);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;
      // Backend stream ожидает access_token в query (EventSource не умеет header)
      // Используем CLIENT_API_BASE (относительный в проде через rewrites)
      const url = `${CLIENT_API_BASE}/api/v1/notifications/stream?access_token=${encodeURIComponent(token)}`;
      try {
        es = new EventSource(url);
      } catch {
        startPolling();
        return;
      }

      const handler = () => {
        backoffMs = 1_000;
        cbRef.current();
      };

      es.addEventListener("notification", handler);
      es.addEventListener("snapshot", handler);
      // realtime при публикации проекта (из 04) и matching заявке (из 05) — разные event name, ловим все
      es.addEventListener("project_published", handler);
      es.addEventListener("project_updated", handler);
      es.addEventListener("is_public", handler);
      es.onmessage = handler;
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
        // backoff reconnection, не спамить
        if (closed) return;
        const delay = Math.min(backoffMs, 30_000);
        retryTimer = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, 30_000);
          connect();
        }, delay);
      };
      // при успешном open сбрасываем polling
      es.onopen = () => {
        stopPolling();
        backoffMs = 1_000;
      };
    };

    connect();

    // fallback polling 30с пока нет SSE — страхуем, если EventSource недоступен за балансировщиком
    // polling стартует только после ошибки, чтобы не дублировать запросы при живом SSE
    return () => {
      closed = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
      stopPolling();
    };
  }, [token, enabled, pollMs]);
}
