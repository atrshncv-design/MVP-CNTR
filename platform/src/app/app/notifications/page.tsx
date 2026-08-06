/**
 * T-012. Центр уведомлений участника (/app/notifications).
 * Фикстуры + локальные уведомления (nfr-local-notifications), фильтры
 * (непрочитанные/все), переключение прочитано/не прочитано, переход к объекту.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Inbox } from "lucide-react";
import { notificationFixtures } from "@/data/fixtures";
import {
  effectiveReadState,
  listLocalNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "@/lib/notifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import type { NotificationEvent } from "@/lib/types";
import { EmptyState } from "@/components/states/empty-state";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

/** Переход к объекту уведомления (P0-маршруты). */
function notificationHref(notification: NotificationEvent): string | null {
  if (notification.objectType === "technology") {
    return `/app/partner/technologies/${notification.objectId}`;
  }
  if (notification.objectType === "request") {
    return `/app/customer/requests/${notification.objectId}`;
  }
  if (notification.objectType === "document") {
    return "/app/documents";
  }
  return null;
}

export default function NotificationsPage() {
  const [locals, setLocals] = useState<NotificationEvent[]>([]);
  const [readState, setReadState] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    (async () => {
      const localList = listLocalNotifications();
      setLocals(localList);
      setReadState(effectiveReadState([...localList, ...notificationFixtures]));
    })();
  }, []);

  const all = useMemo(
    () => [...locals, ...notificationFixtures],
    [locals],
  );

  const visible = useMemo(() => {
    const sorted = [...all].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (filter === "unread") {
      return sorted.filter((n) => !(readState[n.id] ?? n.read));
    }
    return sorted;
  }, [all, filter, readState]);

  const unreadCount = useMemo(
    () => all.filter((n) => !(readState[n.id] ?? n.read)).length,
    [all, readState],
  );

  const toggleRead = (id: string, read: boolean) => {
    setNotificationRead(id, read);
    setReadState((current) => ({ ...current, [id]: read }));
  };

  const markAll = () => {
    markAllNotificationsRead(all.map((n) => n.id));
    setReadState(Object.fromEntries(all.map((n) => [n.id, true])));
  };

  return (
    <div className={CONTAINER}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-h2 font-semibold tracking-tight text-primary">
            <BellRing className="h-6 w-6 text-accent" aria-hidden />
            Уведомления
          </h1>
          <p className="mt-1.5 text-small text-secondary">
            {unreadCount > 0
              ? `${unreadCount} непрочитанных`
              : "Непрочитанных нет"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Фильтр уведомлений"
            className="flex rounded-control border border-subtle bg-surface p-0.5"
          >
            {(
              [
                { value: "all", label: "Все" },
                { value: "unread", label: "Непрочитанные" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={filter === tab.value}
                onClick={() => setFilter(tab.value)}
                className={`rounded-control px-4 py-2 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                  filter === tab.value
                    ? "bg-accent-strong text-accent-contrast"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAll}
              className="inline-flex h-10 items-center rounded-control border border-border-strong bg-surface px-4 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Прочитать все
            </button>
          ) : null}
        </div>
      </header>

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Уведомлений нет"
            description="События по проектам, заявкам и решениям появятся здесь. Сейчас непрочитанных уведомлений нет."
            icon={Inbox}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              href={notificationHref(notification)}
              read={readState[notification.id] ?? notification.read}
              onToggleRead={toggleRead}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
