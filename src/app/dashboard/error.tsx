"use client";

import { ErrorState } from "@/components/states";

/** Единый error-экран сегмента /dashboard (тикет 01). */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      message={error.message || "Что-то пошло не так. Попробуйте ещё раз."}
      onRetry={reset}
    />
  );
}
