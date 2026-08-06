"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string | null;
}

/** Короткий звуковой сигнал через Web Audio (без аудиофайлов). */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const list = (await res.json()) as NotificationItem[];
      setItems(list);
      setUnread(list.filter((n) => !n.is_read).length);
    } catch {
      /* ignore */
    }
  }, [token]);

  // SSE-подписка: live-события + звук
  useEffect(() => {
    if (!token) return;
    const es = new EventSource(
      `${API_URL}/api/v1/notifications/stream?access_token=${encodeURIComponent(token)}`,
    );
    esRef.current = es;
    es.addEventListener("notification", () => {
      beep();
      void load();
    });
    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { unread: number };
        setUnread(data.unread);
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [token, load]);

  const markRead = async (id: number) => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
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
        className="relative grid h-9 w-9 place-items-center rounded-xl text-tz-secondary transition hover:bg-tz-surface-2 hover:text-tz-fg"
        aria-label={`Уведомления${unread ? `, ${unread} непрочитанных` : ""}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 rounded-2xl border border-tz-border bg-tz-surface p-2 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-bold text-tz-fg">Уведомления</span>

          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-tz-muted">
                Уведомлений пока нет
              </p>
            ) : (
              items.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => void markRead(n.id)}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-tz-surface-2 ${
                    n.is_read ? "opacity-60" : ""
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {n.is_read ? (
                      <Check size={14} className="text-tz-muted" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-[#2E5BFF]" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-tz-fg">
                      {n.title}
                    </span>
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
