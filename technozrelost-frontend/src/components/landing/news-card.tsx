import Link from "next/link";
import { CalendarDays, Newspaper } from "lucide-react";
import type { NewsCard as NewsCardData } from "@/lib/news-types";
import { formatRuDate } from "@/lib/format-date";

/**
 * Карточка новости в публичной ленте (спека §3.7).
 * Обложка: бэкенд отдаёт только storage_key без публичного медиа-маршрута,
 * поэтому честно рендерим стилизованный placeholder-блок (тикет 07).
 */
export default function NewsCard({ item }: { item: NewsCardData }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="tz-card tz-card-hover group flex h-full flex-col overflow-hidden"
    >
      {/* Обложка (placeholder — медиа-маршрут бэкенда не подключён) */}
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden border-b border-tz-card-border bg-gradient-to-br from-tz-accent-soft via-tz-surface to-tz-surface-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tz-surface text-tz-accent shadow-tz-card transition-transform duration-300 group-hover:scale-105">
          <Newspaper size={26} strokeWidth={1.75} />
        </div>
        {item.category && (
          <span className="absolute bottom-2.5 left-2.5 tz-badge tz-badge-accent">
            {item.category.name}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-tz-muted">
          {item.published_at && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} />
              {formatRuDate(item.published_at)}
            </span>
          )}
        </div>

        <h3 className="tz-card-title mt-2 line-clamp-2 transition-colors group-hover:text-tz-accent">
          {item.title}
        </h3>

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
      </div>
    </Link>
  );
}
