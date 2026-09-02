// Колокольчик SSE + страница /dashboard/notifications (R26.1, G43, G56)
// Почему отдельный компонент: realtime уведомления при публикации проекта (04)
// и matching заявке (05) должны приходить без ручного обновления.
// Использует lib/api-client (тикет 01) и features/notifications stream.

/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import Link from "next/link";

import { getNotifications, markNotificationRead } from "@/lib/api-client";
import { CLIENT_API_BASE } from "@/lib/public-api";
import type { NotificationOut } from "@/lib/types";

/** Короткий звуковой сигнал через Web Audio (без аудиофайлов). */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* звук недоступен — молча */
  }
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Загрузка через api-client (тикет 01)
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await getNotifications(token);
      setItems(Array.isArray(list) ? list : []);
      setUnread(list.filter((n) => !n.is_read).length);
    } catch {
      /* ignore — скелетон/error покажет страница, колокольчик молчит */
    }
  }, [token]);

  // SSE-подписка: GET /notifications/stream + fallback polling 30с, backoff при разрыве
  useEffect(() => {
    if (!token) return;
    let stale = false;
    let backoffMs = 1_000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;

    const startPolling = () => {
      if (pollRef.current) return;
      // fallback polling 30с — если SSE недоступен за балансировщиком
      pollRef.current = setInterval(() => void load(), 30_000);
    };
    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const connect = () => {
      if (stale) return;
      // Предпочитаем прямой токен в query (backend реалтайм поддерживает access_token)
      // Если бэкап sse-ticket недоступен — падаем в polling, не спамим.
      const url = `${CLIENT_API_BASE}/api/v1/notifications/stream?access_token=${encodeURIComponent(token)}`;
      try {
        es = new EventSource(url);
        esRef.current = es;
      } catch {
        startPolling();
        return;
      }

      const onNotification = () => {
        beep();
        void load();
      };
      const onSnapshot = (e: MessageEvent) => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { unread: number };
          if (typeof data.unread === "number") setUnread(data.unread);
        } catch {
          /* ignore */
        }
      };

      es.addEventListener("notification", onNotification);
      es.addEventListener("snapshot", onSnapshot);
      // realtime при публикации проекта (из 04) и matching заявке (из 05)
      es.addEventListener("project_published", onNotification);
      es.addEventListener("project_updated", onNotification);
      es.addEventListener("is_public", onNotification);
      es.onmessage = onNotification;
      es.onopen = () => {
        backoffMs = 1_000;
        stopPolling();
      };
      es.onerror = () => {
        es?.close();
        esRef.current = null;
        startPolling();
        if (stale) return;
        const delay = Math.min(backoffMs, 30_000);
        retryTimer = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, 30_000);
          connect();
        }, delay);
      };
    };

    // сразу грузим и коннектим SSE
    void load();
    connect();

    return () => {
      stale = true;
      es?.close();
      esRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [token, load]);

  const markRead = async (id: number) => {
    if (!token) return;
    try {
      // Используем api-client для POST /notifications/{id}/read (тикет 01 контракт)
      await markNotificationRead(id, token);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    }
  };

  if (!token) return null;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className="relative grid h-9 w-9 place-items-center rounded-xl text-tz-secondary transition hover:bg-tz-surface-2 hover:text-tz-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
        aria-label={`Уведомления${unread ? `, ${unread} непрочитанных` : ""}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-tz-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 rounded-2xl border border-tz-border bg-tz-surface p-2 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-bold text-tz-fg">Уведомления</span>
            <Link href="/dashboard/notifications" className="text-xs font-semibold text-tz-accent hover:underline" onClick={() => setOpen(false)}>
              Все
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-tz-muted">Уведомлений пока нет</p>
            ) : (
              // дропдаун последние 10 с mark read — по ТЗ 10, не 20
              items.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => void markRead(n.id)}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-tz-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2 ${
                    n.is_read ? "opacity-60" : ""
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {n.is_read ? (
                      <Check size={14} className="text-tz-muted" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-tz-accent" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-tz-fg">{n.title}</span>
                    <span className="block text-xs text-tz-muted">{n.created_at ?? ""}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
