import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileText,
  Home,
  Image as ImageIcon,
  Newspaper,
  Paperclip,
  User,
} from "lucide-react";
import type { NewsDetail } from "@/lib/news-types";
import { sortNewsMedia } from "@/lib/news-types";
import { formatRuDate, formatRuDateTime } from "@/lib/format-date";

/**
 * Полная публикация (спека §3.7): обложка, заголовок, дата/автор,
 * HTML-контент, галерея, вложения, теги, категория.
 * Серверный компонент: данные уже получены в /news/[id]/page.tsx.
 */
export default function NewsDetailView({ post }: { post: NewsDetail }) {
  const media = sortNewsMedia(post.media);
  const gallery = media.filter((m) => m.kind === "gallery");
  const attachments = media.filter((m) => m.kind === "attachment");

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 md:py-14">
      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-tz-muted">
        <Link href="/" className="flex items-center gap-1 transition-colors hover:text-tz-accent">
          <Home size={14} />
          <span>Главная</span>
        </Link>
        <ChevronRight size={14} />
        <Link href="/news" className="transition-colors hover:text-tz-accent">
          Новости
        </Link>
        <ChevronRight size={14} />
        <span className="line-clamp-1 font-medium text-tz-secondary">
          {post.title}
        </span>
      </nav>

      {/* Мета: категория + дата публикации */}
      <div className="flex flex-wrap items-center gap-3">
        {post.category && (
          <span className="tz-badge tz-badge-accent">{post.category.name}</span>
        )}
        {post.published_at && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-tz-muted">
            <CalendarDays size={13} />
            {formatRuDate(post.published_at)}
          </span>
        )}
      </div>

      <h1 className="tz-page-title mt-4 text-balance">{post.title}</h1>

      {post.author_name && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-tz-secondary">
          <User size={14} className="text-tz-muted" />
          {post.author_name}
        </p>
      )}

      {/* Обложка (placeholder — медиа-маршрут бэкенда не подключён) */}
      <div className="mt-8 flex aspect-[16/7] items-center justify-center overflow-hidden rounded-2xl border border-tz-card-border bg-gradient-to-br from-tz-accent-soft via-tz-surface to-tz-surface-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tz-surface text-tz-accent shadow-tz-card">
          <Newspaper size={30} strokeWidth={1.75} />
        </div>
      </div>

      {/* HTML-контент (санитизирован на backend — спека §3.1) */}
      <article
        className="tz-news-content mt-8"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Галерея */}
      {gallery.length > 0 && (
        <section className="mt-10" aria-label="Галерея">
          <h2 className="tz-section-title">Галерея</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {gallery.map((m) => (
              <div
                key={m.id}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-tz-card-border bg-tz-surface-2 p-4 text-center"
              >
                <ImageIcon size={22} className="text-tz-muted" />
                <span className="line-clamp-2 max-w-full text-xs text-tz-secondary">
                  {m.file_name}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Вложения */}
      {attachments.length > 0 && (
        <section className="mt-10" aria-label="Вложения">
          <h2 className="tz-section-title">Вложения</h2>
          <ul className="tz-card mt-4 divide-y divide-tz-border">
            {attachments.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 px-5 py-3.5"
                title="Скачивание станет доступно после подключения медиа-маршрута бэкенда"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tz-accent-soft text-tz-accent">
                  <Paperclip size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-sm font-medium text-tz-fg">
                    {m.file_name}
                  </span>
                  {m.mime_type && (
                    <span className="mt-0.5 block text-xs text-tz-muted">
                      {m.mime_type}
                    </span>
                  )}
                </span>
                <FileText size={16} className="shrink-0 text-tz-muted" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Теги */}
      {post.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-tz-border pt-6">
          {post.tags.map((t) => (
            <span key={t.id} className="tz-badge tz-badge-neutral">
              #{t.slug}
            </span>
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-tz-border pt-6">
        <Link href="/news" className="tz-btn tz-btn-secondary">
          <ArrowLeft className="h-4 w-4" />
          Ко всем новостям
        </Link>
        {post.updated_at && (
          <span className="text-xs text-tz-muted">
            Обновлено {formatRuDateTime(post.updated_at)}
          </span>
        )}
      </div>
    </div>
  );
}
