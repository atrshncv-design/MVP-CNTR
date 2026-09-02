"use client";

/**
 * Баннер offline (P3, R04).
 * Почему отдельный компонент: показывает состояние сети (offline/online),
 * количество действий в очереди и кнопку повторной синхронизации (retry).
 * Использует `useOfflineQueue` (navigator.onLine + localStorage queue).
 * WCAG: role alert/status + aria-live.
 */

import * as React from "react";
import { WifiOff, Wifi, RefreshCw, X } from "lucide-react";

import { useOfflineQueue } from "./useOfflineQueue";

/* eslint-disable react-hooks/set-state-in-effect -- mounted + dismissed синхронизация внешнего состояния сети/очереди */

export interface OfflineBannerProps {
  className?: string;
  dismissible?: boolean;
}

export function OfflineBanner({ className, dismissible = true }: OfflineBannerProps) {
  const { isOnline, isOffline, queueLength, retry, isSyncing } = useOfflineQueue();
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Сброс dismissed при смене состояния сети/очереди
  React.useEffect(() => {
    if (isOffline || queueLength > 0) setDismissed(false);
  }, [isOffline, queueLength]);

  if (!mounted) return null;
  if (dismissed) return null;
  // Не показываем если онлайн и очередь пуста
  if (isOnline && queueLength === 0) return null;

  // Офлайн — красный/янтарный баннер с предупреждением
  if (isOffline) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="offline-banner"
        data-offline="true"
        className={
          "fixed left-0 right-0 top-0 z-[70] flex items-center justify-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm " +
          (className ?? "")
        }
      >
        <WifiOff size={18} aria-hidden="true" className="shrink-0" />
        <span>
          Нет соединения — вы офлайн. Действия сохраняются в очередь
          {queueLength > 0 ? ` (${queueLength})` : ""} и синхронизируются после восстановления сети.
        </span>
        {queueLength > 0 ? (
          <span className="hidden sm:inline rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold">
            в очереди: {queueLength}
          </span>
        ) : null}
        {dismissible ? (
          <button
            type="button"
            aria-label="Закрыть баннер офлайн"
            onClick={() => setDismissed(true)}
            className="ml-2 rounded p-1 hover:bg-amber-200"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }

  // Онлайн, но есть несинхронизированные действия — показываем баннер синхронизации
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-sync-banner"
      data-offline="false"
      className={
        "fixed left-0 right-0 top-0 z-[70] flex items-center justify-center gap-3 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 shadow-sm " +
        (className ?? "")
      }
    >
      <Wifi size={18} aria-hidden="true" className="shrink-0 text-sky-600" />
      <span>
        Соединение восстановлено. {queueLength > 0 ? `Осталось синхронизировать: ${queueLength}.` : "Все действия синхронизированы."}
      </span>
      {queueLength > 0 ? (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={isSyncing}
          aria-label="Повторить синхронизацию очереди"
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
        >
          <RefreshCw size={14} aria-hidden="true" className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Синхронизация…" : "Синхронизировать"}
        </button>
      ) : null}
      {dismissible ? (
        <button
          type="button"
          aria-label="Закрыть баннер синхронизации"
          onClick={() => setDismissed(true)}
          className="ml-1 rounded p-1 hover:bg-sky-100"
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export default OfflineBanner;
