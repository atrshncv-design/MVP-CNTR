// Хук уведомлений — единый источник для колокольчика и страницы (R26.1, G41)
// Почему в features/notifications: SSE + polling должны переиспользоваться,
// а не дублироваться в bell и page. Использует lib/api-client (тикет 01).

/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as React from "react";
import { useSession } from "next-auth/react";

import { getNotifications, markNotificationRead } from "@/lib/api-client";
import type { NotificationOut } from "@/lib/types";

export type NotificationsFilter = "all" | "unread";

export function useNotifications(opts?: { pollMs?: number }) {
  const pollMs = opts?.pollMs ?? 30_000; // fallback polling 30с по ТЗ (не спамить)
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [items, setItems] = React.useState<NotificationOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const list = await getNotifications(token);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // initial + polling fallback (SSE может дополнить, но не заменяет)
  React.useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [token, load, pollMs]);

  const markRead = React.useCallback(
    async (id: number | string) => {
      if (!token) return;
      try {
        await markNotificationRead(id, token);
        setItems((prev) => prev.map((n) => (n.id === Number(id) ? { ...n, is_read: true } : n)));
      } catch {
        // ignore — оставляем непрочитанным, повтор через polling
      }
    },
    [token],
  );

  const unreadCount = React.useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const filtered = React.useCallback(
    (filter: NotificationsFilter) => {
      if (filter === "unread") return items.filter((n) => !n.is_read);
      return items;
    },
    [items],
  );

  return { items, loading, error, reload: load, markRead, unreadCount, filtered };
}
