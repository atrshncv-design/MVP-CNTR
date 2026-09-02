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
      <Button variant="secondary" onClick={onLoadMore} loading={loading}>
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
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={page <= 1}>
        <ChevronLeft size={16} /> Назад
      </Button>
      <span className="font-mono text-sm text-tz-muted">Стр. {page}</span>
      <Button variant="ghost" size="sm" onClick={onNext}>
        Далее <ChevronRight size={16} />
      </Button>
    </div>
  );
}
