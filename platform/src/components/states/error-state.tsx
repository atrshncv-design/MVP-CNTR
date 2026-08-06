/**
 * T-005. Состояние ошибки (STATES.md §3 «Error»): что сломалось, retry без
 * потери ввода пользователя, fallback-маршрут когда возможен.
 *
 * Сохранение ввода: вызывающий код передаёт в `preservedInput` живую область
 * формы/полей (со своим state) — компонент показывает её в отдельном блоке
 * «Ваши данные сохранены», и повторная попытка не стирает введённое.
 */

"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export interface ErrorStateProps {
  /** Что именно не удалось загрузить/выполнить. */
  title?: string;
  /** Объяснение причины и что попробовать. */
  description?: ReactNode;
  /** Обработчик повторной попытки. */
  onRetry?: () => void;
  /** Подпись кнопки повторной попытки. */
  retryLabel?: string;
  /** Fallback-маршрут, когда он возможен. */
  fallbackHref?: string;
  /** Подпись fallback-ссылки. */
  fallbackLabel?: string;
  /**
   * Область с введёнными пользователем данными (форма/поля), которая
   * переживает ошибку. Рендерится под сообщением с подписью «Ваши данные
   * сохранены».
   */
  preservedInput?: ReactNode;
}

export function ErrorState({
  title = "Не удалось загрузить данные",
  description,
  onRetry,
  retryLabel = "Повторить",
  fallbackHref,
  fallbackLabel = "Вернуться назад",
  preservedInput,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-panel border border-status-danger/40 bg-surface p-6"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-status-danger-soft"
          aria-hidden
        >
          <AlertTriangle className="h-5 w-5 text-status-danger" />
        </span>
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold tracking-tight text-primary">
            {title}
          </h3>
          {description ? (
            <div className="mt-2 max-w-2xl text-small leading-relaxed text-secondary">
              {description}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                {retryLabel}
              </button>
            ) : null}
            {fallbackHref ? (
              <a
                href={fallbackHref}
                className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {fallbackLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {preservedInput ? (
        <div className="mt-5 rounded-control border border-subtle bg-canvas/60 p-4">
          <p className="flex items-center gap-2 text-meta font-medium text-muted">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-status-success"
              aria-hidden
            />
            Ваши данные сохранены — повторная попытка не сотрёт введённое
          </p>
          <div className="mt-3">{preservedInput}</div>
        </div>
      ) : null}
    </div>
  );
}
