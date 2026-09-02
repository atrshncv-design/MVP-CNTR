"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-6">
      <Button variant="secondary" onClick={onLoadMore} loading={loading} aria-label="Загрузить ещё записи">
        Показать ещё
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
  return (
    <nav aria-label="Навигация по страницам" className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={page <= 1} aria-label="Предыдущая страница">
        <ChevronLeft size={16} aria-hidden="true" /> Назад
      </Button>
      <span className="font-mono text-sm text-tz-muted" aria-live="polite" aria-atomic="true">
        Стр. {page}
      </span>
      <Button variant="ghost" size="sm" onClick={onNext} aria-label="Следующая страница">
        Далее <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}
