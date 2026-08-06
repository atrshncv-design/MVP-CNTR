"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * T-002. Обработчик ошибок публичной группы (Next 16: retry вместо reset).
 * Header/футер из layout остаются на месте.
 */
export default function PublicError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Логирование в dev-консоль; в проде сюда подключается трекинг ошибок
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-24 md:px-8 md:py-32">
      <div className="max-w-xl">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 items-center justify-center rounded-control bg-status-danger-soft text-status-danger"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h1 className="mt-6 text-h2 font-semibold text-primary">
          Не удалось загрузить страницу
        </h1>
        <p className="mt-3 text-body leading-relaxed text-secondary">
          Что-то пошло не так. Попробуйте ещё раз — если ошибка повторится,
          вернитесь на главную или свяжитесь с Центром.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-sm font-medium text-accent-contrast transition-colors hover:opacity-90"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-control border border-border-strong px-5 text-sm font-medium text-primary transition-colors hover:bg-surface-elevated"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
