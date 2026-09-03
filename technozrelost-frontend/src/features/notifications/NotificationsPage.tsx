// Страница /dashboard/notifications — ALL_ROLES (R26.1, G41, G55)
// Почему client: фильтры «Все/Непрочитано», отметка прочитанности, realtime,
// скелетон+retry, даты 31.03.2027 + тултип «2 дня назад» — всё интерактивно.
// Использует lib/api-client (тикет 01) и lib/format-date.

"use client";

import * as React from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatRelative, formatShortDate } from "@/lib/format-date";

import { useNotifications, type NotificationsFilter } from "./useNotifications";
import { useNotificationsStream } from "./useNotificationsStream";

function NotificationsSkeleton() {
  const t = useTranslations("notifications");
  return (
    <div className="space-y-3" aria-busy="true" aria-label={t("skeletonLabel")}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="tz-card p-5">
          <div className="h-4 w-32 animate-pulse rounded bg-tz-surface-2" />
          <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-tz-soft" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-tz-soft" />
        </div>
      ))}
    </div>
  );
}

export function NotificationsPage() {
  const t = useTranslations("notifications");
  const { items, loading, error, reload, markRead, filtered } = useNotifications({ pollMs: 30_000 });
  const [filter, setFilter] = React.useState<NotificationsFilter>("all");

  // realtime: при публикации проекта (из 04) и matching заявке (из 05) — обновляем список
  useNotificationsStream(() => void reload(), { enabled: true, pollMs: 30_000 });

  const list = React.useMemo(() => filtered(filter), [filtered, filter]);
  const unreadCount = React.useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  if (loading) return <NotificationsSkeleton />;

  if (error) {
    return (
      <div className="tz-card tz-empty" role="alert">
        <p className="tz-empty-title">{t("loadFailed")}</p>
        <p className="tz-empty-text">{error}</p>
        <button onClick={() => void reload()} className="tz-btn tz-btn-secondary mt-4">
          <RefreshCw size={15} /> {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl" aria-label={t("title")}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-tz-accent-soft text-tz-accent">
            <Bell size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-tz-fg">{t("title")}</h1>
            <p className="text-sm text-tz-muted">{unreadCount > 0 ? t("subtitleUnread", { count: unreadCount }) : t("subtitleNoUnread")}</p>
          </div>
        </div>
        <button onClick={() => void reload()} className="tz-btn tz-btn-ghost tz-btn-sm" aria-label={t("update")}>
          <RefreshCw size={15} /> {t("update")}
        </button>
      </div>

      {/* Фильтры «Все/Непрочитано» */}
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Фильтр уведомлений">
        <button
          role="tab"
          aria-selected={filter === "all"}
          onClick={() => setFilter("all")}
          className={`tz-btn ${filter === "all" ? "tz-btn-primary" : "tz-btn-ghost"} tz-btn-sm`}
        >
          {t("filterAll")}
        </button>
        <button
          role="tab"
          aria-selected={filter === "unread"}
          onClick={() => setFilter("unread")}
          className={`tz-btn ${filter === "unread" ? "tz-btn-primary" : "tz-btn-ghost"} tz-btn-sm`}
        >
          {t("filterUnread")}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="tz-card tz-empty">
          <span className="tz-empty-icon">
            <Bell size={22} />
          </span>
          <h2 className="tz-empty-title">{t("emptyTitle")}</h2>
          <p className="tz-empty-text">
            {t("emptyDesc")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => {
            const short = formatShortDate(n.created_at); // 31.03.2027
            const rel = formatRelative(n.created_at); // 2 дня назад
            return (
              <li
                key={n.id}
                className={`tz-card flex items-start gap-3 p-4 transition ${n.is_read ? "opacity-60" : "border-tz-accent/30"}`}
              >
                <span className="mt-1 shrink-0">
                  {n.is_read ? (
                    <CheckCheck size={16} className="text-tz-muted" aria-label={t("read")} />
                  ) : (
                    <span className="block h-2.5 w-2.5 rounded-full bg-tz-accent" aria-label={t("unread")} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-tz-fg">{n.title}</p>
                  {short && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-tz-muted">
                      <span title={rel} className="cursor-help underline decoration-dotted underline-offset-2">
                        {short}
                      </span>
                      {rel && <span title={short} className="cursor-help">· {rel}</span>}
                    </p>
                  )}
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => void markRead(n.id)}
                    className="tz-btn tz-btn-ghost tz-btn-sm shrink-0"
                    aria-label={t("markReadAria", { title: n.title })}
                  >
                    {t("read")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default NotificationsPage;
