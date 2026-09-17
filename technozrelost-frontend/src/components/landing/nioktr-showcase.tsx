"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  FlaskConical,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";
import {
  SHOWCASE_DIRECTORY_PAGE_SIZE,
  buildNioktrQuery,
  mergeOffsetPage,
  toNioktrCard,
  type NioktrShowcaseCard,
  type PublicNioktrCard,
} from "@/lib/landing-showcases";

/**
 * Страница НИОКТР из браузера: относительный путь уходит на бэкенд
 * через rewrites. Только параметры бэкенда (limit/offset);
 * поиск — клиентский фильтр ниже. Без Authorization по построению.
 */
async function fetchNioktrPage(offset: number): Promise<PublicNioktrCard[]> {
  const qs = buildNioktrQuery({ limit: SHOWCASE_DIRECTORY_PAGE_SIZE, offset });
  const response = await fetch(`${API_URL}/api/v1/nioktr${qs}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const err = new Error("nioktr-page") as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return (await response.json()) as PublicNioktrCard[];
}

const MAX_KEYWORDS = 5;

function NioktrCard({ card, index }: { card: NioktrShowcaseCard; index: number }) {
  const t = useTranslations("nioktr");
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="tz-card tz-card-hover flex h-full flex-col gap-3 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-tz-soft/70 px-2.5 py-0.5 font-mono text-[11px] font-medium text-tz-muted">
          {card.regNumber}
        </span>
        {card.isAi && (
          <span className="rounded-full bg-tz-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-tz-accent">
            {t("badgeAi")}
          </span>
        )}
        {card.types.slice(0, 2).map((tp) => (
          <span key={tp} className="rounded-full bg-tz-soft/70 px-2.5 py-0.5 text-[11px] text-tz-muted">
            {tp}
          </span>
        ))}
      </div>
      <h3 className="tz-card-title leading-snug">{card.name}</h3>
      {card.annotation && (
        <p className="flex-1 text-[13px] leading-relaxed text-tz-secondary">
          {card.annotation}
        </p>
      )}
      {(card.executor || card.customer) && (
        <div className="flex flex-col gap-1 border-t border-tz-border/60 pt-3 text-[11.5px] text-tz-muted">
          {card.executor && <span>{card.executor}</span>}
          {card.customer && <span>{card.customer}</span>}
        </div>
      )}
      {card.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.keywords.slice(0, MAX_KEYWORDS).map((k) => (
            <span key={k} className="rounded-full bg-tz-surface-2 px-2 py-0.5 text-xs text-tz-secondary">
              {k}
            </span>
          ))}
          {card.keywords.length > MAX_KEYWORDS && (
            <span className="rounded-full bg-tz-accent-soft px-2 py-0.5 text-xs font-medium text-tz-accent">
              +{card.keywords.length - MAX_KEYWORDS}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-tz-border/60 bg-tz-surface p-5">
      <div className="h-5 w-2/5 animate-pulse rounded-full bg-tz-soft" />
      <div className="h-6 w-4/5 animate-pulse rounded bg-tz-soft" />
      <div className="h-3 w-full animate-pulse rounded bg-tz-soft" />
      <div className="h-3 w-3/5 animate-pulse rounded bg-tz-soft" />
    </div>
  );
}

/* ================================================================== */
/*  Витрина НИОКТР на живых данных публичного реестра                 */
/* ================================================================== */

export default function NioktrShowcase({
  initialItems,
  initialError,
  initialStatus = null,
}: {
  initialItems: PublicNioktrCard[];
  initialError: string | null;
  initialStatus?: number | null;
}) {
  const t = useTranslations("nioktr");
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("projectsLanding");
  const [items, setItems] = useState<PublicNioktrCard[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length >= SHOWCASE_DIRECTORY_PAGE_SIZE);
  const [loading, setLoading] = useState(initialError !== null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [errorStatus, setErrorStatus] = useState<number | null>(initialStatus);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [search, setSearch] = useState("");

  const statusOf = (err: unknown): number | null => {
    const status = err instanceof Error ? (err as { status?: number }).status : undefined;
    return typeof status === "number" ? status : null;
  };
  const toLoadError = useCallback(() => t("errorLoad"), [t]);

  // Сервер (RSC) уже отдал первую страницу (offset 0) — курсор продолжает её.
  const offsetRef = useRef<number>(initialItems.length);
  // Не дублируем серверный запрос на монтировании, кроме серверной ошибки:
  // браузер дотянется через rewrites сам.
  const skipInitialFetchRef = useRef(initialError === null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setMoreError(null);

    fetchNioktrPage(0)
      .then((page) => {
        if (requestRef.current !== requestId) return;
        const merged = mergeOffsetPage([], page, 0, SHOWCASE_DIRECTORY_PAGE_SIZE);
        setItems(merged.items);
        offsetRef.current = merged.nextOffset;
        setHasMore(merged.hasMore);
      })
      .catch((err: unknown) => {
        if (requestRef.current !== requestId) return;
        setItems([]);
        offsetRef.current = 0;
        setHasMore(false);
        setError(toLoadError());
        setErrorStatus(statusOf(err));
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [retryTick, toLoadError]);

  const cards = useMemo(() => items.map(toNioktrCard), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((p) => {
      const haystack = [
        p.name,
        p.annotation ?? "",
        p.executor ?? "",
        p.customer ?? "",
        p.regNumber,
        ...p.keywords,
        ...p.types,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [search, cards]);

  const handleLoadMore = () => {
    if (loadingMore || loading || !hasMore) return;
    const requestId = ++requestRef.current;
    const offset = offsetRef.current;
    setLoadingMore(true);
    setMoreError(null);

    fetchNioktrPage(offset)
      .then((page) => {
        if (requestRef.current !== requestId) return;
        // Дедуп и слияние — через общий mergeOffsetPage: курсор считается
        // от сырой страницы, пересечения окон не дублируют карточки.
        setItems((prev) => mergeOffsetPage(prev, page, offset, SHOWCASE_DIRECTORY_PAGE_SIZE).items);
        offsetRef.current = offset + page.length;
        setHasMore(page.length >= SHOWCASE_DIRECTORY_PAGE_SIZE);
      })
      .catch((err: unknown) => {
        if (requestRef.current !== requestId) return;
        setMoreError(toLoadError());
        void statusOf(err);
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoadingMore(false);
      });
  };

  return (
    <div>
      {/* Поиск — клиентский фильтр, бэкенд-поиск не используется для единообразия */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-tz-border/60 bg-tz-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tSearch("searchPlaceholder")}
            aria-label={tCommon("search")}
            className="h-10 w-full rounded-xl border border-tz-border/60 bg-tz-bg pl-9 pr-3 text-sm text-tz-fg outline-none transition-colors placeholder:text-tz-muted focus:border-tz-accent"
          />
        </div>
      </div>

      {/* Скелетон первой загрузки */}
      {loading && items.length === 0 && !error && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SHOWCASE_DIRECTORY_PAGE_SIZE }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Ошибка */}
      {!loading && error && items.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-tz-border/60 bg-tz-surface p-10 text-center">
          <AlertCircle className="h-10 w-10 text-tz-danger" />
          <div>
            <p className="font-semibold text-tz-fg">{error}</p>
            {errorStatus != null && <p className="mt-1 text-sm text-tz-secondary">HTTP {errorStatus}</p>}
          </div>
          <button type="button" onClick={() => setRetryTick((n) => n + 1)} className="tz-btn tz-btn-secondary">
            <RefreshCw className="h-4 w-4" />
            {tCommon("retry")}
          </button>
        </div>
      )}

      {/* Сетка живых карточек */}
      {!loading && !error && filtered.length > 0 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <NioktrCard key={p.id} card={p} index={i} />
          ))}
        </div>
      )}

      {/* Фильтр ничего не дал — подсказка, не выдумка */}
      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-tz-border bg-tz-surface/50 px-6 py-16 text-center">
          <FlaskConical size={32} className="mx-auto text-tz-muted/60" />
          <h3 className="mt-4 text-lg font-semibold text-tz-fg">{t("emptyTitle")}</h3>
          <p className="mt-1.5 text-sm text-tz-muted">{t("emptyDesc")}</p>
        </div>
      )}

      {/* Пустой реестр — честное пустое состояние с призывом к действию */}
      {!loading && !error && items.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-tz-border bg-tz-surface/50 px-6 py-16 text-center">
          <FlaskConical size={32} className="mx-auto text-tz-muted/60" />
          <div>
            <h3 className="text-lg font-semibold text-tz-fg">{t("emptyTitle")}</h3>
            <p className="mx-auto mt-1.5 max-w-xl text-sm text-tz-muted">{t("emptyDesc")}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="tz-btn tz-btn-primary">
              {tSearch("register")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="tz-btn tz-btn-secondary">
              {tSearch("login")}
            </Link>
          </div>
        </div>
      )}

      {/* Пагинация «Показать ещё» */}
      {!loading && !error && items.length > 0 && hasMore && (
        <div className="mt-10 flex flex-col items-center gap-3">
          {moreError && <p className="text-sm text-tz-danger">{moreError}</p>}
          <button type="button" onClick={handleLoadMore} disabled={loadingMore} className="tz-btn tz-btn-secondary">
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tCommon("loading")}
              </>
            ) : (
              tCommon("showMore")
            )}
          </button>
        </div>
      )}
    </div>
  );
}
