/**
 * T-012. Центр уведомлений участника (/app/notifications).
 *
 * Клиентский компонент: объединяет фикстуры событий (notificationFixtures,
 * STATES.md §5) и локальные уведомления этого браузера
 * (nfr-local-notifications — решения Центра из DecisionForm и др.).
 * Группировка по типу объекта, фильтр «все/непрочитанные», переключение
 * «прочитано/не прочитано» (состояние чтения хранится отдельно —
 * фикстуры не мутируются), прямой переход к объекту.
 *
 * SSR-safe: до монтирования (window недоступен) рендерится скелет;
 * данные читаются только в браузере.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { notificationFixtures } from "@/data/fixtures";
import type { NotificationEvent } from "@/lib/types";
import {
  effectiveReadState,
  listLocalNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "@/lib/notifications";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import { NotificationItem } from "@/components/notifications/notification-item";

type NotificationFilter = "all" | "unread";

/** Русские подписи типов объектов (группы центра уведомлений). */
const OBJECT_TYPE_GROUP_LABELS: Record<NotificationEvent["objectType"], string> = {
  technology: "Технологии",
  request: "Запросы",
  organization: "Организации",
  research: "НИОКТР",
  pilot: "Пилоты",
  document: "Документы",
  decision: "Решения",
  system: "Системные",
};

/** Порядок групп в центре (сначала объекты, по которым есть страницы). */
const GROUP_ORDER: readonly NotificationEvent["objectType"][] = [
  "technology",
  "request",
  "pilot",
  "document",
  "decision",
  "system",
  "organization",
  "research",
];

/**
 * Прямой переход к объекту (тикет T-012): технология → досье исполнителя,
 * запрос → dossier заказчика, пилот → пилоты заказчика, документ → workspace
 * документов. Для объектов без страницы в P0 ссылка не выдумывается (null).
 */
export function notificationObjectHref(
  notification: NotificationEvent,
): string | null {
  const id = encodeURIComponent(notification.objectId);
  switch (notification.objectType) {
    case "technology":
      return `/app/partner/technologies/${id}`;
    case "request":
      return `/app/customer/requests/${id}`;
    case "pilot":
      return `/app/customer/pilots/${id}`;
    case "document":
      return "/app/documents";
    case "organization":
    case "research":
    case "decision":
    case "system":
      return null;
  }
}

/** Сортировка: новые сверху (createdAt по убыванию). */
function byNewest(a: NotificationEvent, b: NotificationEvent): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [readState, setReadState] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Фикстуры + локальные уведомления; фикстуры не мутируются.
      const all = [...notificationFixtures, ...listLocalNotifications()].sort(byNewest);
      setNotifications(all);
      setReadState(effectiveReadState(all));
      setLoaded(true);
    })();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readState[item.id]).length,
    [notifications, readState],
  );

  const toggleRead = (id: string, read: boolean) => {
    setNotificationRead(id, read);
    setReadState((prev) => ({ ...prev, [id]: read }));
  };

  const markAllRead = () => {
    const ids = notifications.map((item) => item.id);
    markAllNotificationsRead(ids);
    setReadState((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });
  };

  if (!loaded) {
    return <LoadingSkeleton variant="list" rows={4} label="Загружаем уведомления" />;
  }

  const visible =
    filter === "unread"
      ? notifications.filter((item) => !readState[item.id])
      : notifications;

  const groups = GROUP_ORDER.map((objectType) => ({
    objectType,
    label: OBJECT_TYPE_GROUP_LABELS[objectType],
    items: visible
      .filter((item) => item.objectType === objectType)
      .sort(byNewest),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Панель управления: счётчик, фильтры, «все прочитаны» */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-control border border-subtle bg-surface p-1">
          {(
            [
              { value: "all", label: "Все" },
              { value: "unread", label: "Непрочитанные" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`inline-flex h-10 items-center gap-2 rounded-control px-4 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                filter === option.value
                  ? "bg-accent-strong text-accent-contrast"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {option.label}
              {option.value === "unread" ? (
                <span
                  className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-meta ${
                    filter === option.value
                      ? "bg-accent-contrast/20"
                      : "bg-accent-soft text-accent"
                  }`}
                >
                  {unreadCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="inline-flex h-10 items-center gap-2 rounded-control border border-border-strong px-4 text-small font-medium text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          Отметить все прочитанными
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={filter === "unread" ? Inbox : Bell}
          title={
            filter === "unread"
              ? "Непрочитанных уведомлений нет"
              : "Уведомлений пока нет"
          }
          description={
            filter === "unread"
              ? "Все события прочитаны. Новые уведомления появятся здесь."
              : "События по проектам, заявкам и решениям Центра появятся здесь. Сейчас список пуст."
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.objectType} aria-labelledby={`group-${group.objectType}`}>
              <h2
                id={`group-${group.objectType}`}
                className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
              >
                <Bell className="h-5 w-5 text-accent" aria-hidden />
                {group.label}
                <span className="font-mono text-meta font-normal text-muted">
                  {group.items.length}
                </span>
              </h2>
              <ul className="mt-3 space-y-3">
                {group.items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    href={notificationObjectHref(item)}
                    read={readState[item.id] ?? false}
                    onToggleRead={toggleRead}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
