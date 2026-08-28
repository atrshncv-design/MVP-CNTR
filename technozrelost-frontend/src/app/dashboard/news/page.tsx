"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Newspaper,
  PenSquare,
  Plus,
  RefreshCw,
  Settings2,
} from "lucide-react";
import DashboardNewsCard from "@/components/dashboard/news-card";
import { NEWS_PAGE_SIZE } from "@/lib/news-types";
import type { NewsCard, NewsDetail, NewsStatus } from "@/lib/news-types";
import { getAdminNewsList, publishNews, unpublishNews } from "@/lib/news-admin-api";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";

function isAdmin(roles?: string[]): boolean {
  return !!roles?.some((r) => r === "cntr_admin");
}

function isStaff(roles?: string[]): boolean {
  return (
    !!roles?.some((r) => r === "cntr_admin") ||
    !!roles?.some((r) => r === "cntr_manager")
  );
}

/** Публичная лента (published) через rewrites — без токена. */
async function fetchPublicFeed(): Promise<NewsDetail[]> {
  const params = new URLSearchParams({ page: "1", per_page: "50" });
  const response = await fetch(`${API_URL}/api/v1/news?${params}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ленту (${response.status}).`);
  }
  const feed = (await response.json()) as {
    items: NewsCard[];
  };
  return feed.items.map((card) => toDetail(card));
}

/** NewsCard публичной ленты → NewsDetail (без управления чужими). */
function toDetail(card: NewsCard): NewsDetail {
  return {
    ...card,
    content: "",
    author_id: 0,
    author_name: null,
    status: "published" as NewsStatus,
    scheduled_at: null,
    source: "manual",
    created_automatically: false,
    media: [],
    updated_at: null,
  };
}

/** Сортировка витрины: published_at (иначе created_at) DESC. */
function sortFeed(items: NewsDetail[]): NewsDetail[] {
  return [...items].sort((a, b) => {
    const da = new Date(a.published_at ?? a.created_at ?? 0).getTime();
    const db = new Date(b.published_at ?? b.created_at ?? 0).getTime();
    return db - da;
  });
}

export default function DashboardNewsPage() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const roles = session?.user?.roles;
  const admin = isAdmin(roles);
  const staff = isStaff(roles);

  const [items, setItems] = useState<NewsDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Загрузка ленты: admin — всё через admin-list; менеджер — свои (admin-list)
  // + опубликованное другими (публичная лента); остальные роли — публичная.
  const load = useCallback(async () => {
    if (!token) return;
    try {
      let list: NewsDetail[] = [];
      if (admin) {
        list = await getAdminNewsList(token);
      } else if (staff) {
        const [own, feed] = await Promise.all([
          getAdminNewsList(token),
          fetchPublicFeed(),
        ]);
        const ownIds = new Set(own.map((n) => n.id));
        list = [...own, ...feed.filter((n) => !ownIds.has(n.id))];
      } else {
        list = await fetchPublicFeed();
      }
      setItems(sortFeed(list));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить новости.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, admin, staff]);

  useEffect(() => {
    // setState внутри load выполняется после await — не синхронно с телом
    // эффекта (react-hooks/set-state-in-effect).
    void (async () => {
      await load();
    })();
  }, [load, retryTick]);

  const handlePublish = async (item: NewsDetail) => {
    if (!token) return;
    setBusyId(item.id);
    try {
      const updated = await publishNews(token, item.id);
      setItems((prev) => sortFeed(prev.map((n) => (n.id === item.id ? updated : n))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось опубликовать.");
    } finally {
      setBusyId(null);
    }
  };

  const handleUnpublish = async (item: NewsDetail) => {
    if (!token) return;
    setBusyId(item.id);
    try {
      const updated = await unpublishNews(token, item.id);
      setItems((prev) => sortFeed(prev.map((n) => (n.id === item.id ? updated : n))));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось снять с публикации.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const cards = items.map((item) => (
    <DashboardNewsCard
      key={item.id}
      item={item}
      canManage={admin || (staff && String(item.author_id) === session?.user?.id)}
      busy={busyId === item.id}
      onPublish={(i) => void handlePublish(i)}
      onUnpublish={(i) => void handleUnpublish(i)}
    />
  ));

  return (
    <div data-od-id="dashboard-news">
      {/* Hero (светлый стиль ЛК) */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Публикации платформы</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="tz-page-title">Новости</h1>
          {staff && (
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/news/new" className="tz-btn tz-btn-primary tz-btn-sm">
                <Plus size={14} />
                Создать новость
              </Link>
              <Link href="/dashboard/news/admin" className="tz-btn tz-btn-secondary tz-btn-sm">
                <Settings2 size={14} />
                Консоль
              </Link>
            </div>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Официальные публикации платформы: события ЦНТР УР, конкурсы, проекты
          и обучение. {staff ? "Ваши черновики и запланированные видны только вам." : ""}
        </p>
      </div>

      {/* Загрузка */}
      {loading && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: NEWS_PAGE_SIZE }, (_, i) => (
            <div key={i} className="tz-card overflow-hidden">
              <div className="aspect-[16/9] animate-pulse bg-tz-soft" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-2/5 animate-pulse rounded bg-tz-soft" />
                <div className="h-5 w-4/5 animate-pulse rounded bg-tz-soft" />
                <div className="h-3 w-full animate-pulse rounded bg-tz-soft" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ошибка */}
      {!loading && error && (
        <div className="tz-card tz-empty mt-8">
          <span className="tz-empty-icon">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h2 className="tz-empty-title">Новости не загрузились</h2>
          <p className="tz-empty-text">{error}</p>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="tz-btn tz-btn-secondary"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Повторить
          </button>
        </div>
      )}

      {/* Пустое состояние */}
      {!loading && !error && items.length === 0 && (
        <div className="tz-card tz-empty mt-8">
          <span className="tz-empty-icon">
            <Newspaper size={22} aria-hidden="true" />
          </span>
          <h2 className="tz-empty-title">
            {staff ? "Пока нет новостей" : "Пока нет опубликованных новостей"}
          </h2>
          <p className="tz-empty-text">
            {staff
              ? "Создайте первую новость — черновик появится здесь и в консоли."
              : "Первые публикации появятся после публикации на платформе."}
          </p>
          {staff && (
            <Link href="/dashboard/news/new" className="tz-btn tz-btn-primary">
              <PenSquare size={15} aria-hidden="true" />
              Создать новость
            </Link>
          )}
        </div>
      )}

      {/* Лента */}
      {!loading && !error && items.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards}
        </div>
      )}
    </div>
  );
}
