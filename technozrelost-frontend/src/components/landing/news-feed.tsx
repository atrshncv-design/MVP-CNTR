"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Newspaper, RefreshCw } from "lucide-react";
import NewsCard from "@/components/landing/news-card";
import { NEWS_PAGE_SIZE } from "@/lib/news-types";
import type { NewsCard as NewsCardData, NewsCategory, NewsFeed } from "@/lib/news-types";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";

/** Запрос ленты из браузера: относительный путь уходит на бэкенд через rewrites. */
async function fetchFeedPage(
  page: number,
  category: string,
  tag: string,
): Promise<NewsFeed> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(NEWS_PAGE_SIZE),
  });
  if (category !== "all") params.set("category", category);
  if (tag !== "all") params.set("tag", tag);
  const response = await fetch(`${API_URL}/api/v1/news?${params}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить новости (${response.status}).`);
  }
  return (await response.json()) as NewsFeed;
}

function SkeletonCard() {
  return (
    <div className="tz-card overflow-hidden">
      <div className="aspect-[16/9] animate-pulse bg-tz-soft" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-2/5 animate-pulse rounded bg-tz-soft" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-tz-soft" />
        <div className="h-3 w-full animate-pulse rounded bg-tz-soft" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-tz-soft" />
      </div>
    </div>
  );
}

export default function NewsFeed({
  initialFeed,
  initialError,
  categories,
}: {
  initialFeed: NewsFeed | null;
  initialError: string | null;
  categories: NewsCategory[];
}) {
  const [items, setItems] = useState<NewsCardData[]>(initialFeed?.items ?? []);
  const [total, setTotal] = useState(initialFeed?.total ?? 0);
  const [nextPage, setNextPage] = useState(
    initialFeed && initialFeed.items.length > 0 ? initialFeed.page + 1 : 2,
  );

  const [category, setCategory] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");

  const [loading, setLoading] = useState(initialFeed === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Отменяем устаревшие ответы при смене фильтров / повторном запросе.
  const requestRef = useRef(0);
  // Сервер (RSC) уже отдал первую страницу — не дублируем запрос на монтировании.
  const skipInitialFetchRef = useRef(initialFeed !== null);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    setMoreError(null);
    setItems([]);
    setTotal(0);

    fetchFeedPage(1, category, tag)
      .then((feed) => {
        if (requestRef.current !== requestId) return;
        setItems(feed.items);
        setTotal(feed.total);
        setNextPage(feed.page + 1);
      })
      .catch((err: unknown) => {
        if (requestRef.current !== requestId) return;
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить новости.",
        );
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [category, tag, retryTick]);

  const seenTags = useMemo(() => {
    const bySlug = new Map<string, NewsCardData["tags"][number]>();
    for (const item of items) {
      for (const t of item.tags) {
        if (!bySlug.has(t.slug)) bySlug.set(t.slug, t);
      }
    }
    return [...bySlug.values()];
  }, [items]);

  const handleLoadMore = () => {
    if (loadingMore) return;
    const requestId = requestRef.current;
    setLoadingMore(true);
    setMoreError(null);

    fetchFeedPage(nextPage, category, tag)
      .then((feed) => {
        if (requestRef.current !== requestId) return;
        setItems((prev) => [...prev, ...feed.items]);
        setTotal(feed.total);
        setNextPage(feed.page + 1);
      })
      .catch((err: unknown) => {
        if (requestRef.current !== requestId) return;
        setMoreError(
          err instanceof Error ? err.message : "Не удалось загрузить следующую страницу.",
        );
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoadingMore(false);
      });
  };

  const filtersActive = category !== "all" || tag !== "all";

  return (
    <div className="mt-10">
      {/* ── Фильтры ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-tz-secondary">
            Категория
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setTag("all");
              }}
              className="tz-select w-auto min-w-[200px]"
            >
              <option value="all">Все категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {seenTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-tz-muted">
              Теги
            </span>
            <button
              type="button"
              onClick={() => setTag("all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                tag === "all"
                  ? "border-tz-accent bg-tz-accent-soft text-tz-accent"
                  : "border-tz-border text-tz-secondary hover:border-tz-accent hover:text-tz-accent"
              }`}
            >
              Все
            </button>
            {seenTags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTag(t.slug)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  tag === t.slug
                    ? "border-tz-accent bg-tz-accent-soft text-tz-accent"
                    : "border-tz-border text-tz-secondary hover:border-tz-accent hover:text-tz-accent"
                }`}
              >
                #{t.slug}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Скелетон первой загрузки ── */}
      {loading && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: NEWS_PAGE_SIZE }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Ошибка ── */}
      {!loading && error && (
        <div className="tz-card mt-8 flex flex-col items-center gap-4 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-tz-danger" />
          <div>
            <p className="font-semibold text-tz-fg">Новости не загрузились</p>
            <p className="mt-1 text-sm text-tz-secondary">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="tz-btn tz-btn-secondary"
          >
            <RefreshCw className="h-4 w-4" />
            Повторить
          </button>
        </div>
      )}

      {/* ── Лента ── */}
      {!loading && !error && items.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* ── Честное пустое состояние ── */}
      {!loading && !error && items.length === 0 && (
        <div className="tz-card mt-8 flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tz-accent-soft text-tz-accent">
            <Newspaper size={26} strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-semibold text-tz-fg">
              {filtersActive
                ? "По выбранным фильтрам новостей нет"
                : "Пока нет опубликованных новостей"}
            </p>
            <p className="mt-1 text-sm text-tz-secondary">
              {filtersActive
                ? "Попробуйте сбросить фильтры категории или тега."
                : "Первые публикации появятся здесь после публикации на платформе."}
            </p>
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setTag("all");
              }}
              className="tz-btn tz-btn-secondary"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {/* ── Пагинация «Загрузить ещё» ── */}
      {!loading && !error && items.length > 0 && items.length < total && (
        <div className="mt-10 flex flex-col items-center gap-3">
          {moreError && (
            <p className="text-sm text-tz-danger">{moreError}</p>
          )}
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="tz-btn tz-btn-secondary"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка…
              </>
            ) : (
              "Загрузить ещё"
            )}
          </button>
          <p className="text-xs text-tz-muted">
            Показано {items.length} из {total}
          </p>
        </div>
      )}
    </div>
  );
}
