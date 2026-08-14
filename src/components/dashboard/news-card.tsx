"use client";

import Link from "next/link";
import { CalendarDays, Newspaper, Pencil, Rocket, Unlink } from "lucide-react";
import {
  NEWS_STATUS_LABELS,
  type NewsDetail,
  type NewsStatus,
} from "@/lib/news-types";
import { formatRuDate } from "@/lib/format-date";

/** Цвета статусных бейджей (tz-токены, три темы — спека §3.7). */
const STATUS_BADGE: Record<NewsStatus, string> = {
  draft: "tz-badge-neutral",
  scheduled: "tz-badge-warning",
  published: "tz-badge-accent",
};

/**
 * Карточка новости в ЛК (/dashboard/news): та же витрина, что публичная
 * (обложка-placeholder, категория, дата, теги), плюс статус и кнопки
 * управления для автора/cntr_admin (на своих / любых).
 */
export default function DashboardNewsCard({
  item,
  canManage,
  busy,
  onPublish,
  onUnpublish,
}: {
  item: NewsDetail;
  canManage: boolean;
  busy: boolean;
  onPublish: (item: NewsDetail) => void;
  onUnpublish: (item: NewsDetail) => void;
}) {
  const badge = STATUS_BADGE[item.status] ?? "tz-badge-neutral";
  const date = item.published_at ?? item.created_at;

  return (
    <div className="tz-card tz-card-hover flex h-full flex-col overflow-hidden">
      {/* Обложка (placeholder — медиа-маршрут бэкенда не подключён) */}
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden border-b border-tz-card-border bg-gradient-to-br from-tz-accent-soft via-tz-surface to-tz-surface-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tz-surface text-tz-accent shadow-tz-card">
          <Newspaper size={26} strokeWidth={1.75} />
        </div>
        <span className={`absolute bottom-2.5 left-2.5 tz-badge ${badge}`}>
          {NEWS_STATUS_LABELS[item.status] ?? item.status}
        </span>
        {item.category && (
          <span className="absolute right-2.5 top-2.5 tz-badge tz-badge-accent">
            {item.category.name}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-tz-muted">
          {date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} />
              {formatRuDate(date)}
            </span>
          )}
          {item.status === "scheduled" && item.scheduled_at && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} />
              план: {formatRuDate(item.scheduled_at)}
            </span>
          )}
        </div>

        <Link
          href={`/news/${item.id}`}
          className="tz-card-title mt-2 line-clamp-2 transition-colors hover:text-tz-accent"
        >
          {item.title}
        </Link>

        {item.excerpt && (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-tz-secondary">
            {item.excerpt}
          </p>
        )}

        {item.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 4).map((tag) => (
              <span key={tag.id} className="tz-badge tz-badge-neutral">
                #{tag.slug}
              </span>
            ))}
          </div>
        )}

        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-tz-border pt-4">
            <Link
              href={`/dashboard/news/${item.id}/edit`}
              className="tz-btn tz-btn-secondary tz-btn-sm"
            >
              <Pencil size={13} />
              Редактировать
            </Link>
            {item.status !== "published" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPublish(item)}
                className="tz-btn tz-btn-primary tz-btn-sm"
              >
                <Rocket size={13} />
                Опубликовать
              </button>
            )}
            {item.status === "published" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onUnpublish(item)}
                className="tz-btn tz-btn-ghost tz-btn-sm"
              >
                <Unlink size={13} />
                Снять с публикации
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
