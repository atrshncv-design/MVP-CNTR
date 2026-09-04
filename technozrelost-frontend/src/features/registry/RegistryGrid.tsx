"use client";

import * as React from "react";
import { AlertCircle, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Empty } from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Единый грид реестра — только карточки (тикет 04, G33, G41.1, G49.1).
 * Состояния: loading → skeleton 6, empty → tz-empty + CTA, error → Retry,
 * forbidden → 403, partial — карточки с «—».
 * Мобилка: grid-cols-1, десктоп: md:grid-cols-2.
 */
export function RegistrySkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tz-card p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-4 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function RegistryGrid<T>({
  items,
  loading,
  error,
  errorStatus,
  onRetry,
  hasMore,
  onLoadMore,
  loadingMore,
  renderCard,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  items: T[];
  loading: boolean;
  error: string | null;
  errorStatus?: number | null;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
  renderCard: (item: T, index: number) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  const t = useTranslations("registry");
  const title = emptyTitle ?? t("emptyDefaultTitle");
  const description = emptyDescription ?? t("emptyDefaultDescription");
  if (loading) {
    return <RegistrySkeleton count={6} />;
  }

  if (error) {
    if (errorStatus === 403) {
      return (
        <div className="tz-card tz-empty">
          <span className="tz-empty-icon">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h2 className="tz-empty-title">{t("forbiddenTitle")}</h2>
          <p className="tz-empty-text">{t("forbiddenDesc")}</p>
        </div>
      );
    }
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <Empty
        icon={<FilePlus2 size={22} aria-hidden="true" />}
        title={title}
        description={description}
        action={
          emptyAction ?? (
            <Link href="/dashboard/gk_customer/projects/new" className="tz-btn tz-btn-primary">
              {t("createRequest")}
            </Link>
          )
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((it, idx) => (
          <div key={(it as unknown as { id: number }).id ?? idx}>{renderCard(it, idx)}</div>
        ))}
      </div>
      {hasMore ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={!!loadingMore}
            className="tz-btn tz-btn-secondary"
          >
            {loadingMore ? t("loadingMore") : t("loadMore")}
          </button>
        </div>
      ) : null}
    </>
  );
}
