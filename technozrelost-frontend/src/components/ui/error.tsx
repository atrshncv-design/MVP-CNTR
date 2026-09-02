"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="tz-card tz-empty" role="alert" aria-live="assertive">
      <span className="tz-empty-icon" aria-hidden="true">
        <AlertCircle size={22} aria-hidden="true" />
      </span>
      <h2 className="tz-empty-title">Не удалось загрузить</h2>
      <p className="tz-empty-text">{message}</p>
      {onRetry ? (
        <button type="button" className="tz-btn tz-btn-secondary mt-4" onClick={onRetry} aria-label="Повторить загрузку">
          Повторить
        </button>
      ) : null}
    </div>
  );
}

export function InlineError({ message, id }: { message: string; id?: string }) {
  return (
    <p id={id} role="alert" className="text-sm text-tz-danger">
      {message}
    </p>
  );
}
