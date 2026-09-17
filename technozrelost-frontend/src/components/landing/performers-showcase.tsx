"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle,
  Loader2,
  RefreshCw,
  Search,
  User,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";
import {
  SHOWCASE_DIRECTORY_PAGE_SIZE,
  buildSpecialistsQuery,
  mergeKeysetPage,
  toExecutorCard,
  type ExecutorShowcaseCard,
  type PublicExecutor,
} from "@/lib/landing-showcases";

/**
 * Страница специалистов из браузера: относительный путь уходит на бэкенд
 * через rewrites. Только параметры бэкенда (after_id/limit);
 * поиск — клиентский фильтр ниже. Без Authorization по построению.
 */
async function fetchSpecialistsPage(afterId?: number): Promise<PublicExecutor[]> {
  const qs = buildSpecialistsQuery(
    afterId == null
      ? { limit: SHOWCASE_DIRECTORY_PAGE_SIZE }
      : { limit: SHOWCASE_DIRECTORY_PAGE_SIZE, after_id: afterId },
  );
  const response = await fetch(`${API_URL}/api/v1/executors/specialists${qs}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const err = new Error("specialists-page") as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return (await response.json()) as PublicExecutor[];
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

const MAX_COMPETENCIES = 5;

function SpecialistCard({ person, index }: { person: ExecutorShowcaseCard; index: number }) {
  const t = useTranslations("executors");
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="tz-card tz-card-hover flex h-full flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tz-accent/10 text-lg font-bold text-tz-accent">
          {person.name?.[0]?.toUpperCase() ?? "?"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-tz-success-soft px-2.5 py-0.5 text-xs font-medium text-tz-success">
          <User size={12} />
          {t("badgeUser")}
        </span>
      </div>
      <h3 className="tz-card-title mt-4">{person.name || "—"}</h3>
      {person.org && (
        <p className="mt-1 flex items-center gap-1 text-sm text-tz-muted">
          <Building2 size={14} aria-hidden="true" /> {person.org}
        </p>
      )}
      {person.role && <p className="mt-1 text-[12.5px] font-medium text-tz-fg">{person.role}</p>}
      <p className="mt-2 flex items-center gap-1 text-sm text-tz-muted">
        <CheckCircle size={14} className="text-tz-success" aria-hidden="true" />
        {person.completedProjects}{" "}
        {pluralize(person.completedProjects, t("projectOne"), t("projectFew"), t("projectMany"))}
      </p>
      {person.competencies.length > 0 && (
        <div className="mt-3 border-t border-tz-border pt-3">
          <p className="mb-1.5 text-xs text-tz-muted">{t("competencies")}</p>
          <div className="flex flex-wrap gap-1.5">
            {person.competencies.slice(0, MAX_COMPETENCIES).map((c) => (
              <span key={c} className="rounded-full bg-tz-surface-2 px-2 py-0.5 text-xs text-tz-secondary">
                {c}
              </span>
            ))}
            {person.competencies.length > MAX_COMPETENCIES && (
              <span className="rounded-full bg-tz-accent-soft px-2 py-0.5 text-xs font-medium text-tz-accent">
                +{person.competencies.length - MAX_COMPETENCIES}
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-tz-border/60 bg-tz-surface p-5">
      <div className="h-12 w-12 animate-pulse rounded-xl bg-tz-soft" />
      <div className="h-6 w-4/5 animate-pulse rounded bg-tz-soft" />
      <div className="h-3 w-full animate-pulse rounded bg-tz-soft" />
      <div className="h-3 w-3/5 animate-pulse rounded bg-tz-soft" />
    </div>
  );
}

/* ================================================================== */
/*  Витрина специалистов на живых данных публичного каталога          */
/* ================================================================== */

export default function PerformersShowcase({
  initialItems,
  initialError,
  initialStatus = null,
}: {
  initialItems: PublicExecutor[];
  initialError: string | null;
  initialStatus?: number | null;
}) {
  const t = useTranslations("executors");
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("projectsLanding");
  const [items, setItems] = useState<PublicExecutor[]>(initialItems);
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

  const afterIdRef = useRef<number | undefined>(
    initialItems.length > 0 ? initialItems[initialItems.length - 1].id : undefined,
  );
  // Сервер (RSC) уже отдал первую страницу — не дублируем запрос на монтировании,
  // кроме случая серверной ошибки: браузер дотянется через rewrites сам.
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

    fetchSpecialistsPage()
      .then((page) => {
        if (requestRef.current !== requestId) return;
        const merged = mergeKeysetPage([], page, SHOWCASE_DIRECTORY_PAGE_SIZE);
        setItems(merged.items);
        afterIdRef.current = merged.nextAfterId;
        setHasMore(merged.hasMore);
      })
      .catch((err: unknown) => {
        if (requestRef.current !== requestId) return;
        setItems([]);
        afterIdRef.current = undefined;
        setHasMore(false);
        setError(toLoadError());
        setErrorStatus(statusOf(err));
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [retryTick, toLoadError]);

  const cards = useMemo(() => items.map(toExecutorCard), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((p) => {
      const haystack = `${p.name} ${p.org ?? ""} ${p.role ?? ""} ${p.competencies.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [search, cards]);

  const handleLoadMore = () => {
    if (loadingMore || loading || !hasMore) return;
    const requestId = ++requestRef.current;
    setLoadingMore(true);
    setMoreError(null);

    fetchSpecialistsPage(afterIdRef.current)
      .then((page) => {
        if (requestRef.current !== requestId) return;
        // Дедуп и слияние — через общий mergeKeysetPage: граница страниц
        // (полная страница + пустой ответ) закрывает пагинацию без потерь.
        setItems((prev) => mergeKeysetPage(prev, page, SHOWCASE_DIRECTORY_PAGE_SIZE).items);
        if (page.length > 0) afterIdRef.current = page[page.length - 1].id;
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
      {/* Поиск — клиентский фильтр, бэкенд его не понимает */}
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
            <SpecialistCard key={p.id} person={p} index={i} />
          ))}
        </div>
      )}

      {/* Фильтр ничего не дал — подсказка, не выдумка */}
      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-tz-border bg-tz-surface/50 px-6 py-16 text-center">
          <Users size={32} className="mx-auto text-tz-muted/60" />
          <h3 className="mt-4 text-lg font-semibold text-tz-fg">{t("emptyTitle")}</h3>
          <p className="mt-1.5 text-sm text-tz-muted">{t("emptyDesc")}</p>
        </div>
      )}

      {/* Пустой каталог — честное пустое состояние с призывом к действию */}
      {!loading && !error && items.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-tz-border bg-tz-surface/50 px-6 py-16 text-center">
          <Users size={32} className="mx-auto text-tz-muted/60" />
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
