"use client";

import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Поле ввода с WCAG: label связан по id, ошибка — aria-describedby + aria-invalid + role=alert.
 */
export function Input({ label, error, className, id, ...props }: InputProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);
  return (
    <label className="block" htmlFor={inputId}>
      {label ? <span className="tz-label">{label}</span> : null}
      <input
        id={inputId}
        className={["tz-input", className].filter(Boolean).join(" ")}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        {...props}
      />
      {hasError ? (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-tz-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
