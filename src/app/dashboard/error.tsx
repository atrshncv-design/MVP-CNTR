"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Граница ошибок ЛК (тикет 03 internal-ux-redesign).
 * Честное состояние ошибки с повторной попыткой (reset) — без фейковых
 * «успехов»: показывается только реальная ошибка рендера/загрузки.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Намеренное логирование для диагностики (пользователю не показывается).
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto max-w-xl rounded-2xl border border-tz-border bg-tz-surface p-8 text-center shadow-[var(--tz-shadow-card)]"
    >
      <span
        className="mx-auto grid h-12 w-12 place-items-center rounded-xl text-tz-danger"
        style={{ backgroundColor: "var(--tz-danger-soft)" }}
      >
        <AlertTriangle size={22} aria-hidden />
      </span>
      <h1 className="tz-section-title mt-4">Не удалось загрузить раздел</h1>
      <p className="mt-2 text-sm text-tz-secondary">
        Произошла ошибка при обработке запроса. Попробуйте ещё раз — если
        проблема повторится, обратитесь к менеджеру ЦНТР.
      </p>
      <button type="button" onClick={reset} className="tz-btn tz-btn-primary mt-6">
        <RefreshCw size={16} aria-hidden />
        Повторить
      </button>
    </div>
  );
}
