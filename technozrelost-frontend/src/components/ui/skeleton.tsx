"use client";

import * as React from "react";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["animate-pulse rounded bg-tz-surface-2", className].filter(Boolean).join(" ")} {...props} />;
}

export function SkeletonCard() {
  return (
    <div className="tz-card p-5">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-4 h-16" />
    </div>
  );
}

export function Loading({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tz-accent border-t-transparent" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
