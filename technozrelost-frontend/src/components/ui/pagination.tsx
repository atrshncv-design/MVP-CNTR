"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./button";

export function Pagination({
  hasMore,
  onLoadMore,
  loading,
}: {
  hasMore: boolean;
  onLoadMore: () => void;
  loading?: boolean;
}) {
  const t = useTranslations("dashboard");
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-6">
      <Button variant="secondary" onClick={onLoadMore} loading={loading} aria-label={t("uiLoadMoreAria")}>
        {t("uiLoadMore")}
      </Button>
    </div>
  );
}

export function PageNav({
  page,
  onPrev,
  onNext,
}: {
  page: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <nav aria-label={t("uiPageNavAria")} className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={page <= 1} aria-label={t("uiPagePrev")}>
        <ChevronLeft size={16} aria-hidden="true" /> {t("uiPageBack")}
      </Button>
      <span className="font-mono text-sm text-tz-muted" aria-live="polite" aria-atomic="true">
        {t("uiPageIndicator", { page })}
      </span>
      <Button variant="ghost" size="sm" onClick={onNext} aria-label={t("uiPageNext")}>
        {t("uiPageNextShort")} <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}
